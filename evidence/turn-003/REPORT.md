# Turn 003 — Restate ownership of a Pi coding actor

**GOAL:** Prove or falsify whether Restate can own the durable lifecycle of a real Pi coding actor without reconstructing a second semantic-agent runtime.

**RESULT: ACHIEVED** — the bounded challenge resolved the architecture question. **CLASSIFICATION RESULT: B.** **MIGRATION DECISION: not requested; none made.**

Restate can host a small keyed lifecycle wrapper that launches and re-launches a real Pi RPC process on the same machine, retaining one run/turn identity and one settled tool effect in this controlled failure. The missing owner is the Pi conversation state: recovery depended on the host-local Pi JSONL session. Removing that file left the Restate object completed but a new Pi process with the same session ID had zero messages. The experiment stopped there; no transcript replication, cross-host workaround, or product change was attempted.

## GAP

The missing capability is portable ownership of Pi's semantic transcript and its incomplete tool-call state, plus native effect correlation/idempotency across retries. The physical discriminator is exact: Restate state remained completed after the Pi session file was unavailable, while the same Pi session ID exposed zero prior messages.

## Capability-physics table

| Capability | Source/documented behavior | Physical observation in this turn | Inference |
|---|---|---|---|
| Run / turn identity | Restate virtual objects provide a stable object key, state, invocation journal, and named `ctx.run` actions. The existing Kilo adapter's `actorId`, `sessionId`, and attempt fields are request metadata. | `DurableAgent` object key/run ID `turn003-20261003T201940Z-3970555`; logical turn `turn-003-post-effect-crash-…`; one Restate run invocation `inv_1dKKeKvXmxOb7soguoJK3qj1D07yTyWFEW`; actor attempt 1 and 2 retained the same Pi session ID. | A small Restate object can own same-host attempt sequencing and custom run/turn identity. These are wrapper-defined fields, not native Pi actor identity. |
| Failure after tool effect | Pi RPC distinguishes `tool_execution_end` from `agent_settled`; Restate `ctx.run` journals results but documents a small re-execution window before the result is durable. | Pi PID `3976905` received SIGKILL at `tool_execution_end`, 56 ms after KiloNode invocation `inv_18w9UfEEUiXp6xP6QZaoNopSjfsvbGB2hq` was completed in Restate. The non-idempotent append left exactly one marker line. A new Pi PID `3977390` read the file and settled `RECOVERED`. | The bounded scenario recovered without repeating the observed effect. It does **not** prove exactly-once arbitrary effects, replay safety in Restate's success/recording gap, or recovery after the Restate worker itself dies. |
| Pi transcript / settlement | Pi sessions are JSONL files in a session directory. `agent_end` is not final settlement; `agent_settled` means no automatic retries/queued work remain. | At the kill boundary the local transcript had one user prompt, one assistant tool call, and **no tool-result message**. After relaunch, the same file/session had one original prompt, one new recovery prompt, and the read result; original prompt count remained one. | Restate did not own a complete Pi transcript in this implementation. A recovery instruction had to be sent into Pi after re-opening its existing local session. |
| Session-file loss | Pi RPC exposes the session ID, session file, and message count. Restate object state is independent of the Pi file. | Temporarily moving the completed session file out of Pi's session directory, then opening the same session ID, returned `messageCount=0` and `getMessages().length=0`. The Restate object still reported `phase=completed`, `actorAttempt=2`, and the old session-file path. The new path returned by Pi was not present to archive after the no-prompt process closed; the original file was restored. The wrapper was not asked to run another Pi task after this loss. | **Exact portability failure:** the Restate state does not restore Pi conversation history when the recorded host-local JSONL file is unavailable. This is a same-host path-loss test, not a second-host deployment test. |
| Effect identity / parentage | Existing `probe/pi-extension.ts` sends each tool call through ingress; `probe/service.ts` wraps its operation in `ctx.run`. It does not pass an explicit stable ingress idempotency key or invoke KiloNode as a child of `DurableAgent`. | Two KiloNode calls were separate `invoked_by=ingress` invocations with different generated idempotency keys. Their result metadata had `parentNodeId=null`; correlation to the Restate actor was custom `actorId`/`sessionId`/attempt/tool-call metadata. Both invocation rows and the parent object invocation completed successfully. | Run correlation exists, but there is no native parent-child tool-invocation link or adapter-level deduplication across a retried tool call. The one-line effect count is scenario evidence, not a general duplication bound. |
| Process and retry ownership | `DurableAgent` used explicit `ctx.run("pi-attempt-1/2")` actions. Smithers source separately contains durable run claims/fencing, heartbeat-based stale-run reclaim, transcript projection, workspace checks, and ownerless spawned-process records for reaping. | The live Restate worker remained up while its Pi child was killed and relaunched. The parent invocation was `completed` with 13 journal entries and two named Pi-attempt actions; no suspended invocation or Restate worker restart occurred. | This establishes a wrapper-supervised Pi subprocess path, not Restate-native supervision of arbitrary Pi workers. Worker restart and orphan cleanup remain untested here. |
| Status and structured result | Restate exposes invocation status, pinned deployment, journal sizes, and JSON handler results through the admin query API. | The `DurableAgent.run` invocation completed successfully on deployment `dp_14PqsFrcNJa0ySKeDgRKnBf`; its JSON result reported `status=recovered`, two attempts, stable IDs, tool records, and `finalText=RECOVERED`. Both KiloNode calls completed successfully on `dp_16QZTEX6fyawrCnrAe5vqTL`; no suspension was observed. | Operational observability is strong, but a completed Restate invocation is not proof that Pi's semantic turn settled or that its transcript is portable. |
| Workspace, approval, and control | The probe's KiloNode worker uses a configured `WORKSPACE` but the adapter has no workspace ownership check/signature boundary; Smithers has `HistoryWorkspace.canExecute` and durable approval/park/resume paths. | The probe wrote only under its unique evidence workspace. No approval was tested in this turn; prior Turn-002 evidence is retained separately. The selected Smithers commissioning evidence reports approval wait, original-process termination, and fresh-process resume. | Restate can durably mediate a workspace effect, but this specimen did not establish Smithers-like workspace fencing or human-control semantics for a Pi actor. |
| Smithers comparison | Smithers source: `AgentSession.ts`, `FlowEngineLike.ts`, `Transcript.ts`, `Ownership.ts`, `RunDriver.ts`, `ProcessLedger.ts`, `ProcessReaper.ts`, `history/Workspace.ts`, `SemanticSettlement.ts`. | The accepted commissioning report records a native run parked at approval, the original Smithers process terminated, a fresh process resumed the same run, and final status `completed`. No matched Smithers test was run for this turn. The report's claimed post-run test pass conflicts with `returns/final-run-show.json`, which says the test could not execute in that shell; suite-pass status is therefore not relied on. | Smithers provides more of the lifecycle machinery for its integrated agent engine, but its process ledger/reaper is not proof that it launches or restores this Pi RPC subprocess. It is a source/evidence comparator, not an asserted replacement for Pi. |

## AGENT WORK

A disposable `DurableAgent` virtual object on a separate local Restate endpoint launched two bounded Pi RPC attempts using the unchanged existing adapter. Attempt 1 was killed after a completed KiloNode effect; attempt 2 reopened the same session, read the effect, and settled. The runner then removed the session file briefly, queried a same-ID fresh Pi session without sending a model prompt, read the Restate object state, and restored the original file. No Restate or Smithers source, existing probe code, or product behavior was changed.

## EXACT HOSTILE EVIDENCE

- Run: `evidence/turn-003/hostile-boundary/runs/turn003-20261003T201940Z-3970555/summary.json` (raw Restate invocation/journal query results, attempt events, transcript counts/hashes, deployment snapshot, session-loss observations, and ten assertions; verdict `PASS`).
- Independent saved re-read/assertion: same run directory, `validation.json` (`PASS`, ten predicates, actor and effect invocation IDs, restored session hash, and post-cleanup checks). `MANIFEST.sha256` checks the contract, admission, actor assignment/trace/reports, scripts, session, effect, and key run captures.
- No product test suite was run; no product or existing probe source was changed.
- Realized code is confined to `evidence/turn-003/hostile-boundary/actor-service.ts` and `run.ts`; the Pi tool extension and KiloNode service were reused unchanged.
- Restate server `1.7.13`, TypeScript SDK `1.17.2`, Pi `1.0.0`, Node `v22.22.2`, model `openai-codex/gpt-5.6-luna`.
- `DurableAgent` deployment `dp_14PqsFrcNJa0ySKeDgRKnBf`; existing KiloNode deployment `dp_16QZTEX6fyawrCnrAe5vqTL`. The temporary deployment was submitted for removal after all run-key invocations were complete; the container was returned to its pre-run `exited (0)` state. Exact setup/cleanup records are in the run directory.
- The pre-existing KiloNode worker warns that it accepts requests without signature validation; the adapter also has unrestricted `bash`. This remained a disposable local probe, not a security boundary.

## ROOT CAUSE / CAPABILITY BOUNDARY

The failure is not in Restate's ability to persist a keyed object's state or journal a named action. The missing ownership is between that durable state and Pi's semantic session. In the wrapper, Restate stores IDs, attempt records, hashes, and the session-file path; Pi stores the conversation in a host-local JSONL file. Removing the file preserves the former and loses the latter. Tool invocations also enter Restate independently through ingress, so their relationship to the logical turn is metadata rather than a native child invocation or a stable deduplication key.

The first attempt's completed KiloNode result was visible to the wrapper's Pi RPC event, but the Pi session file at the kill point still contained an unresolved assistant tool call and no tool-result message. The same-host continuation succeeded while the existing session file remained available and the wrapper sent a new recovery prompt; this does not show that Restate reconstructed the missing transcript or automatically completed the original Pi turn.

## RECONSTRUCTION TAX

To claim portable actor lifecycle ownership rather than the demonstrated same-host wrapper, additional work would have to define and own: Pi transcript/session portability or a supported shared session store; crash recovery around incomplete tool-call records; durable turn/settlement and continuation rules; stable per-effect idempotency/correlation across replays; and process ownership/fencing/cleanup when the Restate worker itself restarts. No such machinery was built. Building transcript replication to force a pass was explicitly out of scope.

## RESTATESTRENGTHS

Observed strengths: the Restate object key and journal gave one queryable run identity; `ctx.set` retained wrapper state; named `ctx.run` actions recorded the two bounded Pi attempts; completed KiloNode effects were queryable through `sys_invocation` and `sys_journal`. The same-host actor recovery and one-effect outcome are useful positives, not exactly-once claims.

## NEW LEARNING FROM RESTATE

The KiloNode tool invocation can complete and return its result to the wrapper before the corresponding Pi tool-result message is present in the Pi JSONL file. Killing at that exact RPC event preserved the user prompt and assistant tool call but not the tool result. Pi turn settlement and Restate tool-effect settlement are distinct durable boundaries.

## SMITHERS COMPARISON

Read-only Smithers inspection found stronger integrated lifecycle ownership: run claims and fencing in `Ownership.ts`/`RunDriver.ts`; stale-running sweep (batch cap 64); journal-derived agent transcript projection and journal validation in `Transcript.ts`; stable activity keys in `FlowEngineLike.ts`; workspace execution checks; and host-process spawn/exit/orphan/reap records in `ProcessLedger.ts`/`ProcessReaper.ts`. The commissioning evidence supports fresh-process resume of a Smithers run through approval. It does not establish arbitrary Pi subprocess/session restoration, and a saved test-status contradiction prevents relying on the report's test-suite claim.

## DO NOT RELY ON

- The single append count as a proof of exactly-once external effects.
- The Pi child kill as a Restate worker/process restart test.
- The same-host session reopen as proof of cross-host portability.
- Request fields as native parent-child linkage or idempotency.
- The Smithers commissioning report's test-suite pass claim; its saved return conflicts.
- The earlier Turn-002 manual session continuation as automatic actor recovery; Turn-002 remains separate evidence.

## UNANSWERED QUESTIONS

- What happens if the Restate worker dies after the KiloNode effect but before the enclosing `ctx.run` result is persisted? Restate documents a re-execution window; it was not injected here.
- Can a shared, supported Pi session store make this actor portable without custom transcript replication? Not tested.
- What deduplication contract should apply when the same Pi tool call is reissued with a new ingress idempotency key? Not tested.
- How would cancellation, process fencing, orphan reaping, and recovery interact during worker restart? Not tested.

## FACTORY FEEDBACK

The verbatim Turn-003 assignment and its matching SHA-256 are preserved in `ITERATION.md` and the actor-turn `ASSIGNMENT.md`; `SEMANTIC_ADMISSION.md` records the inferred bounded challenge. Formal provenance for a canonical Factory goal remains unavailable, so this report does not update `FACTORY_STATE.md`, claim completion of an existing goal, or rewrite the earlier inferred goal.

## NEXT PROMPT

If portability is later required, commission a separate, bounded design/probe for a supported Pi session-store or transcript-replay boundary before implementation. Do not treat this result as a migration instruction.

## Source and evidence references

- Pi RPC/session contracts: runtime `docs/json.md`, `docs/rpc-commands.md`, `docs/session-format.md`, and `docs/sessions.md`.
- Restate effect contract: installed TypeScript SDK `dist/context.d.ts` (`ctx.run` persisted result and success-before-result-persistence window); live invocation SQL is included in `summary.json`.
- Adapter: `probe/pi-extension.ts`, `probe/service.ts`, and `probe/client.ts` (unchanged by this turn).
- Smithers implementation: `packages/smithers/agent/src/AgentSession.ts`, `packages/smithers/agent/src/FlowEngineLike.ts`, `packages/smithers/agent/harness/src/Transcript.ts`, `packages/smithers/flows/run-store/src/Ownership.ts`, `packages/smithers/flows/engine-store/src/internal/RunDriver.ts`, `packages/smithers/flows/kernel/src/ProcessLedger.ts`, `packages/smithers/flows/platform-node/src/ProcessReaper.ts`, `packages/smithers/src/history/Workspace.ts`, and `packages/smithers/src/SemanticSettlement.ts`.
- Smithers commissioning comparison: `.agent/goals/kilo-smithers-production-commissioning-2026-09-28/REPORT.md` and `returns/final-run-show.json` (read-only; internally inconsistent test-suite status).
