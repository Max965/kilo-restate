# Restate / Kilo operational node and substrate probe

This repository retains earlier Restate substrate probes and now contains the Kilo-owned `operational-node/` vertical slice. It is production-shaped acceptance work, not a production deployment or security boundary. Restate source is a separate upstream checkout at `../restate-fork`; maintained Pi is a separate checkout at `../kilo-pi-durable`. Neither is modified here.

## Retained operational node

Prereqs: Podman, Node 22+, npm, and the maintained Pi checkout. The deterministic verifier uses Pi Faux; it needs no model credentials. Restate ingress/admin use host ports 8180/9170.

The one-command acceptance run starts a stopped existing `kilo-restate-pi-lifecycle` container, registers the Kilo service, runs all 32 A01–G04 checks in disposable workspaces, writes per-run evidence, removes its deployment, and restores the container's original started/stopped state. It does not create the container. Create it once if absent:

```sh
podman run -d --name kilo-restate-pi-lifecycle \
  -p 8180:8080 -p 9170:9070 \
  docker.restate.dev/restatedev/restate:1.7
```

Then run:

```sh
npm run verify:operational-node
```

For interactive service development, ensure Restate is running (`podman start kilo-restate-pi-lifecycle` if stopped), create a bounded workspace root, then start the service:

```sh
mkdir -p workspaces
KILO_WORKSPACE_ROOT="$PWD/workspaces" \
KILO_PI_SOURCE="/home/miles/repos/agent-harnesses/kilo-pi-durable" \
npm run operational-node
```

The Kilo service listens on port 19083 by default; Pi RPC children are spawned per operation. Keep workspace paths under `KILO_WORKSPACE_ROOT`. `npm run test:operational-node` runs the contract self-check; `npm run typecheck:operational-node` checks the retained module.

## Historical substrate probe

Prereqs: Podman, Node 22+, npm, Pi + an authenticated model (the recorded run used `openai-codex/gpt-6-luna`). Host port 8080 is occupied by Bifrost here, so the commands map Restate ingress/admin to 8180/9170.

```sh
npm ci
podman run -d --name kilo-restate-server \
  -p 8180:8080 -p 9170:9070 \
  docker.restate.dev/restatedev/restate:1.7
mkdir -p evidence workspace
printf 'initial content\n' > workspace/sample.txt
WORKSPACE="$PWD/workspace" npm run service
```

In another terminal, register the local handler with Restate:

```sh
curl -X POST http://localhost:9170/deployments \
  -H 'content-type: application/json' \
  -d '{"uri":"http://host.containers.internal:9080"}'
```

Then exercise tool calls and dynamic A → B:

```sh
RESTATE_INGRESS=http://localhost:8180 WORKSPACE="$PWD/workspace" npm run typecheck
RESTATE_INGRESS=http://localhost:8180 WORKSPACE="$PWD/workspace" npm test
```

The Pi extension deliberately keeps the names `read`, `edit`, and `bash`; disable Pi's local built-ins so these names resolve to the Restate adapter instead:

```sh
RESTATE_INGRESS=http://localhost:8180 \
KILO_NODE=pi-probe KILO_ACTOR=actor-01 KILO_ATTEMPT=1 \
PI_SESSION_ID=pi-probe-session-01 \
pi --provider openai-codex --model gpt-6-luna \
  --no-builtin-tools --no-session --no-extensions \
  --extension ./probe/pi-extension.ts \
  -p 'Call read on sample.txt. Then edit it, then use bash to print hello.'
```

Approval uses Restate's durable awakeable. In one terminal `RESTATE_INGRESS=http://localhost:8180 npx tsx probe/start-approval.ts`; inspect `evidence/approval-ticket.json`, then accept with `RESTATE_INGRESS=http://localhost:8180 npx tsx probe/approve.ts` (or deny with `probe/deny.ts`). `approve.ts` and `deny.ts` are deliberately external approval actors, not a policy engine.

Human surfaces: Restate UI `http://localhost:9170/ui/`; admin SQL introspection `POST http://localhost:9170/query`. SQL defaults to Arrow IPC; request JSON explicitly with `-H 'accept: application/json'`, e.g.:

```sh
curl -sS -X POST http://localhost:9170/query \
  -H 'content-type: application/json' -H 'accept: application/json' \
  -d '{"query":"SELECT * FROM sys_invocation ORDER BY created_at DESC LIMIT 10"}'
```

Service logs include invocation IDs and replay events.

The approval effect is a keyed Restate object state update. Arbitrary external `ctx.run` effects still have the documented crash window and require idempotency at the effect boundary.

## Pi session lifecycle follow-up (turn 002)

Recorded state, SQL snapshots, filtered Pi transcripts, hashes and the direct-Pi comparison are under `evidence/turn-002/`; `REPORT.md` explains the boundary and limitations. This reuses the existing service/extension. Pi's file-backed session is stored by Pi on the host; Restate does not launch or own the process.

For a fresh rerun, create two separate workspaces with identical initial files:

```sh
for name in workspace-restated workspace-direct; do
  mkdir -p "evidence/turn-002/$name"
  printf '// implementation goes here\n' > "evidence/turn-002/$name/route.js"
  printf '%s\n' \
    'Implement `classifyIncident(code)` in `route.js`.' '' \
    'Rules:' \
    '- Exact input `amber` maps to `queue-amber-r7`.' \
    '- Every other string maps to `queue-default`.' \
    '- Matching is case-sensitive.' '' \
    'This is stage one: learn and report the exact mapping and case rule. Do not edit the source yet.' \
    > "evidence/turn-002/$name/TASK.md"
done
```

For this follow-up, stop any earlier sample worker, then start the worker with `WORKSPACE` set to the lifecycle fixture (rather than the earlier `workspace/` sample); register/update the deployment as in the setup above:

```sh
WORKSPACE="$PWD/evidence/turn-002/workspace-restated" npm run service
```

Start Pi in RPC mode from `workspace-restated` with the existing extension (type the following environment and command in a terminal; send each JSON line to its stdin after startup):

```sh
cd evidence/turn-002/workspace-restated
SESSION="$(uuidgen)"
RESTATE_INGRESS=http://localhost:8180 KILO_NODE=pi-lifecycle-node \
KILO_ACTOR=actor-01 KILO_ATTEMPT=1 PI_SESSION_ID="$SESSION" \
pi --mode rpc --session-id "$SESSION" --provider openai-codex --model gpt-6-luna \
  --no-builtin-tools --no-extensions --extension "$PWD/../../../probe/pi-extension.ts"
```

Send stage one:

```json
{"type":"prompt","message":"Read TASK.md with the read tool. Return the exact mapping for amber and all other strings and state whether the comparison is case-sensitive. Do not edit route.js yet."}
```

After the response settles, record the task hash and remove the brief. For a strict rerun, save the Pi PID and explicitly kill it before relaunching; the recorded run confirmed the original PID was gone after its interactive-shell session was user-taken-over/output-transferred, but did not capture the exit signal.

```sh
sha256sum TASK.md
rm TASK.md
# In a second shell, replace 12345 with Pi's PID:
kill -KILL 12345
ps -p 12345  # should return no process row
```

Relaunch the same command with the same `SESSION`, workspace and node/actor, changing only `KILO_ATTEMPT=2`. Then send the second stage:

```json
{"type":"prompt","message":"Continue the task from stage one in this same session. Implement the routing rule from TASK.md in route.js using the exact amber destination and default destination you reported in your previous answer; preserve the case-sensitive match. TASK.md has been removed from the workspace, so do not try to read or recover it. Use the edit tool to replace the exact marker `// implementation goes here` with the implementation. Then use bash to run a Node assertion for `classifyIncident(\"amber\")` against the exact destination from your prior answer and `classifyIncident(\"AMBER\")` against the prior fallback. Report the code and verification result."}
```

For the direct baseline, reset `workspace-direct/TASK.md` and `route.js`, then use a separate Pi process/session from that directory; omit `--no-builtin-tools` to keep Pi's built-ins active and omit the custom extension:

```sh
cd ../workspace-direct
DIRECT_SESSION="$(uuidgen)"
pi --mode rpc --session-id "$DIRECT_SESSION" --provider openai-codex --model gpt-6-luna --no-extensions
```

Submit the same two prompt strings and remove `TASK.md` between them. Query `sys_invocation`/`sys_journal` before and after using the JSON `Accept` header above; capture `/ui/` separately if desired.
