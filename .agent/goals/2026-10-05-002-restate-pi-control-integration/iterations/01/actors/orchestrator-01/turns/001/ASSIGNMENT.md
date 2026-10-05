EXECUTION_MODE: PI_LEGACY  
PI_REVIEW_PROFILE: DIRECT

Do this work yourself; do not launch or delegate to any sub-agents.

## SUBJECT

Restate ↔ maintained Pi coding-agent operational-node adapter.

This is a **reuse-first capability/physics probe**, not a production implementation.

## Exact goal

Create a new goal using the existing `.agent/goals/` convention and copy the following GOAL text **verbatim**:

**GOAL: Determine and physically prove the lowest-tax integration between Restate and the maintained ordinary Pi coding agent for Kilo's asynchronous durable operational node: find and reuse or adapt existing Pi extensions/packages and existing Restate agent-integration patterns wherever possible; map the exact impedance mismatch between Restate's durable outer invocation semantics and Pi's inner session/model/tool lifecycle; and identify the minimum Kilo-owned adapter required to obtain durable outer control, low-level interception, complete structured visibility, recovery, and semantic settlement without forking Pi or reimplementing its provider/model runtime.**

Do not paraphrase that goal.

## Existing world

Use the existing Kilo repositories/checkouts under:

`/home/miles/repos/agent-harnesses/`

Relevant existing material includes:

- the Kilo Restate investigation/fork;
- the Pi monorepo already cloned for the `kilo-pi-durable` investigation.

Resolve the exact existing paths and revisions first.

Do **not** create duplicate clones if the required source is already present.

Do **not** create feature/candidate branches. Work from the existing canonical main/checkouts and keep any disposable probe under the goal/evidence area unless a source modification is absolutely necessary.

## Architectural hypothesis

The working hypothesis is:

```text
SOFTWARE FACTORY / CONTROLLER
              |
              v
          RESTATE
  authoritative operational run
  identity / durability / journal
  retry / wait / signal / lineage
  lifecycle / settlement
              |
              | Kilo agent adapter
              v
             PI
  maintained coding-agent runtime
  session / provider / model loop
  tools / workspace / extensions
              |
              v
      provider + host effects
```

Restate should remain authoritative for the **outer operation**.

Pi should remain authoritative for the **coding-agent implementation**.

Kilo should own only the smallest semantic bridge between them.

Do not make Pi masquerade as Restate and do not make Restate reimplement Pi.

## Governing requirement

**Control precedes observability.**

We require actual interception at meaningful agent boundaries.

Do not count logging, OTEL inference, transcript parsing, or post-hoc reconstruction as control.

For every visibility requirement ask first:

> What executable boundary do we control that makes this event observable truthfully?

---

# 1. Reuse search — do this before designing anything

Search current upstream source, examples, packages and relevant public ecosystem for reusable components.

At minimum inspect current official Pi examples and APIs around:

- `permission-gate`
- `protected-paths`
- `tool-override`
- `ssh`
- `subagent`
- `rpc-demo`
- session lifecycle hooks
- agent/turn lifecycle hooks
- `tool_call`
- tool result/update hooks
- pre-final-settlement / settled boundaries
- provider-request / provider-response hooks
- provider stream events
- RPC client/server integration
- SDK session control
- abort / steer / follow-up
- session persistence/resume

Also search Pi packages/community repositories for existing:

- approval bridges;
- remote control bridges;
- RPC wrappers;
- event sinks;
- telemetry/OTEL exporters;
- external policy gates;
- durable/session supervisors;
- workflow-engine adapters;
- Restate integrations.

Search current Restate source/examples/integrations for patterns including:

- OpenAI Agents `DurableRunner`;
- durable function tools;
- Pydantic `RestateAgent`;
- Vercel AI durable model middleware;
- remote-agent patterns;
- human approval;
- interrupt/regenerate;
- multi-agent orchestration;
- Langfuse/observability;
- A2A/MCP orchestration;
- TypeScript generic-LLM/agent integration.

For every relevant discovered component classify:

`DIRECT_REUSE | ADAPT | REFERENCE_PATTERN | NOT_APPLICABLE`

Record:

- source/repository;
- exact revision/version where material;
- license;
- responsibility provided;
- missing responsibility;
- expected adaptation tax.

Do not start bespoke code until this search establishes that no existing component closes the seam directly.

---

# 2. Freeze ownership before adapter design

Produce one explicit ownership table.

It must distinguish:

| Concern | Restate | Kilo adapter | Pi |
|---|---|---|---|
| logical operation ID | | | |
| invocation admission | | | |
| durable journal | | | |
| outer retry | | | |
| Pi process lifecycle | | | |
| Pi session ID/path | | | |
| transcript/context | | | |
| provider integration | | | |
| model turns | | | |
| tool request | | | |
| tool execution | | | |
| approval decision | | | |
| cancellation | | | |
| checkpoint/recovery | | | |
| parent/child operational nodes | | | |
| final semantic settlement | | | |
| event projection | | | |
| external-effect reconciliation | | | |

There must be **one authoritative owner** for every durable lifecycle fact.

Do not create two equal workflow engines.

---

# 3. Map the actual impedance mismatch

Start from the proven Restate required runtime contract:

```text
idempotent start
attach/status
checkpoint/restore
ordered events
inner control hooks
effect identity/reconciliation
semantic settlement
```

Map each item against current ordinary Pi.

For every item show:

```text
RESTATE EXPECTS
        ↓
KILO TRANSLATION, if any
        ↓
PI NATIVE SURFACE
```

Use exact Pi symbols/events/RPC operations rather than conceptual labels.

Classify each mapping:

`DIRECT | SHAPE_ADAPTER | STATE_ADAPTER | LIFECYCLE_ADAPTER | MISSING`

---

# 4. Produce the wire map

Show the actual sequence for one ordinary agent turn.

For example, but correct it from physical evidence:

```text
1. controller submits keyed Restate invocation
2. Restate service establishes logical operation identity
3. adapter starts or attaches Pi RPC session
4. Pi begins turn
5. Pi emits model/turn event
6. Pi proposes tool call
7. Pi extension intercepts BEFORE execution
8. extension/adapter asks Restate for durable policy decision
9. Restate records ALLOW / DENY / DEFER
10. decision returns to Pi extension
11. Pi executes or blocks tool
12. Pi emits tool result
13. adapter correlates result into Restate operation
14. Pi reaches authoritative settled boundary
15. adapter settles Restate invocation/result
```

For every arrow state:

- PUSH or PULL;
- transport/API;
- identity carried;
- durable before/after boundary;
- what happens on timeout/crash;
- who retries.

The purpose is to make the impedance mismatch visually obvious.

---

# 5. Pi extension boundary — prove interception

Physically verify on the current Pi revision that an extension can truthfully intercept the built-in tools relevant to our coding agent.

At minimum exercise harmless instances of:

- `read`
- `write`
- `edit`
- `bash`

Verify for each:

```text
PRE-TOOL INTERCEPTED?
CAN BLOCK?
CAN ASYNC-WAIT?
RESULT OBSERVED?
CALL ID AVAILABLE?
PARENT/TURN ID AVAILABLE?
INTERRUPTION AVAILABLE?
```

There have historically been extension/tool interception bugs, so do not rely only on type definitions or example source.

Use a disposable workspace.

Do not perform destructive commands.

If any built-in bypasses the extension seam, classify that as a material blocker/residual.

---

# 6. RPC + extension coexistence

Physically prove that Pi can run:

```text
Pi RPC mode
+
Kilo-style extension
```

at the same time.

Determine whether the external adapter can:

- start/resume a known session;
- prompt;
- receive lifecycle events;
- receive tool events;
- steer/follow up;
- abort;
- wait for authoritative settlement;
- recover the session identity after the controlling process restarts.

Use official Pi RPC/client surfaces where available.

Do not invent another protocol if Pi RPC already carries the necessary control.

---

# 7. Restate durable gate probe

Build only the **smallest disposable probe** needed to prove the critical seam.

Preferred specimen:

```text
Restate keyed invocation
        |
        v
Pi RPC session
        |
        v
Pi extension intercepts harmless tool call
        |
        v
Restate durable decision boundary
ALLOW / DENY
        |
        v
Pi continues or blocks
        |
        v
tool result + agent settlement
        |
        v
Restate terminal result
```

Use a harmless command or temporary-file operation.

The decision must actually pass through Restate durable semantics.

Do not substitute an in-memory callback and call it durable.

Capture:

- Restate invocation ID/key;
- Pi session ID;
- Pi turn/activity identity if exposed;
- tool call ID;
- approval/decision identity;
- tool result;
- Pi authoritative settled event;
- Restate final settlement;
- relevant Restate journal/introspection evidence.

If an existing Restate wrapper or Pi extension pattern can be directly adapted for this specimen, use that rather than designing new abstractions.

---

# 8. Crash boundary

After the basic gate works, attack the **single highest-value crash seam** that is cheap to exercise.

Prefer:

```text
Restate has durably recorded the tool decision
        ↓
adapter/Pi process dies
        ↓
restart/reattach
```

Determine:

- whether the same Restate operation is retained;
- whether the same Pi session can be reopened;
- whether the decision is replayed or duplicated;
- whether the tool executes twice;
- whether final settlement can be reconciled.

Do not broaden into a complete production recovery suite.

The purpose is to learn whether the chosen boundary is structurally viable.

---

# 9. Visibility contract

Determine the smallest structured event vocabulary Kilo actually needs.

Do not blindly mirror every Pi event.

Start with:

```text
RUN_STARTED
TURN_STARTED
MODEL_STARTED
MODEL_SETTLED
TOOL_REQUESTED
TOOL_DECIDED
TOOL_STARTED
TOOL_SETTLED
TURN_SETTLED
RUN_SETTLED
RUN_FAILED
RUN_INTERRUPTED
CHECKPOINT / SESSION_IDENTITY
CHILD_STARTED / CHILD_SETTLED if physically relevant
```

For each event specify:

- native Pi source event;
- whether interception precedes or follows the effect;
- Restate representation;
- identity/correlation fields;
- durability requirement;
- payload retention/redaction;
- whether replay needs deduplication.

The output must distinguish:

**CONTROL EVENT** — causes/permits state transition.

**OBSERVATION EVENT** — reports something already true.

Do not use an observation event where control is required.

---

# 10. Parent/child operational node boundary

Do not implement full sub-agent orchestration.

Characterise the cleanest existing path whereby a Pi agent can request another operational node.

Compare only native/reusable patterns such as:

- Pi subagent extension/tool;
- a Kilo tool exposed to Pi that performs a Restate child invocation;
- Restate remote-agent/service invocation.

Identify which side should create the child Restate invocation.

The target law is:

```text
agent requests child
        ↓
controlled tool/intercept boundary
        ↓
Restate creates durable child operation
        ↓
child identity returned to agent
```

Pi must not become the authoritative owner of the durable child lifecycle.

---

# 11. Pi Durable relationship

Do not integrate Pi Durable in this goal.

Only determine whether any useful Pi Durable component can be reused *without giving it competing operation ownership*.

Classify possible reuse as:

`NONE | INTERNAL_CHECKPOINT_HELPER | SESSION_HELPER | TASK_HELPER | FUTURE_REPLACEMENT`

If using Pi Durable underneath Restate would create double retry, double settlement, or competing journals for the same semantic operation, say so explicitly.

---

# 12. Adapter tax

After reuse search and physical proof, classify the Restate↔Pi adapter:

### `EXISTING_INTEGRATION`
A usable existing integration already supplies essentially the whole boundary.

### `ADAPT_EXISTING`
An existing Pi extension/package or Restate adapter supplies most of the machinery and requires bounded modification.

### `THIN_NEW_ADAPTER`
No complete package exists, but existing native Pi/Restate ports make the missing bridge small and stable.

### `DEEP_ADAPTER`
Substantial new lifecycle/protocol/state machinery remains.

### `CORE_CHANGE_REQUIRED`
Pi or Restate itself would need invasive modification.

Measure tax by responsibilities, not line count.

State exactly which responsibilities are Kilo-owned.

---

# 13. No-fork criterion

One acceptance target is:

**No Pi source fork required.**

A Kilo-owned Pi extension/package is acceptable.

A Kilo-owned Restate service/adapter is acceptable.

A Kilo-owned semantic event schema is acceptable.

Modifying Pi's provider/model/runtime internals is a major negative and must be justified by a proven missing port.

Do not modify upstream Pi source merely because doing so is convenient.

---

# Required return

Return these decision surfaces:

## REUSE INVENTORY

| Existing component | Source | Reuse class | What we get | Remaining mismatch |

## OWNERSHIP TABLE

Restate vs adapter vs Pi.

## IMPEDANCE MAP

Exact Restate requirement → Pi native seam → translation/tax.

## WIRE MAP

One ordinary turn from Restate admission through Pi settlement, with push/pull and durability boundaries.

## PHYSICAL INTERCEPTION RESULTS

`read/write/edit/bash` proof table.

## RPC + EXTENSION RESULT

Whether the supported Pi process boundary is sufficient.

## DURABLE GATE RESULT

Evidence from the Restate↔Pi tool gate specimen.

## CRASH RESULT

One hostile restart/reattach result.

## VISIBILITY CONTRACT

Minimum Kilo event vocabulary and native source for each event.

## PARENT/CHILD PORT

How a Pi request becomes a Restate-owned child operation.

## PI DURABLE REUSE

Only bounded components that could sit underneath Restate without competing ownership.

## ADAPTER CLASS

One of:

`EXISTING_INTEGRATION | ADAPT_EXISTING | THIN_NEW_ADAPTER | DEEP_ADAPTER | CORE_CHANGE_REQUIRED`

## KILO-OWNED CODE

List only the irreducible responsibilities we would have to maintain.

## DO NOT BUILD

Explicitly list candidate machinery avoided because an existing Pi/Restate component already owns it.

## UNANSWERED QUESTIONS

Only remaining uncertainties capable of changing the architecture decision.

## EVIDENCE POINTERS

Exact revisions, files, symbols, external packages/examples, probe source and observed outputs.

Do not make the final Software Factory migration decision.

Do not implement the production operational node.

The purpose of this run is to determine whether **Restate + ordinary maintained Pi** can be assembled mainly from native/reusable pieces, and to expose the exact remaining impedance mismatch before we commit engineering effort.

Additional reuse leads from controller research — these are within the existing reuse-search scope and do not change the goal.

Prioritise inspection of:

1. `earendil-works/pi-chat`

This is the strongest candidate. It is an existing Pi extension bridging external Discord/Telegram inputs to persistent Pi sessions and already contains remote control, worker/session lifecycle, status snapshots, streamed interaction, persistent workspaces and multi-worker management.

Do not copy its Discord/Telegram/Gondolin product assumptions blindly.

Determine whether its architecture separates cleanly enough that:

`chat transport/channel -> Pi session/worker`

can become:

`Restate invocation/service -> Pi session/worker`

Classify which parts are reusable versus channel-specific.

2. Official Pi `file-trigger.ts`

Inspect the extremely small external-ingress pattern using `pi.sendMessage(..., { triggerTurn: true })`. Determine whether the same Pi-native injection surface is appropriate behind a Restate signal/invocation.

3. Official `permission-gate.ts`

Use as a reference for the Pi pre-tool interception point. Determine whether its async decision callback can map directly to a Restate durable approval/awakeable without modifying Pi.

4. Official `tool-override.ts` and `ssh.ts`

These explicitly demonstrate replacement/rerouting of built-in `read/write/edit/bash` operations to externally controlled execution.

Determine whether the Kilo Restate adapter can reuse this pattern so that meaningful tool effects cross a Restate-owned control boundary before execution.

5. Official Pi `RpcClient`

Treat this as the likely process-lifecycle boundary. Inspect whether it plus a loaded extension is sufficient for start/prompt/events/abort/settlement/session reopen while keeping raw Pi RPC private to the local Restate worker.

6. `@earendil-works/pi-telemetry`

Inspect only as a visibility/export primitive. Do not mistake telemetry for operational control. Determine whether its explicit adapter contract can reduce the Kilo event-projection implementation after control/interception has already been established.

Also inspect `pi.events` only as an internal extension-to-extension bus if splitting the Kilo Pi integration into independent control and observation extensions would reduce coupling.

For each candidate return:

`DIRECT_REUSE | ADAPT | REFERENCE_PATTERN | NOT_APPLICABLE`

and identify the smallest actual impedance mismatch to Restate.

The key question is not “can we build a Restate Pi adapter?”

It is:

**How much of the adapter already exists in Pi's official external-integration patterns, especially pi-chat, such that Kilo only replaces the outside transport/authority with Restate?**
