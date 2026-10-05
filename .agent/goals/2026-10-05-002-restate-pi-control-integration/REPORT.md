FACTORY_REBASE_REQUIRED: YES
RECEIVER_ACTION: REBASE_AND_RECONCILE_HYPOTHESIS
REPORT_TIMESTAMP: 2026-10-05T13:47:00+01:00
GOAL_ID: 2026-10-05-002-restate-pi-control-integration
ITERATION: 01
GOAL_ITERATION_COUNT: 1
RUN_KIND: HYPOTHESIS_CHALLENGE
GOAL_BATCH_MODE: NONE
GOAL_MANIFEST: NOT_APPLICABLE
GOAL_BATCH_RESULTS_PATH: NOT_APPLICABLE
GOAL_BATCH_COUNTS: NOT_APPLICABLE
BATCH_ALIGNMENT_GATE: NOT_APPLICABLE
ONBOARDING_RESULT: NOT_APPLICABLE
SUBJECT_READINESS: NOT_APPLICABLE
UPSTREAM_IDENTITY: https://github.com/earendil-works/pi.git at b2b5c42f6138b73ec4b2f49ec0ca468800f88586 (MIT); Restate source at 8a383eba008b325340ded34045321673b6373fb0 (BSL 1.1)
LOCAL_FORK_IDENTITY: NONE; existing unmodified checkout at /home/miles/repos/agent-harnesses/kilo-pi-durable revision b2b5c42f6138b73ec4b2f49ec0ca468800f88586, origin https://github.com/earendil-works/pi.git
DEPENDENCY_CENSUS: existing Pi monorepo dependencies; Kilo-installed Restate SDK/clients 1.17.2 and TSX; no new packages
MISSING_DEPENDENCIES: NONE for probe; scoped tsc reports 24 unrelated Pi diagnostics, zero probe-file diagnostics
INSTALL_DECISION_REQUIRED: NONE
EXTERNAL_EFFECT_CENSUS: goal-local workspace file effects and temporary registration of uniquely named probe services in cached local Restate; no paid provider, external model, or package install
EXTERNAL_EFFECT_DECISION_REQUIRED: NONE
CLEAN_ENVIRONMENT: goal-local disposable run/session workspace; reused initially stopped Restate container and restored it to stopped
BUILD_RESULT: NOT_RUN
UPSTREAM_TEST_RESULT: NOT_RUN
RUNTIME_SMOKE_RESULT: PASS (exact-source RPC/extension/Restate probe; see evidence)
OPERATING_CONTRACT: Restate owns keyed outer run/gate/effect journals and settlement; Pi owns provider loop, transcript and native tools; Kilo maps run/session/process/events and explicitly blocks on gate denial/error
READINESS_GAP: production host-loss session storage, cancellation mapping, effect-specific reconciliation, and native child lineage remain unproven/contract decisions
AUTOMATION_DEBT: repeatable exact-source launch, SQL evidence and deployment cleanup remain probe-driver work until a production representation is commissioned
WORKER_RESULT: AGREES
PHYSICS_TOUCHED: current Pi RpcClient and extension hooks; native read/write/edit/bash; Restate keyed submit/attach, awakeable gate, ctx.run effects, one Pi-child crash/reopen, Pi settlement
DECISIVE_EVIDENCE: evidence/physical-probe/validation.json; runtime/probe-1791201303431-f1f53dfa/result.json; probe-cleanup-verification.json
TAX_DELTA: UNCHANGED
RECOMMENDED_CONTROLLER_HYPOTHESIS_DELTA: NONE; the small native-composition hypothesis holds, with host-loss/effect/lineage boundaries preserved as residuals
REMAINING_UNCERTAINTY: shared session-store semantics on worker/host loss; whether native Restate child lineage is required; per-effect idempotency/reconciliation contract
RUN_MODE: OPERATE
FEATURE_ID: kilo-restate-pi-control-integration
FEATURE: Restate-owned asynchronous operational run around ordinary Pi coding-agent execution
FEATURE_STATUS_PROPOSAL: PROOF_CANDIDATE
QUALITY_BAR: durable outer admission/gate/effects; actual pre-tool interception; same-session retry proof; structured correlation; authoritative Pi and Restate settlement
EXECUTION_FRONTIER: bounded reuse-first physics probe; prioritize control/visibility/recovery seams; one harmless four-tool specimen and one child-process crash; no production, full crash matrix, performance or hardening
FRONTIER_DISCIPLINE: ON_TARGET
SEMANTIC_RETURN_POINT: REACHED
RETURN_POINT_REASON: The required reuse, four-tool gate, RPC/extension, one-crash and settlement surfaces have a stable physical answer; single-goal challenge result is AGREES.
RETURN_WHEN_EVALUATION: MET
POST_RETURN_POINT_SUBJECT_ACTIONS: NONE
LATE_COMPLETION_DISPOSITION: NONE (no active monitor, loop, child, or other async owner)
WAKE_CONTROL_AUDIT: CLEAN
UNAUTHORISED_WAKE_REENTRIES: NONE
QUALITY_STATUS: PARTIAL
EXECUTABLE_DESIGN_ID: NOT_APPLICABLE (HYPOTHESIS_CHALLENGE)
EXECUTABLE_DESIGN_REVISION_USED: NOT_APPLICABLE
EXECUTABLE_DESIGN_PATH: NOT_APPLICABLE (no executable design supplied)
EXECUTABLE_DESIGN_MEDIA: NOT_APPLICABLE
OPERATOR_METHOD_ID: semantic-operator/HYPOTHESIS_CHALLENGE
OPERATOR_METHOD_REVISION_USED: current installed Semantic Operator method
OPERATOR_METHOD_PATH: /home/miles/repos/runtime/.pi/agent/skills/semantic-operator/references/problem-solving-method.md; iterations/01/ITERATION.md
RUN_QUESTION: Which existing Pi/Restate surfaces physically provide the lowest-tax durable outer-control, tool-gate, recovery, visibility and settlement seam?
SEMANTIC_ADMISSION_GATE: PASS
SEMANTIC_ADMISSION_CLASS: INFERRED
SEMANTIC_ADMISSION_RECEIPT: iterations/01/SEMANTIC_ADMISSION.md
SEMANTIC_ADMISSION_INFERENCES: HYPOTHESIS_CHALLENGE and DIRECT inferred from explicit bounded reuse-first instruction; no Executable Design required for this run kind
SEMANTIC_ADMISSION_CONFLICTS: NONE
SEMANTIC_ADMISSION_DECISION: Continue directly; no production code or delegation; physically test native surfaces and return evidence/limits.
ROLE: orchestrator/operator
HOST_CONSUMER: ordinary maintained Pi coding-agent behind a local Restate worker
RUN_PLACEMENT: SUBJECT_LOCAL
CANONICAL_WORKTREE: /home/miles/repos/agent-harnesses/kilo-restate (main)
RUN_HOME: /home/miles/repos/agent-harnesses/kilo-restate
WORKING_AREA: .agent/goals/2026-10-05-002-restate-pi-control-integration
PROBE_WORKSPACE: goal-local disposable runtime directories under evidence/physical-probe/runtime/
EVIDENCE_HOME: /home/miles/repos/agent-harnesses/kilo-restate/.agent/goals/2026-10-05-002-restate-pi-control-integration/evidence
REALIZATION_HOME: NOT_APPLICABLE (no production realization)
EXECUTABLE_DESIGN_TARGET: NOT_APPLICABLE (capability probe only)
RETENTION_LANDING_RULE: preserve all probe, report and runtime evidence within this goal; shared probes and Pi source untouched
BEST_JUSTIFIED_FRONTIER: Restate + ordinary Pi compose through a thin Kilo bridge using RpcClient, tool_call, native remote operation interfaces and Restate workflow/awakeable/ctx.run; same-host Pi child restart and local session reopen proven, other listed recovery/lineage limits unproved.
EXECUTABLE_ARTEFACT: goal-local Restate service + Pi extension + RPC driver used only as a physical probe
ARTEFACT_STATUS: PROOF_CANDIDATE
FEATURE_SEMANTICS: one idempotent Restate run owns a Pi RPC turn; gate precedes native tool execution; effect result returns through Pi; outer terminal result follows agent_settled
ASSUMED_PHYSICS: Restate worker remains available; Pi session file is local and accessible to retry; effects use stable operation identity
OPERATING_PHYSICS: Node 22.22.2, Pi source via existing TSX loader, Restate SDK 1.17.2/server 1.7.13, same-host process spawn and session-file reopen
RESIDUAL_PHYSICS: worker/host loss, portable session storage, late-effect reconciliation, cross-process cancellation, and true causal child lineage
REPRESENTATION_LEVEL: AD_HOC_PROBE (candidate production composition would be THIN_NEW_ADAPTER)
TAX_LADDER_POSITION: COMPOSITION
DESCENT_JUSTIFICATION: Existing Pi and Restate APIs do not bind their run/session/process/gate identities; a small Kilo bridge is the missing boundary.
RETURN_DELTA_CLASS: PROOF_CANDIDATE
CONTROLLER_DECISION_REQUIRED: YES
WORKING_HYPOTHESIS: Ordinary Pi RPC/extensions/tool replacement and Restate workflow/awakeable/effect primitives compose with a small Kilo-owned identity/decision/event bridge; the contrary would be a missing required hook, bypass, or unreconcilable crash.
CONTROLLER_RESEARCH_DESIGN_CONSUMED: Canonical GOAL/ITERATION and semantic admission; no machine Executable Design supplied because this is HYPOTHESIS_CHALLENGE.
RESEARCH_FACTS_CONSUMED: Pi has local RPC/session/extension/tool surfaces; Restate has workflow/context/awakeable primitives; prior Kilo probe proves only reverse ingress/result.
PHYSICAL_DISCOVERY: All four native tools passed through the Restate gate/operation boundary; deny and gate error blocked; killing Pi after durable read ALLOW caused same outer invocation/activity retry and same local session reopen, followed by agent_settled and outer completion.
RESEARCH_CONTRADICTIONS: No direct pi-chat or official Restate AI adapter exists in the searched scope; independent ingress calls do not establish native Restate causal child lineage.
SETUP_ADAPTATION: goal-local service/extension/driver and isolated disposable files; no source build, new dependency, or upstream edit.
INFORMATION_GAIN: official Pi ssh.ts operation interfaces remove duplicate schemas/execution logic; the tested restart boundary is same-host only.
WORLD_DELTA: exact-source RpcClient + extension can be driven from Restate and native tool operations can be Restate-backed without a Pi fork.
ARTEFACT_DELTA: NONE (no controller Executable Design supplied; return candidate adapter responsibilities only).
METHOD_DELTA: NONE.
PROOF_CANDIDATE: evidence/physical-probe/validation.json and its linked raw run result establish gate, tool routing, same-host replay and settlement.
BLOCKER: NONE for the bounded probe.
IMPLEMENTATION_PROFILE: AD_HOC_PROBE; TypeScript; reuse Pi RpcClient/native tools/Faux provider, Restate SDK; no upstream source changes; only goal-local probe semantics owned; production refactor target is a thin Kilo adapter.
FEATURE_ACCEPTANCE_CANDIDATE: FEATURE=Restate outer control around ordinary Pi; ARTEFACT=goal-local probe; ASSUMPTIONS=same-host session file and stable operation keys; EVIDENCE=physical-probe result+validator; RESULT=proof candidate; RESIDUAL=cross-host, effects, cancellation, child lineage.
CAPABILITY_CONVERGENCE_STATUS: feature=PROOF_CANDIDATE; quality=PARTIAL; artifact=PROOF_CANDIDATE; representation=THIN_NEW_ADAPTER; frontier=bounded composition, no fork.
TARGET_FORM_STATUS: PARTIALLY ACHIEVED
HARD_OPERATED_LABOUR: manually launch exact-source Pi/Restate and collect SQL/deployment evidence; a future production harness may automate repeatable packaging/diagnostics after controller commission.
SUBJECT_SKILL_PATH: NONE (no repository-owned Kilo Restate SKILL.md exists)
SUBJECT_SKILL_MINING: REVIEWED_NO_DELTA
SUBJECT_SKILL_DELTA: NONE; no canonical subject skill exists, so retain findings in this goal report rather than create an unrequested skill.
SOURCE_CONTROL_BASE_HEAD: c6779f182c7502aa65916767445b1f55c625fee3
SOURCE_CONTROL_END_HEAD: c6779f182c7502aa65916767445b1f55c625fee3
COMMITS_AFTER_BASELINE: 0
RETURN_SOURCE_STATE: UNCOMMITTED_CANDIDATE (goal-local evidence only; no subject source change)
PROCESS_FACTORY_TELEMETRY: root direct operator, gpt-6-luna [openai-codex] max; current model/level differ from the installed Semantic Operator pool and are recorded as process-profile friction; no children/reviewers; no active monitor/loop; Pi CLI v1.0.2-18-gb2b5c42f6; Node 22.22.2; skills semantic-operator, agent-worker, Ponytail, systematic-debugging, verification-before-completion; ended at stable evidence frontier.
OPERATOR_STATE_FINAL: WAITING_FOR_FACTORY
OPERATOR_STATE_SUMMARY: The bounded physical challenge agrees with a thin no-fork composition; host-loss, side-effect reconciliation and causal child semantics remain for controller decision.
ACTOR_TURN_CLOSEOUT_AUDIT: COMPLETE; turns 001 and 002 each have assignment/report/trace; assignment byte hashes were checked; turn 001 report was retrospectively materialized from its preserved assignment/trace during final audit.
ORCHESTRATOR_ACTOR_ID: orchestrator-01
ORCHESTRATOR_FINAL_TURN: 002
CHILD_REPORT_REBASE_AUDIT: NOT_APPLICABLE (no child runs)
SEMANTIC_TRACE: iterations/01/actors/orchestrator-01/turns/002/SEMANTIC_TRACE.md
ORCHESTRATION_TERMINAL_CLASS: RETURN_PASS
EVIDENCE_TRANSPORT: raw probe/reuse evidence remains under this goal's evidence/; standard latest.zip carries the iteration chain/report and review receipts, not a duplicate of the goal-root evidence tree.
RETURN_ENVELOPE: /home/miles/repos/agent-harnesses/kilo-restate/.agent/goals/2026-10-05-002-restate-pi-control-integration/latest.zip
FACTORY_FEEDBACK: NONE
FACTORY_STATUS: READY FOR FACTORY REVIEW
LATEST ZIP: /home/miles/repos/agent-harnesses/kilo-restate/.agent/goals/2026-10-05-002-restate-pi-control-integration/latest.zip
LATEST ZIP URI: file:///home/miles/repos/agent-harnesses/kilo-restate/.agent/goals/2026-10-05-002-restate-pi-control-integration/latest.zip

# Restate ↔ ordinary Pi integration — capability/physics report

**Goal:** Determine and physically prove the lowest-tax integration between Restate and the maintained ordinary Pi coding agent for Kilo's asynchronous durable operational node.

**Disposition:** `PASS` for this bounded reuse/capability challenge. **Adapter class:** `THIN_NEW_ADAPTER`. This is not a production implementation, rollout approval, or Software Factory migration decision.

## Decision summary

No maintained package found in the bounded search directly joins Restate's durable outer invocation to the ordinary Pi coding-agent session, tool, and settlement lifecycle. The low-tax path composes existing native pieces:

- Pi `RpcClient` to start/control the ordinary local `--mode rpc` process and await `agent_settled`.
- Pi's extension `tool_call` hook for awaited, pre-execution decisions.
- Pi's existing `createReadTool`, `createWriteTool`, `createEditTool`, and `createBashTool` operation interfaces, following the official `ssh.ts` remote-operation pattern.
- Restate workflow, `ctx.run`, awakeable, and idempotent invocation primitives for outer control, decisions, effects, and terminal output.

The disposable exact-source probe physically passed a Restate decision through each native tool boundary, denied a write, failed a gate closed, killed the Pi child after a durable ALLOW, reopened the same local Pi session, and settled the same outer Restate invocation. The measured integration tax is a Kilo-owned bridge for run/session mapping, local Pi process lifecycle, gate/effect requests, structured event correlation, and mapping Pi settlement to Restate output. No Pi core change or provider/model runtime reimplementation is indicated.

The evidence is deliberately bounded: same-host Pi child restart/session reopen only; not worker/host-loss recovery, portable Pi session recovery, exactly-once external effects, automatic cancellation/supervision, or Restate-native causal parent/child lineage. The probe sends child-operation requests as independent Restate ingress invocations carrying a manual `parentInvocationId`; it does not establish a context-native child edge. A complete durable event projection is also Kilo work: RPC/hook logs are not themselves durable truth.

## Scope and pinned world

| Subject | Revision/version | Evidence / state |
|---|---|---|
| Kilo Restate | `c6779f182c7502aa65916767445b1f55c625fee3`, `main` | Baseline; only the new goal-local directory is untracked. |
| Maintained Pi checkout | `b2b5c42f6138b73ec4b2f49ec0ca468800f88586`, `main`, `v1.0.2-18-gb2b5c42f6` | MIT. Pre-existing untracked `.agent/`, `.pi/loops/`, `latest.zip`, and `ruvector.db` remain unchanged. Exact source ran through Kilo's existing TSX loader; no build outputs were written into Pi. |
| Restate source checkout | `8a383eba008b325340ded34045321673b6373fb0`, `main` | Restate repository license is BSL 1.1. No Restate source was changed. |
| Restate TypeScript SDK / clients | `1.17.2`, MIT | Already installed in Kilo. |
| Restate server | `1.7.13` | Reused cached `kilo-restate-pi-lifecycle` container on ports `8180/9170`; restored to initially stopped state. |
| Runtime | Node `v22.22.2` | Existing TSX loader used for exact Pi source. |

Exact final identities and checkout status: [source-identities.json](evidence/physical-probe/source-identities.json). The scoped `tsc` run exits 2 on 24 existing Pi-source diagnostics (`path.PlatformPath` and missing `highlight.js` declarations); it reports **zero diagnostics** in the goal-local probe files ([summary](evidence/physical-probe/typescript-check.json), [log](evidence/physical-probe/typescript-check.log)).

## Reuse inventory

| Existing component | Source / version / license | Reuse class | What it supplies | Smallest Restate mismatch / tax |
|---|---|---|---|---|
| Pi `RpcClient` | Pi `packages/coding-agent/src/modes/rpc/rpc-client.ts`; commit `b2b5c42f…`; MIT | `DIRECT_REUSE` | Official JSONL stdin/stdout control of a local `node <cli> --mode rpc` child; prompt, steer/follow-up, abort, state/session identity, entries, and collection through settlement. | It does not own/supervise/recover its child, persist a run↔session binding, expose extension callbacks on the RPC event stream, or make Pi session files portable. Kilo supplies those bridges. |
| Pi CLI/session manager | `packages/coding-agent/src/cli/args.ts`, `core/session-manager.ts`, session docs; same revision; MIT | `ADAPT` | `--session-id`, `--session-dir`, and native local session open/create behavior. | A local session identity/path is a reopen input, not a cross-host durability contract. Kilo must persist/map the binding and ensure the file store is available on retry. |
| Extension `tool_call`, `tool_result`, lifecycle/provider hooks | `core/extensions/types.ts`, runner, agent-session; same revision; MIT | `ADAPT` | Actual in-process pre-tool input, block/terminate response, result, turn, provider and settlement boundaries. | Hook callbacks are not exposed as callbacks over RPC. `tool_call` has no `AbortSignal`; extension handler exceptions are caught/emitted, so Restate denial/outage must explicitly return `{block:true,...}`. Kilo bridges the hook to a durable gate and event projection. |
| Native Pi tools + remote operations | `core/tools/{read,write,edit,bash}.ts`, `examples/extensions/ssh.ts`; same revision; MIT | `ADAPT` | Native schemas, validation, workspace behavior, result formatting, execution IDs and operation interfaces. Official `ssh.ts` proves those implementations can use remote operations. | Substitute Restate-backed operation callbacks and stable idempotency/correlation; do not duplicate Pi schemas or rendering. |
| Pi Faux provider | `packages/ai/src/providers/faux.ts`; same revision; MIT | `DIRECT_REUSE` (probe only) | Native deterministic assistant/tool-call stream through Pi's own agent/provider loop, without network or paid model calls. | Test utility, not production model/provider. It leaves the Pi runtime in control. |
| Pi extension examples | `permission-gate.ts`, `protected-paths.ts`, `tool-override.ts`, `file-trigger.ts`, `rpc-demo.ts`, `subagent/`, `event-bus.ts`; same revision; MIT | `REFERENCE_PATTERN` (with native hook reuse above) | Permission, external ingress, tool replacement, lifecycle, subagent, and internal extension-bus precedents. | They do not provide Restate persistence, effect reconciliation, or external causal lineage. `pi.events` is same-process only. |
| `earendil-works/pi-chat` | Main commit `9adbd29b40ee27ff1decf0fc87cbe180b40924f5`; Apache-2.0 per `LICENSE` and package metadata | `REFERENCE_PATTERN` | Local channel JSONL, stable Pi sessions, `ConversationRuntime` queue, `sendUserMessage`, `tool_call` allow/block, tmux worker/status patterns. | Discord/Telegram, Gondolin and tmux product assumptions; legacy peer name `@mariozechner/pi-coding-agent`; no Restate invocation, durable approval, or context lineage. README says MIT but conflicts with the authoritative LICENSE/package (`Apache-2.0`); exact license text and hashes are retained under `evidence/reuse-search/`. |
| Pi telemetry | `@earendil-works/pi-telemetry` `1.0.2`, MIT | `NOT_APPLICABLE` as control; observation reference only | Callback-shaped telemetry context and local in-memory recorder. | No exporter by default and no found injection path from ordinary `pi-coding-agent` RPC/extension; process-local, not durable decisions or event authority. |
| Pi Durable | `@earendil-works/pi-durable` `1.0.2`, MIT | `NOT_APPLICABLE` underneath this run; relationship `FUTURE_REPLACEMENT` | A Chord-backed session/task/harness with its own stores and journal. | It owns the inner task/session durability lifecycle and has no Restate adapter. Putting it under Restate for the same operation creates competing journals/retries/settlement. No component was identified that can be detached as a safe helper. |
| Restate TypeScript SDK | Installed `@restatedev/restate-sdk` and clients `1.17.2`, MIT | `DIRECT_REUSE` | Workflow/object handlers, durable `ctx.run`, awakeables, idempotent client options, attach/output and SQL introspection. | Pi has no Restate context; Kilo must translate Pi identities/tool events into Restate requests and preserve idempotency keys. |
| Existing Kilo `KiloNode` / `Approval` | Baseline Kilo `probe/service.ts`, `probe/pi-extension.ts`, `probe/approve.ts`; Kilo revision above | `REFERENCE_PATTERN` / `ADAPT` | Existing `ctx.run` operations and `ctx.awakeable()` approval pattern. | Shared probes were left untouched; the specimen needs native `write`, `tool_call` fail-closed behavior, Pi RPC outer control, and per-call correlation. |
| Restate AI integrations | `restate-ai-examples` main commit `60d1eda2e5f3aae96db2efeba498e52367a01648`, tree `01bb2bef6a87b2611b38d494bd407fbc07362a38`; no declared repository license found | `REFERENCE_PATTERN` | OpenAI `DurableRunner`, Pydantic `RestateAgent`, Vercel `durableCalls(ctx)`, remote-agent, template, and awakeable approval patterns. | These target other agent/model SDKs or provide generic patterns; they are not ordinary Pi adapters. No code was copied. |
| Restate A2A/MCP examples | Pinned source evidence under `evidence/reuse-search/`; source repository metadata did not declare a license where checked | `REFERENCE_PATTERN` | Remote-agent and tool/orchestration shapes. | No Pi process/session, extension-hook or Restate↔Pi settlement binding. |

The reuse search found no direct ordinary-Pi↔Restate integration. Candidate HTTP/source evidence and the pi-chat license resolution are retained under [`evidence/reuse-search/`](evidence/reuse-search/).

## Ownership table

One authority per durable fact; the adapter translates but is not a second workflow engine.

| Concern | Authoritative owner | Boundary / translation |
|---|---|---|
| Logical operation ID | Restate | Stable workflow key/invocation identity; Kilo carries it into Pi metadata. |
| Invocation admission | Restate | Keyed workflow submission and duplicate admission. |
| Durable outer journal | Restate | Workflow journal, gate awakeable/object journals, and effect `ctx.run` entries. |
| Outer retry | Restate | Replays the bounded Pi RPC activity; Pi continues to own its own model loop. |
| Pi process lifecycle | Kilo adapter | Uses Pi `RpcClient`; starts, times out, kills/reopens local child; Restate decides outer retry. `RpcClient` does not supervise it. |
| Pi session ID/path | Pi creates native session; Kilo owns durable mapping | Pi `SessionManager` persists the inner transcript locally; Kilo binds `runId` to `sessionId`/`sessionFile` and must provide storage on retry. |
| Transcript/context | Pi | Pi owns session tree, messages and continuation semantics. |
| Provider integration | Pi | Pi's provider/model runtime; Kilo supplies configuration/credentials, not another model loop. |
| Model turns | Pi | Pi agent/provider pipeline and internal turn lifecycle. |
| Tool request | Pi | Pi `tool_call` is the truthful pre-execution boundary; adapter captures full call identity/input. |
| Tool effect execution | Restate (effect); Pi (tool contract) | Kilo reuses native tool validation/formatting but routes side effects to Restate operation handlers. |
| Approval/policy decision | Restate | Gate object/awakeable records decision; adapter explicitly translates denial/error to Pi block. |
| Cancellation | Restate owns outer state; Kilo translates | `RpcClient.abort`/tool `AbortSignal` are available; actual mapping to Restate child cancellation is not established. |
| Checkpoint/recovery | Restate outer journal; Pi inner session file; Kilo mapping | Separate scopes, not two owners for the same state. Portable Pi session recovery is unproved. |
| Parent/child operational nodes | Restate | Pi may request a child through a controlled tool; a Restate-context caller must create/attach the child. Current probe only carries parent ID as data. |
| Final semantic settlement | Restate outer result; Pi reports inner settled truth | Kilo awaits Pi `agent_settled`, serializes its result, and returns from the workflow. |
| Event projection | Kilo adapter | Merges Pi RPC observations with in-process hook events and Restate IDs; Restate journal remains authority for durable decisions/effects. |
| External-effect reconciliation | Restate journal + Kilo effect identity | Stable idempotency key/result records; side effects can repeat in a crash gap, so handlers still need operation-specific idempotency/reconciliation. |

## Impedance map

| Restate requirement | Pi native seam | Kilo translation | Class / limit |
|---|---|---|---|
| Idempotent start | `workflowSubmit` on stable key; Pi `RpcClient.start()` | Bind one Restate run ID to a Pi session/process; never treat `RpcClient.start()` itself as durable admission. | `SHAPE_ADAPTER` |
| Attach/status | Restate workflow attach/output/status; Pi `RpcClient.getState()` | Controller attaches to Restate; only the local worker speaks Pi RPC. | `SHAPE_ADAPTER` |
| Checkpoint/restore | Restate replay journal; Pi `--session-id`, `--session-dir`, `SessionManager.open/findById` | Persist binding and reopen same local session after retry. | `STATE_ADAPTER`; only same-host local file reopen was physically proven. |
| Ordered events | Pi RPC JSONL `AgentSessionEvent` plus separate extension hooks | Merge by session/turn/tool IDs; use Restate journal sequence for durable control order. RPC and hook logs alone are not a durable total order. | `SHAPE_ADAPTER` |
| Inner control hooks | awaited Pi `tool_call`, explicit `{block,reason,terminate}` | Call a Restate gate before allowing Pi's native tool wrapper to execute; explicitly block on DENY/error. | `LIFECYCLE_ADAPTER`; physically proven for four tools. |
| Effect identity/reconciliation | Pi `toolCallId`, optional `parentToolCallId`; native tool operation interfaces | Derive stable Restate idempotency keys from run/session/tool-call/operation; journal effect output; reconcile external side effects. | `STATE_ADAPTER`; no global exactly-once claim. |
| Semantic settlement | Pi `agent_settled` and RPC event collection | Only complete the outer workflow after Pi settlement/result is observed and Restate records its output. | `LIFECYCLE_ADAPTER`; physically proven in the probe. |
| Cancel/interrupt | `RpcClient.abort()`, native tool `AbortSignal` | Translate Restate cancellation to Pi abort/child termination and track late results. | `LIFECYCLE_ADAPTER`; source surface exists, end-to-end cancellation not physically tested. |
| Provider/model visibility | Pi provider hooks and RPC assistant/message events | Optional redacted Kilo projection; do not infer decisions from telemetry. | `SHAPE_ADAPTER`; raw provider hooks were not part of the acceptance specimen. |
| Native child lineage | Restate context client/invocation APIs; current external extension only has ingress | Relay child requests to a Restate-context handler or accept explicit external ingress/manual correlation. | `MISSING` for native lineage in the specimen; no Pi or Restate core change indicated. |

## Wire map: one ordinary turn

| # | Direction and API | Identity carried | Durable boundary / timeout / retry |
|---:|---|---|---|
| 1 | Controller **pushes** keyed Restate workflow submit. | Kilo `runId` / Restate workflow key. | Restate admits once; duplicate submit returned `PreviouslyAccepted` with the same invocation ID. |
| 2 | Restate handler **pulls/executes** `ctx.run("ordinary-pi-rpc-turn", ...)`, starting local Pi through `RpcClient`. | `runId` and Kilo's mapped `sessionId`/`sessionFile`. | Restate journals the activity; Kilo owns child process timeout/exit. Activity retry starts a new Pi child. |
| 3 | Kilo → Pi: `RpcClient.promptAndWait` writes the prompt over RPC JSONL and collects structured events. | `sessionId`, Pi turn index. | RPC stream is transient; Pi persists its transcript to the local session tree. |
| 4 | Pi → provider: Pi's existing provider/model loop emits assistant/tool calls. | Pi session/message identity; provider metadata remains Pi-owned. | No Kilo model runtime. Probe used native Faux provider, so no network/model call. |
| 5 | Pi → loaded extension: awaited `tool_call` before native tool execution. | `toolCallId`, `toolName`, typed input, optional `parentToolCallId`, session ID. | This is the actual control boundary; event must return ALLOW or explicit block. It has no `AbortSignal`. |
| 6 | Extension **pushes** a Restate Gate object request over HTTP, with `rpc.opts({idempotencyKey})`. | Outer `parentInvocationId`, session ID, tool call ID, gate/object key. | Restate journals ticket and awakeable before returning a pending decision; retry uses the same idempotency identity. |
| 7 | Approval/operator **pushes** ALLOW/DENY by resolving the durable awakeable. | Gate ticket/invocation ID and decision. | Decision is durable in Restate. Timeout leaves the hook awaiting; gate failure is caught and converted to fail-closed block. |
| 8 | Extension → Pi returns from `tool_call`; only ALLOW proceeds. | Same `toolCallId`. | DENY/error returns `{block:true,reason}` and Pi does not call `execute`; this was physically tested. |
| 9 | Pi invokes the reused native tool implementation; its operation callback **pushes** a Restate Tool object invocation. | `toolCallId`, operation name, `parentInvocationId`; operation idempotency key. | The specimen passes the call through Restate ingress; it is correlated by payload, not a context-native child edge. |
| 10 | Restate Tool handler **executes** the underlying `ctx.run` effect and returns structured output. | Tool invocation ID, call ID, operation ID. | Restate journals outcome; a crash after an external side effect but before journal completion can repeat the effect. Handler-level idempotency/reconciliation remains necessary. |
| 11 | Restate → Pi wrapper returns operation result; Pi's native tool formats result and emits `tool_result` / RPC `tool_execution_end`. | `toolCallId`, `toolName`, result/error, optional parent call ID. | Result is observed after effect. Blocked calls were visible in RPC `tool_execution_end` even though the extension `tool_result` hook did not fire. |
| 12 | Pi emits `agent_settled`; `RpcClient` returns the settled state/result. | Session ID, turn/tool event IDs. | Kilo waits for the authoritative Pi settled boundary; a timeout/child exit fails the Restate activity and triggers Restate retry. |
| 13 | Restate handler returns `ctx.run` result and terminal workflow result. | Outer workflow/invocation ID. | Restate journals final output and status; repeated submit/attach resolves to the same outer identity. |
| 14 | Controller **pulls** attach/output/status; operator may query `sys_invocation_status`/`sys_journal`. | Outer invocation ID plus recorded gate/tool invocation IDs. | Restate is authoritative. Extension JSONL/process logs are local evidence only, not durable status. |

## Physical interception results

| Pi tool | Native pre-tool interception | Durable decision / operation | Result and observed boundary |
|---|---|---|---|
| `read` | `tool_call` carried `read-1`; gate awaited before execution. | ALLOW; Restate `access`/`read` operations. Gate replay after Pi child death reused the same gate invocation ID. | Native read returned `original\n`; executed once after reopen in this one probe. |
| `write` | `tool_call` carried `write-1`; gate awaited. | ALLOW; Restate `access`/`mkdir`/`write`. | `written.txt` contains `written by Pi\n`; native result observed. |
| `edit` | `tool_call` carried `edit-1`; gate awaited. | ALLOW; Restate `access`/`read`/`write`. | `seed.txt` changed from `original\n` to `edited by Pi\n`; native edit result/diff observed. |
| `bash` | `tool_call` carried `bash-1`; gate awaited. | ALLOW; Restate `bash` operation with a harmless `printf`. | Native structured result `exit_code: 0`, output `bash-ok\n`. |
| denied `write` | `tool_call` carried `write-deny`; gate returned DENY. | No `tool_execute` or remote effect call. | Pi RPC `tool_execution_end` reports error; `denied.txt` was not created. |
| failing gate for `edit` | `tool_call` carried `edit-fail`; gate returned intentional HTTP 500. | Extension explicitly returned fail-closed block; no `tool_execute` or remote effect call. | Pi RPC reports `Restate gate unavailable; blocked fail-closed`; seed remained edited, not overwritten. |

For all four native tools the pre-execution hook, call ID, async wait, and Restate-backed operation path were exercised. This run had top-level calls (`parentToolCallId: null`); nested ancestry is supported by the Pi fields but not exercised. `tool_call` itself receives no abort signal. The registered native tool execute callbacks receive an `AbortSignal`; propagation to cancellation of an already-admitted Restate invocation is not proven.

## RPC + extension result

| Capability | Result |
|---|---|
| Start ordinary exact-source Pi RPC with extension loaded | **Physical pass.** Pi CLI ran through `RpcClient` and the goal-local extension in the same process. |
| Prompt / provider / native tool pipeline | **Physical pass.** Faux provider scripted genuine native Pi tool calls through Pi's own loop. |
| Lifecycle and tool events | **Physical pass.** RPC event stream returned turn/tool execution and `agent_settled`; in-process hooks supplied full typed input and pre-tool decisions. RPC alone does not export extension callbacks. |
| Wait for authoritative settlement | **Physical pass.** `agent_settled` preceded returned final text `probe complete`; Restate workflow then became ready/completed. |
| Reopen Pi identity after child process death | **Physical pass, same host only.** Two process starts used the same session ID and session file. |
| Restate keyed start/attach | **Physical pass.** First submission `Accepted`; duplicate `PreviouslyAccepted` with same invocation ID; pending output was not ready; attach settled `completed`. |
| Steer / follow-up / abort | `RpcClient` source exposes these RPC methods. This specimen did not physically exercise them. `abort()` does not prove Restate cancellation or child termination. |
| Restart controlling Kilo/Restate worker or move to another host | **Not tested.** The killed process was the Pi child; Restate activity retried on the running worker. Session-file portability is not established. |

## Durable gate result

Successful run: `probe-1791201303431-f1f53dfa`. Outer Restate invocation `inv_1cQL8pRLjNm63srUcnei9MCabEhtRDAdxf`; Pi session `b79f6e00-a065-475a-af98-0aa7a2ec5332`. The persisted session file is goal-local under that run's `sessions/` directory.

Five Gate tickets were observed (read, write, edit, bash, denied write); `edit-fail` generated an intentional gate error rather than a ticket. ALLOW and DENY were actual Restate responses, not local mock callbacks. The gate held an awakeable until resolution. Pi's `tool_call` returned an explicit block on DENY and gate error; the native executor did not start in either case. The Restate journal/introspection capture contains 15 invocation rows and 65 journal rows across the outer workflow and gate/tool objects. The outer journal contains the `ordinary-pi-rpc-turn` activity; Gate/Tool ingress invocations have their own journals and are correlated with the outer ID in request/event payloads.

## Crash result

The probe killed the Pi child after Restate had durably recorded ALLOW for `read-1` and before the native operation executed. The first RPC collection timed out. Restate retained the same outer invocation and retried the `ctx.run` activity. A second Pi child reopened the same local session identity/file; Pi repeated the call, and the Gate reused the same invocation ID/decision. The read executed and the Pi agent settled; Restate attached to the same outer invocation and returned `completed`.

**Observed for this specimen:** one outer identity, two Pi process starts, replayed read gate under the same gate invocation identity, one post-reopen read operation, final `agent_settled`, final Restate result. **Not established:** global exactly-once effects; no concurrent/host-loss test; no worker process restart; no cross-host session file; no late-effect reconciliation after a crash in the external-effect/Restate-journal gap. The first run's output-capture failure is preserved separately and is not counted as a pass.

## Visibility contract

`CONTROL` entries authorize/change a state transition. `OBSERVATION` entries report a boundary already reached. The probe's local JSONL files are evidence, not a durable event store; only Restate invocation/journal state is durable authority. Kilo should persist bounded/redacted projections and use Restate journal order, not local timestamps, as control order.

| Minimum event | Native source / relation to effect | Type and Restate representation | Correlation identity | Durability, payload, replay |
|---|---|---|---|---|
| `RUN_STARTED` | Restate workflow admission, before Pi start. | `CONTROL`; workflow input/journal. | `runId`, Restate invocation ID, idempotency key. | Durable before child spawn; retain request digest/metadata, not secret prompt body; dedupe by workflow key. |
| `TURN_STARTED` | Pi RPC `turn_start`, before provider/tool work. | `OBSERVATION`; append bounded event or project to workflow journal. | run ID, Pi session ID, turn index. | Persist only if UI/audit needs ordering; dedupe by session+turn. |
| `MODEL_STARTED` | Pi `before_provider_request` (source hook, before provider request); not separately instrumented in this probe. | `OBSERVATION` (or control only if policy is deliberately placed here). | run/session/turn, provider/model, request ID if exposed. | Redact prompt and credentials; do not mistake telemetry for control; dedupe per provider request. |
| `MODEL_SETTLED` | Pi `after_provider_response` or RPC `message_end`, after response. | `OBSERVATION`; record completion/usage metadata. | run/session/turn/message ID. | Bounded metadata; never require full provider payload for settlement; dedupe by message/request ID. |
| `TOOL_REQUESTED` | Pi `tool_call`, before execution; physically exercised. | `CONTROL`; create/attach durable Gate request. | run/invocation, session, `toolCallId`, optional `parentToolCallId`, tool name. | Durable gate identity before ALLOW; redact/bound input, preserve schema-safe hash; retry same call ID. |
| `TOOL_DECIDED` | Restate Gate/awakeable response, before Pi proceeds. | `CONTROL`; Gate journal/result; explicit ALLOW/DENY/DEFER/error. | gate invocation/ticket ID + tool call ID. | Durable before tool execution; decision is not re-created on retry; DENY/error must explicitly block. |
| `TOOL_STARTED` | Kilo wrapper / Restate Tool invocation admission, before external operation. | `OBSERVATION` with a durable effect-start command; operation handler owns execution. | tool call ID, operation key, Restate tool invocation ID. | Persist stable operation identity; avoid full command/output secrets; replay by operation key. |
| `TOOL_SETTLED` | Pi `tool_result` after successful execution; RPC `tool_execution_end` also reports blocked/error results. | `OBSERVATION`; result/error reference plus Restate effect outcome. | tool call ID, operation invocation ID, attempt. | Persist outcome before returning to Pi; bound/redact content; dedupe by operation identity. |
| `TURN_SETTLED` | Pi `agent_settled` after the loop; do not substitute `turn_end`. | `OBSERVATION`; awaited by Kilo activity. | run/session/turn. | Record settled result reference; replay cannot settle the outer run twice. |
| `RUN_SETTLED` | Restate workflow output/status after Pi settlement. | `CONTROL` for outer terminal transition; `workflowOutput`/journal. | workflow key/invocation ID. | Durable terminal result; idempotent attach. |
| `RUN_FAILED` | Restate terminal invocation error, or Kilo maps an unrecoverable Pi/RPC failure. | `CONTROL`; Restate terminal status/result. | run/invocation ID, failure class. | Persist bounded error/cause; do not convert transient timeout to success; retry policy owned by Restate. |
| `RUN_INTERRUPTED` | Restate cancellation plus Kilo translation to `RpcClient.abort`/child stop. | `CONTROL`; Restate cancellation/status. | run/invocation ID, Pi session/process identity. | Must define late-result handling; not physically exercised. Do not claim RPC abort cancels Restate work. |
| `CHECKPOINT / SESSION_IDENTITY` | Pi `RpcClient.getState()` (`sessionId`, `sessionFile`) and Pi session manager. | `OBSERVATION`; Kilo durably stores mapping in Restate-owned run state. | run ID, Pi session ID, storage locator/version. | Persist the mapping, not secrets or entire transcript; local session path is not portable recovery. |
| `CHILD_STARTED / CHILD_SETTLED` | Restate context creates/awaits child; not emitted by Pi subagent as Restate truth. | `CONTROL` at create/await; `OBSERVATION` at child result. | parent Restate ID, child Restate ID, originating Pi tool call. | Child identity/journal durable; dedupe child creation by parent+tool-call key. Not physically exercised here. |

## Parent/child port

Pi's `subagent` extension is a useful local worker/session reference, but it makes Pi the child lifecycle manager. Restate AI remote-agent examples are cross-runtime patterns. Existing Kilo `KiloNode.parentChild` demonstrates a Restate context invoking another Restate object. The clean law is:

```text
Pi proposes a child operation at tool_call
  → Kilo applies the Restate gate
  → Restate context creates or attaches the child using a stable key
  → Kilo returns child ID/result to Pi
```

The Restate side, not Pi, must own the child operation ID and settlement. In this probe the extension process called Gate/Tool endpoints through Restate ingress; `parentInvocationId` was carried in request/event payloads. These are separate invocations, not platform-created causal children. A context-relay/awakeable boundary is needed if native Restate lineage is required; no full child orchestration was implemented.

## Pi Durable relationship

`@earendil-works/pi-durable` is classified `FUTURE_REPLACEMENT`, not a helper beneath Restate. No isolated checkpoint/session/task component was found that avoids its harness/journal ownership. Using it for the same operation under Restate would create competing session/task journals and retry/settlement authorities. Do not integrate it in this architecture.

## Adapter class and irreducible Kilo ownership

**`THIN_NEW_ADAPTER`** — no existing complete integration, but Pi's official RPC/extension/native-operation ports and Restate's workflow/awakeable/effect primitives are stable and physically composed. This is not `EXISTING_INTEGRATION` or `ADAPT_EXISTING`: no package already supplies the full Restate↔Pi boundary. It is not `DEEP_ADAPTER` or `CORE_CHANGE_REQUIRED`: the tested path needed no Pi/Restate internal modification and reused Pi's model loop, RPC protocol, tool schemas, and operation implementations.

Kilo must own only:

1. Stable `runId` ↔ Pi session ID/storage locator mapping and local Pi child lifecycle under Restate retry.
2. Restate gate request/decision mapping to Pi's explicit `tool_call` ALLOW/block response, including fail-closed handling.
3. Restate-backed native tool operation callbacks, stable operation idempotency keys, and effect-specific reconciliation.
4. Correlation/projection across RPC events, extension hooks, Restate invocation IDs, and Pi settlement; decide what event payloads are retained/redacted.
5. Mapping Pi `agent_settled` to the Restate workflow's terminal semantic result.
6. If required, a context-aware parent→child relay and Restate cancellation→Pi process cancellation. These were not part of the passing specimen and are the principal remaining lifecycle tax.

## No-fork criterion

**Pass.** Exact Pi source ran without creating `dist`; Pi and Restate checkouts stayed at their pinned revisions. No provider/model/runtime internals changed; no clone or branch was created. The physical adapter files and generated artifacts are confined to this goal's `.agent/goals/.../evidence/physical-probe/`. Pre-existing untracked Pi files and shared Kilo `probe/` files were preserved.

## Do not build

- A second Pi provider/model loop, agent runtime, RPC protocol, session format, or reimplementation of built-in tool schemas/formatting.
- A custom durable retry/journal/approval engine; Restate already owns those outer facts.
- Pi Durable underneath the Restate-owned operation; it would create competing ownership.
- An OTEL/event bus as a substitute for pre-tool control or durable decision state.
- Full Pi subagent orchestration or a generic event mirror; build only the child/event projections the accepted contract requires.

## Unanswered questions capable of changing the architecture

1. Must production recovery survive Restate worker/host loss? If yes, select and physically verify a shared/persistent Pi session store and define the run↔session locator before commissioning implementation; this probe only reopens a local file on the same host.
2. Does the accepted contract require Restate-native causal child lineage, rather than durable independent ingress calls with a manual parent correlation field? If yes, the adapter needs a Restate-context relay/child-creation path.
3. What external effects require idempotency/reconciliation beyond Restate's journal? The crash gap means exactly-once effects cannot be inferred; each effect contract must state its own dedupe/recovery behavior.

RPC abort/steer/follow-up physical coverage, production event retention/redaction, and worker/process hardening remain implementation checks, but did not change the demonstrated native integration route and are not used to claim production readiness.

## Evidence pointers

- Full raw successful specimen: [result.json](evidence/physical-probe/runtime/probe-1791201303431-f1f53dfa/result.json).
- Process starts/retry evidence: [process-events.jsonl](evidence/physical-probe/runtime/probe-1791201303431-f1f53dfa/process-events.jsonl); [sessions/](evidence/physical-probe/runtime/probe-1791201303431-f1f53dfa/sessions/).
- Extension hook, gate and effect records: [extension-events.jsonl](evidence/physical-probe/runtime/probe-1791201303431-f1f53dfa/extension-events.jsonl), [gate-errors.jsonl](evidence/physical-probe/runtime/probe-1791201303431-f1f53dfa/gate-errors.jsonl).
- Disposable service/extension/driver and runner: [service.ts](evidence/physical-probe/service.ts), [extension.ts](evidence/physical-probe/extension.ts), [driver.ts](evidence/physical-probe/driver.ts), [run.sh](evidence/physical-probe/run.sh); acceptance checker [validate.py](evidence/physical-probe/validate.py).
- Initial failed capture, preserved for audit: [first-run-status.json](evidence/physical-probe/first-run-status.json), [cleanup-first-run.json](evidence/physical-probe/cleanup-first-run.json).
- Deployment cleanup/current inventory: [probe-cleanup-verification.json](evidence/physical-probe/probe-cleanup-verification.json), [cleanup.json](evidence/physical-probe/cleanup.json), [deployments-after-run.json](evidence/physical-probe/deployments-after-run.json).
- Pinned source identities: [source-identities.json](evidence/physical-probe/source-identities.json); scoped TypeScript result: [typescript-check.json](evidence/physical-probe/typescript-check.json), [typescript-check.log](evidence/physical-probe/typescript-check.log).
- pi-chat license/source evidence: `evidence/reuse-search/pi-chat-LICENSE`, `pi-chat-package.json`, `pi-chat-runtime.ts`, commit metadata under `evidence/reuse-search/`.
- Restate example versions/sources: `evidence/reuse-search/restate-ai-examples-main.json`, `restate-ai-examples-tree.json`, and pinned template files under `evidence/reuse-search/`.
- Existing Kilo reference surfaces: baseline `probe/service.ts`, `probe/pi-extension.ts`, `probe/approve.ts`, and `probe/check.ts` at Kilo baseline `c6779f182c7502aa65916767445b1f55c625fee3`.

## Final boundary

This return answers the reuse/physics question only: **ordinary maintained Pi and Restate compose without a Pi fork, through a thin Kilo-owned bridge**. It does not implement the production operational node or choose whether the Software Factory should migrate to this representation.