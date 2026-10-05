import * as restate from "@restatedev/restate-sdk";
import { connect, rpc } from "@restatedev/restate-sdk-clients";
import type { OperationEvent } from "../contract.ts";

// ponytail: linear dedupe in a 512-event window; use per-event keys if this volume grows.
const MAX_EVENTS = 512;

export const OperationEvents = restate.object({
  name: "KiloOperationEvents",
  handlers: {
    append: async (ctx: restate.ObjectContext, event: OperationEvent): Promise<void> => {
      const current = await ctx.get<OperationEvent[]>("events") ?? [];
      if (current.some((item) => item.eventId === event.eventId)) return;
      ctx.set("events", [...current.slice(-(MAX_EVENTS - 1)), event]);
    },
    events: async (ctx: restate.ObjectSharedContext): Promise<OperationEvent[]> =>
      await ctx.get<OperationEvent[]>("events") ?? [],
  },
});

export function createOperationEventSink(ingressUrl: string): (event: OperationEvent) => Promise<void> {
  const client = connect({ url: ingressUrl });
  return async (event) => {
    await client.objectClient(OperationEvents, event.operationId).append(event, rpc.opts({ idempotencyKey: event.eventId }));
  };
}
