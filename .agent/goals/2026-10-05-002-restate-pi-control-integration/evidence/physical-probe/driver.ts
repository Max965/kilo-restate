import { watch } from "node:fs";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@restatedev/restate-sdk-clients";

const probeDir = dirname(fileURLToPath(import.meta.url));
const evidenceRoot = resolve(process.env.PROBE_ROOT ?? probeDir);
const runId = `probe-${Date.now()}-${randomUUID().slice(0, 8)}`;
const sessionId = randomUUID();
const runDir = join(evidenceRoot, "runtime", runId);
const workspace = join(runDir, "workspace");
const sessionDir = join(runDir, "sessions");
const homeDir = join(runDir, "home");
const ticketDir = join(runDir, "tickets");
const eventLogPath = join(runDir, "extension-events.jsonl");
const processLogPath = join(runDir, "process-events.jsonl");
const crashMarkerPath = join(runDir, "crash-once.marker");
const outputPath = join(runDir, "result.json");
const ingressUrl = process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180";
const adminUrl = process.env.RESTATE_ADMIN ?? "http://127.0.0.1:9170";
const runServiceName = "KiloPiControlProbeRun20261005";

interface RunRequest {
  runId: string;
  sessionId: string;
  workspace: string;
  sessionDir: string;
  homeDir: string;
  extensionPath: string;
  eventLogPath: string;
  processLogPath: string;
  crashMarkerPath: string;
  prompt: string;
}

interface RunResult {
  settlement: string;
  invocationId: string;
  workflowKey: string;
  runId: string;
  sessionId: string;
  sessionFile: string | null;
  rpcEvents: Array<Record<string, unknown>>;
  sessionEntries: Array<Record<string, unknown>>;
  leafId: string | null;
  lastAssistantText: string | null;
}

interface Output<T> {
  ready: boolean;
  result: T;
}

interface Submission {
  invocationId: string;
  status: "Accepted" | "PreviouslyAccepted";
  attachable: true;
}

interface WorkflowClient {
  workflowSubmit(input: RunRequest): Promise<Submission>;
  workflowOutput(): Promise<Output<RunResult>>;
  workflowAttach(): Promise<RunResult>;
}

interface Ticket {
  runId: string;
  parentInvocationId: string;
  sessionId: string;
  toolCallId: string;
  parentToolCallId: string | null;
  toolName: string;
  input: Record<string, unknown>;
  invocationId: string;
  awakeableId: string;
}

const ingress = connect({ url: ingressUrl });
const tickets = new Map<string, Ticket>();
const waiters = new Map<string, (ticket: Ticket) => void>();

async function readJsonLines(path: string): Promise<Array<Record<string, unknown>>> {
  return (await readFile(path, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function maybeJsonLines(path: string): Promise<Array<Record<string, unknown>>> {
  try { await access(path); return await readJsonLines(path); }
  catch { return []; }
}

function waitForTicket(callId: string, timeoutMs = 30000): Promise<Ticket> {
  const existing = tickets.get(callId);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolveTicket, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(callId);
      reject(new Error(`Timed out waiting for durable gate ticket ${callId}`));
    }, timeoutMs);
    waiters.set(callId, (ticket) => {
      clearTimeout(timer);
      waiters.delete(callId);
      resolveTicket(ticket);
    });
  });
}

async function query(sql: string): Promise<{ rows: Array<Record<string, unknown>> }> {
  const response = await fetch(`${adminUrl}/query`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(`Restate SQL failed (${response.status}): ${await response.text()}`);
  return await response.json() as { rows: Array<Record<string, unknown>> };
}

async function textFile(name: string): Promise<string | undefined> {
  try { return await readFile(join(workspace, name), "utf8"); }
  catch { return undefined; }
}

await mkdir(workspace, { recursive: true });
await mkdir(sessionDir, { recursive: true });
await mkdir(homeDir, { recursive: true });
await mkdir(ticketDir, { recursive: true });
await writeFile(join(workspace, "seed.txt"), "original\n");

const watcher = watch(ticketDir, (_eventType, filename) => {
  const fileName = filename?.toString();
  if (!fileName?.endsWith(".json")) return;
  void readFile(join(ticketDir, fileName), "utf8").then((text) => {
    const ticket = JSON.parse(text) as Ticket;
    tickets.set(ticket.toolCallId, ticket);
    waiters.get(ticket.toolCallId)?.(ticket);
  }).catch(() => {});
});

try {
  const workflow = ingress.workflowClient({ name: runServiceName } as never, runId) as unknown as WorkflowClient;
  const request: RunRequest = {
    runId,
    sessionId,
    workspace,
    sessionDir,
    homeDir,
    extensionPath: resolve(probeDir, "extension.ts"),
    eventLogPath,
    processLogPath,
    crashMarkerPath,
    prompt: "Run the deterministic Restate tool-boundary probe and report completion.",
  };
  const firstSubmit = await workflow.workflowSubmit(request);
  const duplicateSubmit = await workflow.workflowSubmit(request);

  const firstGate = await waitForTicket("read-1");
  const pending = await workflow.workflowOutput();
  const pendingOutput = pending.ready ? { ready: true, result: pending.result } : { ready: false };
  await ingress.resolveAwakeable(firstGate.awakeableId, "ALLOW");
  const resolvedTickets: Array<{ toolCallId: string; decision: string; invocationId: string }> = [
    { toolCallId: firstGate.toolCallId, decision: "ALLOW", invocationId: firstGate.invocationId },
  ];

  for (const [callId, decision] of [["write-1", "ALLOW"], ["edit-1", "ALLOW"], ["bash-1", "ALLOW"], ["write-deny", "DENY"]] as const) {
    const ticket = await waitForTicket(callId);
    await ingress.resolveAwakeable(ticket.awakeableId, decision);
    resolvedTickets.push({ toolCallId: ticket.toolCallId, decision, invocationId: ticket.invocationId });
  }

  const attachedResult = await workflow.workflowAttach();
  const completed = await workflow.workflowOutput();
  if (!completed.ready) throw new Error("workflow output remained pending after attach");
  const completedOutput = { ready: true, result: completed.result };
  const extensionEvents = await maybeJsonLines(eventLogPath);
  const processEvents = await maybeJsonLines(processLogPath);
  const processStarts = processEvents.filter((event) => event.phase === "started");
  const ticketFiles = await readdir(ticketDir);
  const gateTickets = await Promise.all(ticketFiles.filter((name) => name.endsWith(".json")).map(async (name) => JSON.parse(await readFile(join(ticketDir, name), "utf8")) as Ticket));
  const gateErrors = await maybeJsonLines(join(runDir, "gate-errors.jsonl"));

  const invocationIds = new Set<string>([firstSubmit.invocationId]);
  for (const event of extensionEvents) {
    if (typeof event.invocationId === "string") invocationIds.add(event.invocationId);
  }
  for (const ticket of gateTickets) invocationIds.add(ticket.invocationId);
  for (const event of gateErrors) if (typeof event.invocationId === "string") invocationIds.add(event.invocationId);
  const ids = [...invocationIds].filter((id) => /^[A-Za-z0-9_]+$/.test(id));
  const quotedIds = ids.map((id) => `'${id}'`).join(",");
  const [invocations, journal] = await Promise.all([
    query(`SELECT id, status, target_service_name, target_handler_name FROM sys_invocation_status WHERE id IN (${quotedIds})`),
    query(`SELECT id, index, entry_type, name, entry_json FROM sys_journal WHERE id IN (${quotedIds}) ORDER BY id, index`),
  ]);

  const workspaceFiles: Record<string, string> = {};
  for (const name of ["seed.txt", "written.txt", "denied.txt"]) {
    const contents = await textFile(name);
    if (contents !== undefined) workspaceFiles[name] = contents;
  }
  const output = {
    runId,
    outer: { runId, firstSubmit, duplicateSubmit, pendingOutput, completedOutput, attachedResult },
    pi: { processStarts, processEvents, rpcEvents: attachedResult.rpcEvents, result: completedOutput.result },
    extensionEvents,
    gateTickets,
    resolvedTickets,
    workspace: workspaceFiles,
    restate: { invocations: invocations.rows, journal: journal.rows, sql: ["sys_invocation_status", "sys_journal"] },
  };
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  watcher.close();
  console.log(JSON.stringify({ outputPath, runId, invocationId: firstSubmit.invocationId, ticketCount: gateTickets.length, processStarts: processStarts.length }, null, 2));
} finally {
  watcher.close();
}
