#!/usr/bin/env bash
set -Eeuo pipefail

PROBE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="/home/miles/repos/agent-harnesses/kilo-restate"
CONTAINER="kilo-restate-pi-lifecycle"
ADMIN="http://127.0.0.1:9170"
INGRESS="http://127.0.0.1:8180"
CODEX_BIN="/home/miles/repos/runtime/vendors/bin/codex"
TSX="$REPO_ROOT/node_modules/tsx/dist/esm/index.mjs"
RUN_ID="codex-probe-$(date +%s)-$$"
RUN_DIR="$PROBE_DIR/$RUN_ID"
CODEX_HOME="$RUN_DIR/codex-home"
WORKSPACE="$RUN_DIR/workspace"
SERVICE_PORT=19083
SERVICE_LOG="$RUN_DIR/service.log"
REGISTRATION="$RUN_DIR/deployment-registration.json"
DELETION="$RUN_DIR/deployment-deletion.json"
CLEANUP="$RUN_DIR/cleanup.json"
mkdir -m 700 -p "$RUN_DIR"
INITIAL_RUNNING="$(podman inspect -f '{{.State.Running}}' "$CONTAINER")"
if [ "$INITIAL_RUNNING" != "false" ]; then
  printf 'Refusing to alter container state: %s is already running\n' "$CONTAINER" >&2
  exit 2
fi
if [ ! -r "$HOME/.codex/auth.json" ] || [ ! -r "$HOME/.codex/config.toml" ]; then
  printf 'Codex auth/config files are unavailable; no fallback will be attempted\n' >&2
  exit 2
fi

DEPLOYMENT_ID=""
WORKER_PID=""
DELETE_ACCEPTED=false
WORKER_STOPPED=false
CONTAINER_RESTORED=false
TEMP_CODEX_HOME_REMOVED=false

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  local cleanup_failed=0
  if [ -n "$DEPLOYMENT_ID" ]; then
    local delete_status
    delete_status="$(curl -sS -o "$DELETION" -w '%{http_code}' -X DELETE "$ADMIN/deployments/$DEPLOYMENT_ID?force=true" || true)"
    printf '%s\n' "$delete_status" > "$PROBE_DIR/deployment-deletion.status"
    if [ "$delete_status" = "202" ]; then
      DELETE_ACCEPTED=true
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
    if podman stop "$CONTAINER" >/dev/null; then CONTAINER_RESTORED=true; else cleanup_failed=1; fi
  fi
  if [ -d "$CODEX_HOME" ]; then
    rm -rf -- "$CODEX_HOME"
    TEMP_CODEX_HOME_REMOVED=true
  fi
  printf '{"container":"%s","initialRunning":%s,"deploymentId":"%s","deploymentDeleteAccepted":%s,"workerStopped":%s,"containerRestoredStopped":%s,"temporaryCodexHomeRemoved":%s,"exitCode":%d}\n' \
    "$CONTAINER" "$INITIAL_RUNNING" "$DEPLOYMENT_ID" "$DELETE_ACCEPTED" "$WORKER_STOPPED" "$CONTAINER_RESTORED" "$TEMP_CODEX_HOME_REMOVED" "$exit_code" > "$CLEANUP"
  if [ "$exit_code" -eq 0 ] && [ "$cleanup_failed" -ne 0 ]; then exit_code=3; fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

mkdir -m 700 -p "$CODEX_HOME" "$WORKSPACE"
cp "$HOME/.codex/auth.json" "$CODEX_HOME/auth.json"
cp "$HOME/.codex/config.toml" "$CODEX_HOME/config.toml"
chmod 600 "$CODEX_HOME/auth.json" "$CODEX_HOME/config.toml"

podman start "$CONTAINER" >/dev/null
curl --retry 30 --retry-delay 1 --retry-connrefused --max-time 2 -sS -o /dev/null "$ADMIN/"
PROBE_ROOT="$PROBE_DIR" SERVICE_PORT="$SERVICE_PORT" RESTATE_INGRESS="$INGRESS" CODEX_BIN="$CODEX_BIN" \
  node --import "$TSX" "$PROBE_DIR/service.ts" > "$SERVICE_LOG" 2>&1 &
WORKER_PID=$!
curl --http0.9 --retry 30 --retry-delay 1 --retry-connrefused --max-time 2 -sS -o /dev/null "http://127.0.0.1:$SERVICE_PORT/"

register_status="$(curl -sS -o "$REGISTRATION" -w '%{http_code}' -X POST "$ADMIN/deployments" \
  -H 'content-type: application/json' --data "{\"uri\":\"http://host.containers.internal:$SERVICE_PORT\"}")"
printf '%s\n' "$register_status" > "$PROBE_DIR/deployment-registration.status"
if [[ ! "$register_status" =~ ^2 ]]; then
  printf 'Restate deployment failed (HTTP %s)\n' "$register_status" >&2
  exit 1
fi
DEPLOYMENT_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$REGISTRATION")"

cd "$REPO_ROOT"
PROBE_RUN_ID="$RUN_ID" CODEX_HOME="$CODEX_HOME" CODEX_BIN="$CODEX_BIN" \
  RESTATE_INGRESS="$INGRESS" RESTATE_ADMIN="$ADMIN" \
  node --import "$TSX" "$PROBE_DIR/driver.ts"
