# Actor turn 004 return — user iteration 003

**GOAL:** Prove or falsify whether Restate can own the durable lifecycle of a real Pi coding actor without reconstructing a second semantic-agent runtime.

**RESULT: ACHIEVED — CLASSIFICATION B.** The hostile evidence isolates a material missing owner: Pi conversation state is a host-local JSONL session, not part of the Restate object's durable actor state. **MIGRATION DECISION: not requested; none made.**

**GAP / ROOT CAUSE:** A keyed Restate virtual object can sequence two Pi subprocess attempts on the same host and retain custom run/turn IDs, but recovery depended on re-opening the same local Pi session file. Moving that file away and reopening the same session ID returned zero messages while the Restate object remained `completed` and retained a pointer to the unavailable original file. The unresolved Pi tool call/result transcript and session portability are not owned by this thin adapter.

**AGENT WORK:** Reused the existing KiloNode service and Pi extension unchanged. Added a disposable `DurableAgent` object and runner only under `evidence/turn-003/hostile-boundary/`. Killed Pi PID `3976905` with `SIGKILL` at `tool_execution_end`, after KiloNode invocation `inv_18w9UfEEUiXp6xP6QZaoNopSjfsvbGB2hq` was completed and before `agent_settled`; relaunched Pi PID `3977390` with the same session ID, read the effect, and settled `RECOVERED`. The physical append count was exactly one in this controlled run. Then temporarily removed the local session file and confirmed the same-ID Pi session exposed zero prior messages. Stopped both workers and returned the previously stopped Restate container to `exited (0)`.

**RESTATE STRENGTHS:** Durable object key/state, named `ctx.run` attempt journal, stable invocation IDs, and SQL-queryable effect records made the same-host wrapper and result observable.

**RECONSTRUCTION TAX:** Portable recovery would require an owned Pi transcript/session persistence boundary, recovery rules for incomplete tool-call records, stable per-effect idempotency/correlation, and worker-level process fencing/reaping. None was built. The run did not test Restate worker death or the documented effect-success/result-persistence window.

**SMITHERS COMPARISON:** Smithers source shows durable run ownership/fencing, heartbeat reclaim, journal-derived transcript projection, stable activity keys, workspace checks, process ledger/reaping, and semantic settlement. Its commissioning evidence records fresh-process resume of a native Smithers run through approval, but does not prove Pi subprocess restoration; its test-suite status is inconsistent between report and saved return. No matched Smithers experiment was run.

**CAPABILITY-PHYSICS TABLE / EXACT HOSTILE EVIDENCE:** See [`evidence/turn-003/REPORT.md`](../../../../evidence/turn-003/REPORT.md). Raw invocation/journal rows, transcript/session-loss captures, deployments, and ten passing assertions are in [`evidence/turn-003/hostile-boundary/runs/turn003-20261003T201940Z-3970555/summary.json`](../../../../evidence/turn-003/hostile-boundary/runs/turn003-20261003T201940Z-3970555/summary.json); independent evidence validation is in `validation.json`.

**NEW LEARNING FROM RESTATE:** A completed KiloNode tool invocation and successful external effect do not imply the Pi transcript has durably recorded its tool result. At the injected boundary, Pi's JSONL contained the original prompt and assistant tool call but no tool-result message; the recovery prompt was a separate user message.

**DO NOT RELY ON:** This one append as exactly-once proof; same-host session reopen as cross-host portability; custom metadata as native parent-child linkage; this child kill as a Restate worker restart test; or the contradicted Smithers suite-pass claim.

**UNANSWERED QUESTIONS:** Worker death between external effect and enclosing `ctx.run` persistence; supported cross-host Pi session storage; idempotency for reissued tool calls; worker-restart cancellation/fencing/orphan recovery.

**FACTORY FEEDBACK:** The work-order copy/hash and inferred admission are preserved. Canonical Factory goal provenance remains unavailable; no `FACTORY_STATE.md` or prior goal status was modified.

**NEXT PROMPT:** If portability matters, commission a separate bounded probe/design for a supported Pi session-store or transcript-replay boundary. This report does not authorize migration.
