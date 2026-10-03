import { Type } from "@sinclair/typebox";
import { call } from "./client.js";

// Load with: pi --extension ./probe/pi-extension.ts. Workspace effects happen in the Restate service.
export default function (pi: any) {
  for (const operation of ["read", "edit", "bash"] as const) {
    pi.registerTool({
      name: operation,
      label: `Kilo ${operation}`,
      description: `Run ${operation} through the durable KiloNode Restate handler; no local fallback.`,
      parameters: operation === "read" ? Type.Object({ path: Type.String() })
        : operation === "edit" ? Type.Object({ path: Type.String(), oldText: Type.String(), newText: Type.String() })
          : Type.Object({ command: Type.String() }),
      execute: async (toolCallId: string, args: any) => {
        const result = await call("KiloNode", "run", `actor-${process.env.KILO_ACTOR ?? "pi"}`, {
          nodeId: `${process.env.KILO_NODE ?? "node-tool-call"}:${toolCallId}`,
          actorId: process.env.KILO_ACTOR ?? "pi",
          sessionId: process.env.PI_SESSION_ID ?? "unavailable",
          actorAttempt: process.env.KILO_ATTEMPT ?? "1",
          toolCallId,
          operation,
          args,
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
      },
    });
  }
}
