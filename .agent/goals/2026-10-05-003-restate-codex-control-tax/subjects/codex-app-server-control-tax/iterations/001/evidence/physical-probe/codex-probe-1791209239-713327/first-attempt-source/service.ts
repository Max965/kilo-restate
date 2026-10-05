import * as restate from "@restatedev/restate-sdk";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { resumeCodexThread, runCodexTurn } from "./appserver-driver.js";

const RUN = "KiloCodexTaxProbeRun20261005";
const GATE = "KiloCodexTaxProbeGate20261005";
const probeRoot = resolve(process.env.PROBE_ROOT ?? ".");
type Decision = "decline" | "accept";

interface GateRequest {
  runId: string;
  outerInvocationId: string;
  requestId: string | number;
  threadId: string;
  turnId: string;
  itemId: string;
  commandSha256: string;
}
interface RunRequest {
  runId: string;
  codexHome: string;
  workspace: string;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new restate.TerminalError(`invalid ${label}`);
  return value;
}
function underProbeRoot(value: unknown, label: string): string {
  const target = resolve(requiredString(value, label));
  if (!target.startsWith(probeRoot + sep)) throw new restate.TerminalError(`${label} outside probe evidence`);
  return target;
}
function validRunId(value: unknown): string {
  const runId = requiredString(value, "runId");
  if (!/^codex-probe-[a-z0-9-]+$/.test(runId)) throw new restate.TerminalError("invalid runId");
  return runId;
}

const ApprovalGate = restate.object({
  name: GATE,
  handlers: {
    request: async (ctx: restate.ObjectContext, request: GateRequest) => {
      const runId = validRunId(request.runId);
      if (ctx.key !== runId) throw new restate.TerminalError("gate key does not match runId");
      const outerInvocationId = requiredString(request.outerInvocationId, "outerInvocationId");
      const threadId = requiredString(request.threadId, "threadId");
      const turnId = requiredString(request.turnId, "turnId");
      const itemId = requiredString(request.itemId, "itemId");
      const awakeable = ctx.awakeable<Decision>();
      const invocationId = ctx.request().id;
      const ticketPath = join(probeRoot, runId, "gate-ticket.json");
      const ticket = {
        runId, outerInvocationId, invocationId, awakeableId: awakeable.id,
        requestId: request.requestId, threadId, turnId, itemId,
        commandSha256: request.commandSha256,
      };
      await ctx.run("record-approval-ticket", async () => {
        await mkdir(dirname(ticketPath), { recursive: true });
        const temporary = `${ticketPath}.tmp`;
        await writeFile(temporary, JSON.stringify(ticket, null, 2), { mode: 0o600 });
        await rename(temporary, ticketPath);
      });
      const decision = await awakeable.promise;
      return { decision, invocationId, awakeableId: awakeable.id, threadId, turnId, itemId };
    },
  },
});

const Run = restate.workflow({
  name: RUN,
  handlers: {
    run: async (ctx: restate.WorkflowContext, request: RunRequest) => {
      const runId = validRunId(request.runId);
      if (ctx.key !== runId) throw new restate.TerminalError("workflow key does not match runId");
      const codexHome = underProbeRoot(request.codexHome, "codexHome");
      const workspace = underProbeRoot(request.workspace, "workspace");
      const outerInvocationId = ctx.request().id;
      const paths = {
        runId,
        outerInvocationId,
        codexHome,
        workspace,
        ingressUrl: process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180",
        stderrPath: join(probeRoot, runId, "appserver-first.stderr.log"),
      };
      const turn = await ctx.run("codex-app-server-turn", () => runCodexTurn(paths), { maxRetryAttempts: 1 });
      const resumed = await ctx.run("codex-app-server-resume-after-restart", () => resumeCodexThread({
        codexHome,
        workspace,
        stderrPath: join(probeRoot, runId, "appserver-resume.stderr.log"),
      }, String(turn.threadId), String(turn.turnId)), { maxRetryAttempts: 1 });
      return {
        status: "completed",
        runId,
        workflowKey: ctx.key,
        outerInvocationId,
        turn,
        resumed,
      };
    },
  },
});

restate.serve({ services: [Run, ApprovalGate], port: Number(process.env.SERVICE_PORT ?? 19083) });
