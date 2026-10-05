import { Type } from "@sinclair/typebox";
import { resolve } from "node:path";
import { connect, rpc } from "@restatedev/restate-sdk-clients";
import {
  makeEffectId,
  makeGateId,
  type ChildRelayRequest,
  type EffectOperation,
  type GateRequest,
  type OperationEvent,
  type ToolEffectRequest,
} from "../../contract.ts";
import { OperationEvents } from "../../restate/events.ts";
import { ChildRelay, OperationGate, ToolEffect } from "../../restate/service.ts";
import { pathToFileURL } from "node:url";

interface ToolCallEvent {
  toolCallId: string;
  parentToolCallId?: string;
  toolName: string;
  input: Record<string, unknown>;
}

interface PiApi {
  on(event: "tool_call", handler: (event: ToolCallEvent) => Promise<{ block?: boolean; reason?: string } | void>): unknown;
  on(event: "turn_start", handler: (event: { turnIndex: number; timestamp: number }) => unknown): unknown;
  on(event: "agent_start" | "agent_settled", handler: (event: { type: string }) => unknown): unknown;
  registerTool(tool: unknown): void;
}

interface NativeTool {
  name: string;
  label: string;
  description: string;
  parameters: object;
  [key: string]: unknown;
  execute(
    toolCallId: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
    onUpdate?: (update: unknown) => void,
    context?: unknown,
  ): Promise<unknown>;
}

interface ReadOperations {
  readFile(path: string): Promise<Buffer>;
  access(path: string): Promise<void>;
  detectImageMimeType?(path: string): Promise<string | null | undefined>;
}

interface WriteOperations {
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
}

interface EditOperations {
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, content: string): Promise<void>;
  access(path: string): Promise<void>;
}

interface BashOperations {
  exec(command: string, cwd: string, options: {
    onData: (data: Buffer) => void;
    signal?: AbortSignal;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
  }): Promise<{ exitCode: number | null }>;
}

interface NativeFactories {
  createReadToolDefinition(cwd: string, options?: { operations?: ReadOperations }): NativeTool;
  createWriteToolDefinition(cwd: string, options?: { operations?: WriteOperations }): NativeTool;
  createEditToolDefinition(cwd: string, options?: { operations?: EditOperations }): NativeTool;
  createBashToolDefinition(cwd: string, options?: { operations?: BashOperations }): NativeTool;
}

const operationId = process.env.KILO_OPERATION_ID;
const invocationId = process.env.KILO_OPERATION_INVOCATION_ID;
const sessionId = process.env.KILO_SESSION_ID;
if (!operationId || !invocationId || !sessionId) throw new Error("Kilo operation identity is required");
const ingress = connect({ url: process.env.KILO_EVENT_INGRESS ?? "http://127.0.0.1:8180" });
const testExtensionAllowed = process.env.KILO_ALLOW_TEST_EXTENSION === "1";
const sequenceByCall = new Map<string, number>();
let eventSequence = 0;

function record(value: Record<string, unknown>): OperationEvent {
  const type = String(value.type ?? "event");
  return {
    eventId: `${process.pid}-${eventSequence++}-${type}`,
    operationId,
    invocationId,
    sessionId,
    processId: process.pid,
    type,
    at: new Date().toISOString(),
    ...(typeof value.toolCallId === "string" ? { toolCallId: value.toolCallId } : {}),
    ...(typeof value.parentOperationId === "string" ? { parentOperationId: value.parentOperationId } : {}),
    ...(typeof value.parentToolCallId === "string" ? { parentToolCallId: value.parentToolCallId } : {}),
    payload: value,
  };
}

async function append(value: Record<string, unknown>): Promise<void> {
  const event = record(value);
  await ingress.objectClient(OperationEvents, operationId).append(event, rpc.opts({ idempotencyKey: event.eventId }));
}

async function callEffect(
  toolCallId: string,
  toolName: string,
  operation: EffectOperation,
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const stage = sequenceByCall.get(toolCallId) ?? 0;
  sequenceByCall.set(toolCallId, stage + 1);
  const effectId = makeEffectId({ operationId, sessionId, toolCallId, operation, stage });
  const request: ToolEffectRequest = {
    operationId,
    sessionId,
    toolCallId,
    operation,
    stage,
    effectId,
    parentInvocationId: invocationId,
    ...(process.env.KILO_PARENT_TOOL_CALL_ID ? { parentToolCallId: process.env.KILO_PARENT_TOOL_CALL_ID } : {}),
    workspace: process.cwd(),
    input: { ...input, toolName },
  };
  const result = await ingress.objectClient(ToolEffect, effectId).execute(request, rpc.opts({ idempotencyKey: effectId, signal }));
  await append({ type: "tool_effect_result", toolCallId, toolName, operation, stage, effectId, result: result.result });
  return result.result;
}

async function gate(event: ToolCallEvent): Promise<{ block?: boolean; reason?: string } | void> {
  const supported = ["read", "write", "edit", "bash", "spawn_child"].includes(event.toolName)
    || (testExtensionAllowed && event.toolName === "test_wait");
  if (!supported) return { block: true, reason: `Kilo operational node does not route ${event.toolName}` };
  const gateId = makeGateId({ operationId, sessionId, toolCallId: event.toolCallId });
  const request: GateRequest = {
    operationId,
    parentInvocationId: invocationId,
    sessionId,
    toolCallId: event.toolCallId,
    ...(event.parentToolCallId ? { parentToolCallId: event.parentToolCallId } : {}),
    toolName: event.toolName,
    input: event.input,
  };
  try {
    await append({
      type: "tool_requested",
      toolCallId: event.toolCallId,
      parentToolCallId: event.parentToolCallId,
      toolName: event.toolName,
      gateId,
      input: event.input,
    });
    const client = ingress.workflowClient(OperationGate, gateId);
    await client.workflowSubmit(request);
    const result = await client.workflowAttach(rpc.opts({ timeout: Number(process.env.KILO_GATE_TIMEOUT_MS ?? 30_000) }));
    if (result.decision !== "ALLOW") return { block: true, reason: result.reason ?? "Restate gate denied the tool call" };
    return;
  } catch (error) {
    try {
      await append({ type: "gate_failed", toolCallId: event.toolCallId, toolName: event.toolName, gateId, error: String(error) });
    } catch { /* fail closed even when the event surface is unavailable */ }
    return { block: true, reason: "Restate gate unavailable; blocked fail-closed" };
  }
}

const piRoot = resolve(process.env.KILO_PI_SOURCE ?? "/home/miles/repos/agent-harnesses/kilo-pi-durable");
const moduleUrl = (path: string): string => pathToFileURL(resolve(path)).href;
const nativeModules: unknown[] = await Promise.all([
  import(moduleUrl(`${piRoot}/packages/coding-agent/src/core/tools/read.ts`)),
  import(moduleUrl(`${piRoot}/packages/coding-agent/src/core/tools/write.ts`)),
  import(moduleUrl(`${piRoot}/packages/coding-agent/src/core/tools/edit.ts`)),
  import(moduleUrl(`${piRoot}/packages/coding-agent/src/core/tools/bash.ts`)),
]);
const factories = Object.assign({}, ...nativeModules) as NativeFactories;
const cwd = process.cwd();

function installNativeTool(pi: PiApi, name: "read" | "write" | "edit" | "bash", definition: NativeTool): void {
  const registered: NativeTool = {
    ...definition,
    async execute(toolCallId, input, signal, onUpdate, context) {
      const next = (operation: EffectOperation, args: Record<string, unknown>) => callEffect(toolCallId, name, operation, args, signal);
      if (name === "read") {
        const native = factories.createReadToolDefinition(cwd, {
          operations: {
            async readFile(path) { return Buffer.from(String((await next("read", { path })).base64), "base64"); },
            async access(path) { await next("access", { path }); },
            async detectImageMimeType(path) {
              const mimeType = (await next("detectImageMimeType", { path })).mimeType;
              return typeof mimeType === "string" ? mimeType : null;
            },
          },
        });
        return native.execute(toolCallId, input, signal, onUpdate, context);
      }
      if (name === "write") {
        return factories.createWriteToolDefinition(cwd, { operations: {
          async writeFile(path, content) { await next("write", { path, content }); },
          async mkdir(path) { await next("mkdir", { path }); },
        } }).execute(toolCallId, input, signal, onUpdate, context);
      }
      if (name === "edit") {
        return factories.createEditToolDefinition(cwd, { operations: {
          async readFile(path) { return Buffer.from(String((await next("read", { path })).base64), "base64"); },
          async writeFile(path, content) { await next("write", { path, content }); },
          async access(path) { await next("access", { path }); },
        } }).execute(toolCallId, input, signal, onUpdate, context);
      }
      return factories.createBashToolDefinition(cwd, { operations: {
        async exec(command, workingDirectory, options) {
          const result = await next("bash", { command, cwd: workingDirectory, timeout: options.timeout });
          const stdout = String(result.stdout ?? "");
          const stderr = String(result.stderr ?? "");
          const output = `${stdout}${stderr}`;
          if (output) options.onData(Buffer.from(output));
          return { exitCode: typeof result.exitCode === "number" ? result.exitCode : null };
        },
      } }).execute(toolCallId, input, signal, onUpdate, context);
    },
  };
  pi.registerTool(registered);
}

export default function (pi: PiApi): void {
  pi.on("tool_call", gate);
  pi.on("turn_start", (event) => { void append({ type: "turn_start", turnIndex: event.turnIndex, timestamp: event.timestamp }); });
  pi.on("agent_start", () => { void append({ type: "agent_start" }); });
  pi.on("agent_settled", () => { void append({ type: "agent_settled" }); });

  installNativeTool(pi, "read", factories.createReadToolDefinition(cwd));
  installNativeTool(pi, "write", factories.createWriteToolDefinition(cwd));
  installNativeTool(pi, "edit", factories.createEditToolDefinition(cwd));
  installNativeTool(pi, "bash", factories.createBashToolDefinition(cwd));

  pi.registerTool({
    name: "spawn_child",
    label: "spawn child operation",
    description: "Start one bounded child operational-node request through Restate.",
    parameters: Type.Object({ prompt: Type.String({ minLength: 1, maxLength: 4000 }) }),
    async execute(toolCallId: string, input: { prompt: string }, signal?: AbortSignal) {
      const depth = Number(process.env.KILO_OPERATION_DEPTH ?? 0);
      if (depth >= 1) throw new Error("child operation depth limit reached");
      const request: ChildRelayRequest = {
        parentOperationId: operationId,
        parentInvocationId: invocationId,
        parentSessionId: sessionId,
        toolCallId,
        ...(process.env.KILO_PARENT_TOOL_CALL_ID ? { parentToolCallId: process.env.KILO_PARENT_TOOL_CALL_ID } : {}),
        prompt: input.prompt,
        workspacePath: cwd,
        provider: process.env.KILO_PI_PROVIDER ?? "faux",
        model: process.env.KILO_PI_MODEL ?? "faux-1",
      };
      await append({ type: "child_requested", toolCallId, parentOperationId: operationId, prompt: input.prompt });
      const result = await ingress.serviceClient(ChildRelay).request(request, rpc.opts({ idempotencyKey: `child-${operationId}-${toolCallId}`, signal }));
      await append({ type: "child_returned", toolCallId, childOperationId: result.operationId, childStatus: result.status });
      return { content: [{ type: "text", text: `Child ${result.operationId} ${result.status}: ${result.output ?? ""}` }], details: result };
    },
  });
}
