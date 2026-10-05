import json
from collections import Counter
from pathlib import Path

here = Path(__file__).resolve().parent

def load(name):
    return json.loads((here / name).read_text())

def one_row(name):
    rows = load(name)["rows"]
    assert len(rows) == 1, (name, rows)
    return rows[0]

sends = load("dedupe-sends.json")
assert sends["first"]["invocationId"] == sends["duplicate"]["invocationId"]
assert (sends["first"]["status"], sends["duplicate"]["status"]) == ("Accepted", "PreviouslyAccepted")
assert sends["unkeyedA"]["invocationId"] != sends["unkeyedB"]["invocationId"]

offline = load("dedupe-while-worker-down.json")["rows"]
assert len(offline) == 3 and all(row["status"] == "backing-off" for row in offline), offline
recovered = load("dedupe-after-worker-restart.json")["rows"]
expected_ids = {sends[name]["invocationId"] for name in ("first", "unkeyedA", "unkeyedB")}
assert len(recovered) == 3 and all(row["status"] == "completed" for row in recovered), recovered
assert {row["id"] for row in recovered} == expected_ids, recovered

effects = [json.loads(line) for line in (here / "effects.jsonl").read_text().splitlines()]
counts = Counter(row["tag"] for row in effects)
assert counts == {"same-key": 1, "unkeyed": 2, "gap": 2}, counts
gap_pids = {row["pid"] for row in effects if row["tag"] == "gap"}
assert len(gap_pids) == 2, gap_pids
assert (here / "effect-committed-before-result").exists()

pre = one_row("effect-gap-before-kill.json")
pre_journal = load("effect-gap-journal-before-kill.json")["rows"]
post = one_row("effect-gap-after-replay.json")
post_journal = load("effect-gap-journal-after-replay.json")["rows"]
assert pre["id"] == post["id"] == load("gap-send.json")["invocationId"]
assert pre["status"] == "running"
assert [row["entry_type"] for row in pre_journal] == ["Command: Input", "Command: Run"]
assert post["status"] == "completed" and post["completion_result"] == "success"
assert sum(row["entry_type"] == "Command: Run" for row in post_journal) == 1
assert any(row["entry_type"] == "Notification: Run" for row in post_journal)
assert load("gap-result.json") == {"tag": "gap", "ok": True}

before = one_row("server-restart-pre-restart.json")
after = one_row("server-restart-post-restart.json")
assert before["id"] == after["id"] and before["status"] == after["status"] == "suspended"
assert load("server-restart-result.json") == {"resolution": "RESUME"}
server_log = (here / "restate-server.log").read_text(errors="replace")
assert server_log.count("Starting Restate Server 1.7.13") >= 2

result = {
    "verdict": "PASS",
    "assertions": {
        "same_idempotency_key_reuses_invocation_id": True,
        "same_key_runs_once_and_unkeyed_submissions_are_distinct": True,
        "send_is_accepted_while_worker_is_down_then_completes_after_restart": True,
        "suspended_invocation_survives_server_SIGKILL_and_container_restart_on_same_volume": True,
        "awakeable_resolution_completes_and_returns_saved_result": True,
        "ctx_run_external_effect_can_repeat_when_worker_dies_before_result_is_journaled": True,
        "journal_exposes_outer_run_boundary_not_opaque_external_effect_detail": True,
    },
    "effect_counts": dict(counts),
    "gap_worker_pids": sorted(gap_pids),
    "limitations": [
        "single Restate node and same persistent Podman volume; no host-loss, volume-loss, or multi-node failover test",
        "disposable handler only; no coding-agent runtime inspected",
        "the forced ctx.run gap is a controlled boundary probe, not a frequency estimate",
    ],
}
(here / "validation.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
