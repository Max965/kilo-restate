// Creates one disposable Pi run, verifies same-host recovery, then tests loss of its local session file.
import { connect } from "@restatedev/restate-sdk-clients";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const fail = (message: string): never => { throw new Error(message); };
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const timeout = <T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => clearTimeout(timer!));
};

const runId = process.env.TURN_003_RUN_ID ?? fail("TURN_003_RUN_ID required");
const runDir = resolve(process.env.TURN_003_RUN_DIR ?? fail("TURN_003_RUN_DIR required"));
const workspace = resolve(join(runDir, "workspace"));
const sessionDir = resolve(join(runDir, "pi-sessions"));
const toolExtension = resolve(process.env.TURN_003_TOOL_EXTENSION ?? fail("TURN_003_TOOL_EXTENSION required"));
const restateIngress = process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180";
const admin = process.env.RESTATE_ADMIN ?? "http://127.0.0.1:9170";
const logicalTurnId = `turn-003-post-effect-crash-${runId}`;
const sessionId = randomUUID();
const effectMarker = `TURN003_EFFECT_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
const originalPrompt = [
  "Use the provided custom tools only.",
  `Call bash exactly once with this exact command: printf '%s\\n' '${effectMarker}' >> effect.log`,
  "Do not read, edit, or call any other tool. Do not append a second time. After the tool returns, do not continue the task; the harness will SIGKILL this Pi process at tool_execution_end before agent_settled."
].join("\n");
const recoveryPrompt = [
  "Continue the same logical turn from the existing Pi session after the previous Pi process was killed immediately after the Restate-backed bash tool returned.",
  "Do not repeat, repair, or append the prior effect. Use only the read tool on effect.log.",
  `Count exact lines equal to '${effectMarker}' and report exactly RECOVERED if the count is 1, otherwise DUPLICATED with the count. Then settle this session.`
].join("\n");

assert(existsSync(workspace) && existsSync(sessionDir), "disposable workspace/session directory must be pre-created");
assert(await readFile(join(workspace, "effect.log"), "utf8") === "", "effect.log must start empty");

const rs = connect({ url: restateIngress });
const request = {
  logicalRunId: runId,
  logicalTurnId,
  sessionId,
  sessionDir,
  workspace,
  originalPrompt,
  recoveryPrompt,
  effectMarker,
  toolExtension
};
const result: any = await rs.call({ service: "DurableAgent", handler: "run", key: runId, parameter: request });
const actorStateAfterRun: any = await rs.call({ service: "DurableAgent", handler: "status", key: runId, parameter: {} });

const effectText = await readFile(join(workspace, "effect.log"), "utf8");
const effectLines = effectText.split(/\r?\n/).filter(Boolean);
const matchingEffectLines = effectLines.filter((line) => line === effectMarker).length;
let loss: any = { attempted: false };

if (result.status === "recovered" && result.sessionFile && existsSync(result.sessionFile)) {
  loss.attempted = true;
  const originalSessionFile = resolve(result.sessionFile);
  const originalArchive = join(runDir, "session-before-local-loss.jsonl");
  const freshArchive = join(runDir, "session-after-local-loss.jsonl");
  await rename(originalSessionFile, originalArchive);
  const { RpcClient } = await import("/home/miles/repos/runtime/vendors/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/rpc/rpc-client.js");
  const peek: any = new RpcClient({
    cliPath: "/home/miles/repos/runtime/vendors/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js",
    cwd: workspace,
    provider: "openai-codex",
    model: "gpt-5.6-luna",
    env: { RESTATE_INGRESS: restateIngress, KILO_NODE: "turn-003-lifecycle", KILO_ACTOR: runId, KILO_ATTEMPT: "3", PI_SESSION_ID: sessionId },
    args: ["--session-id", sessionId, "--session-dir", sessionDir, "--no-builtin-tools", "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-themes", "--no-context-files", "--extension", toolExtension, "--thinking", "high"]
  });
  let peekState: any;
  let peekMessageCount: number | null = null;
  let peekPid: number | null = null;
  try {
    await peek.start();
    const child = peek.process;
    peekPid = child?.pid ?? null;
    const closed = once(child, "close");
    peekState = await peek.getState();
    peekMessageCount = (await peek.getMessages()).length;
    child.stdin.end();
    await timeout(closed, 10000, "session-loss Pi process exit timed out");
  } catch (error) {
    const child = peek.process;
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    loss.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  const generatedFile = peekState?.sessionFile ? resolve(peekState.sessionFile) : originalSessionFile;
  if (existsSync(generatedFile)) await rename(generatedFile, freshArchive);
  await rename(originalArchive, originalSessionFile);
  const actorStateAfterSessionLoss: any = await rs.call({ service: "DurableAgent", handler: "status", key: runId, parameter: {} });
  loss = {
    attempted: true,
    originalSessionFile: originalSessionFile,
    originalSessionSha256: hash(await readFile(originalSessionFile, "utf8")),
    originalSessionRestored: existsSync(originalSessionFile),
    restartedPiPid: peekPid,
    restartedSessionId: peekState?.sessionId ?? null,
    restartedSessionFile: peekState?.sessionFile ?? null,
    restartedMessageCount: peekState?.messageCount ?? null,
    restartedGetMessagesCount: peekMessageCount,
    newSessionFileArchived: existsSync(freshArchive),
    actorStateAfterSessionLoss: actorStateAfterSessionLoss ? {
      logicalRunId: actorStateAfterSessionLoss.logicalRunId,
      logicalTurnId: actorStateAfterSessionLoss.logicalTurnId,
      restateInvocationId: actorStateAfterSessionLoss.restateInvocationId,
      phase: actorStateAfterSessionLoss.phase,
      actorAttempt: actorStateAfterSessionLoss.actorAttempt,
      sessionFile: actorStateAfterSessionLoss.sessionFile
    } : null,
    error: loss.error ?? null
  };
}

const deploymentsResponse = await fetch(`${admin}/deployments`);
const deployments = await deploymentsResponse.json();
const query = async (sql: string) => {
  const response = await fetch(`${admin}/query`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: sql })
  });
  if (!response.ok) throw new Error(`Restate SQL query failed: ${response.status} ${await response.text()}`);
  return response.json();
};
const invocations = await query(
  `SELECT id,target,target_service_name,target_service_key,target_handler_name,idempotency_key,invoked_by,pinned_deployment_id,journal_size,journal_commands_size,created_using_restate_version,status,completion_result,created_at,completed_at FROM sys_invocation WHERE (target_service_name='DurableAgent' AND target_service_key='${runId}') OR (target_service_name='KiloNode' AND target_service_key='actor-${runId}') ORDER BY created_at`
);
const journal = await query(
  `SELECT id,index,entry_type,name,entry_json FROM sys_journal WHERE id IN (SELECT id FROM sys_invocation WHERE (target_service_name='DurableAgent' AND target_service_key='${runId}') OR (target_service_name='KiloNode' AND target_service_key='actor-${runId}')) ORDER BY id,index`
);
const invocationRows = invocations.rows ?? [];
const killInvocationId = result.attempts?.[0]?.killPoint?.invocationId;
const killedToolInvocation = invocationRows.find((row: any) => row.id === killInvocationId);
const assertions = [
  { name: "one stable Restate object key/run id", pass: result.logicalRunId === runId && result.objectKey === runId },
  { name: "same logical turn completed after exactly one bounded Pi relaunch", pass: result.logicalTurnId === logicalTurnId && result.status === "recovered" && result.actorAttempts === 2 },
  { name: "first actor process killed after the effect tool result", pass: result.attempts?.[0]?.outcome === "effect-crash" && result.attempts?.[0]?.signal === "SIGKILL" && result.attempts?.[0]?.killPoint?.boundary.includes("tool_execution_end") },
  { name: "settled KiloNode invocation recorded before actor death", pass: Boolean(killInvocationId && killedToolInvocation?.status === "completed") },
  { name: "Pi session identity survived same-host process restart", pass: result.attempts?.[0]?.sessionId === sessionId && result.attempts?.[1]?.sessionId === sessionId },
  { name: "original task prompt appears once in Pi transcript", pass: result.attempts?.[1]?.transcript?.originalPromptOccurrences === 1 },
  { name: "recovery prompt appears once in Pi transcript", pass: result.attempts?.[1]?.transcript?.recoveryPromptOccurrences === 1 },
  { name: "non-idempotent physical append occurred once", pass: matchingEffectLines === 1 },
  { name: "Pi session file loss yields no prior messages", pass: loss.attempted && (loss.restartedMessageCount === 0 || loss.restartedGetMessagesCount === 0) },
  { name: "Restate object state survives Pi session file loss", pass: loss.actorStateAfterSessionLoss?.phase === "completed" && loss.actorStateAfterSessionLoss?.logicalRunId === runId }
];
const summary = {
  recordedAt: new Date().toISOString(),
  runtime: { node: process.version, piVersion: "1.0.0", model: "openai-codex/gpt-5.6-luna", restateSdk: "1.17.2", restateServer: "1.7.13" },
  logicalRunId: runId,
  logicalTurnId,
  sessionId,
  effectMarker,
  originalPrompt,
  recoveryPrompt,
  workspace,
  effectText,
  effectLines,
  matchingEffectLines,
  result,
  actorStateAfterRun: actorStateAfterRun ? {
    logicalRunId: actorStateAfterRun.logicalRunId,
    logicalTurnId: actorStateAfterRun.logicalTurnId,
    objectKey: actorStateAfterRun.objectKey,
    restateInvocationId: actorStateAfterRun.restateInvocationId,
    sessionId: actorStateAfterRun.sessionId,
    actorAttempt: actorStateAfterRun.actorAttempt,
    phase: actorStateAfterRun.phase,
    sessionFile: actorStateAfterRun.sessionFile,
    promptSha256: actorStateAfterRun.promptSha256,
    recoveryPromptSha256: actorStateAfterRun.recoveryPromptSha256,
    attempts: actorStateAfterRun.attempts?.map((attempt: any) => ({
      actorAttempt: attempt.actorAttempt, pid: attempt.pid, exitCode: attempt.exitCode, signal: attempt.signal,
      sessionId: attempt.sessionId, sessionFile: attempt.sessionFile, initialMessageCount: attempt.initialMessageCount,
      outcome: attempt.outcome, killPoint: attempt.killPoint, transcript: attempt.transcript,
      tools: attempt.tools, eventTypes: attempt.eventTypes, finalText: attempt.finalText, error: attempt.error
    }))
  } : null,
  sessionLoss: loss,
  deployments,
  sysInvocation: invocations,
  sysJournal: journal,
  assertions,
  verdict: assertions.every((assertion) => assertion.pass) ? "PASS" : "PARTIAL_OR_FAIL"
};
await writeFile(join(runDir, "summary.json"), JSON.stringify(summary, null, 2), { flag: "wx" });
console.log(JSON.stringify({ runDir, verdict: summary.verdict, assertions, restateInvocationId: result.restateInvocationId, sessionId, sessionFile: result.sessionFile, resultStatus: result.status, effectLineCount: matchingEffectLines, sessionLoss: loss }, null, 2));
assert(assertions.every((assertion) => assertion.pass), "one or more physical acceptance checks failed; see summary.json");
