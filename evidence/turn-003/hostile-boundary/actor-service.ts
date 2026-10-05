// Disposable Turn-003 lifecycle wrapper; not production code.
import * as restate from "@restatedev/restate-sdk";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const piPackage = "/home/miles/repos/runtime/vendors/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/rpc/rpc-client.js";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const fail = (message: string): never => { throw new restate.TerminalError(message); };

type Request = {
  logicalRunId: string;
  logicalTurnId: string;
  sessionId: string;
  sessionDir: string;
  workspace: string;
  originalPrompt: string;
  recoveryPrompt: string;
  effectMarker: string;
  toolExtension: string;
};

type Attempt = {
  actorAttempt: number;
  pid: number | null;
  exitCode: number | null;
  signal: string | null;
  startedAt: string;
  exitedAt: string;
  sessionId: string | null;
  sessionFile: string | null;
  initialMessageCount: number | null;
  model: unknown;
  outcome: "effect-crash" | "settled" | "error";
  killPoint: unknown;
  tools: unknown[];
  eventTypes: string[];
  transcript: unknown;
  finalText: string | null;
  error: string | null;
};

type RunState = {
  logicalRunId: string;
  logicalTurnId: string;
  objectKey: string;
  restateInvocationId: string;
  sessionId: string;
  promptSha256: string;
  recoveryPromptSha256: string;
  actorAttempt: number;
  phase: "starting" | "effect-settled" | "recovering" | "completed" | "failed";
  sessionFile: string | null;
  attempts: Attempt[];
  result?: unknown;
};

const messageText = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part: any) => part?.type === "text" ? part.text ?? "" : "").join("");
};

const transcriptStats = async (path: string | null, originalPrompt: string, recoveryPrompt: string) => {
  if (!path) return null;
  const text = await readFile(path, "utf8");
  const entries = text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const messages = entries.filter((entry) => entry.type === "message").map((entry) => entry.message);
  return {
    sha256: hash(text),
    bytes: Buffer.byteLength(text),
    entries: entries.length,
    messages: messages.length,
    userMessages: messages.filter((message: any) => message.role === "user").length,
    assistantMessages: messages.filter((message: any) => message.role === "assistant").length,
    toolResultMessages: messages.filter((message: any) => message.role === "toolResult").length,
    toolCalls: messages.flatMap((message: any) => Array.isArray(message.content) ? message.content : [])
      .filter((part: any) => part?.type === "toolCall").length,
    originalPromptOccurrences: messages.filter((message: any) => message.role === "user" && messageText(message.content) === originalPrompt).length,
    recoveryPromptOccurrences: messages.filter((message: any) => message.role === "user" && messageText(message.content) === recoveryPrompt).length,
    userText: messages.filter((message: any) => message.role === "user").map((message: any) => messageText(message.content))
  };
};

const errorText = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : String(error);
const timeout = <T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => clearTimeout(timer!));
};

async function runPiAttempt(req: Request, actorAttempt: number): Promise<Attempt> {
  const { RpcClient } = await import(piPackage);
  const client: any = new RpcClient({
    cliPath: "/home/miles/repos/runtime/vendors/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js",
    cwd: req.workspace,
    provider: "openai-codex",
    model: "gpt-5.6-luna",
    env: {
      RESTATE_INGRESS: process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180",
      KILO_NODE: "turn-003-lifecycle",
      KILO_ACTOR: req.logicalRunId,
      KILO_ATTEMPT: String(actorAttempt),
      PI_SESSION_ID: req.sessionId
    },
    args: [
      "--session-id", req.sessionId,
      "--session-dir", req.sessionDir,
      "--no-builtin-tools", "--no-extensions", "--no-skills",
      "--no-prompt-templates", "--no-themes", "--no-context-files",
      "--extension", req.toolExtension,
      "--thinking", "high"
    ]
  });

  const startedAt = new Date().toISOString();
  const eventTypes: string[] = [];
  const tools: any[] = [];
  const callArgs = new Map<string, any>();
  let state: any = null;
  let finalText: string | null = null;
  let killPoint: any = null;
  let outcome: Attempt["outcome"] = "error";
  let error: string | null = null;
  let child: any = null;
  let closePromise: Promise<any[]> | null = null;
  let resolveEvent!: (value: "effect-crash" | "settled") => void;
  const eventOutcome = new Promise<"effect-crash" | "settled">((resolveEvent_) => { resolveEvent = resolveEvent_; });
  let unsubscribe = () => {};

  try {
    await client.start();
    child = client.process;
    if (!child?.pid) throw new Error("Pi RPC client did not expose its child PID");
    closePromise = once(child, "close");
    state = await client.getState();
    unsubscribe = client.onEvent((event: any) => {
      eventTypes.push(event.type);
      if (event.type === "tool_execution_start") {
        callArgs.set(event.toolCallId, { toolName: event.toolName, args: event.args });
      } else if (event.type === "tool_execution_end") {
        const started = callArgs.get(event.toolCallId) ?? { toolName: event.toolName, args: null };
        const record = {
          toolCallId: event.toolCallId,
          toolName: started.toolName,
          args: started.args,
          isError: event.isError,
          result: event.result
        };
        tools.push(record);
        const command = started.args?.command;
        if (actorAttempt === 1 && started.toolName === "bash" && typeof command === "string" && command.includes(req.effectMarker)) {
          const details = event.result?.details;
          killPoint = {
            boundary: "Pi tool_execution_end after KiloNode result returned",
            toolCallId: event.toolCallId,
            toolName: started.toolName,
            command,
            invocationId: details?.invocationId ?? null,
            invocationStatusObservedAtKill: "not yet queried; confirm from Restate sys_invocation",
            sentSignal: "SIGKILL",
            sentAt: new Date().toISOString(),
            signalAccepted: child.kill("SIGKILL")
          };
          outcome = "effect-crash";
          resolveEvent("effect-crash");
        }
      } else if (event.type === "agent_settled") {
        finalText = event.messages?.filter((message: any) => message.role === "assistant")
          .map((message: any) => messageText(message.content)).filter(Boolean).at(-1) ?? finalText;
        if (!killPoint) {
          outcome = "settled";
          resolveEvent("settled");
        }
      }
    });

    const prompt = actorAttempt === 1 ? req.originalPrompt : req.recoveryPrompt;
    try {
      await timeout(client.prompt(prompt), 60000, "Pi prompt acceptance timed out");
    } catch (cause) {
      if (!killPoint) throw cause;
    }
    const signal = await timeout(eventOutcome, 300000, "Pi actor attempt timed out");
    outcome = signal;
    if (signal === "settled") {
      finalText = await client.getLastAssistantText().catch(() => finalText);
      child.stdin.end();
    }
    const close = closePromise;
    if (close) {
      const closed = await timeout(close, 10000, "Pi process exit timed out");
      return {
        actorAttempt, pid: child.pid, exitCode: closed[0], signal: closed[1], startedAt,
        exitedAt: new Date().toISOString(), sessionId: state?.sessionId ?? null,
        sessionFile: state?.sessionFile ?? null, initialMessageCount: state?.messageCount ?? null,
        model: state?.model ?? null, outcome, killPoint, tools,
        eventTypes: [...new Set(eventTypes)],
        transcript: await transcriptStats(state?.sessionFile ?? null, req.originalPrompt, req.recoveryPrompt),
        finalText, error
      };
    }
    throw new Error("Pi process close event was not observed");
  } catch (cause) {
    error = errorText(cause);
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    if (closePromise) {
      try { await timeout(closePromise, 10000, "Pi process exit timed out"); } catch { /* captured in result */ }
    }
    return {
      actorAttempt, pid: child?.pid ?? null, exitCode: child?.exitCode ?? null,
      signal: child?.signalCode ?? null, startedAt, exitedAt: new Date().toISOString(),
      sessionId: state?.sessionId ?? null, sessionFile: state?.sessionFile ?? null,
      initialMessageCount: state?.messageCount ?? null, model: state?.model ?? null,
      outcome: killPoint ? "effect-crash" : "error", killPoint, tools,
      eventTypes: [...new Set(eventTypes)],
      transcript: await transcriptStats(state?.sessionFile ?? null, req.originalPrompt, req.recoveryPrompt).catch(() => null),
      finalText, error
    };
  } finally {
    unsubscribe();
  }
}

const DurableAgent = restate.object({
  name: "DurableAgent",
  handlers: {
    run: async (ctx: restate.ObjectContext, req: Request) => {
      if (ctx.key !== req.logicalRunId) fail("OBJECT_KEY_RUN_ID_MISMATCH");
      if (
        resolve(req.workspace) !== resolve(process.env.TURN_003_WORKSPACE ?? "") ||
        resolve(req.sessionDir) !== resolve(process.env.TURN_003_SESSION_DIR ?? "") ||
        resolve(req.toolExtension) !== resolve(process.env.TURN_003_TOOL_EXTENSION ?? "")
      ) fail("REQUEST_PATHS_DO_NOT_MATCH_DISPOSABLE_PROBE_CONFIGURATION");
      if (!/^[A-Za-z0-9-]{1,100}$/.test(req.logicalRunId) || !/^[A-Za-z0-9-]{1,120}$/.test(req.logicalTurnId)) {
        fail("INVALID_LOGICAL_IDENTITY");
      }
      if (req.originalPrompt.length > 4000 || req.recoveryPrompt.length > 4000 || req.effectMarker.length > 100) {
        fail("PROBE_INPUT_EXCEEDS_BOUND");
      }
      const promptSha256 = hash(req.originalPrompt);
      const recoveryPromptSha256 = hash(req.recoveryPrompt);
      const prior = await ctx.get<RunState>("lifecycle");
      if (prior) {
        if (prior.logicalTurnId !== req.logicalTurnId || prior.sessionId !== req.sessionId || prior.promptSha256 !== promptSha256) {
          fail("CONFLICTING_LOGICAL_RUN_IDENTITY");
        }
        if (prior.phase === "completed" || prior.phase === "failed") return prior.result;
        fail("NONTERMINAL_RUN_ALREADY_RECORDED");
      }

      let state: RunState = {
        logicalRunId: req.logicalRunId,
        logicalTurnId: req.logicalTurnId,
        objectKey: ctx.key,
        restateInvocationId: ctx.request().id,
        sessionId: req.sessionId,
        promptSha256,
        recoveryPromptSha256,
        actorAttempt: 0,
        phase: "starting",
        sessionFile: null,
        attempts: []
      };
      ctx.set("lifecycle", state);
      for (let actorAttempt = 1; actorAttempt <= 2; actorAttempt++) {
        state = {
          ...state,
          actorAttempt,
          phase: actorAttempt === 1 ? "starting" : "recovering"
        };
        ctx.set("lifecycle", state);
        const attempt = await ctx.run(`pi-attempt-${actorAttempt}`, async () => {
          try { return await runPiAttempt(req, actorAttempt); }
          catch (cause) {
            return {
              actorAttempt, pid: null, exitCode: null, signal: null,
              startedAt: new Date().toISOString(), exitedAt: new Date().toISOString(),
              sessionId: null, sessionFile: null, initialMessageCount: null, model: null,
              outcome: "error", killPoint: null, tools: [], eventTypes: [], transcript: null,
              finalText: null, error: errorText(cause)
            } satisfies Attempt;
          }
        });
        state = {
          ...state,
          phase: attempt.outcome === "effect-crash" ? "effect-settled" : state.phase,
          sessionFile: attempt.sessionFile,
          attempts: [...state.attempts, attempt]
        };
        ctx.set("lifecycle", state);
        if (actorAttempt === 1 && attempt.outcome === "effect-crash") continue;
        const status = attempt.outcome === "settled" ? "completed" : "failed";
        const result = {
          logicalRunId: req.logicalRunId,
          logicalTurnId: req.logicalTurnId,
          objectKey: ctx.key,
          restateInvocationId: ctx.request().id,
          promptSha256,
          status: status === "completed" && state.attempts.length > 1 ? "recovered" : status,
          actorAttempts: state.attempts.length,
          sessionId: req.sessionId,
          sessionFile: attempt.sessionFile,
          attempts: state.attempts,
          finalText: attempt.finalText
        };
        state = { ...state, phase: status, result };
        ctx.set("lifecycle", state);
        return result;
      }
      state = { ...state, phase: "failed", result: { status: "failed", actorAttempts: state.attempts.length } };
      ctx.set("lifecycle", state);
      return state.result;
    },
    status: async (ctx: restate.ObjectContext) => await ctx.get<RunState>("lifecycle")
  }
});

restate.serve({ services: [DurableAgent], port: Number(process.env.SERVICE_PORT ?? 9081) });
