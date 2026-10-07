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

## Daily Driver V0 (local, externally supervised)

Use the existing Restate container/service above, then register the service:

```sh
curl -X POST http://127.0.0.1:9170/deployments \
  -H 'content-type: application/json' \
  -d '{"uri":"http://host.containers.internal:19083"}'
```

Create `contract.json` (workspace must exist under the service's `KILO_WORKSPACE_ROOT`):

```json
{
  "workspace": "/absolute/safe/workspace",
  "provider": "openai-codex",
  "model": "gpt-6.1-sol",
  "pi": {"agentDir": "/home/miles/repos/runtime/.pi/agent", "thinking": "low"},
  "workContract": {"GOAL": "Your bounded coding task", "WORK": "Task and acceptance requirements"}
}
```

```sh
npm run --silent node:daily -- start contract.json > start.json
OP=$(node -p "JSON.parse(require('fs').readFileSync('start.json','utf8')).operationId")
npm run --silent node:daily -- status "$OP"
npm run --silent node:daily -- steer "$OP" 'Bounded correction'
npm run --silent node:daily -- allow "$OP" TOOL_CALL_ID
# or: deny "$OP" TOOL_CALL_ID
npm run --silent node:daily -- cancel "$OP"
npm run --silent node:daily -- result "$OP"
```

`start` generates identity once; the receipt supplies every subsequent command. `status` includes pending gate tool-call IDs, lifecycle/effect events, session identity and terminal result. The external controller must explicitly allow/deny each pending gate. `result` attaches to the durable workflow and waits for termination. `steer` acknowledges Pi RPC queueing on the current service host, not model consumption; after restart/no active process it returns `not_active`.

Presence of `pi` enables normal Pi resource discovery and user HOME, with optional native `agentDir`, `skills`, `extensions`, and `thinking` passthroughs. No Kilo profile store or credentials in contracts. Kilo's extension loads last; a tool-source ownership check blocks an overridden native tool fail-closed. Only read/write/edit/bash are selected. Trusted extensions can execute host hooks outside tool calls: this is local trusted-profile operation, **not a sandbox**. Arbitrary bash effects and hook side effects are not globally exactly-once.

Terminal transport status and task success are separate: `workReport` is a validated object with GOAL/RESULT/GAP/AGENT WORK/ROOT CAUSE/NEXT PROMPT. Missing/invalid model JSON is explicitly `reportError`, never an inferred ACHIEVED. Existing isolated deterministic callers remain unchanged when `pi` is absent. `npm run test:daily` checks the new contract; `npm run verify:daily` runs the bounded physical real-model/control/cleanup specimen after regression evidence is available.

## Human-facing DEV read demo

No useful coding work: one ordinary Pi read proves the existing gate/effect/settlement path. Requires the existing local Restate container, Node 22+, a reachable user systemd manager, maintained Pi checkout and an already-working native model/profile. Nothing is installed or promoted.

Create a safe disposable workspace and `goal.json`:

```json
{
  "schema": "kilo-demo/v1",
  "goal": "Read probe.txt exactly once and return its marker. Make no changes.",
  "workspace": "/absolute/disposable/workspace",
  "realization": "DEV",
  "pi": {"provider": "openai-codex", "model": "gpt-6.1-sol", "agentDir": "/home/miles/repos/runtime/.pi/agent", "thinking": "low"},
  "policy": "demo-readonly"
}
```

```sh
npm run --silent node:demo -- run goal.json --dev
# Use the generated identity/commands printed in the receipt:
npm run --silent node:demo -- watch OPERATION_ID
npm run --silent node:demo -- result OPERATION_ID
npm run --silent node:demo -- verify OPERATION_ID
npm run --silent node:demo -- cleanup OPERATION_ID
```

The command creates `probe.txt` with a unique marker if absent (or preserves an existing contained regular fixture of at most 4096 bytes), binds DEV source/configuration, starts only the existing stopped container, owns a transient native user service, registers natively, submits once, resolves this operation's gates automatically, prints the structural stream and verifies the fixed typed result against actual effect Run journals. `EFFECT_RESULT` is an intermediate effect result, **not** the full formatted native Pi tool result. Read-only policy denies writes/edits/bash/path escapes and filesystem-policy errors; resolver delivery failure rejects the awakeable. Existing Daily Driver manual gate behavior is unchanged.

At successful return, service/container/deployment intentionally remain inspectable. Receipts and persisted Pi sessions live under `~/.local/state/kilo-restate/dev-demo/<operationId>` (or `KILO_DEMO_HOME`); one local active receipt prevents simultaneous DEV takeovers. Native journal/result visibility is approximately 24h after completion, **not indefinite**. Cleanup verifies unit description/container/deployment identity, removes only the owned unit/deployment and unchanged auto-created fixture, and stops the container only if this launch started it and no new foreign deployments appeared. Prior nonoverlapping deployments are preserved; conflicting node-service registration is refused. No recorded-PID killing. Failed launches also print their explicit cleanup command.

This is trusted local DEV, not a sandbox or a first production execution route: trusted native hooks, direct ingress access, same-host session storage and the externally scoped resolver remain explicit boundaries. `npm run test:demo` runs the focused schema/policy/identity/projection check. No general control surface, supervisor, pub/sub, UI or release mechanism was added.

## First normal headless Factory route V0 (same-host DEV)

Canonical entry, using the existing Daily Driver CLI:

```sh
RESTATE_INGRESS=http://127.0.0.1:8180 npm run --silent node:daily -- factory /absolute/work-package.json
```

The owned native service must admit the target through `KILO_WORKSPACE_ROOT` and explicitly enable `KILO_FACTORY_DEV_POLICY=1`. The route submits and waits for the existing contracted result; no separate runtime or registry. Work-package JSON uses Factory envelope identity `SUBJECT`, `SUBJECT_ROOT`, `GOAL_ID`, positive `ITERATION`, plus `GOAL`, `WORK`, `WORKSPACE`, `AUTHORITY: {policy: "factory-dev-v0", workspace: <same canonical workspace>}`, native `provider`, `model`, optional `pi`.

Canonical subject root/subject/goal/normalized iteration hash to one native workflow key. Workspace, intended work and native configuration fingerprint live only in existing node state; changed input under an already-admitted identity is rejected. Receipt loss/re-submission recovers the same native invocation. Advance the Factory iteration for new work, not to retry a lost receipt. Control semantic selector is `<GOAL_ID>/factory/iteration-<NN>` at the admitted workspace.

Factory DEV gates automatically resolve existing awakeables: existing admitted files read/edit, writes with resolved admitted parent, supported bounded bash at admitted cwd. Outside paths, symlink escape/unresolved targets, unsupported actions and invalid bounds fail closed. Bash retains current DEV shell/network/host authority—it is **not** a production sandbox and command contents are not a universal security parser. Automatic policy does not grant child spawning. Global skill reads outside the workspace are denied; use a suitably scoped native Pi profile.

Contracted success still requires normal actor outcome plus existing valid ACHIEVED WorkReport. Artifact/test claims still require independent deterministic evidence. No production/cross-host/security/promotion claim.

## Kilo Control V0 (same-host, opt-in)

The existing service can expose a private Unix-socket command API and SSE fan-out **inside the same RpcClient owner process**. It does not spawn an observing Pi, broker, registry database or second lifecycle. Enable only on an owned DEV service with `KILO_CONTROL_SOCKET` (absolute, max100 bytes; e.g. a private `/tmp/kilo-control-xxxx/control.sock`) and `KILO_CONTROL_GRANTS` (0600 JSON file). The socket parent must be0700. Grant entries contain `identity`, a random64-hex `token`, explicit `capabilities` and admitted canonical `workspaces`. Capabilities are `VIEW`, `ATTACH`, `INSPECT`, `DEBUG`, `STEER`, `CANCEL`, `LAUNCH`; the endpoint checks every command/subscription and workspace, regardless of CLI behavior. Reader tokens can hold only VIEW/ATTACH.

In the VS Code integrated terminal at the admitted workspace, set `KILO_CONTROL_SOCKET` and a0600 `KILO_CONTROL_TOKEN_FILE`. Invoke the executable directly; it resolves its own loader and preserves your current workspace as cwd. `node run --attach spec.json` submits once and attaches in the same permission-checked request; use `node launch spec.json` for submit-only:

```sh
KILO=/home/miles/repos/agent-harnesses/kilo-restate/bin/kilo
"$KILO" node here
"$KILO" node list --json
"$KILO" node run --attach launch.json
"$KILO" node attach human-demo/worker/alpha
"$KILO" node inspect human-demo/worker/alpha --json
"$KILO" node debug human-demo/worker/alpha provider-request
"$KILO" node steer human-demo/worker/alpha 'Bounded correction'
"$KILO" node cancel human-demo/worker/alpha
```

Attach shows only the latest three persisted messages by default; pass `--history` explicitly to request the bounded full transcript.

`launch.json` contains `address: {workspace, responsibility, role, instance}`, `prompt`, `provider`, `model`, native `pi`, and optional boolean `debug`. Semantic names are short slugs; responsibility/role/instance filters can be partial, but zero/ambiguous matches are explicit errors. IDs remain in JSON/detail output, not necessary for selection. LAUNCH persists the optional address in existing Restate workflow state; discovery queries retained native run rows and status (bounded200-node scan). Older unaddressed callers remain unchanged and are not silently named/adopted.

ATTACH fans out native RPC lifecycle/text/thinking/tools plus minimal native gate/effect annotations. Ctrl-C disconnects only that observer, not Pi. Catch-up reads the native persisted transcript plus Restate state/result, including the actual session-file pointer during a live attempt. No semantic delta journal or memory tail was added: the physical disconnect/reconnect restored completed text/tool proposals from Pi. Full in-flight token replay is not promised. Slow observers exceeding1MiB queued output are disconnected; native catch-up remains available.

DEBUG requires its own permission and opt-in at LAUNCH. A tiny native Pi observer uses documented UI-notify RPC events for **counts, field names and SHA256 only**, never headers/tokens/prompt/context bodies. The owner validates this projection and excludes debug events from ATTACH. Model/provider SDK/core are untouched. `npm run test:control` checks permissions, zero/ambiguity and terminal projection.

This is a DEV capability boundary, not an OS sandbox: same-UID filesystem access and existing unsigned Restate ingress are outside it. Raw ingress must be fenced separately before untrusted-user/production use. Grants are immutable until service restart; history discovery is limited by native run retention and the explicit200-node cap. No remote auth/multitenancy/release mechanism, VS Code extension, Herdr, Langfuse or DAP.

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
