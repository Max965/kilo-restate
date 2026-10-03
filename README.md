# Restate / Kilo operational-node substrate probe

This is a throwaway, reproducible probe; it is not a Kilo migration. It has its own Git repository at `kilo-restate/`. Restate source is a separate ordinary upstream checkout at `../restate-fork`.

## Run locally

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

Human surfaces: Restate UI `http://localhost:9170/ui/`; admin SQL introspection `POST http://localhost:9170/query`, e.g. `{"query":"SELECT * FROM sys_invocation ORDER BY created_at DESC LIMIT 10"}`. Service logs include invocation IDs and replay events.

The approval effect is a keyed Restate object state update. Arbitrary external `ctx.run` effects still have the documented crash window and require idempotency at the effect boundary.
