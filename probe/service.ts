import * as restate from "@restatedev/restate-sdk";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const execAsync = promisify(exec);
const root = resolve(process.env.WORKSPACE ?? "./workspace");
const approvalTicket = resolve("./evidence/approval-ticket.json");
const services = {
  async read(_ctx: restate.ObjectContext, req: { path: string }): Promise<any> {
    const target = resolve(root, req.path);
    if (!target.startsWith(root + "/")) throw new restate.TerminalError("path outside workspace");
    return { text: await readFile(target, "utf8"), target };
  },
  async edit(_ctx: restate.ObjectContext, req: { path: string; oldText: string; newText: string }): Promise<any> {
    const target = resolve(root, req.path);
    if (!target.startsWith(root + "/")) throw new restate.TerminalError("path outside workspace");
    const before = await readFile(target, "utf8");
    if (!before.includes(req.oldText)) throw new restate.TerminalError("oldText not found");
    await writeFile(target, before.replace(req.oldText, req.newText));
    return { target, changed: true };
  },
  async bash(_ctx: restate.ObjectContext, req: { command: string }): Promise<any> {
    const result = await execAsync(req.command, { cwd: root, timeout: 10000 });
    return { stdout: result.stdout, stderr: result.stderr, code: 0, cwd: root };
  },
};

const Node = restate.object({
  name: "KiloNode",
  handlers: {
    run: async (ctx: restate.ObjectContext, req: { nodeId: string; parentNodeId?: string; actorId?: string; sessionId?: string; actorAttempt?: string; toolCallId?: string; operation: keyof typeof services; args: any }) => {
      const startedAt = await ctx.date.toJSON();
      const result = await ctx.run(`tool:${req.operation}`, () => services[req.operation](ctx, req.args));
      return { nodeId: req.nodeId, parentNodeId: req.parentNodeId ?? null, actorId: req.actorId ?? null, sessionId: req.sessionId ?? null, actorAttempt: req.actorAttempt ?? null, toolCallId: req.toolCallId ?? null, invocationId: ctx.request().id, operation: req.operation, args: req.args, admission: "probe-allow", result, failure: null, startedAt, settledAt: await ctx.date.toJSON() };
    },
    parentChild: async (ctx: restate.ObjectContext, req: { nodeA: string; nodeB: string; path: string }) => {
      const parentInvocationId = ctx.request().id;
      const childCall = ctx.objectClient({ name: "KiloNode" } as any, req.nodeB).run({ nodeId: req.nodeB, parentNodeId: req.nodeA, operation: "read", args: { path: req.path } });
      const childInvocationId = await childCall.invocationId;
      const child = await childCall;
      return { nodeA: req.nodeA, parentInvocationId, nodeB: req.nodeB, childInvocationId, child, settlement: "completed" };
    },
  },
});

const Approval = restate.object({
  name: "Approval",
  handlers: {
    request: async (ctx: restate.ObjectContext, req: { effect: string }) => {
      const awakeable = ctx.awakeable<boolean>();
      const invocationId = ctx.request().id;
      await ctx.run("record-approval-request", async () => {
        await mkdir(dirname(approvalTicket), { recursive: true });
        await writeFile(approvalTicket, JSON.stringify({ invocationId, awakeableId: awakeable.id, effect: req.effect, requestedAt: new Date().toISOString() }, null, 2));
      });
      const approved = await awakeable.promise;
      if (!approved) throw new restate.TerminalError("denied");
      const settledAt = await ctx.date.toJSON();
      ctx.set("approved-effect", { effect: req.effect, approvedAt: settledAt, exactlyOnceKey: ctx.key });
      return { effect: req.effect, exactlyOnceKey: ctx.key, settlement: "completed", settledAt };
    },
  },
});

restate.serve({ services: [Node, Approval], port: Number(process.env.SERVICE_PORT ?? 9080) });
