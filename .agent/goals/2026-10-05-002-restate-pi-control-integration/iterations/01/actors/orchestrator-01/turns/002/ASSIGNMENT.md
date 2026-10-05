# Continuation Assignment — Turn 002

ASSIGNMENT_KIND: CONTINUATION_AFTER_CONTEXT_COMPACTION
DERIVED_FROM: `.agent/goals/2026-10-05-002-restate-pi-control-integration/iterations/01/ITERATION.md` SHA-256 `2debce8ee807277f753ad7c560edcd395a880b8c8471bb4cb2c8428a3415d5c1`
CANONICAL_GOAL: `.agent/goals/2026-10-05-002-restate-pi-control-integration/GOAL.md`

Continue the existing bounded `HYPOTHESIS_CHALLENGE` directly (no subagents) from the user-provided progress summary. Do not change the goal, expand it into production implementation, or make a migration decision.

## Remaining acceptance work

1. Finish source-based reuse analysis, especially `earendil-works/pi-chat`, and classify each relevant Pi/Restate candidate as `DIRECT_REUSE`, `ADAPT`, `REFERENCE_PATTERN`, or `NOT_APPLICABLE`, with its smallest Restate mismatch and adaptation tax.
2. Complete the explicit ownership, impedance, wire, visibility, parent/child, Pi Durable, adapter-tax, and no-fork decision surfaces required by the canonical instruction.
3. Physically exercise the smallest disposable current-Pi RPC-plus-extension and `read`/`write`/`edit`/`bash` interception specimen; pass a real durable Restate decision across that boundary; attack one highest-value restart seam; preserve exact evidence and limits.
4. Produce and validate the goal-local report and cleanup/evidence records. Do not modify Pi or Restate source, create clones/branches, overwrite pre-existing Pi checkout contents, implement the production node, or claim exactly-once effects, cross-host Pi recovery, or automatic process supervision without direct proof.

## Current known boundary

The supplied summary says the existing Pi and Restate source checkouts and initial Pi API review are complete; the `pi-chat` repository metadata/tree was fetched but its contents were not yet analyzed; existing Kilo Pi→Restate tools prove ingress/result only, not the requested gate, crash recovery, or semantic settlement. Preserve those classifications as provisional until their source/evidence is checked.
