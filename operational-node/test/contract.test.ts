import assert from "node:assert/strict";

const contract = await import("../contract.ts").catch(() => undefined);
assert.ok(contract, "operational-node/contract.ts must provide stable identities");

const operationId = contract.assertOperationId("op_20261005_case-01");
assert.equal(operationId, "op_20261005_case-01");
assert.throws(() => contract.assertOperationId("../escape"), /operation/i);

const effect = { operationId, sessionId: "pi-session-1", toolCallId: "call/1", operation: "read", stage: 0 };
assert.equal(contract.makeEffectId(effect), contract.makeEffectId(effect));
assert.notEqual(contract.makeEffectId(effect), contract.makeEffectId({ ...effect, stage: 1 }));
assert.throws(() => contract.makeEffectId({ ...effect, stage: -1 }), /stage/i);

const gate = { operationId, sessionId: "pi-session-1", toolCallId: "call/1" };
assert.equal(contract.makeGateId(gate), contract.makeGateId(gate));
assert.notEqual(contract.makeGateId(gate), contract.makeGateId({ ...gate, toolCallId: "call/2" }));

assert.equal(contract.makeChildOperationId(operationId, "child-call"), contract.makeChildOperationId(operationId, "child-call"));
assert.notEqual(contract.makeChildOperationId(operationId, "child-call"), contract.makeChildOperationId(operationId, "other-call"));
console.log("contract identities: PASS");
