#!/usr/bin/env python3
import json
import sys
from pathlib import Path

result = json.loads(Path(sys.argv[1]).read_text())
assert result.get("status") == "PASS", "specimen status is not PASS"
assert result["restate"]["status"].lower() == "completed", "outer Restate run did not settle"
assert result["restate"]["invocationId"], "missing outer invocation identity"
assert result["codex"]["threadId"] == result["codex"]["resumedThreadId"], "resume changed thread identity"
assert result["codex"]["ephemeral"] is False, "thread is ephemeral"
assert result["codex"]["processIdBeforeRestart"] != result["codex"]["processIdAfterRestart"], "App Server was not restarted"
assert result["codex"]["turnId"] and result["codex"]["turnStatus"], "turn lacks terminal identity/status"
assert result["approval"]["method"] == "item/commandExecution/requestApproval", "wrong control surface"
assert result["approval"]["requestId"] is not None and result["approval"]["itemId"], "approval lacks stable request/item identity"
assert result["approval"]["asyncPendingObserved"] is True, "Restate gate did not suspend for an async decision"
assert result["approval"]["decision"] == "decline", "specimen was not denied"
assert result["approval"]["effectExistsAtDecision"] is False, "effect existed before the decision"
assert result["approval"]["effectExistsAfter"] is False, "denied command caused an effect"
methods = [event["type"] for event in result["events"]]
assert methods.index("approval_request") < methods.index("gate_decision") < methods.index("turn_completed"), "control/settlement order is wrong"
print("CODEX_RESTATE_SPECIMEN_PASS: thread/turn, pre-effect durable denial, outer settlement, and same-thread resume verified")
