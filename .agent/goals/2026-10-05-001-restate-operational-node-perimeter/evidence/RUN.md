# Isolated Restate-only probe

This is a disposable service-behavior test, not an agent adapter. It uses the pinned local Restate image and TypeScript SDK recorded in `baseline.json`.

1. Create an isolated server and persistent local volume:

   ```sh
   podman volume create kilo-restate-perimeter-20261005
   podman run -d --name kilo-restate-perimeter-20261005 \
     -p 19180:8080 -p 19170:9070 \
     -v kilo-restate-perimeter-20261005:/restate-data \
     -e RESTATE_NODE_NAME=perimeter-node \
     docker.restate.dev/restatedev/restate:1.7
   ```

2. From the repository root, start the service with `PERIMETER_EVIDENCE_DIR="$PWD/.agent/goals/2026-10-05-001-restate-operational-node-perimeter/evidence" PERIMETER_SERVICE_PORT=19080 nohup ./node_modules/.bin/tsx .agent/goals/2026-10-05-001-restate-operational-node-perimeter/evidence/perimeter-service.ts serve`. Register `http://host.containers.internal:19080` using `POST http://127.0.0.1:19170/deployments` and `{"uri":"http://host.containers.internal:19080"}`.
3. Run `perimeter-driver.ts wait server-restart`; wait until SQL reports the invocation `suspended`; `podman kill --signal KILL` and `podman start` the Restate container; query status again, then run driver modes `resolve server-restart` and `result server-restart`.
4. Kill the service worker process. Run `perimeter-driver.ts dedupe`; query the three returned IDs while the worker is down; restart the same service endpoint and query until they complete.
5. Run `perimeter-driver.ts gap`; after `effect-committed-before-result` exists and the journal has a pending `Run`, `SIGKILL` the service worker and restart it. Compare `effects.jsonl`, invocation status, and journal before/after replay.
6. Validate saved results with:

   ```sh
   npx tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node \
     .agent/goals/2026-10-05-001-restate-operational-node-perimeter/evidence/perimeter-service.ts \
     .agent/goals/2026-10-05-001-restate-operational-node-perimeter/evidence/perimeter-driver.ts
   python3 .agent/goals/2026-10-05-001-restate-operational-node-perimeter/evidence/validate.py
   ```

The recorded run used a same-node Podman volume. It did not simulate host loss or test a coding-agent runtime. Cleanup removed only the container/volume/processes created for this probe; see `cleanup.json`.
