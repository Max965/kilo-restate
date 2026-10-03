# Restate / Kilo operational-node substrate falsification

**Result:** Useful proof: Restate can own durable dynamic invocation composition, park/wake, replay and system introspection. It does not provide Kilo's semantic Pi-session lifecycle, effect-authority boundary, or operator-level coding UI. Overall for replacing Kilo-Smithers as an operational-node substrate: **materially more friction**, despite Restate being notably simpler/stronger for durable async execution primitives. No migration decision is made.

## Provenance

- Restate upstream: `https://github.com/restatedev/restate`, checkout `../restate-fork`, observed HEAD `8a383eba008b325340ded34045321673b6373fb0` (`2026-10-02T22:21:01+01:00`, `main`); no upstream files edited.
- Kilo probe: this folder, separate local Git repository, no remotes. Probe commit is recorded in the return after closeout.
- Smithers specimen: `/home/miles/repos/agent-harnesses/smithers-fork`; at first inspection HEAD was `05ef001157c023dcea7f78f994e3479ef5dc9ced` on `smithers/b217`, with extensive pre-existing modifications. During the probe, an independent commit `5715f6a21ddd9f3968e2412370e3bef655025ed6` (`feat(agent): audit physical provider attempts`, 2026-10-03T17:17:47+01:00) appeared; final tracked tree is clean and one commit ahead of origin. I did not create or modify that reference commit/files. Targeted evidence used: `.agent/goals/kilo-smithers-production-commissioning-2026-09-28/REPORT.md` (native end-to-end run, approval parked across fresh-process resume, durable journal, tool effects, evidence; source baseline cited there `de5620cb2f3031a369795ad17b6f272ea567303e`), and inspected `packages/smithers/src/NodeControl.ts` / `packages/smithers/agent/src/AgentSession.ts`.
- Setup friction: port 8080 is already bound by Bifrost. The probe uses Restate ingress/admin on 8180/9170. Restate server image `docker.restate.dev/restatedev/restate:1.7` reported version `1.7.13`; TypeScript SDK/client `1.17.2`. The local worker and Restate container were stopped after evidence capture; rerun `README.md` to reopen the UI.

## Physical specimen results

### A. Dynamic nodes

`KiloNode/parentChild` created a fresh `KiloNode` keyed object call at runtime (`ctx.objectClient(...).run(...)`), awaited B's result and returned settlement. A and B identities plus parent and child Restate invocation IDs are in `evidence/check-run.json`; independent Restate `sys_invocation` query proves B's `invoked_by_service_name`, `invoked_by_id`, and `invoked_by_target` point at A in `evidence/parent-child-introspection-latest.json`. Both settled completed. The tool/service invocations use durable IDs; the code's node labels are request data. System retry count is available through `sys_invocation.retry_count`; successful specimens had no reported retry count. A's child operation and args appear in B's invocation journal/request/result. This is dynamic runtime composition, not a static graph.

### B. Pi semantic actor

`probe/pi-extension.ts` registers tools named exactly `read`, `edit`, `bash`, and returns Pi's expected `{content, details}` result shape. Pi ran with `--no-builtin-tools`, so all three calls routed to the Restate `KiloNode` handler, not local built-ins. Actual Pi run `evidence/pi-physical-run.log` read, edited the workspace fixture and ran `printf final-bash-check`; `evidence/service.log` shows the three completed Restate handler invocations. A call carries node ID, actor ID, Pi session label, adapter-supplied actor-attempt label, Pi tool-call ID, operation, and arguments. This actor-attempt label is not Restate's retry count; actual execution retry metadata is in Restate's `sys_invocation.retry_count`/failure fields. The Restate response records invocation ID, admission result, physical result/failure, start and settlement times. Decoded exact Restate request/output payloads for read, edit and bash (including actor/session/attempt metadata, arguments, admission, physical result, timestamps and invocation ID) are committed in `evidence/pi-tool-structured-results.json`; raw invocation journals are in `evidence/pi-tool-journals-raw.json`.

The actual Pi run was launched with `--no-session`, and `PI_SESSION_ID` was set to the explicit probe label; it is not proof of a persisted Pi conversation. Pi's result render path works without parsing terminal output. We reused tool names and the standard Pi generic content/details rendering; we did not reuse special built-in renderers.

### C. Approval/control

The `Approval` keyed object registers a Restate awakeable, writes one request ticket through `ctx.run`, and parks awaiting an external decision. The accept route resolved the awakeable; the handler then performed one journaled keyed state update (`approved-effect`). `evidence/approval-journal.json` has one `SetState` entry; `evidence/approval-state.json` has the single settled keyed value. Denial also ran: external reject produced terminal failure `operator denied` in `evidence/approval-denial-status.json`, and no approved-effect state was created for that key.

Scope of exactly-once claim: the probe's consequential approved effect is a Restate-owned keyed state update; journal replay does not duplicate this state transition. This does **not** prove exactly-once semantics for arbitrary filesystem/process side effects. Restate SDK `ctx.run` documentation explicitly allows a narrow re-execution window after external action success but before durable result persistence; external effects need idempotency keys or their own transactional/idempotent boundary.

### D. Failure/durability

While an approval invocation was in flight and awaiting its awakeable, the Node service worker was `SIGKILL`ed, then restarted at the same endpoint. `evidence/worker-restart.txt` records the interruption; the service log reports `Replaying invocation` for the same `inv_...` ID; the durable ticket/journal survived; external approval completed the same invocation and the status settled `completed`. This proves Restate recovery of the in-flight service invocation/journal and resumed handler, not Pi session durability. The Restate server itself was not restarted in this specimen. Restate still cannot reconstruct Pi's transcript/model continuation, terminal/session owner, local UI state, or unjournaled effect; Kilo must own those. Tool effect execution is inside `ctx.run`; do not assume stronger-than-documented semantics at the external-effect boundary.

### E. Live operator inspection

During the run, Restate's bundled UI responded at `http://localhost:9170/ui/`; admin SQL introspection worked at `/query`. While the approval invocation was active, `sys_invocation` exposed ID, target service/key/handler, status, journal sizes, pending signal/suspension fields; `sys_journal` exposed input/run/signal/state/output entries. A/B linkage is visible via `sys_invocation.invoked_by*`; service deployment/version and invocations are discoverable, and SQL tables include invocation, journal, state, inbox, vqueue, scheduler and promises. `sys_journal` exposes the named `tool:read|edit|bash` effect; invocation request/result/journal can expose arguments and results, but these are not a semantic actor transcript or a first-class current-tool panel. The Restate UI and SQL are good runtime-operability surfaces; our approval decision required an external resolver script, not a Restate-native Kilo approval screen. A human could see/manage one or two underlying invocations and query retry/failure metadata; denial physically demonstrated terminal failure, but this probe did not induce a transient retry/backoff state. The upstream CLI source renders running/suspended/backing-off retry counts, while our executable live specimen used SQL/UI rather than installing the CLI. A human still cannot supervise a coding actor's prompt/session/tool narrative or policy decisions without Kilo's own projection/control UI.

### F. Workspace/effect authority

Restate itself imposes no filesystem/process sandbox. In this specimen only the handler performed read/edit/bash; the chosen Pi loadout disables built-in tools. That makes the adapter the sole route in this *configured invocation*, not a security boundary: the Pi process and extension have the same OS rights, other extensions/configurations may restore local tools, and any arbitrary process/shell code can bypass the adapter. The probe's lexical path check is not symlink-safe, and `bash` is unrestricted within the worker user's OS rights. The SDK also logged that request signatures are not being validated; the public service endpoint therefore needs network/auth protection. Production needs Kilo-side admission/grants plus OS/container/sandbox enforcement and authenticated handler ingress. Distinguish control from observation: Restate can durably record/sequence the effect and identify its service invocation; it does not restrict the OS process or prove that the call was authorized outside the handler's own policy code.

### G. Langfuse / observability

Restate source supports OTLP gRPC and HTTP (protobuf or JSON) trace export, configurable `tracing-endpoint`, service-specific endpoint override, and `tracing-headers`. Clean route is Restate `tracing-services-endpoint: otlp+http://<existing-collector>:4318/v1/traces` → existing OTEL collector → Langfuse OTLP HTTP ingest (`/api/public/otel/v1/traces`); the collector owns Langfuse auth/headers. Restate can also send OTLP HTTP directly with headers if desired. No Kilo-Langfuse rebuild and no credentials were used in this probe. Restate server spans carry RPC service/method, `restate.invocation.id`, target, trace identity; service and invocation identity survive naturally. Actor/session/tool IDs are currently request/journal fields, not demonstrated Restate server span attributes: add explicit SDK spans/attributes or collector mapping before claiming stable Langfuse actor/tool identity. Smithers current evidence: `AgentEventOtel.ts`, `AgentSession.ts` emit typed agent events/relationships (`smithers.relationships.v1`); `NodeControl.withLangfuseSession` sets stable session IDs. This route was source-verified, not exported/read back against Langfuse.

## Capability matrix

| CAPABILITY | RESTATE | SMITHERS CURRENT | EVIDENCE | TAX |
|---|---|---|---|---|
| Dynamic operational child | ALREADY_NATIVE | Native durable child/agent work composition | Parent/child `sys_invocation` rows and service source `ctx.objectClient` | Thin handler glue to define node semantics/IDs |
| Parent waits for settlement | ALREADY_NATIVE | Native run/node settlement | Returned B result; invocation status completed | Low |
| Durable identities, attempts, settlement | THIN_ADAPTER | Native control identities/status/journal/settlements | Restate invocation IDs, keyed service, system retry metadata; app IDs in request | Kilo maps semantic actors, nodes and actor attempts |
| Pi `read/edit/bash` | THIN_ADAPTER | Smithers exposes guarded native semantic tools, not this Pi adapter | Real Pi run + handler logs + structured journal | Pi extension, active tool profile, typed request/result; ~small |
| Durable approval park/accept/deny | THIN_ADAPTER | Native approval card/channel and run statuses | Awakeable pause/resume, one SetState, denial result | Kilo approval identity/UI/channel + authorized resolver |
| Durable handler recovery | ALREADY_NATIVE | Native durable engine recovery | Worker SIGKILL/restart, same Restate invocation replayed | Pi actor session/semantic continuation still Kilo |
| Restate UI/introspection | ALREADY_NATIVE | Smithers control CLI/events + its workflow/UI projection | `/ui/`, `sys_invocation`, `sys_journal`, SQL | Kilo coding-actor view and semantic human controls |
| Filesystem/process authority | KILO_MUST_BUILD | Smithers guarded filesystem/shell, grants and process ledger | `NodeControl.ts` `layerGuardedPlatform`, `ProcessReaper` | Significant: OS containment still required either way |
| OTEL export | THIN_ADAPTER | Smithers native agent event OTEL + Langfuse session mapping | Restate `exporter.rs`/`common.rs`; Smithers `AgentEventOtel.ts` / `NodeControl.ts` | Configure endpoint/auth and add actor/tool attributes/mapping |
| Durable promises, journals, timers, retries | ALREADY_NATIVE | Smithers durable engine/control DB/journal semantics | Restate SDK ctx/source + runtime queries | Strong Restate primitive; useful concept regardless of runtime |
| Provider/Pi transcript and semantic acceptance | KILO_MUST_BUILD | Native `AgentSession`/responsibility settlement and provider/session control | Smithers `AgentSession.ts`, `NodeControl.ts` | Large Kilo reconstruction if swapping engine |

## NEW LEARNING FROM RESTATE

1. **Durable async/await is a very compact composition model.** A handler can call a keyed child and await it; its invocation identity and outgoing call are journaled, and the child has native `invoked_by` linkage. Smithers currently implements durable run/node/child records through its own engine/control DB/events. **Adopt:** expose equivalent parent/child/invocation relationships as one queryable contract, even if Smithers remains the executor.
2. **Park/wake is a first-class durable future.** The awakeable plus external resolver is less bespoke than rebuilding suspension into a run loop. Smithers currently provides durable approval token/channel, waiting status, external decision and resume. **Adopt:** keep approval as a typed durable signal/promise with exact request identity; don't adopt an untyped manual polling design.
3. **Durable effects have an explicit honest ceiling.** `ctx.run` records results and skips them on replay, but has a narrow effect-success-before-journal-commit re-execution window. Smithers should preserve explicit idempotency/ledger/sandbox boundaries instead of overclaiming global exactly-once.
4. **Built-in SQL introspection is valuable operator leverage.** `sys_invocation`, `sys_journal`, `state`, queues and service metadata make live forensic answers straightforward. Smithers has its own event/query/control surfaces. **Adopt:** one coherent read-only system view joining execution identity, parent links, active operation, status and journal, instead of adding yet another bespoke log format.
5. **Pinned deployment identity is native.** Invocation metadata records deployment ID and protocol version, so recovery can replay against its pinned deployment. Smithers already has explicit release/source lineage but the probe did not compare deployment pin semantics end-to-end. This merits a Kilo release-compatibility requirement, not importing Restate itself.

## HIDDEN COST / WHAT SMITHERS CURRENTLY SAVES US

- Smithers already composes `AgentSession` over durable stores, guarded filesystem/shell capabilities, grants, approval/steering, process reaping, budgets and semantic settlement in `NodeControl.layerExecutor`.
- `AgentSession` owns the Pi/agent conversation and tool events, durable approval registration and waiting/settlement projections; Restate only sees its handler protocol unless Kilo adds this semantic model.
- Smithers's commissioning evidence has an operator-facing approval payload/list/approve/deny/resume route, and shows recovery from a fresh Smithers process; this probe's external awakeable resolver is not an operator UX.
- Smithers current emits structured agent-event OTEL relationships and stable Langfuse session IDs; Restate emits infrastructure/invocation traces, so tool/actor correlation still needs adapter instrumentation.
- Restate invocation recovery is not actor recovery. Replacing Smithers would force Kilo to rebuild Pi session/transcript recovery, capability admission and filesystem/process isolation, approval UI, semantic settlement, actor-level telemetry and a coding-focused operator projection.

## Reproduction/evidence inventory

- Code: `probe/service.ts`, `probe/client.ts`, `probe/pi-extension.ts`, `probe/check.ts`, approval scripts.
- Commands/invocations: `evidence/check-run.json`, `evidence/pi-physical-run.log`, `evidence/service.log`, `evidence/kilonode-invocations.json`, `evidence/pi-tool-structured-results.json`, `evidence/pi-tool-journals-raw.json`.
- Dynamic relation: `evidence/parent-child-introspection-latest.json`.
- Approval: `evidence/approval-journal.json`, `evidence/approval-state.json`, `evidence/approval-denial*.json` (denial rerun status and empty state included), `evidence/approval-live-*.json`.
- Recovery: `evidence/worker-restart.txt`, replay in `evidence/service.log`; completion/status in `evidence/invocations-after-recovery.json`.
- Deployment/version: `evidence/deployment.json`, `evidence/server-version.json`.
- Full reproduce commands: `README.md`.

## Final verdict

**Materially more friction** as an integrated Kilo operational-node replacement; **better/simpler** as a durable async invocation/journal substrate. This is limited to the specimens above. No migration recommendation.
