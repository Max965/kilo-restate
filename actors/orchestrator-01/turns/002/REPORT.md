# Actor return — Persisted Pi session lifecycle

## OUTCOME

**RESIDUAL FRONTIER**

## CLAIM

**Pi's native persisted session resumed successfully after its process was no longer alive, and its subsequent `read`, `edit`, and `bash` calls remained Restate-routed.** Restate did not own or restore the Pi session; the operator relaunched Pi with the same local session file/ID, node, actor, and workspace. This answers the bounded continuity probe, not whether Restate alone supplies a Kilo operational actor.

## SUBJECT

Local `kilo-restate` probe: existing `probe/pi-extension.ts` and `probe/service.ts`, lifecycle fixtures and evidence under `evidence/turn-002/`. No Restate upstream changes.

## PROOF

Real Pi RPC processes, same-host persisted Pi JSONL session, Restate admin SQL before/after, Pi tool results, independent Node assertions, direct-Pi baseline. Detailed identities and evidence paths follow.

## CHANGED

No adapter, handler, policy, or UI source changed. Turn 002 adds isolated workspace results, evidence, `README.md` reproduction guidance, and this report/semantic trace.

## CAPABILITY / OWNERSHIP

Pi owns conversation persistence; the operator owns restarting and reattaching the correct session/workspace; Restate owns the mediated tool invocation journal. The adapter is thin composition, not a process supervisor or OS security boundary.

## Specimen and recovery

- Provider/model/thinking: `openai-codex/gpt-6-luna`, `max`; real Pi RPC session `50782890-f2b9-4de9-80f8-8a8a16fc11a6`.
- Workspace: `evidence/turn-002/workspace-restated`; Restate node prefix `pi-lifecycle-node`, actor `actor-01`. Tool metadata advanced `actorAttempt` from `1` to `2`; this label is distinct from Restate's retry metadata.
- Pi session file: `/home/miles/repos/runtime/.pi/agent/sessions/--home-miles-repos-agent-harnesses-kilo-restate-evidence-turn-002-workspace-restated--/2026-10-03T17-22-11-007Z_50782890-f2b9-4de9-80f8-8a8a16fc11a6.jsonl`. Its hash changed from `a7ea8941…274ab50` after stage one to `0f6d8f9e…c7fec1d8` after resumed stage two. Filtered evidence transcripts omit system prompts and thinking/signatures.
- Stage one read the task, reported exact `amber -> queue-amber-r7`, fallback `queue-default`, case-sensitive, and did not edit. Before restart Pi reported one user message, two assistant messages, two tool calls/results, with the stage-one answer as last assistant text.
- The first process PID (`3035867`) was confirmed absent after the interactive shell became user-takeover and its output was transferred. No exit signal or cause was captured. Thus the process boundary and resume are evidenced, but this was not a controlled `SIGKILL` or power-loss test.
- After recording the brief hash (`c00f0d03…cd21cd1`), `TASK.md` was removed. Pi restarted with the same session ID/file, model, node/actor, and workspace; only `actorAttempt=2` changed. `get_state`/stats returned the same session file and the previous answer. Stage two used that context to read `route.js`, edit the marker and test `amber`/`AMBER`; it did not read the absent task file.
- Restate `sys_invocation` rows increased from 2 to 5, all status `completed`; both original IDs remain and exactly three new attempt-2 invocations are present (`read route.js`, `edit route.js`, `bash`). The one successful `TASK.md` read has the same invocation ID before/after and appears only once. The initial out-of-workspace skill read is a failed tool result inside a settled Restate invocation, not a Restate retry.
- The live Restate deployment and worker stayed up throughout the Pi process boundary. Deployment `dp_16QZTEX6fyawrCnrAe5vqTL`, container ID and worker PID are in `evidence/turn-002/lifecycle-summary.json`.

## Direct Pi comparison

The direct run used a separate session and workspace with the same initial task hash, same two prompt strings, provider/model and thinking level, but Pi's built-in tools and no custom extension. It returned the same mapping. It made 15 tool calls/results, including skill reads and a failed CommonJS-style check under the repository's `type: module`; after inspecting the module configuration, it added an ESM export and passed assertions. The Restate run used five tool calls/results, including one out-of-workspace rejection. This is not a tool-efficiency or cost benchmark: tool availability and automatic skill reads differed. Independent host-side assertions passed on both resulting files. The Restate fixture has a function declaration without an export; the direct fixture exports it for ESM import. Both implementations satisfy the specified mapping.

## Operator visibility and evidence

- SQL snapshots before and after: `evidence/turn-002/sql-before-restart-{invocations,journal}.json` and `sql-after-restart-{invocations,journal}.json`.
- Restate UI endpoint shell fetched before/after: `ui-before-restart.html`, `ui-after-restart.html`. The dynamic invocation state was inspected via admin SQL, not browser automation.
- Restate SQL defaults to Arrow IPC unless `Accept: application/json` is set. The initial Arrow captures are retained with `.arrow` extensions; corrected JSON captures use the explicit header.
- Curated transcripts: `pi-session-restated-before-restart.json`, `pi-session-restated-after-restart.json`, `pi-session-direct.json`. Raw Pi JSONL remains in Pi's session store and is represented by hashes, not copied into the probe.
- `lifecycle-summary.json` joins SQL rows to decoded tool requests/results and records counts, identities, hashes, session stats, and limitations.
- `README.md` contains reproduction steps.

## Boundary and remaining Kilo work

This proves composition of Pi's own same-host file-backed session persistence with a thin Restate tool adapter. It does **not** make Pi a Restate-owned process or actor: the operator supplied restart, stable session ID/path, workspace and attempt metadata. Kilo still needs explicit lifecycle/lease and session/workspace rebinding policy, semantic acceptance, authenticated ingress, stronger OS/sandbox and filesystem boundaries, and coherent coding-actor visibility. Global Pi skill paths outside the configured workspace were not available through the Restate `read`; the adapter is not a security boundary and `bash` remains unrestricted by this probe.

No crash was injected during `edit`/`bash`; no arbitrary external-effect exactly-once claim is supported. Cross-host/session-store durability, automatic supervisor restart, concurrent session ownership, transient retry/backoff, Restate server recovery in this lifecycle case, and Langfuse export/readback remain untested. No migration decision is made.

After evidence capture, Pi PIDs `3312501` and `3358741` were dead, Node worker PID `3023825` was stopped, Restate container `kilo-restate-pi-lifecycle` exited with code 0, and ports `8180`, `9170`, and `9080` were closed.

## Validation

Fresh checks after report/evidence updates: both resulting files passed the independent Node mapping/case assertions; all 11 turn-002 `.json` artifacts parsed; `git diff --check` passed; `npm run typecheck` exited 0. The full `npm test` integration command was not rerun after the Restate service/container were stopped; it passed in the preceding turn before this lifecycle follow-up, which changed no probe service/adapter source.

## Semantic Operator handoff

### OPERATOR-MANUAL DELTA

No subject-specific operator manual was changed. `README.md` now records the lifecycle rerun commands and the Restate SQL `Accept: application/json` requirement.

### EXECUTION DAG

1. Start the existing Restate service/extension against an isolated workspace; register the existing deployment.
2. Stage one reads the task and settles through Restate.
3. Record Pi session/SQL state; remove `TASK.md`; observe original Pi PID exit.
4. Relaunch Pi against same persisted session, workspace and node, advancing actor-attempt metadata; stage two reads/edits/tests through Restate.
5. Run direct Pi baseline with same prompts/model and built-ins; capture before/after SQL, filtered sessions, hashes, and compare outputs.

### SEMANTIC JUDGEMENTS

Conversation continuity came from Pi's persisted session file, not Restate. Restate kept the tool operations durable and queryable. The test establishes local manual reattachment, not Restate actor ownership, process supervision, or global exactly-once effects. `actorAttempt` is application metadata, not a Restate retry count.

### DETERMINISTIC AGENT LABOUR

The mediated Pi made two stage-one tool calls (one out-of-workspace rejection and the task read), then three stage-two calls (`read`, `edit`, `bash`). The direct Pi made 15 tool calls/results, including skill reads, a CommonJS/ESM mismatch and its correction. Both produced the requested mapping and passed the specified behavior assertions; the task brief was absent for stage two in both runs.

### RESIDUAL CODE

No adapter, handler, UI, or Restate source code was added or changed. Only bounded workspace fixtures, evidence, `README.md` and reports changed.

### REDUCTION PASS

Reuse-first boundary: existing Pi RPC/session store, existing Pi extension, existing `KiloNode` service, Restate SQL/UI route, and a two-file task fixture. No new runner, policy layer, supervision handler, or generic harness.

### HARD EDGE / FRONTIER

The exit signal for the first Pi process is not recorded; direct `SIGKILL`/power-loss replay, cross-host session storage, automatic restart, edit/bash crash-window behavior, authenticated ingress, and Langfuse readback remain untested. The actor handoff uses `actors/.../turns/002`; this repository has no `.agent/goals` subject tree, so no competing goal/subject or review ZIP was invented.

### FACTORY FEEDBACK / BLAME

- **Prompt/specification friction:** the test needed a task brief that could be removed after stage one and a session ID distinct from Restate's invocation IDs.
- **Skill/protocol friction:** the global `using-superpowers` read was outside the adapter's workspace and correctly failed; an operator profile may need an explicit allowed skill-file policy if these reads are expected.
- **Tooling/environment friction:** Restate `/query` returned Arrow unless `Accept: application/json` was set; the interactive-shell takeover did not retain the first Pi process exit signal.
- **What had to be inferred:** the session JSONL path is global Pi storage keyed by project CWD/session ID; `actorAttempt` is request metadata; same ID/file was the actual resumption mechanism.
- **Factory improvement:** provide explicit process-PID/exit-status capture for lifecycle probes and declare whether global skill files are inside the actor's granted read surface.
