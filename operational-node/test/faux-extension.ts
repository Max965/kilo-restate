import { open } from "node:fs/promises";
import { Type } from "@sinclair/typebox";
import { connect, rpc } from "@restatedev/restate-sdk-clients";
import { createOperationEventSink, OperationEvents } from "../restate/events.ts";

interface FauxToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface FauxProviderHandle {
  provider: unknown;
  setResponses(responses: unknown[]): void;
}

interface PiApi {
  registerProvider(provider: unknown): void;
  registerTool(tool: unknown): void;
  on(event: "tool_call", handler: (event: { toolCallId: string; toolName: string }) => Promise<void>): unknown;
}

const operationId = process.env.KILO_OPERATION_ID;
const invocationId = process.env.KILO_OPERATION_INVOCATION_ID;
const sessionId = process.env.KILO_SESSION_ID;
if (!operationId || !invocationId || !sessionId) throw new Error("test extension requires an operation identity");
const ingress = connect({ url: process.env.KILO_EVENT_INGRESS ?? "http://127.0.0.1:8180" });
const sink = createOperationEventSink(process.env.KILO_EVENT_INGRESS ?? "http://127.0.0.1:8180");
let eventSequence = 0;

async function event(type: string, payload: Record<string, unknown>): Promise<void> {
  await sink({
    eventId: `${process.pid}-fixture-${eventSequence++}-${type}`,
    operationId,
    invocationId,
    sessionId,
    processId: process.pid,
    type,
    at: new Date().toISOString(),
    ...(typeof payload.toolCallId === "string" ? { toolCallId: payload.toolCallId } : {}),
    payload,
  });
}

const piRoot = process.env.KILO_PI_SOURCE ?? "/home/miles/repos/agent-harnesses/kilo-pi-durable";
const fauxModule: unknown = await import(new URL(`file://${piRoot}/packages/ai/src/providers/faux.ts`).href);
const faux = fauxModule as {
  fauxProvider(): FauxProviderHandle;
  fauxAssistantMessage(content: string | FauxToolCall, options?: { stopReason?: string }): unknown;
  fauxToolCall(name: string, args: Record<string, unknown>, options?: { id?: string }): FauxToolCall;
};

function tool(f: typeof faux.fauxToolCall, m: typeof faux.fauxAssistantMessage, name: string, args: Record<string, unknown>, id: string): unknown {
  return m(f(name, args, { id }), { stopReason: "toolUse" });
}

function responsesFor(scenario: string): unknown[] {
  const f = faux.fauxToolCall;
  const m = faux.fauxAssistantMessage;
  switch (scenario) {
    case "core-tools":
      return [
        tool(f, m, "read", { path: "readme.txt" }, "read-core"),
        tool(f, m, "write", { path: "written.txt", content: "written by faux\n" }, "write-core"),
        tool(f, m, "edit", { path: "readme.txt", edits: [{ oldText: "before", newText: "after" }] }, "edit-core"),
        tool(f, m, "bash", { command: "printf 'faux-bash\\n'", timeout: 5 }, "bash-core"),
        m("CORE_TOOLS_SETTLED"),
      ];
    case "deny": return [tool(f, m, "write", { path: "denied.txt", content: "must not exist" }, "write-denied"), m("DENY_SETTLED")];
    case "gate-error": return [tool(f, m, "write", { path: "gate-error.txt", content: "must not exist" }, "write-error"), m("GATE_ERROR_SETTLED")];
    case "recovery": return [tool(f, m, "read", { path: "readme.txt" }, "recover-read"), m("RECOVERY_SETTLED")];
    case "cancel": return [tool(f, m, "test_wait", { milliseconds: 120_000 }, "wait-cancel"), m("CANCEL_SETTLED")];
    case "child": return [tool(f, m, "spawn_child", { prompt: "Return CHILD_SETTLED without calling tools." }, "spawn-child"), m("PARENT_CHILD_SETTLED")];
    default: return [m("OPERATIONAL_NODE_OK")];
  }
}

export default function (pi: PiApi): void {
  const provider = faux.fauxProvider();
  provider.setResponses(responsesFor(process.env.KILO_FAUX_SCENARIO ?? "plain"));
  pi.registerProvider(provider.provider);

  pi.registerTool({
    name: "test_wait",
    label: "test wait",
    description: "Test-only cancellable wait for acceptance verification.",
    parameters: Type.Object({ milliseconds: Type.Number({ minimum: 1, maximum: 120_000 }) }),
    async execute(toolCallId: string, input: { milliseconds: number }, signal?: AbortSignal) {
      await event("test_wait_started", { toolCallId, milliseconds: input.milliseconds });
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, input.milliseconds);
          const abort = (): void => { clearTimeout(timer); reject(new Error("test wait interrupted")); };
          signal?.addEventListener("abort", abort, { once: true });
        });
        await event("test_wait_completed", { toolCallId });
        return { content: [{ type: "text", text: "wait completed" }] };
      } catch (error) {
        await event("test_wait_interrupted", { toolCallId, error: String(error) });
        throw error;
      }
    },
  });

  pi.on("tool_call", async (eventInfo) => {
    if (eventInfo.toolCallId !== process.env.KILO_TEST_KILL_AFTER_ALLOW_FOR) return;
    const markerPath = process.env.KILO_TEST_CRASH_MARKER;
    if (!markerPath) return;
    let marker;
    try { marker = await open(markerPath, "wx"); } catch { return; }
    await marker.close();
    for (let attempt = 0; attempt < 80; attempt++) {
      const events = await ingress.objectClient(OperationEvents, operationId).events();
      if (events.some((item) => item.type === "gate_allowed" && item.toolCallId === eventInfo.toolCallId)) {
        await event("test_killing_pi_after_allow", { toolCallId: eventInfo.toolCallId });
        process.kill(process.pid, "SIGKILL");
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  });
}
