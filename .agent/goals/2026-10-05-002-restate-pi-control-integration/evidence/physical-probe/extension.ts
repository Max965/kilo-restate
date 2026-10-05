import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { connect, rpc } from "@restatedev/restate-sdk-clients";
import { createBashTool } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/core/tools/bash.ts";
import { createEditTool } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/core/tools/edit.ts";
import { createReadTool } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/core/tools/read.ts";
import { createWriteTool } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/core/tools/write.ts";
import type { ExtensionAPI } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/core/extensions/types.ts";
import type { BashOperations } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/core/tools/bash.ts";
import type { EditOperations } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/core/tools/edit.ts";
import type { ReadOperations } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/core/tools/read.ts";
import type { WriteOperations } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/core/tools/write.ts";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/ai/src/providers/faux.ts";

const RUN_ID = requiredEnv("KILO_RUN_ID");
const SESSION_ID = requiredEnv("PI_SESSION_ID");
const PARENT_INVOCATION_ID = requiredEnv("KILO_PARENT_INVOCATION_ID");
const WORKSPACE = process.cwd();
const EVENT_LOG = requiredEnv("KILO_PROBE_EVENTS");
const CRASH_MARKER = requiredEnv("KILO_PROBE_CRASH_MARKER");
const RESTATE_INGRESS = process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180";
const TOOL_SERVICE = "KiloPiControlProbeTool20261005";
const GATE_SERVICE = "KiloPiControlProbeGate20261005";
type ToolName = "read" | "write" | "edit" | "bash";
type Operation = "access" | "read" | "mkdir" | "write" | "bash";

interface GateRequest {
  runId: string;
  parentInvocationId: string;
  sessionId: string;
  toolCallId: string;
  parentToolCallId?: string;
  toolName: ToolName;
  input: Record<string, unknown>;
}

interface GateResult {
  decision: "ALLOW" | "DENY";
  invocationId: string;
  toolCallId: string;
}

interface ToolRequest {
  runId: string;
  parentInvocationId: string;
  sessionId: string;
  toolCallId: string;
  parentToolCallId?: string;
  toolName: ToolName;
  operation: Operation;
  input: Record<string, unknown>;
  workspace: string;
}

interface ToolResult {
  runId: string;
  parentInvocationId: string;
  sessionId: string;
  toolCallId: string;
  parentToolCallId: string | null;
  toolName: ToolName;
  operation: Operation;
  invocationId: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function record(value: Record<string, unknown>): void {
  appendFileSync(EVENT_LOG, `${JSON.stringify({ at: new Date().toISOString(), ...value })}\n`);
}

function isToolName(value: string): value is ToolName {
  return value === "read" || value === "write" || value === "edit" || value === "bash";
}

const ingress = connect({ url: RESTATE_INGRESS });
const parentToolCalls = new Map<string, string | undefined>();

async function remoteOperation(
  toolCallId: string,
  parentToolCallId: string | undefined,
  toolName: ToolName,
  operation: Operation,
  input: Record<string, unknown>,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ToolResult> {
  const request: ToolRequest = {
    runId: RUN_ID,
    parentInvocationId: PARENT_INVOCATION_ID,
    sessionId: SESSION_ID,
    toolCallId,
    parentToolCallId,
    toolName,
    operation,
    input,
    workspace: WORKSPACE,
  };
  const result = await ingress.call<ToolRequest, ToolResult>({
    service: TOOL_SERVICE,
    handler: "execute",
    key: RUN_ID,
    parameter: request,
    opts: rpc.opts({ idempotencyKey, signal }),
  });
  record({ type: "remote_operation", ...result });
  return result;
}

function operationCaller(toolCallId: string, toolName: ToolName, signal?: AbortSignal) {
  let sequence = 0;
  const parentToolCallId = parentToolCalls.get(toolCallId);
  return (operation: Operation, input: Record<string, unknown>) => remoteOperation(
    toolCallId,
    parentToolCallId,
    toolName,
    operation,
    input,
    `${toolCallId}:${sequence++}:${operation}`,
    signal,
  );
}

export default function (pi: ExtensionAPI): void {
  const fake = fauxProvider();
  fake.setResponses([
    fauxAssistantMessage(fauxToolCall("read", { path: "seed.txt" }, { id: "read-1" }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("write", { path: "written.txt", content: "written by Pi\n" }, { id: "write-1" }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("edit", { path: "seed.txt", edits: [{ oldText: "original\n", newText: "edited by Pi\n" }] }, { id: "edit-1" }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("bash", { command: "printf 'bash-ok\\n'", timeout: 5 }, { id: "bash-1" }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("write", { path: "denied.txt", content: "must not exist\n" }, { id: "write-deny" }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("edit", { path: "seed.txt", edits: [{ oldText: "edited by Pi\n", newText: "should-not-run\n" }] }, { id: "edit-fail" }), { stopReason: "toolUse" }),
    fauxAssistantMessage("probe complete"),
  ]);
  pi.registerProvider(fake.provider);

  pi.on("tool_call", async (event) => {
    if (!isToolName(event.toolName)) return;
    parentToolCalls.set(event.toolCallId, event.parentToolCallId);
    record({
      type: "tool_call",
      callId: event.toolCallId,
      toolName: event.toolName,
      input: event.input,
      parentToolCallId: event.parentToolCallId ?? null,
      sessionId: SESSION_ID,
      parentInvocationId: PARENT_INVOCATION_ID,
    });
    const request: GateRequest = {
      runId: RUN_ID,
      parentInvocationId: PARENT_INVOCATION_ID,
      sessionId: SESSION_ID,
      toolCallId: event.toolCallId,
      parentToolCallId: event.parentToolCallId,
      toolName: event.toolName,
      input: event.input as Record<string, unknown>,
    };
    try {
      const decision = await ingress.call<GateRequest, GateResult>({
        service: GATE_SERVICE,
        handler: "request",
        key: RUN_ID,
        parameter: request,
        opts: rpc.opts({ idempotencyKey: `gate:${event.toolCallId}` }),
      });
      record({
        type: "gate_decision",
        callId: event.toolCallId,
        toolName: event.toolName,
        decision: decision.decision,
        invocationId: decision.invocationId,
        parentInvocationId: PARENT_INVOCATION_ID,
        sessionId: SESSION_ID,
      });
      if (decision.decision !== "ALLOW") return { block: true, reason: "Restate gate denied this tool call" };
      if (event.toolCallId === "read-1" && !existsSync(CRASH_MARKER)) {
        writeFileSync(CRASH_MARKER, "killed after durable ALLOW, before tool execution\n", { flag: "wx" });
        record({ type: "process_kill", callId: event.toolCallId, parentInvocationId: PARENT_INVOCATION_ID, sessionId: SESSION_ID });
        process.kill(process.pid, "SIGKILL");
      }
    } catch (error) {
      record({
        type: "gate_error",
        callId: event.toolCallId,
        toolName: event.toolName,
        message: error instanceof Error ? error.message : String(error),
        parentInvocationId: PARENT_INVOCATION_ID,
        sessionId: SESSION_ID,
      });
      return { block: true, reason: "Restate gate unavailable; blocked fail-closed" };
    }
  });

  const cwd = process.cwd();
  const localRead = createReadTool(cwd);
  const localWrite = createWriteTool(cwd);
  const localEdit = createEditTool(cwd);
  const localBash = createBashTool(cwd);

  pi.registerTool({
    ...localRead,
    async execute(id, params, signal, onUpdate) {
      record({ type: "tool_execute", callId: id, toolName: "read", sessionId: SESSION_ID });
      const call = operationCaller(id, "read", signal);
      const tool = createReadTool(cwd, {
        operations: {
          async readFile(path) {
            const result = await call("read", { path });
            return Buffer.from(String(result.result.text), "utf8");
          },
          async access(path) { await call("access", { path }); },
          async detectImageMimeType() { return null; },
        } satisfies ReadOperations,
      });
      return tool.execute(id, params, signal, onUpdate);
    },
  });

  pi.registerTool({
    ...localWrite,
    async execute(id, params, signal, onUpdate) {
      record({ type: "tool_execute", callId: id, toolName: "write", sessionId: SESSION_ID });
      const call = operationCaller(id, "write", signal);
      const tool = createWriteTool(cwd, {
        operations: {
          async writeFile(path, content) { await call("write", { path, content }); },
          async mkdir(path) { await call("mkdir", { path }); },
        } satisfies WriteOperations,
      });
      return tool.execute(id, params, signal, onUpdate);
    },
  });

  pi.registerTool({
    ...localEdit,
    async execute(id, params, signal, onUpdate) {
      record({ type: "tool_execute", callId: id, toolName: "edit", sessionId: SESSION_ID });
      const call = operationCaller(id, "edit", signal);
      const tool = createEditTool(cwd, {
        operations: {
          async readFile(path) {
            const result = await call("read", { path });
            return Buffer.from(String(result.result.text), "utf8");
          },
          async writeFile(path, content) { await call("write", { path, content }); },
          async access(path) { await call("access", { path }); },
        } satisfies EditOperations,
      });
      return tool.execute(id, params, signal, onUpdate);
    },
  });

  pi.registerTool({
    ...localBash,
    async execute(id, params, signal, onUpdate) {
      record({ type: "tool_execute", callId: id, toolName: "bash", sessionId: SESSION_ID });
      const call = operationCaller(id, "bash", signal);
      const tool = createBashTool(cwd, {
        operations: {
          async exec(command, workingDirectory, options) {
            const result = await call("bash", { command, cwd: workingDirectory, timeout: options.timeout });
            if (typeof result.result.stdout === "string" && result.result.stdout) options.onData(Buffer.from(result.result.stdout));
            if (typeof result.result.stderr === "string" && result.result.stderr) options.onData(Buffer.from(result.result.stderr));
            return { exitCode: typeof result.result.exitCode === "number" ? result.result.exitCode : null };
          },
        } satisfies BashOperations,
      });
      return tool.execute(id, params, signal, onUpdate);
    },
  });

  pi.on("tool_result", (event) => {
    record({
      type: "tool_result",
      callId: event.toolCallId,
      toolName: event.toolName,
      input: event.input,
      parentToolCallId: event.parentToolCallId ?? null,
      content: event.content,
      structuredContent: event.structuredContent,
      isError: event.isError,
      details: event.details,
      usage: event.usage,
      parentInvocationId: PARENT_INVOCATION_ID,
      sessionId: SESSION_ID,
    });
    parentToolCalls.delete(event.toolCallId);
  });
  pi.on("turn_start", (event) => record({ type: "turn_start", event, parentInvocationId: PARENT_INVOCATION_ID, sessionId: SESSION_ID }));
  pi.on("turn_end", (event) => record({ type: "turn_end", event, parentInvocationId: PARENT_INVOCATION_ID, sessionId: SESSION_ID }));
  pi.on("agent_before_settle", (event) => record({ type: "agent_before_settle", event, parentInvocationId: PARENT_INVOCATION_ID, sessionId: SESSION_ID }));
  pi.on("agent_settled", () => record({ type: "agent_settled", parentInvocationId: PARENT_INVOCATION_ID, sessionId: SESSION_ID }));
}
