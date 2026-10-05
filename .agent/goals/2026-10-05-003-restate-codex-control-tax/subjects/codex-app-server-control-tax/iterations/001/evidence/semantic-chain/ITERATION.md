EXECUTION_MODE: PI_LEGACY  
PI_REVIEW_PROFILE: DIRECT

Do this work yourself; do not launch or delegate to any sub-agents.

## SUBJECT

Restate ↔ OpenAI Codex operational-node adapter.

This is a **short capability/tax probe**.

Do not implement the production adapter.
Do not broaden into Codex architecture research.
Do not compare model quality.
Do not redesign the existing successful Restate↔Pi path.

Work in the existing Kilo Restate subject:

`/home/miles/repos/agent-harnesses/kilo-restate`

Create a new goal under the existing `.agent/goals/` convention.

## Exact goal

Copy this GOAL text verbatim:

**GOAL: Determine the minimum integration tax required to substitute the current OpenAI Codex runtime for ordinary Pi behind Kilo's Restate-owned asynchronous operational-node boundary: identify and physically exercise Codex's supported external control, approval/effect interception, persistent identity, structured visibility, interruption, settlement, and reconnect surfaces; map them to the already-proven Restate ownership model; and classify whether Codex can remain a replaceable inner runtime without modifying Restate core or reimplementing the Codex agent harness.**

## Accepted outer architecture

Treat this as fixed for the probe:

```text
SOFTWARE FACTORY
       |
       v
REST﻿ATE
authoritative outer operation
identity / journal / retry
gates / child operations
terminal settlement
       |
       | Kilo runtime driver
       v
CODEX
agent implementation
thread / turn / items
tools / provider / workspace
```

Restate remains authoritative for the outer operation.

Codex remains authoritative for its coding-agent internals.

The Kilo driver translates between them.

Do not create competing durable workflow authorities.

---

## 1. Pin the current Codex world

First identify the exact Codex installation/version available on this machine.

Prefer the installed/current Codex runtime for physical testing.

Inspect current upstream source/protocol only as needed to establish exact semantics.

Do not clone another large repository if an existing checkout or installed protocol/SDK is sufficient.

Identify the lowest-level supported integration surfaces, especially:

- Codex App Server;
- current SDK wrapper around App Server, if useful;
- thread start/resume/read/status;
- turn start/status/completion;
- item lifecycle events;
- command/file-change/permission approvals;
- interrupt/cancel;
- dynamic/client-owned tools;
- persisted thread identity/history;
- plugins/hooks only if App Server cannot provide the required boundary.

For each material API mark:

`STABLE | EXPERIMENTAL | INTERNAL`

The distinction matters.

---

## 2. Use the Pi result as the contract, not as an implementation

The proven Restate↔Pi boundary owns:

```text
Restate:
- outer run ID/admission
- durable journal
- outer retry
- policy/tool decision
- external effect ownership
- child operational nodes
- terminal outer settlement

Inner runtime:
- native session/thread
- model loop
- transcript
- provider integration
- agent semantic settlement

Kilo:
- identity mapping
- lifecycle translation
- control/event translation
- effect reconciliation
```

Test whether Codex fits that same ownership law.

Do not copy Pi-specific implementation shapes where Codex already has a better native primitive.

---

## 3. Map the impedance mismatch

Return this compact map:

| Required agent property | Codex native surface | Kilo translation required | Stability | Tax |
|---|---|---|---|---|
| stable start | | | | |
| persistent runtime identity | | | | |
| attach/resume | | | | |
| current status | | | | |
| turn start | | | | |
| structured events | | | | |
| pre-effect approval/control | | | | |
| client-owned tool/effect | | | | |
| interrupt/cancel | | | | |
| semantic settlement | | | | |
| restart/reconnect | | | | |
| child/subagent identity | | | | |

Use:

`DIRECT | SHAPE_ADAPTER | STATE_ADAPTER | LIFECYCLE_ADAPTER | MISSING`

for tax.

---

## 4. Establish the preferred Codex boundary

Test this hypothesis first:

```text
Restate worker
      |
      v
Codex App Server
      |
 thread / turn / item protocol
 approvals / client requests
      |
      v
Codex harness
```

Prefer App Server over private Codex internals.

Determine whether a Codex plugin/hook is actually required.

A desirable result is:

`Restate + App Server only`

A still acceptable result is:

`Restate + App Server + small Codex plugin`

A major negative is:

`Codex source modification or reimplementation required`

---

## 5. One physical persistent-thread specimen

Using a harmless disposable workspace:

1. start or connect to Codex App Server;
2. create a persistent thread;
3. record its thread identity;
4. run one tiny turn;
5. capture structured turn/item events;
6. reach a real terminal turn status/result;
7. disconnect/restart the controlling client or App Server if cheaply feasible;
8. resume/read the same thread identity.

Do not perform substantial coding work.

Use the minimum model call necessary to establish the physics.

Record exactly what persists versus what is merely connection-local.

---

## 6. One physical control/effect specimen

Exercise **one** meaningful pre-effect control boundary.

Prefer a native harmless shell/file action which causes a client-facing approval request.

If a reliable native approval specimen is not practical, exercise one client-owned/dynamic tool and separately source-prove the native built-in approval path.

The decision path should conceptually be:

```text
Codex requests consequential action
        |
        v
Kilo client/driver sees it BEFORE effect
        |
        v
Restate durable ALLOW / DENY
        |
        v
Codex continues or blocks
```

If practical, pass the approval through an actual disposable Restate handler/gate.

Do not build a general gateway.

Prove:

- request arrives before effect;
- stable request/item identity exists;
- async decision is possible;
- DENY prevents the effect;
- result/failure returns into Codex;
- the outer Restate invocation can subsequently settle.

If some of these require experimental APIs, say so clearly.

---

## 7. Visibility / debug mapping

Determine what Restate could truthfully show for a Codex-backed operation.

Map:

```text
Restate RUN
    |
    +-- Codex THREAD
          |
          +-- TURN
                |
                +-- ITEM / approval / tool
```

Identify the smallest bounded event projection needed for:

- `RUN_STARTED`
- `TURN_STARTED`
- `TOOL_REQUESTED`
- `TOOL_DECIDED`
- `TOOL_SETTLED`
- `TURN_SETTLED`
- `RUN_SETTLED`
- failure/interruption

Do not mirror token streams or every Codex internal event.

State which events would naturally become visible in the Restate UI/journal and which belong only in OpenTelemetry or optional specialist AI tracing.

---

## 8. Very small recovery check

Only if cheap after the normal specimen:

```text
persistent Codex thread exists
        ↓
Codex/App Server client disappears
        ↓
new client reconnects/resumes same thread
```

Do not run a crash matrix.

We mainly need to know whether Codex's persistent thread is a usable recovery identity underneath a Restate invocation.

---

## 9. Adapter location and ownership

Assess this target packaging:

```text
kilo-restate/
    operational-node/
        contract/
        restate-service/
        drivers/
            pi/
            codex/
```

No modification to Restate server core.

For Codex determine what belongs in:

- generic operational-node contract;
- generic Restate service;
- Codex-specific driver;
- optional Codex plugin, only if genuinely required.

State whether keeping the Codex driver alongside the Pi driver is structurally sound.

Do not implement this package layout in this goal.

---

## 10. Quick classification

Classify Codex as one of:

`DIRECT_APP_SERVER_ADAPTER`

App Server supplies essentially all required inner-runtime ports and only a small Restate mapping is needed.

`THIN_APP_SERVER_PLUS_PLUGIN`

App Server supplies lifecycle/identity/events but a small plugin/hook is needed for full interception.

`MEDIUM_ADAPTER`

Several lifecycle/control gaps require Kilo state/protocol code.

`DEEP_ADAPTER`

Important agent semantics must be reconstructed or Codex internals substantially adapted.

`NOT_SUITABLE`

Required control/interception cannot be obtained cleanly.

Do not turn this into a Codex-vs-Pi winner decision.

---

## Required return

Keep the return concise.

### CODEX PERIMETER

One diagram of Restate → Kilo driver → Codex App Server → Codex harness.

### IMPEDANCE TABLE

The compact table above.

### PHYSICAL RESULT

Thread/turn specimen plus one control/effect specimen.

### STABLE VS EXPERIMENTAL

Which required Codex APIs are genuinely stable versus experimental.

### RESTATE DEBUG VIEW

What we would see natively in Restate UI/journal and what needs a small event/OTEL projection.

### KILO-OWNED CODE

Only the irreducible Codex-specific responsibilities.

### ADAPTER CLASS

One of the five classifications above.

### ESTIMATED FUTURE TAX

Relative description only:

`LOW | LOW-MEDIUM | MEDIUM | HIGH`

Explain the deciding reason.

### MATERIAL RISKS

Only things that could make Codex materially harder to support later.

### EVIDENCE POINTERS

Exact installed version/source revision, protocol symbols and disposable specimen outputs.

Stop once the future adapter tax and perimeter are clear.

Do not productionise Codex.
Do not harden Restate.
Do not investigate UI implementation beyond the mapping required above.
Do not perform another framework survey.
