# Operational profiles and completion (candidate; not activated)

Existing Factory work orders without `PROFILE` retain the existing printed-WorkReport/exit settlement path. To opt in, add `"PROFILE": "luna-low-v1"`; omit `provider`, `model` and `pi`, or supply exactly matching values. Existing SUBJECT, SUBJECT_ROOT, GOAL_ID, ITERATION, WORKSPACE, AUTHORITY, GOAL and WORK remain required. INTERACTIVE_DEBUG still uses `kilo factory --interactive <file>` and a real terminal.

Profiles are local trusted JSON files in this directory, or the explicitly configured service/CLI `KILO_OPERATIONAL_PROFILES` directory. A name resolves to `<name>.json`. Names cannot contain traversal. Each profile declares a positive version; use a new version/name when changing the contract. The resolved profile is embedded in the admitted contract, included in the admission fingerprint and persisted as `effectiveProfile`. It cannot change workspace roots, grants or native effect policy. Configuration conflicts fail closed.

`luna-low-v1.json` is an installation-specific sample: existing Luna/low agentDir and DEBUG extension, read/bash tools, three total completion submissions and a 15-minute timeout. Its check only proves that control-policy.ts contains `authorize`; it does NOT prove an arbitrary business goal. Replace that predicate in a separately versioned profile with the actual deterministic acceptance criterion for the task. An empty check list means no independent acceptance checks—not verified goal achievement.

Native Pi runs with a generated private agentDir under the existing operation session directory. Settings explicitly suppress packages/MCP/project trust, while discovery-disabling CLI flags suppress incidental extensions/skills/prompts/context/themes. Only explicit Pi resource paths and mandatory Kilo interception are loaded. Auth is linked to the configured credential file, not embedded in work orders or durable state; an optional custom models.json is copied at node startup. Credentials/custom registry contents are not an admission-time durable snapshot. The profile/provider/model/thinking/tool policy itself is snapshotted at admission.

## Completion interface

The mandatory Kilo Pi extension registers:

```text
submit_completion({ report: {
  GOAL: string,
  RESULT: "ACHIEVED" | "PARTIAL" | "BLOCKED",
  GAP: string,
  "AGENT WORK": string,
  "ROOT CAUSE": string,
  "NEXT PROMPT": string
}})
```

The extension supplies session identity, a private operation-scoped capability and the native tool-call ID as submission ID. They are not model-provided tool arguments. The existing ingress client calls `KiloCompletion/<operationId>/submit`. The workflow verifies the token/session; the exclusive Restate object serializes the counter and stores each response. Application-level idempotency checks the capability on every retry; no RPC deduplication bypasses that check.

Invalid reports return `{report, errors, remaining, terminal}` to the same tool call/session. Additional fields, missing/wrong field types, invalid RESULT and excessive string lengths are errors. The default is three submissions total, configurable 1–10. Reusing a submission ID with identical content returns the original response without incrementing; changing its report is rejected. New submissions after terminal closure are rejected.

For structurally valid ACHIEVED, Kilo runs configured bounded relative regular-file checks (<=1MiB), optionally requiring text content. Safe path resolution retains the existing workspace/symlink boundary. Failed acceptance checks are returned as submission errors and consume an attempt. No arbitrary shell acceptance runner is added. Completion replies include how many checks were configured/evaluated and their errors. A passed predicate is evidence for that predicate only, not universal proof of goal achievement.

Valid PARTIAL/BLOCKED settles FAILED without semantic retries. Exhaustion, actor loss or timeout closes the completion object and produces a machine-owned BLOCKED report and failed operation. Closing the serialized completion state prevents late submissions from reopening an operation. A previously committed terminal report wins an actor-exit/signal race. Successful completion signals the existing workflow; it stops its existing Pi owner and writes the authoritative result. Profile operations use one driver attempt, not automatic semantic retries.

The attached CLI prints the authoritative result for profile operations. `kilo node inspect ... --json` remains the durable result fallback. No automatic ChatGPT delivery exists.

## Verification and activation boundary

`npm run test:completion` exercises profile selection, snapshot/backwards compatibility, validator feedback, invalid-then-corrected, three invalid, valid PARTIAL/BLOCKED, duplicate/foreign capability rejection, acceptance checks and serialized machine closure. Restate handler tests use bounded mock contexts: they do not demonstrate real journal replay, signals, cleanup timing or native Pi tool-feedback loops. Existing Control/Factory/native PTY/outcome regressions remain separate.

No service was restarted and no actor was launched for this change. Before use, separately authorize an owner restart only after confirming no live operations, then register/refresh the owned Restate deployment so the new KiloCompletion object and completionScope workflow handler are discoverable. Do not delete foreign deployments. Follow with one disposable native Pi specimen and crash/timeout/duplicate checks before claiming live readiness. Existing external/native administrative invocation cancellation is not newly proved by these tests.
