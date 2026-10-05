# Restate ↔ Codex App Server control/tax probe

**OUTCOME:** `RESIDUAL FRONTIER` — useful protocol coverage is source-backed, but physical control and reconnect were not established. No production adapter was implemented.

**CLAIM:** Installed Codex App Server exposes the right *shapes* for a direct inner-runtime adapter: threads, turns, item events, built-in approval requests, interrupt, resume/read, and client requests. The App Server command is explicitly **experimental**. A real turn could not reach the configured Responses websocket (HTTP 426); no Restate gate/effect occurred. A separate no-turn persistent-thread start succeeded, but the resume phase yielded no persisted result. This is not evidence that Codex lacks the boundary; it is not a physical pass.

## CODEX PERIMETER

```text
Restate — authoritative outer key, journal, retries, gates/effects, settlement
    ⇅ Kilo Codex driver — identity/control/event translation; effect reconciliation
Codex App Server — stdio JSON-RPC, experimental
    ⇅ thread / turn / item / approval protocol
Codex harness — provider, transcript, tools, workspace, inner semantics
```

No plugin or Restate-core change is indicated by the default protocol types. Do not make a production decision from this probe: no SDK wrapper was found locally, and the supported App Server itself is experimental.

## IMPEDANCE TABLE

| Required property | Codex native surface | Kilo translation required | Stability | Tax |
|---|---|---|---|---|
| Stable start | `thread/start`, `turn/start`; stable Restate admission remains separate | Submit one outer run, then map Restate run key to a Codex thread/turn | EXPERIMENTAL | SHAPE_ADAPTER |
| Persistent runtime identity | Non-ephemeral UUIDv7 `threadId`; `sessionId` | Persist thread/run mapping and durable `CODEX_HOME` placement | EXPERIMENTAL | STATE_ADAPTER |
| Attach/resume | `thread/resume`, `thread/read` | Reconnect process and bind resumed thread to the same outer invocation | EXPERIMENTAL | STATE_ADAPTER |
| Current status | Thread/turn status plus status-change notifications | Project Codex status without replacing Restate invocation status | EXPERIMENTAL | SHAPE_ADAPTER |
| Turn start | `turn/start` with typed input | Map Kilo operation input and persist returned turn ID | EXPERIMENTAL | SHAPE_ADAPTER |
| Structured events | Thread/turn/item started/completed and `turn/completed` | Correlate by thread, turn, item and JSON-RPC request IDs; do not mirror token deltas | EXPERIMENTAL | SHAPE_ADAPTER |
| Pre-effect approval/control | `item/commandExecution/requestApproval`, file-change and permission requests; legacy `execCommandApproval`/`applyPatchApproval`; response decision includes `decline` | Route each supported request through a Restate awakeable/gate; return deny/error before execution | EXPERIMENTAL | LIFECYCLE_ADAPTER |
| Client-owned tool/effect | `item/tool/call`; `ThreadStartParams.dynamicTools` is in the experimental schema | Define bounded client tool calls and journal their Restate-owned effect/result | EXPERIMENTAL; dynamic registration is experimental-only | STATE_ADAPTER |
| Interrupt/cancel | `turn/interrupt` by thread/turn identity | Map Restate cancellation to interrupt/process termination and reconcile late results | EXPERIMENTAL | LIFECYCLE_ADAPTER |
| Semantic settlement | `turn/completed` carries terminal turn status/items | Translate terminal Codex result/failure to outer Restate output only after settlement | EXPERIMENTAL | LIFECYCLE_ADAPTER |
| Restart/reconnect | `thread/resume` / `thread/read` in the same Codex home | Store Codex home durably and reconcile the active outer operation | EXPERIMENTAL | STATE_ADAPTER |
| Child/subagent identity | `Thread.parentThreadId`, `forkedFromId`, shared `sessionId` fields | Map Codex ancestry to explicit Restate child operations; do not infer a causal Restate edge | EXPERIMENTAL | LIFECYCLE_ADAPTER |

`DIRECT` is available for unchanged inner-runtime behavior once the protocol is called; every Restate-facing identity/control mapping above still belongs to Kilo. The thread `path` field is marked `[UNSTABLE]`; do not use it as the persistence contract. The opaque storage format is **INTERNAL / not inspected**.

## STABLE VS EXPERIMENTAL

- **No stable App Server guarantee identified.** Installed `codex app-server --help` labels App Server experimental, although the thread/turn/event/approval declarations are in its default generated TypeScript schema.
- `thread/start`, `thread/resume`, `thread/read`, `turn/start`, `turn/interrupt`, lifecycle notifications and approval request/response types: **EXPERIMENTAL** as App Server APIs.
- Client-owned/dynamic tools: **EXPERIMENTAL**, with `dynamicTools` present only in the `--experimental` schema.
- Thread storage implementation/path: **INTERNAL / UNSTABLE**; only IDs and protocol behavior are suitable adapter inputs.
- Runtime pinned to `@openai/codex@0.154.0`; no source revision was available in the installed package metadata. Runtime identity and exact snapshots are in `evidence/codex-protocol/`.

## PHYSICAL RESULT

1. The disposable Restate deployment registered (HTTP 201) and the outer workflow started as `inv_1hW6JH2fDpRR1yFHnU3YKhxRjW0FXV2jo6`.
2. Codex App Server initialized, started a non-ephemeral thread, and accepted one `turn/start`. Its stderr recorded `codex_api::endpoint::responses_websocket` failing against the currently configured local endpoint `ws://127.0.0.1:17841/v1/responses` with `HTTP 426 Upgrade Required`. Codex configuration contents were not read or changed; no alternate route was tried.
3. The driver reached `turn/completed`, then failed its own assertion because no supported command-approval callback had populated its result. It did not persist the terminal status. The default request union includes legacy approval methods too, and this harness did not log unknown request methods, so the exact request path is indeterminate.
4. No Restate gate ticket was created, no decision was delivered, no marker/effect appeared, and the outer invocation did not settle. This is **not** a successful deny-before-effect specimen.
5. Cleanup recorded deployment deletion acceptance HTTP 202, stopped the service worker, restored the existing Restate container to `exited`, removed the private temporary `CODEX_HOME`, and left no Codex process.
6. A no-turn identity specimen successfully created a thread with `ephemeral:false`, UUIDv7 thread/session ID `01a10c79-aca0-7053-9554-812d685be5d8`, and status `idle`. A second App Server process initialized. The driver then entered phase `thread-resume` immediately before calling `client.request("thread/resume", {threadId})`; it failed before recording `thread-resume-returned`, `resumed.json`, or `persistent-thread.json`. The saved error has no RPC code/message, so evidence locates the boundary after initialize and at/before completion of resume response parsing, but does not show whether Codex received/rejected the request or local response handling failed. No `turn/start` or model request was made in this specimen; temporary auth state was removed.

Consequently, approval-before-effect, a successful turn result, turn-status projection, same-thread resume, interrupt/cancel, and exact effect reconciliation remain **unproven**. Do not infer exactly-once effects or cross-host recovery.

## RESTATE DEBUG VIEW

Restate naturally shows the outer invocation/key, journaled activities, durable gate/awakeable and effect invocations, retries, and terminal workflow status/output. It will not automatically show Codex's thread/turn/item tree. Kilo should add a small correlated projection for `RUN_STARTED`, `TURN_STARTED`, `TOOL_REQUESTED`, `TOOL_DECIDED`, `TOOL_SETTLED`, `TURN_SETTLED`, `RUN_SETTLED`, and failure/interruption, carrying the outer invocation plus thread/turn/item/request IDs. Keep Restate's journal authoritative; optional OpenTelemetry/specialist AI tracing may carry richer diagnostics. Do not mirror token streams or every internal event.

## KILO-OWNED CODE / OWNERSHIP

Restate keeps outer operation identity, admission, journal/retry, policy decision, effect/child operation ownership, and settlement. Codex keeps its provider/model loop, transcript, native thread/turn/item semantics, and agent settlement. The irreducible Kilo driver is process/stdio JSON-RPC lifecycle, run↔thread↔turn mapping, handling the full approval/request union, durable gate/result translation, compact event correlation, and effect idempotency/reconciliation. A Codex-specific driver beside a generic Restate operational-node service and Pi driver is structurally reasonable; this probe did not implement that layout. No plugin is justified by the source declarations alone.

## ADAPTER CLASS / FUTURE TAX

**Provisional class:** `DIRECT_APP_SERVER_ADAPTER` (source-surface classification only; physical qualification blocked). Default protocol types include lifecycle, approval, and event surfaces, so a plugin or Codex harness reimplementation is not indicated. **Future tax:** `LOW-MEDIUM`, provisionally: mostly process/identity/decision/event mapping, elevated by experimental API stability and the need to make Codex-home recovery and side-effect reconciliation explicit. The 426 endpoint failure and failed empty-thread resume prevent a production readiness claim or a definitive tax measurement.

## MATERIAL RISKS / NEXT BOUNDARY

- App Server protocol is experimental and may change; dynamic tools are experimental-only.
- Current configured Responses websocket rejects the attempted connection with HTTP 426. Repairing or switching that route requires the user; no automatic fallback is safe.
- The driver must record every incoming server-request method and bounded response code before another control specimen; otherwise legacy approval paths are indistinguishable from no approval.
- Same-host persistent-thread resume, outer retry/reconnect, cancellation, child lineage, and effect reconciliation remain unproven.

**Next action requiring user:** repair/authorize a specific Codex endpoint/configuration before any second model turn. No provider, egress, global Codex state, Pi source, Restate source, or production adapter was changed.

## EVIDENCE POINTERS

- Installed identity/help and hash-pinned selected protocol: [`evidence/codex-protocol/`](../../evidence/codex-protocol/), `SHA256SUMS`.
- One attempted Restate/Codex turn, 426 response, outer failure and cleanup: [`evidence/physical-probe/codex-probe-1791209239-713327/`](../../evidence/physical-probe/codex-probe-1791209239-713327/).
- No-turn thread start/resume failure and cleanup: [`evidence/physical-probe/thread-identity-1791210661647-c0f0aba6/`](../../evidence/physical-probe/thread-identity-1791210661647-c0f0aba6/).
- Aggregate measured facts: [`evidence/physical-probe/final-state.json`](../../evidence/physical-probe/final-state.json); preflight: [`evidence/physical-probe/preflight.txt`](../../evidence/physical-probe/preflight.txt).
- Target-success validator and expected-RED fixture: [`evidence/validate.py`](../../evidence/validate.py), [`evidence/red-empty.json`](../../evidence/red-empty.json). Strict TypeScript and shell checks are recorded in the semantic trace.
- Full decisions/timing: [`iterations/01/actors/orchestrator-01/turns/001/SEMANTIC_TRACE.md`](actors/orchestrator-01/turns/001/SEMANTIC_TRACE.md).

**CHANGED:** goal-local probe/evidence/report files only. No Kilo Restate, Pi, Restate server, Codex installation, user config or egress changes. No dependencies added.

**FACTORY FEEDBACK / BLAME:** Provider/environment friction: configured local Responses websocket returned 426 and needs user direction. Harness friction: approval dispatch was too narrow and failed to persist unknown method/turn status; a future authorized turn needs bounded method/code logging. No other specification gap was filled by inference.
