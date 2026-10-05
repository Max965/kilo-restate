#!/usr/bin/env bash
set -Eeuo pipefail

PROBE_DIR="$(cd "$(dirname "$0")" && pwd)"
PROBE_ROOT="$PROBE_DIR"
REPO_ROOT="/home/miles/repos/agent-harnesses/kilo-restate"
CONTAINER="kilo-restate-pi-lifecycle"
ADMIN="http://127.0.0.1:9170"
SERVICE_LOG="$PROBE_ROOT/service-$(date +%Y%m%dT%H%M%S).log"
REGISTRATION="$PROBE_ROOT/deployment-registration.json"
DELETION="$PROBE_ROOT/deployment-deletion.json"
CLEANUP="$PROBE_ROOT/cleanup.json"
INITIAL_RUNNING="$(podman inspect -f '{{.State.Running}}' "$CONTAINER")"
if [ "$INITIAL_RUNNING" != "false" ]; then
  printf 'Refusing to alter container state: %s is already running\n' "$CONTAINER" >&2
  exit 2
fi

DEPLOYMENT_ID=""
WORKER_PID=""
DEPLOYMENT_DELETE_ACCEPTED=false
WORKER_STOPPED=false
CONTAINER_RESTORED=false

cleanup() {
  local exit_code=$?
  trap - EXIT
  local cleanup_failed=0
  if [ -n "$DEPLOYMENT_ID" ]; then
    local delete_status
    delete_status="$(curl -sS -o "$DELETION" -w '%{http_code}' -X DELETE "$ADMIN/deployments/$DEPLOYMENT_ID?force=true" || true)"
    if [ "$delete_status" = "202" ]; then
      DEPLOYMENT_DELETE_ACCEPTED=true
    else
      cleanup_failed=1
    fi
  fi
  if [ -n "$WORKER_PID" ]; then
    kill "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
    WORKER_STOPPED=true
  fi
  if [ "$INITIAL_RUNNING" = "false" ]; then
    if podman stop "$CONTAINER" >/dev/null; then
      CONTAINER_RESTORED=true
    else
      cleanup_failed=1
    fi
  fi
  printf '{"container":"%s","initialRunning":%s,"deploymentId":"%s","deploymentDeleteAccepted":%s,"workerStopped":%s,"containerRestoredStopped":%s,"exitCode":%d}\n' \
    "$CONTAINER" "$INITIAL_RUNNING" "$DEPLOYMENT_ID" "$DEPLOYMENT_DELETE_ACCEPTED" "$WORKER_STOPPED" "$CONTAINER_RESTORED" "$exit_code" > "$CLEANUP"
  if [ "$exit_code" -eq 0 ] && [ "$cleanup_failed" -ne 0 ]; then exit_code=3; fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

podman start "$CONTAINER" >/dev/null
curl --retry 30 --retry-delay 1 --retry-connrefused --max-time 2 -sS -o /dev/null "$ADMIN/" 
PROBE_ROOT="$PROBE_ROOT" \
SERVICE_PORT=19082 \
RESTATE_INGRESS="http://127.0.0.1:8180" \
TSX_TSCONFIG_PATH="/home/miles/repos/agent-harnesses/kilo-pi-durable/tsconfig.json" \
node --import "$REPO_ROOT/node_modules/tsx/dist/esm/index.mjs" "$PROBE_DIR/service.ts" > "$SERVICE_LOG" 2>&1 &
WORKER_PID=$!
curl --http0.9 --retry 30 --retry-delay 1 --retry-connrefused --max-time 2 -sS -o /dev/null "http://127.0.0.1:19082/"

status="$(curl -sS -o "$REGISTRATION" -w '%{http_code}' -X POST "$ADMIN/deployments" \
  -H 'content-type: application/json' \
  --data '{"uri":"http://host.containers.internal:19082"}')"
if [[ ! "$status" =~ ^2 ]]; then
  printf 'Restate deployment failed (HTTP %s): ' "$status" >&2
  python3 -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).read_text())' "$REGISTRATION" >&2
  exit 1
fi
DEPLOYMENT_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$REGISTRATION")"
cd "$REPO_ROOT"
PROBE_ROOT="$PROBE_ROOT" \
RESTATE_INGRESS="http://127.0.0.1:8180" \
RESTATE_ADMIN="$ADMIN" \
node --import "$REPO_ROOT/node_modules/tsx/dist/esm/index.mjs" "$PROBE_DIR/driver.ts"
