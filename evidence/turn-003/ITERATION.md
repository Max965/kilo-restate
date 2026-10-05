ISSUED_AT: 2026-10-03T20:00:00+01:00  
SUBJECT: RESTATE-AGENT-DURABILITY  
SUBJECT_ROOT: /home/miles/repos/agent-harnesses/restate-fork  
EXECUTION_MODE: PI_LEGACY  
PI_REVIEW_PROFILE: DIRECT  
GOAL_STATUS: ACTIONABLE  
GOAL_ID: RESTATE-AGENT-DURABILITY-003  
ITERATION: 003  
CONTINUES_FROM: evidence/turn-002/ and the current Restate/Kilo operational-node report

ROLE: capability-physics experimenter  
CANONICAL_WORKTREE: /home/miles/repos/agent-harnesses/restate-fork  
REFERENCE_SUBJECT: /home/miles/repos/agent-harnesses/smithers-fork — READ ONLY  
EVIDENCE_HOME: evidence/turn-003/  
PROBE_WORKSPACE: evidence/turn-003/workspace-*  
REALIZATION_HOME: existing probe code plus the minimum disposable Turn-003 lifecycle code  
EXECUTABLE_DESIGN_TARGET: runnable hostile lifecycle specimen only; no production framework

Do this work yourself; do not launch or delegate to any sub-agents.

Before physical work, persist this complete dispatched contract verbatim under `evidence/turn-003/` so compaction cannot reduce it to a short goal summary. Do not create, modify, or reconcile `FACTORY_STATE.md`.

GOAL

Prove or falsify whether Restate can own the durable lifecycle of a real Pi coding actor strongly enough to match or improve on Smithers without reconstructing a second semantic-agent runtime.

Turn 002 already proved the following and you must preserve rather than re-prove it:

- real persisted Pi JSONL can continue semantically across a Pi process boundary;
- `read`, `edit`, and `bash` can remain Restate-mediated;
- settled Restate tool invocations can be inspected independently;
- Restate worker invocation replay, awakeable approval, journals, parent/child execution and SQL/UI introspection already work;
- the missing ownership is Pi launch/relaunch, transcript/session ownership, workspace rebinding and semantic continuation policy.

The decisive question is now:

Can a small Restate-owned keyed object/workflow represent one logical coding-agent run and automatically recover that actor after failure, with stable run/turn identity and bounded duplication, without human session rebinding?

INTENDED DELTA

Build only the minimum disposable `DurableAgent` / agent-run wrapper necessary to test this boundary.

It may durably retain identifiers such as:

- logical agent/run ID;
- logical turn ID;
- Pi session ID and known session location;
- workspace identity;
- actor attempt;
- requested prompt hash/identity;
- lifecycle phase/status.

It may launch Pi RPC/headless and reuse the existing Restate tool extension.

Do not turn this into a general Kilo agent framework.

HOSTILE SPECIMENS

1. AUTOMATIC SAME-HOST ACTOR RECOVERY

Start a real persisted Pi session through the Restate-owned wrapper.

Allow useful semantic state to accumulate.

Kill the Pi process deliberately and capture the exact signal/PID and lifecycle point.

The operator must NOT manually relaunch Pi.

The wrapper must detect failure and, if its model permits recovery, automatically relaunch/rebind the correct persisted Pi session and continue to a correct semantic result.

Prove who actually made every recovery decision.

2. CRASH AFTER SETTLED EFFECT / BEFORE ACTOR-TURN SETTLEMENT

This is the most important hostile boundary.

Construct a tiny deterministic coding task containing a one-time physical mutation plus verification. Make duplication mechanically visible, for example through exact file content/count/hash rather than relying on prose.

Inject Pi death immediately after a Restate-mediated consequential effect has settled but before the surrounding actor turn has cleanly settled.

On recovery determine independently:

- whether the user prompt appears once or more than once;
- whether Pi reissues the same tool call;
- whether Restate creates/replays the same or a new invocation;
- whether the physical mutation occurs once or more than once;
- whether the Pi session contains a pending/completed tool call at the crash point;
- whether the final assistant semantic result appears correctly;
- whether recovery required any manual intervention.

Separate these layers rigorously:

Pi transcript/session semantics  
vs Restate invocation replay  
vs external filesystem/process effect semantics.

Do not describe the combined result as “exactly once” unless every relevant boundary supports that statement.

3. COMBINED RESTATE-WORKER + PI FAILURE — ONLY IF CHEAP

Using the same or closely related deterministic specimen, kill the Pi actor and the Restate Node service worker around the hostile point.

Restart only the service deployment in the normal way.

Determine whether Restate replay causes the same logical agent run to relaunch/rebind automatically.

Do not repeat the generic approval-replay experiment.

If this becomes materially larger than a small extension of specimen 2, stop and leave it UNKNOWN.

4. HOST-LOCAL SESSION FALSIFIER

After proving or falsifying same-host automatic recovery, test the remaining hard dependency.

Stop the actor and make the original Pi session file/path unavailable, or relaunch the adapter under an isolated temporary HOME/session root representing a different host-local filesystem.

Ask:

Is Restate's own durable state sufficient to reconstruct/resume the semantic actor?

If the answer is no because the Pi JSONL/session bytes are external host-local state, record:

`HOST_LOCAL_SESSION_DEPENDENCY`

and stop.

DO NOT implement transcript replication, distributed filesystem storage, session mirroring or a new conversation database merely to make this test pass. Those are candidate reconstruction costs to report.

SMITHERS COMPARISON

Use `/home/miles/repos/agent-harnesses/smithers-fork` as read-only reference material.

Mine the current source and existing accepted commissioning evidence for the corresponding properties:

- logical responsibility/run identity;
- actor/session identity;
- automatic actor launch/relaunch;
- transcript/conversation ownership;
- process reaping/supervision;
- workspace rebinding;
- retry/attempt semantics;
- turn deduplication;
- effect identity/ledger semantics;
- approval/wait recovery;
- lease/fencing semantics where present;
- fresh-process continuation;
- terminal semantic settlement;
- live operator inspection.

Do not infer capabilities from names.

Give exact source/evidence pointers.

Only run a matched Smithers physical specimen if one decision-critical comparison remains UNKNOWN after inspecting existing evidence and that specimen can be run without modifying Smithers source.

Do not change Smithers.

OBSERVABILITY

During each Restate hostile run capture both classes separately:

RESTATE-NATIVE OBSERVATION:
`sys_invocation`, `sys_journal`, deployment identity, retries/status/suspension/parent linkage.

ADAPTER-SUPPLIED OBSERVATION:
Pi PID, session path, actor phase, logical turn, restart counter or any custom state added by the probe.

Do not credit adapter-written fields as native Restate capability.

For each crash specimen retain at least:

- logical agent/run ID;
- logical turn ID;
- Restate invocation ID(s);
- Pi session ID/path;
- Pi PID before/after;
- actor attempt;
- exact kill point;
- process exit/signal evidence;
- transcript/message/tool-call counts before and after;
- Pi tool-call IDs;
- Restate effect invocation IDs;
- physical effect state/hashes before and after;
- automatic restart evidence;
- final settlement/result;
- relevant `sys_invocation` and `sys_journal` rows.

CAPABILITY-PHYSICS RETURN

Produce one compact Restate-vs-Smithers contract table covering:

submission/admission  
acknowledgement  
logical run identity  
logical turn identity  
turn deduplication  
retry/idempotency  
agent process ownership  
session/transcript ownership  
workspace binding/rebinding  
lease/fencing  
same-host crash recovery  
worker+actor crash recovery  
cross-host/session-file-loss recovery  
external-effect boundary  
terminal semantic settlement  
deployment pinning  
operator inspection

For every cell use only:

DOCUMENTED  
SOURCE_VERIFIED  
PHYSICALLY_PROVEN  
CONTRADICTED  
UNKNOWN  
N/A

and include the decisive pointer.

Also classify each capability as:

RESTATENATIVE  
THIN_ADAPTER  
KILO_MUST_BUILD  
SMITHERS_CURRENT  
UNKNOWN

where useful.

DECISION RULE

A successful result is NOT “we managed to write a supervisor around Restate.”

Restate becomes materially stronger as the Kilo agent-durability substrate only if automatic actor continuation emerges from Restate primitives with genuinely thin system-specific glue.

If obtaining parity requires assembling several of the following:

- transcript replication/storage;
- durable process-supervisor service;
- lease/fencing ownership;
- custom turn-deduplication state machine;
- workspace restore/relocation machinery;
- bespoke external-effect ledger;
- semantic settlement/state projection;
- coding-agent-specific lifecycle UI;

stop rather than implementing them.

Report these explicitly as reconstruction tax and compare them with what Smithers already owns.

Conversely, if Restate handles most of the lifecycle through compact native durable composition and the remaining Pi-specific edge is genuinely small, prove that physically and quantify what the adapter actually contains.

CONSTRAINTS

- Preserve all Turn 002 code/evidence.
- Do not edit Restate upstream source.
- Do not edit Smithers source.
- Do not create a remote fork.
- Do not build a production UI.
- Do not build a generic policy system.
- Do not add Langfuse work.
- Do not broaden filesystem/security hardening.
- Do not re-prove ordinary Restate child invocation, awakeable approval, generic worker replay or SQL introspection.
- Do not implement host/session replication merely to force a green result.
- Keep existing Bifrost port constraints; reuse the proven Restate 8180/9170 arrangement unless physics requires otherwise.
- Record actual Restate/server/SDK/Pi versions used in this run.
- Keep Smithers comparison read-only unless executing an already-supported specimen requires no source mutation.

ACCEPTANCE

Return `ACHIEVED` only if the hostile evidence answers the automatic actor-durability question strongly enough to classify the architecture.

A valuable negative result is acceptable.

Specifically, the run may close successfully by proving either:

A. Restate + genuinely thin Pi adapter automatically recovers the logical coding actor with bounded duplicate/lost-work semantics; or

B. the durable Restate boundary stops below the semantic actor and materially more Kilo lifecycle machinery would be required, with the exact missing ownership physically isolated.

Do not continue coding merely to make A true if the evidence establishes B.

RETURN

GOAL  
RESULT: ACHIEVED | EXCEEDED | PARTIAL | NOT_YET | BLOCKED  
GAP  
AGENT WORK  
ROOT CAUSE / CAPABILITY BOUNDARY  
RESTATESTRENGTHS  
RECONSTRUCTION TAX  
SMITHERS COMPARISON  
CAPABILITY-PHYSICS TABLE  
EXACT HOSTILE EVIDENCE  
NEW LEARNING FROM RESTATE  
DO NOT RELY ON  
UNANSWERED QUESTIONS  
FACTORY FEEDBACK  
NEXT PROMPT

The return must distinguish observed physical behaviour from source/documented behaviour and from architectural inference.
