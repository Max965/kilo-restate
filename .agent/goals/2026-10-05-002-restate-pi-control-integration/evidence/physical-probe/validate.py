#!/usr/bin/env python3
"""Acceptance checks for the goal-local Restate ↔ ordinary Pi boundary probe."""
import json
import sys
from pathlib import Path

result = json.loads(Path(sys.argv[1]).read_text())

outer = result["outer"]
assert outer["firstSubmit"]["invocationId"] == outer["duplicateSubmit"]["invocationId"]
assert outer["duplicateSubmit"]["status"] == "PreviouslyAccepted"
assert outer["pendingOutput"]["ready"] is False
assert outer["completedOutput"]["ready"] is True
assert outer["attachedResult"]["settlement"] == "completed"
assert outer["attachedResult"]["invocationId"] == outer["firstSubmit"]["invocationId"]

starts = result["pi"]["processStarts"]
assert len(starts) >= 2, starts
assert len({start["sessionId"] for start in starts}) == 1, starts
assert len({start["sessionFile"] for start in starts}) == 1, starts
assert any(event.get("type") == "agent_settled" for event in result["pi"]["rpcEvents"])

extension = result["extensionEvents"]
def matching(kind, call_id):
    return [event for event in extension if event.get("type") == kind and (event.get("callId") == call_id or event.get("toolCallId") == call_id)]

successful = {"read-1": "read", "write-1": "write", "edit-1": "edit", "bash-1": "bash"}
required_operations = {
    "read": {"access", "read"},
    "write": {"mkdir", "write"},
    "edit": {"access", "read", "write"},
    "bash": {"bash"},
}
for call_id, tool_name in successful.items():
    calls = matching("tool_call", call_id)
    assert calls and all(event["toolName"] == tool_name for event in calls), calls
    decisions = [event for event in extension if event.get("type") == "gate_decision" and event.get("callId") == call_id]
    assert decisions and all(event["decision"] == "ALLOW" for event in decisions), decisions
    executions = matching("tool_execute", call_id)
    assert len(executions) == 1 and executions[0]["toolName"] == tool_name, executions
    operations = matching("remote_operation", call_id)
    assert required_operations[tool_name] <= {event["operation"] for event in operations}, operations
    assert all(event["parentInvocationId"] == outer["firstSubmit"]["invocationId"] for event in operations), operations
    results = matching("tool_result", call_id)
    assert results and all(not event.get("isError", False) for event in results), results

read_decisions = [event for event in extension if event.get("type") == "gate_decision" and event.get("callId") == "read-1"]
assert len({event["invocationId"] for event in read_decisions}) == 1, read_decisions
crashes = matching("process_kill", "read-1")
assert len(crashes) == 1, crashes
assert len(matching("tool_execute", "read-1")) == 1

assert matching("gate_decision", "write-deny")[-1]["decision"] == "DENY"
assert not matching("tool_execute", "write-deny")
assert matching("gate_error", "edit-fail")
assert not matching("tool_execute", "edit-fail")
rpc_tool_results = {event["toolCallId"]: event for event in result["pi"]["rpcEvents"] if event.get("type") == "tool_execution_end"}
assert rpc_tool_results["write-deny"]["isError"]
assert "denied" in json.dumps(rpc_tool_results["write-deny"]["result"])
assert rpc_tool_results["edit-fail"]["isError"]
assert "fail-closed" in json.dumps(rpc_tool_results["edit-fail"]["result"])

workspace = result["workspace"]
assert workspace["seed.txt"] == "edited by Pi\n", workspace
assert workspace["written.txt"] == "written by Pi\n", workspace
assert "denied.txt" not in workspace
bash_results = matching("tool_result", "bash-1")
assert any("bash-ok" in json.dumps(event.get("content")) for event in bash_results), bash_results

restate = result["restate"]
assert restate["journal"], "missing captured Restate journal"
assert restate["invocations"], "missing Restate invocation introspection"
invocation_ids = {invocation["id"] for invocation in restate["invocations"]}
assert outer["firstSubmit"]["invocationId"] in invocation_ids
assert any(entry["id"] == outer["firstSubmit"]["invocationId"] for entry in restate["journal"])

print("PASS: durable outer submit/attach, deferred gate, Pi session reopen, four routed tools, deny/fail-closed, structured events, and Restate journal are evidenced")
