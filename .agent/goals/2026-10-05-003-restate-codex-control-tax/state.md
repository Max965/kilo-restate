# Current state

- Active subject: goal-local Codex App Server control/tax probe.
- Outcome: `RESIDUAL FRONTIER`; not a production adapter approval.
- Proven from installed schema/help: experimental App Server exposes thread/turn/item, approval, interrupt, resume/read and status surfaces; dynamic/client-owned tool registration is experimental-only.
- Physical result: one attempted turn failed at the configured local Responses websocket with HTTP 426 before any gate/effect was captured. No-turn `thread/start` succeeded. A second App Server initialized; the attempt failed after entering `thread-resume` and before `thread-resume-returned`/result persistence. No RPC code/message was saved, so server rejection versus response handling is unknown. Cleanup stopped Restate and removed private temporary Codex state.
- Next exact unknowns: correct/authorized provider route; complete method/error logging; successful approval-before-effect; successful same-thread resume after a turn; cancellation/settlement and child/effect reconciliation.
- Stop rule: do not retry a model turn, change provider/config, or change egress without user authorization.
