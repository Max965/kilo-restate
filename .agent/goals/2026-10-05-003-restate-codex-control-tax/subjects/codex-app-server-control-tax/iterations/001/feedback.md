# Iteration 001 feedback

- Environment friction: current Codex configuration routes Responses over `ws://127.0.0.1:17841/v1/responses`; installed Codex reported HTTP 426. No route/config/egress change is authorized.
- Probe friction: the first driver only handled `item/commandExecution/requestApproval` and did not persist unknown server-request methods or turn status. `ServerRequest` also declares legacy approval methods. The no-turn probe persisted phase but not JSON-RPC error code/message for `thread/resume`.
- Factory decision needed before another model turn: repair/authorize a specific endpoint/configuration.
- No evidence supports a claim that Codex lacks the App Server approval surface.
