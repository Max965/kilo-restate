import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { OperationEvent, OperationRequest } from "../../contract.ts";
import { createOperationEventSink } from "../../restate/events.ts";

interface RpcState {
  sessionId: string;
  sessionFile?: string;
}

interface RpcEvent {
  type: string;
  [key: string]: unknown;
}

interface RpcClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  abort(): Promise<void>;
  onEvent(listener: (event: RpcEvent) => void): () => void;
  getState(): Promise<RpcState>;
  setModel(provider: string, modelId: string): Promise<unknown>;
  getLastAssistantText(): Promise<string | null>;
  promptAndWait(message: string, images?: unknown[], timeout?: number): Promise<RpcEvent[]>;
  getStderr(): string;
}

interface RpcClientConstructor {
  new (options: {
    cliPath: string;
    cwd: string;
    env: Record<string, string>;
    args: string[];
  }): RpcClient;
}

export interface PiDriverInput extends OperationRequest {
  invocationId: string;
  sessionId: string;
  sessionDir: string;
}

export interface PiDriverResult {
  sessionId: string;
  sessionFile: string;
  lastAssistantText: string | null;
  eventTypes: string[];
  settlement: "agent_settled" | "aborted";
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function eventPayload(event: RpcEvent): Record<string, unknown> | undefined {
  const payload: Record<string, unknown> = {};
  for (const key of ["turnIndex", "toolCallId", "toolName", "parentToolCallId", "isError"]) {
    if (event[key] !== undefined) payload[key] = event[key];
  }
  if (event.type === "tool_execution_end" && event.result && typeof event.result === "object") {
    const result = event.result as Record<string, unknown>;
    if (Array.isArray(result.content)) payload.toolResult = result.content;
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
}

export async function runPi(input: PiDriverInput, signal: AbortSignal): Promise<PiDriverResult> {
  const piRoot = resolve(process.env.KILO_PI_SOURCE ?? "/home/miles/repos/agent-harnesses/kilo-pi-durable");
  const rpcClientPath = pathToFileURL(join(piRoot, "packages/coding-agent/src/modes/rpc/rpc-client.ts")).href;
  const rpcModule: unknown = await import(rpcClientPath);
  const RpcClient = (rpcModule as { RpcClient: RpcClientConstructor }).RpcClient;
  const cliPath = join(piRoot, "packages/coding-agent/src/cli.ts");
  const extensionPath = join(repoRoot, "operational-node/drivers/pi/extension.ts");
  const tsxLoader = join(repoRoot, "node_modules/tsx/dist/esm/index.mjs");
  const home = resolve(process.env.KILO_PI_HOME ?? join(dirname(input.sessionDir), "home"));
  await Promise.all([mkdir(input.sessionDir, { recursive: true }), mkdir(home, { recursive: true })]);

  const testExtensionAllowed = process.env.KILO_ALLOW_TEST_EXTENSION === "1";
  const env: Record<string, string> = {
    HOME: home,
    PI_SESSION_ID: input.sessionId,
    KILO_OPERATION_ID: input.operationId,
    KILO_OPERATION_INVOCATION_ID: input.invocationId,
    KILO_SESSION_ID: input.sessionId,
    KILO_OPERATION_DEPTH: String(input.depth ?? 0),
    KILO_EVENT_INGRESS: process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180",
    TSX_TSCONFIG_PATH: join(piRoot, "tsconfig.json"),
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import ${tsxLoader}`].filter(Boolean).join(" "),
  };
  env.KILO_PI_PROVIDER = input.provider;
  env.KILO_PI_MODEL = input.model;
  env.KILO_EVENT_INGRESS = process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180";
  if (input.parentOperationId) env.KILO_PARENT_OPERATION_ID = input.parentOperationId;
  if (input.parentToolCallId) env.KILO_PARENT_TOOL_CALL_ID = input.parentToolCallId;
  if (testExtensionAllowed) env.KILO_ALLOW_TEST_EXTENSION = "1";
  if (testExtensionAllowed && input.testScenario) env.KILO_FAUX_SCENARIO = input.testScenario;
  if (input.provider === "faux") env.PI_OFFLINE = "1";

  const timeout = Number(process.env.KILO_PI_TURN_TIMEOUT_MS ?? 60_000);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 900_000) throw new Error("KILO_PI_TURN_TIMEOUT_MS must be 1000-900000");
  const args = [
    "--no-extensions", "--extension", extensionPath, "--no-skills", "--no-builtin-tools",
    "--session-id", input.sessionId, "--session-dir", input.sessionDir,
  ];
  if (testExtensionAllowed) args.push("--extension", join(repoRoot, "operational-node/test/faux-extension.ts"));

  const rpc = new RpcClient({ cliPath, cwd: input.workspace, env, args });
  const eventSink = createOperationEventSink(env.KILO_EVENT_INGRESS);
  const driverAttemptId = randomUUID();
  let eventSequence = 0;
  const emit = async (type: string, payload?: Record<string, unknown>): Promise<void> => {
    const event: OperationEvent = {
      eventId: `${process.pid}-${driverAttemptId}-${eventSequence++}-${type}`,
      operationId: input.operationId,
      invocationId: input.invocationId,
      sessionId: input.sessionId,
      type,
      at: new Date().toISOString(),
      ...(input.parentOperationId ? { parentOperationId: input.parentOperationId } : {}),
      ...(input.parentToolCallId ? { parentToolCallId: input.parentToolCallId } : {}),
      ...(payload ? { payload } : {}),
    };
    await eventSink(event);
  };
  const events: RpcEvent[] = [];
  const unsubscribe = rpc.onEvent((event) => events.push(event));
  let abortRequest: Promise<void> | undefined;
  const onAbort = (): void => { abortRequest = rpc.abort().catch(() => undefined); };
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();

  try {
    await emit("pi_process_starting", { sessionId: input.sessionId, driverAttemptId });
    await rpc.start();
    await rpc.setModel(input.provider, input.model);
    const initialState = await rpc.getState();
    if (initialState.sessionId !== input.sessionId) throw new Error("Pi opened a different session ID");
    await emit("pi_process_started", { sessionId: initialState.sessionId, sessionFile: initialState.sessionFile ?? null, driverAttemptId });

    let runEvents: RpcEvent[];
    try {
      runEvents = await rpc.promptAndWait(input.prompt, undefined, timeout);
    } catch (error) {
      if (!signal.aborted) throw error;
      runEvents = events;
    }
    for (const event of runEvents) {
      if (["agent_start", "turn_start", "turn_end", "tool_execution_start", "tool_execution_end", "agent_settled"].includes(event.type)) {
        await emit(event.type, eventPayload(event));
      }
    }

    if (!signal.aborted && !runEvents.some((event) => event.type === "agent_settled")) {
      throw new Error(`Pi prompt ended without agent_settled. ${rpc.getStderr()}`);
    }
    const finalState = await rpc.getState();
    if (finalState.sessionId !== input.sessionId || !finalState.sessionFile) throw new Error("Pi session identity or locator was not preserved");
    return {
      sessionId: finalState.sessionId,
      sessionFile: finalState.sessionFile,
      lastAssistantText: await rpc.getLastAssistantText(),
      eventTypes: runEvents.map((event) => event.type),
      settlement: signal.aborted ? "aborted" : "agent_settled",
    };
  } finally {
    signal.removeEventListener("abort", onAbort);
    unsubscribe();
    await abortRequest;
    await rpc.stop();
    await emit("pi_process_stopped", { sessionId: input.sessionId, aborted: signal.aborted, driverAttemptId });
  }
}
