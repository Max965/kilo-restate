import { randomUUID } from "node:crypto";
import { watch } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@restatedev/restate-sdk-clients";

const probeRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = "/home/miles/repos/agent-harnesses/kilo-restate";
const runId = process.env.PROBE_RUN_ID ?? `codex-probe-${Date.now()}-${randomUUID().slice(0, 8)}`;
const runDir = join(probeRoot, runId);
const workspace = join(runDir, "workspace");
const codexHome = join(runDir, "codex-home");
const markerPath = join(workspace, "codex-effect-marker.txt");
const ticketPath = join(runDir, "gate-ticket.json");
const ingressUrl = process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180";
const adminUrl = process.env.RESTATE_ADMIN ?? "http://127.0.0.1:9170";
const runService = "KiloCodexTaxProbeRun20261005";
interface RunRequest { runId: string; codexHome: string; workspace: string }
interface Submission { invocationId: string; status: string; attachable: boolean }
interface Output { ready: boolean; result?: unknown }
interface Ticket {
  runId: string; outerInvocationId: string; invocationId: string; awakeableId: string;
  requestId: string | number; threadId: string; turnId: string; itemId: string; commandSha256: string;
}
interface WorkflowClient {
  workflowSubmit(input: RunRequest): Promise<Submission>;
  workflowOutput(): Promise<Output>;
  workflowAttach(): Promise<unknown>;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid Restate result");
  return value as Record<string, unknown>;
}
async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}
async function readTicket(): Promise<Ticket | undefined> {
  try { return JSON.parse(await readFile(ticketPath, "utf8")) as Ticket; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}
async function waitForTicket(timeoutMs = 180_000): Promise<Ticket> {
  const existing = await readTicket();
  if (existing) return existing;
  return new Promise((resolveTicket, reject) => {
    let timer: NodeJS.Timeout;
    const watcher = watch(dirname(ticketPath), (_event, filename) => {
      if (filename?.toString() !== basename(ticketPath)) return;
      void readTicket().then((ticket) => {
        if (!ticket) return;
        clearTimeout(timer);
        watcher.close();
        resolveTicket(ticket);
      }).catch((error: unknown) => {
        clearTimeout(timer);
        watcher.close();
        reject(error);
      });
    });
    timer = setTimeout(() => {
      watcher.close();
      reject(new Error("timed out waiting for durable Restate approval ticket"));
    }, timeoutMs);
    watcher.once("error", (error) => {
      clearTimeout(timer);
      watcher.close();
      reject(error);
    });
  });
}
async function query(sql: string): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(`${adminUrl}/query`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(`Restate SQL query failed (${response.status})`);
  return (await response.json() as { rows: Array<Record<string, unknown>> }).rows;
}
async function main(): Promise<void> {
  await mkdir(workspace, { recursive: true });
  const ingress = connect({ url: ingressUrl });
  const workflow = ingress.workflowClient({ name: runService } as never, runId) as unknown as WorkflowClient;
  const request: RunRequest = { runId, codexHome, workspace };
  const firstSubmit = await workflow.workflowSubmit(request);
  const duplicateSubmit = await workflow.workflowSubmit(request);
  if (firstSubmit.invocationId !== duplicateSubmit.invocationId) throw new Error("duplicate Restate submit changed outer invocation identity");

  const ticket = await waitForTicket();
  const pendingOutput = await workflow.workflowOutput();
  const effectExistsAtDecision = await exists(markerPath);
  const controllerReceipt = {
    asyncPendingObserved: !pendingOutput.ready,
    pendingOutputReady: pendingOutput.ready,
    effectExistsAtDecision,
    decision: "decline",
    gateInvocationId: ticket.invocationId,
    awakeableId: ticket.awakeableId,
    requestId: ticket.requestId,
    itemId: ticket.itemId,
    observedAt: new Date().toISOString(),
  };
  await ingress.resolveAwakeable(ticket.awakeableId, "decline");
  await writeFile(join(runDir, "controller-resolution.json"), JSON.stringify(controllerReceipt, null, 2), { mode: 0o600 });

  await workflow.workflowAttach();
  const completedOutput = await workflow.workflowOutput();
  if (!completedOutput.ready) throw new Error("outer Restate workflow output remained pending");
  const outer = object(completedOutput.result);
  const turn = object(outer.turn);
  const resumed = object(outer.resumed);
  const effectExistsAfter = await exists(markerPath);
  const ids = [firstSubmit.invocationId, ticket.invocationId];
  if (ids.some((id) => !/^[A-Za-z0-9_]+$/.test(id))) throw new Error("unexpected Restate invocation id format");
  const quoted = ids.map((id) => `'${id}'`).join(",");
  const [invocations, journal] = await Promise.all([
    query(`SELECT id, status, target_service_name, target_handler_name FROM sys_invocation_status WHERE id IN (${quoted})`),
    query(`SELECT id, index, entry_type, name FROM sys_journal WHERE id IN (${quoted}) ORDER BY id, index`),
  ]);
  const approval = object(turn.approval);
  const codex = {
    version: "0.154.0",
    appServerUserAgent: turn.appServerUserAgent ?? null,
    threadId: turn.threadId,
    resumedThreadId: resumed.resumedThreadId,
    sessionId: turn.sessionId,
    ephemeral: turn.ephemeral,
    turnId: turn.turnId,
    turnStatus: turn.turnStatus,
    resumedTurnStatus: resumed.resumedTurnStatus,
    persistedTurnFound: resumed.persistedTurnFound,
    processIdBeforeRestart: turn.processIdBeforeRestart,
    processIdAfterRestart: resumed.processIdAfterRestart,
    turnCount: resumed.turnCount,
    parentThreadId: turn.parentThreadId,
    cliVersion: turn.cliVersion,
    assistantMessagePresent: turn.assistantMessagePresent,
  };
  const result = {
    status: "PASS",
    runId,
    codex,
    approval: {
      method: approval.method,
      requestId: approval.requestId,
      threadId: approval.threadId,
      turnId: approval.turnId,
      itemId: approval.itemId,
      commandSha256: approval.commandSha256,
      gateInvocationId: ticket.invocationId,
      decision: controllerReceipt.decision,
      asyncPendingObserved: controllerReceipt.asyncPendingObserved,
      effectExistsAtDecision,
      effectExistsAfter,
    },
    restate: {
      status: completedOutput.ready && outer.status === "completed" ? "completed" : "incomplete",
      invocationId: firstSubmit.invocationId,
      workflowKey: runId,
      firstSubmit,
      duplicateSubmit,
      pendingOutputReady: pendingOutput.ready,
      attached: true,
      gateInvocationId: ticket.invocationId,
      invocations,
      journal,
    },
    events: turn.events,
    workspace: { markerExists: effectExistsAfter },
  };
  await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ resultPath: join(runDir, "result.json"), runId, outerInvocationId: firstSubmit.invocationId, gateInvocationId: ticket.invocationId }, null, 2));
}

main().catch(async (error: unknown) => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "failure.json"), JSON.stringify({ status: "FAIL", phase: "driver", errorName }, null, 2), { mode: 0o600 });
  console.error(`Codex Restate probe failed (${errorName})`);
  process.exitCode = 1;
});
