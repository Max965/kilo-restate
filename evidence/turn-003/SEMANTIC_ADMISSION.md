SEMANTIC_ADMISSION_GATE: PASS
SEMANTIC_ADMISSION_CLASS: INFERRED
SEMANTIC_ADMISSION_RECEIPT: evidence/turn-003/SEMANTIC_ADMISSION.md

SEMANTIC_ADMISSION_INFERENCES:
- `RUN_KIND=HYPOTHESIS_CHALLENGE`: the work order does not spell a run-kind token, but explicitly asks to prove/falsify a capability, accepts either a positive or valuable negative result, and limits realization to a disposable hostile specimen.
- `EVIDENCE_HOME=evidence/turn-003/` resolves under `/home/miles/repos/agent-harnesses/kilo-restate`, because the named predecessor `evidence/turn-002/` is present there and absent under the Restate checkout. The Kilo probe repository is the evidence/realization home; Restate is the canonical read-only source worktree.
- `GOAL_STATUS` is retained raw as `ACTIONABLE`; iteration continuity is inferred from `ITERATION=003` and `CONTINUES_FROM=evidence/turn-002/ and the current Restate/Kilo operational-node report`. No matching formal `GOAL.md`/iteration-01 record for `RESTATE-AGENT-DURABILITY-003` is available. The previous local inferred goal is not treated as its provenance and is not modified.
- `OPERATOR_METHOD` is the complete current work order itself; no separate method artifact or machine Executable Design is supplied. This is valid for the inferred `HYPOTHESIS_CHALLENGE` path, where a complete Executable Design is not required.
- Use the explicit `evidence/turn-003/workspace-*` paths for disposable probe workspaces; do not create a linked/remote worktree or alter Restate/Smithers source.

SEMANTIC_ADMISSION_CONFLICTS: NONE

AUTHORITY_COHERENCE: PASS. Direct execution, no sub-agents, no Restate/Smithers source edits, Turn-002 evidence preservation, and bounded disposable probing can all be satisfied together. No `FACTORY_STATE.md` action is authorized or planned.
SUBJECT_REPO_COHERENCE: PASS with placement inference. Restate fork `/home/miles/repos/agent-harnesses/restate-fork` is the named, clean, read-only canonical source checkout at `8a383eba008b325340ded34045321673b6373fb0`; Kilo-restate is the established separate probe/evidence repository with the referenced Turn-002 artifacts; Smithers is a read-only reference whose parent Git worktree already contains unrelated dirty changes.
GOAL_CONTINUITY: INFERRED. The explicit current goal is Restate-owned durable Pi actor lifecycle, and Turn-002 ended at manual session reattachment with actor/process ownership unproved. A formal original Factory GOAL.md is missing; preserve this as a provenance gap rather than claim verified iteration lineage.
ARTEFACT_METHOD_COHERENCE: PASS. The user supplied the complete specimen sequence, evidence fields, stop conditions, and acceptance outcomes. Missing separately named design/method artifacts are not a defect for this hypothesis challenge.
EXECUTION_MEANING: PASS. A minimum Restate wrapper around the existing Pi tool adapter can physically test same-host actor recovery, settled-effect crash behavior, optional worker+actor restart, and host-local session dependency; the task explicitly instructs stopping when the missing ownership requires reconstruction tax.

SEMANTIC_ADMISSION_DECISION: Admit the bounded falsification run as `RUN_KIND=HYPOTHESIS_CHALLENGE`, `PI_REVIEW_PROFILE=DIRECT`; do not initialize the implementation review gate or delegate. Perform read-only Pi/Restate/Smithers orientation, implement only the minimum disposable specimen if needed, and stop at the first decisive B result or the explicitly bounded unknown. Report historical-goal provenance and dirty worktree facts honestly.
