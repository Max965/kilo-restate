# Restate operational-node perimeter

**Result:** Restate is a durable invocation/workflow substrate around user-owned service code. It owns the outer invocation lifecycle and its durable journal; it does not thereby own a coding-agent process, session, workspace, model loop, or tool semantics.

**Architecture classification for the full requested profile:** `DEEP_ADAPTER`, with **no Restate core surgery indicated**. This is a perimeter classification, not a recommendation to adopt or migrate. A thin service wrapper is possible only if the selected agent runtime already supplies the contract listed below. No candidate coding-agent runtime was inspected, as required.

## Evidence grades

- **[P] Physical:** observed in the isolated, non-agent Restate probe for this goal.
- **[R] Reused:** existing Restate-only repository evidence reused without re-investigating the agent-runtime portions of earlier work.
- **[S] Source:** Restate server source at `v1.7.13`, matching the physical server image revision, or the installed TypeScript SDK 1.17.2 API/docs.
- **[I] Inference:** architecture conclusion from those boundaries.
- **[U] Unknown:** requires a separately scoped test of a selected agent runtime or production configuration.

The Restate source checkout is at a newer 1.8 RC head, and several lifecycle files differ from the tested server. Lifecycle source claims below therefore point to the `v1.7.13` tag, whose commit exactly matches the image label. Environment/version details are in `evidence/baseline.json`.

## 1. Perimeter map

| Boundary | Restate owns | Outside Restate / evidence |
|---|---|---|
| **Ingress and identity** | Accepts service, virtual-object, and workflow invocations; allocates invocation IDs; optionally derives stable IDs from a workflow key or idempotency key. **[S/P]** | The caller must choose and retain the logical run key and send the same idempotency key on ambiguous retries. A normal unkeyed service send gets a new invocation ID each time. **[S/P]** |
| **Outer execution** | Durable invocation status, input, journaled commands, Restate state for supported object/workflow handlers, timers/awakeables, retry/replay, durable Restate-to-Restate calls, completion/result, and retention. **[S]** | The service handler is user code running in a separately deployed worker process. Restate replays that handler against its journal; it does not preserve the worker's stack or arbitrary process memory. **[S/P]** |
| **Agent runtime** | Nothing agent-specific by default. It can invoke a service that contains or calls an agent. **[I]** | Model/context management, planning loop, agent run/session identity, transcript or checkpoint, workspace, tool implementations, process tree, provider/tool credentials, and semantic turn settlement must be supplied by that service/runtime. **[I/U]** |
| **Visibility** | Invocation status and parent/call metadata, plus the commands and results the handler actually records in its Restate journal; SQL introspection is available through the Admin API. **[S/P/R]** | Internal model/tool events are not inferred from arbitrary handler code. They must be surfaced as structured events or durable commands by the agent/runtime integration. **[I]** |
| **Physical durability** | Restate-managed invocation/journal/state data in its configured storage and log setup. The tested single node used `/restate-data` on a persistent Podman volume. **[S/P]** | Host-loss, volume-loss, backup/restore, multi-node failover, and external agent-session portability depend on other storage/runtime mechanisms and were not tested. **[U]** |

Restate is not the process supervisor for an arbitrary child process. If a service spawns an external runtime, the adapter must own or integrate with that runtime's start/attach/stop/reconcile protocol. **[I]**

## 2. Ports and hooks

| Port or hook | Direction and role | What it provides | What it does not provide |
|---|---|---|---|
| **Ingress HTTP** — server container port `8080`; mapped to host `19180` in this probe. **[P]** | Caller → Restate | `serviceClient` for call-and-wait; `serviceSendClient` for asynchronous submission; workflow/object clients. A keyed retry can return the same invocation ID and `PreviouslyAccepted`. **[S/P]** | Does not mean the handler has started or completed. The probe received `Accepted` while the worker was dead and the invocation was backing off. **[P]** |
| **Admin HTTP** — server container port `9070`; mapped to host `19170` in this probe. **[P]** | Operator/controller → Restate | Deployment registration; SQL query at `POST /query`; invocation cancel/kill/pause/resume and purge operations. **[S/P]** | It is not an agent-specific status/control API; it cannot reach into an uninstrumented agent loop or terminate an unrelated process by itself. **[I]** |
| **User service endpoint** — HTTP/2 bidirectional service protocol; SDK default port `9080`, probe used `19080`. **[S/P]** | Restate → deployed user-owned service | Discovery and invocation of declared handlers. This is the code boundary at which an embedded agent or an external-agent client would be integrated. **[S/I]** | The endpoint protocol carries handler invocations, not a built-in coding-agent event/control protocol. **[S/I]** |
| **Durable context API** — in handler code | Service → Restate | `ctx.run` for a named external action/result; object/workflow state; `ctx.serviceClient`/`objectClient`/`workflowClient`; `ctx.sleep`; `ctx.awakeable` and external resolution. **[S]** | `ctx.run` does not make an external effect atomic, and one opaque long-running agent call does not expose its inner steps. **[S/P/I]** |
| **Agent event/control API** — runtime-specific | Agent/runtime ↔ adapter | Must carry events and control requests if the integration needs turn/tool/model visibility, approval, cancellation, checkpointing, or reattachment. It can be connected using reliable Restate calls/sends or awakeable resolution. **[I]** | Restate defines no standard coding-agent event schema, session restore API, tool hook, or process contract. **[I/U]** |

Internal cluster/fabric ports are deployment-specific and are not the app-to-agent join; they were not expanded or changed in this probe.

## 3. Outer control

- **Start and identity.** A workflow run is keyed by workflow name/key; a regular service or virtual-object invocation can use `idempotencyKey`. In the matching source, the invocation ID is deterministic from the target and key when supplied, otherwise it is random. **[S]** The physical test sent the same keyed request twice: both returned `inv_18hfPRtWMUvW4fjXkZZPwIVvkqEoUnykA1`, with `Accepted` then `PreviouslyAccepted`. Two unkeyed sends returned different IDs. **[P]**
- **Acceptance is not execution.** The server's send path returns after the invocation submission is applied, not after the handler finishes. **[S]** With the service worker stopped, three distinct accepted invocations were visible as `backing-off`; after the worker returned, all three completed. **[P]** This distinguishes caller acknowledgment, durable admission, handler start, and settlement.
- **Wait, reconnect, and result.** A caller can wait on a synchronous call, attach/get an asynchronous result where supported, or query `sys_invocation` via the Admin SQL endpoint. Workflow clients expose submit/attach/output operations. **[S]** The probe obtained a send handle, restarted the server, resolved its persisted awakeable, and retrieved `{"resolution":"RESUME"}`. **[P]**
- **Retries and replay.** Restate retries failed handler attempts according to configured policy and replays recorded journal results. The invocation ID remains the outer identity for that invocation. **[S/P]** Retention is configurable; this probe's deployment reported one-day idempotency and journal retention. Do not treat a key as eternal deduplication after configured retention/purge. **[S/P]**
- **Pause/stop.** Admin supports graceful cancel, forceful kill, pause, and resume. Graceful cancel records termination while preserving progress; the source explicitly warns that kill does not guarantee consistency for virtual-object state, in-flight calls, or side effects. Resume covers paused/suspended invocations and retry backoff. **[S]** These admin operations were source-reviewed, not individually exercised in this probe. **[U]** A user-space agent's own safe-point interrupt must still be wired by its adapter. **[I]**

## 4. Inner control

Restate can durably wait for a decision (`ctx.awakeable`), delay (`ctx.sleep`), and call other Restate handlers. An adapter can therefore make an approval or child invocation part of the outer journal. **[S/P/R]** The earlier `evidence/approval-live-send.json` and `evidence/approval-live-settled.json` are reused as approval-cycle evidence.

That is not equivalent to controlling the interior of a coding agent. If the handler invokes one opaque `runAgent()` call, Restate sees the outer action and its eventual result. It cannot synthesize model-turn, tool-call, approval, or workspace events that the runtime never emits. **[I]** A tool gate has to sit at the agent's actual pre-tool boundary: the runtime asks for approval, the adapter waits on a durable Restate signal, then it explicitly allows or rejects execution. **[I]**

`ctx.run` can wrap a non-deterministic operation, but it has a documented success-before-result-persistence replay window. The controlled test below physically reproduced the duplicate. It is suitable only when the operation is idempotent/reconcilable or when duplicate execution is acceptable. It is not a general exactly-once wrapper for model requests, tool effects, process creation, or file mutations. **[S/P]**

## 5. Execution visibility

Restate's `sys_invocation`/status views expose outer state, invocation identity, caller lineage, retry/status fields, retention, and suspended waits. `sys_journal` exposes the ordered durable commands (for example, input, named `Run`, service call, sleep, or output) and related call IDs/targets. **[S]** In the physical probe, SQL showed the `Run` command pending before recovery and one `Run` plus its notification after recovery. The external effect log contained two writes under that one outer `Run`. **[P]** The handler's internal operation history is not automatically expanded into a per-step tool/model trace.

For **complete execution visibility**, the agent/runtime contract must emit a versioned event stream or durable event records for at least: run/turn start and settlement; model request/response boundaries; tool requested/approved/rejected/started/completed/failed; retries and interruptions; and checkpoint/workspace artifact references. Each event needs a stable event/effect ID, monotonic sequence or resumable cursor, and correlation to the Restate invocation, agent run, turn, and parent invocation. **[I]** Restate can then journal or reliably ingest those events and expose them through query/telemetry. Payload retention, redaction, and event volume remain integration policy, not automatic Restate behavior. **[I/U]**

## 6. Durability and recovery

The default server base directory is `restate-data` under its working directory, joined with the node name; the server's logs, metadata, and partition state are managed by its configured storage/log setup. **[S]** For the physical test, the node was named `perimeter-node` and `/restate-data` was a dedicated persistent Podman volume. A suspended invocation survived `SIGKILL` of the Restate container process and restart of that same container/volume with the same invocation ID and suspended signal wait; resolving the awakeable then completed it. **[P]** This establishes local process/container restart recovery on that volume, not host-loss, volume-loss, or multi-node availability.

The deliberately hostile worker test establishes the opposite boundary for an external effect:

1. The handler entered `ctx.run("append-external-marker", ...)`, appended `{"tag":"gap"}`, and wrote a marker.
2. Before the `Run` completion appeared in the journal, the worker process received `SIGKILL`.
3. Restate replayed the same invocation on a new worker process; the same external append occurred again, then the invocation completed.

The external log has two `gap` records from different worker PIDs; the Restate invocation retained one ID and completed. **[P]** This is a forced timing test, not a frequency estimate. It confirms that durable invocation/journal replay does not make arbitrary external effects exactly once. Use external idempotency keys, deduplicating sinks, an outbox/reconciliation protocol, or accept the duplicate. **[I]**

No external agent transcript/session, workspace filesystem, model state, or process memory was part of this probe. Any recovery promise for those artifacts requires the agent runtime and its storage to supply checkpoint/restore or attach semantics. **[I/U]**

## 7. Parent/child execution

A Restate handler can make a durable request/response call or asynchronous send to another Restate service/object/workflow. The parent journal stores the outgoing call and target; introspection records the child invocation's `invoked_by`, parent invocation ID, and parent target. **[S/R]** The saved `evidence/parent-child-introspection-latest.json` is reused for this lineage observation.

This is **Restate invocation lineage**, not proof of an operating-system process tree or a durable agent-session relationship. A child service call is retried/attached according to its Restate journal. If that child launches a separate agent process, the process/run ID, lease/fencing, attach, stop, and recovery semantics still require an explicit adapter contract. **[I]** Parent cancel/kill behavior must not be assumed to stop arbitrary external descendants. **[I]**

## 8. Minimum truthful agent contract

A runtime intended to sit inside this perimeter must provide—or let a plugin provide—the following, with durable semantics where indicated:

1. **Idempotent start:** accept a stable logical run key and return a stable agent-run ID; duplicate `start` must attach to or return the existing run, not launch another process.
2. **Attach/status:** report lifecycle state, current turn/tool, generation/lease, and terminal result; provide `attach` by stable ID after adapter or worker restart.
3. **Checkpoint/restore:** persist or address transcript/session and workspace/checkpoint state, and restore it in a fresh process. Restate invocation replay alone is not this contract.
4. **Ordered events:** emit structured, replayable model/tool/control events with unique IDs and sequence/cursor, correlated to run and turn. The adapter must be able to resume after a cursor without silently losing events.
5. **Inner control hooks:** expose pre-tool approval, bounded pause/resume at safe points, and cancel/interrupt with an acknowledgment that the runtime/process actually stopped or reached the requested state.
6. **Effect identity:** provide operation IDs/idempotency or reconciliation for tool/model/process effects that may be retried after an ambiguous result.
7. **Semantic settlement:** distinguish `turn settled`/success/failure/cancelled from process exit or “no current tool call”; return the terminal outcome to the Restate handler.

Items 1–7 are the required boundary contract, not findings about any specific runtime. Whether a selected runtime already implements them is deliberately **unknown**. **[I/U]**

## 9. Adapter class and implementation tax

| Capability sought | Restate contribution | Remaining implementation tax |
|---|---|---|
| Durable outer control | High: stable keyed invocation/workflow, admission, journal/replay, timers/awakeables, retries, attach/result, admin controls, SQL introspection. **[S/P]** | **Low** if a handler can call a stable runtime API; define input/output and identity mapping. **[I]** |
| Internal agent control | Restate provides durable coordination primitives, not internal agent hooks. **[S]** | **High** unless the runtime already supports start/attach/interrupt/approval/checkpoint hooks; otherwise runtime/plugin work, safe-point semantics, external process ownership, and duplicate fencing are required. **[I/U]** |
| Complete execution visibility | Restate exposes the adapter's durable commands and invocation lineage. **[S/P]** | **Medium–high**: event schema, instrumentation at model/tool boundaries, durable ingestion/cursors, correlation, query/projection, redaction, and retention. **[I/U]** |
| Recovery of session/workspace | Restate recovers its handler journal and server-managed state under configured storage. **[S/P]** | **High** if the runtime's session/workspace is volatile or host-local: persistent checkpoint/artifact storage, fresh-process restore, lease/fencing, and side-effect reconciliation. **[I/U]** |

**Classification:** `DEEP_ADAPTER` for the full requested control/visibility/recovery profile because the missing part is agent-runtime lifecycle integration, not Restate workflow primitives. **Core surgery: none indicated.** If a runtime already satisfies the seven-part contract, the Restate-facing service and event bridge could be thin. This conditional does not select or rank any runtime. **[I/U]**

## 10. Restate without a coding agent

Restate remains useful as a durable service/workflow engine for ordinary long-running RPCs, integration processes, payments, asynchronous jobs, timers, stateful keyed services, retries, and human approvals. It does not need an LLM or coding agent. Its handler is user-defined application code; Restate supplies its durable outer invocation and coordination substrate. **[S/I]**

## 11. Unanswered questions

- Does the eventual target runtime provide stable start/attach, event cursors, interrupt, approval, and checkpoint/restore APIs? **[U]**
- Can its workspace/session be restored on a new host, and can external tool/model effects be reconciled with a replayed invocation? **[U]**
- What event volume, payload retention, redaction, access-control, and backpressure policy is required for complete traces? **[U]**
- What production Restate storage/replication, host restart, backup/restore, and retention configuration is intended? The local single-volume test is not evidence for those fault domains. **[U]**
- What is the runtime's semantic definition of a settled turn/run, and can it safely stop an in-flight model/tool operation? **[U]**
- The controlled `ctx.run` replay proves a duplicate is possible, but does not measure its probability or test every effect boundary. **[U]**
- Authentication/authorization of ingress, admin endpoints, and service endpoints was not evaluated; the probe SDK explicitly warned that its service endpoint accepted requests without validating signatures. **[P/U]**

## Evidence pointers

- Exact requested goal: `GOAL.md`.
- Environment/source alignment: `evidence/baseline.json`.
- Runnable isolated test and assertions: `evidence/RUN.md`, `evidence/perimeter-service.ts`, `evidence/perimeter-driver.ts`, `evidence/validate.py`, `evidence/validation.json`.
- Same-key/unkeyed and worker-unavailable test: `evidence/dedupe-sends.json`, `evidence/dedupe-while-worker-down.json`, `evidence/dedupe-after-worker-restart.json`, `evidence/effects.jsonl`, and worker logs.
- Suspended invocation across Restate server SIGKILL/container restart: `evidence/server-restart-pre-restart.json`, `evidence/server-restart-post-restart.json`, `evidence/server-restart-result.json`, `evidence/restate-server.log`.
- External-effect/result gap: `evidence/effect-gap-before-kill.json`, `evidence/effect-gap-journal-before-kill.json`, `evidence/effect-gap-kill.txt`, `evidence/effect-gap-after-replay.json`, `evidence/effect-gap-journal-after-replay.json`, `evidence/gap-result.json`.
- Reused Restate evidence: `../../../evidence/approval-live-send.json`, `../../../evidence/approval-live-settled.json`, and `../../../evidence/parent-child-introspection-latest.json`.
- Exact server-source tree: `/home/miles/repos/agent-harnesses/restate-fork` at tag `v1.7.13` / commit `5ab87a6b5eabb70d5ba09738e281edc69b6ae10e`. Relevant symbols/files: `append_invocation.rs:42-63` (apply acknowledgment), `service_handler.rs:370-395` (send response), `identifiers.rs:293+` (deterministic IDs), `state_machine/mod.rs:1021+` (duplicate requests), `admin/src/rest_api/invocations.rs` (control routes), `admin/src/rest_api/query.rs:101+`, `config/common.rs:421,969+`, `config/invocation.rs:26,130+`, and storage-query `journal/schema.rs` / `invocation_status/schema.rs`.
- Installed SDK references: `@restatedev/restate-sdk@1.17.2` `dist/context.d.ts:283-298` (`ctx.run` semantics), `dist/context.d.ts:415+` (reliable RPC), and `dist/node.d.ts:42-76` (HTTP/2 service endpoint); client `@restatedev/restate-sdk-clients@1.17.2` `dist/api.d.ts:173+` and `285-315`.
- Ephemeral Restate container and volume were removed; created ports were unbound. `evidence/cleanup.json` records cleanup. No pre-existing container/volume or Restate source file was modified.

**No migration decision is made by this report.**
