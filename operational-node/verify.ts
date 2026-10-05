import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { createConnection, createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@restatedev/restate-sdk-clients";
import type { OperationEvent, OperationRequest, OperationResult } from "./contract.ts";
import { makeEffectId } from "./contract.ts";
import { OperationWorkflow } from "./restate/service.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const goalEvidence = join(repo, ".agent/goals/2026-10-05-004-kilo-restate-operational-node/iterations/01/evidence/operational-node");
const runTag = `${new Date().toISOString().replace(/[^A-Za-z0-9.-]/g, "-")}-${process.pid}`;
const runRoot = join(goalEvidence, "runs", runTag);
const workspaces = join(runRoot, "workspaces");
const sessions = join(runRoot, "sessions");
const home = join(runRoot, "home");
const adminUrl = process.env.RESTATE_ADMIN ?? "http://127.0.0.1:9170";
const ingressUrl = process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180";
const containerName = process.env.KILO_RESTATE_CONTAINER ?? "kilo-restate-pi-lifecycle";
const piRoot = process.env.KILO_PI_SOURCE ?? "/home/miles/repos/agent-harnesses/kilo-pi-durable";
const tsxLoader = join(repo, "node_modules/tsx/dist/esm/index.mjs");
const servicePath = join(repo, "operational-node/restate/service.ts");
const ingress = connect({ url: ingressUrl });

const specs = [
  ["A01", "Restate ingress and Admin SQL respond"], ["A02", "Restate discovers the Kilo operational-node service"],
  ["A03", "Exact maintained Pi RPC starts with Kilo extension"], ["A04", "Duplicate stable submission resolves to one Restate operation"],
  ["A05", "Restate operation maps to a recorded Pi session locator"], ["B01", "Deterministic prompt reaches ordinary Pi"],
  ["B02", "Pi turn lifecycle is captured"], ["B03", "Pi emits authoritative agent_settled"],
  ["B04", "Restate settles after Pi settlement"], ["C01", "read is gated before Restate effect"],
  ["C02", "write is gated before Restate effect"], ["C03", "edit is gated before Restate effect"],
  ["C04", "harmless bash is gated before Restate effect"], ["C05", "DENY prevents physical effect"],
  ["C06", "gate failure fails closed"], ["D01", "effect identity is stable across retries"],
  ["D02", "effect invocation is durable Restate work"], ["D03", "native-shaped result returns to Pi"],
  ["D04", "operation/session/call/effect/result correlate structurally"], ["E01", "Pi child is killed after durable ALLOW"],
  ["E02", "same Restate operation survives Pi restart"], ["E03", "new Pi process reopens same session"],
  ["E04", "durable gate decision is reused"], ["E05", "recovered operation reaches settlement"],
  ["F01", "controller requests operation cancellation"], ["F02", "RpcClient abort interrupts Pi"],
  ["F03", "late tool result behavior is explicit"], ["F04", "Restate cancellation settles deterministically"],
  ["G01", "child request crosses controlled Pi tool boundary"], ["G02", "child gets stable Restate identity"],
  ["G03", "Restate parent/child causal relation is queryable"], ["G04", "child result returns through Pi to parent"],
] as const;

type CheckStatus = "PASS" | "FAIL" | "BLOCKED" | "SKIPPED_DEPENDENCY";
interface MatrixCheck {
  checkId: string;
  status: CheckStatus;
  observed: unknown;
  expected: string;
  evidencePointer: string[];
  blocks: string[];
}
interface ServiceStatus {
  operationId: string;
  status: string;
  identity?: { operationId: string; invocationId: string; sessionId: string; sessionFile: string; parentOperationId?: string; parentToolCallId?: string };
  result?: OperationResult;
  childIds: string[];
  events: OperationEvent[];
}
interface Trial {
  scenario: string;
  operationId: string;
  workspace: string;
  request?: OperationRequest;
  submission?: { invocationId: string; status: string };
  duplicateSubmission?: { invocationId: string; status: string };
  cancelResponse?: unknown;
  status?: ServiceStatus;
  result?: OperationResult;
  events: OperationEvent[];
  error?: string;
  timedOut?: boolean;
  evidenceFile: string;
}

const checks = new Map<string, MatrixCheck>();
for (const [checkId, expected] of specs) checks.set(checkId, { checkId, status: "BLOCKED", observed: "not run", expected, evidencePointer: [], blocks: [] });
let podmanContainerWasStarted = false;
let deploymentId: string | undefined;
let serviceProcess: ChildProcess | undefined;
let serviceLog: ReturnType<typeof createWriteStream> | undefined;
let setupError: string | undefined;
let cleanup: Record<string, unknown> = {};
const evidence = (name: string): string => join(runRoot, name);
const setCheck = (id: string, status: CheckStatus, observed: unknown, evidenceFiles: string[] = [], blocks: string[] = []): void => {
  const current = checks.get(id);
  assert(current, `unknown check ${id}`);
  checks.set(id, { ...current, status, observed, evidencePointer: evidenceFiles, blocks });
};
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const payloadOf = (event: OperationEvent): Record<string, unknown> => asRecord(event.payload);
const errorText = (error: unknown): string => error instanceof Error ? `${error.name}: ${error.message}` : String(error);
const delay = (ms: number): Promise<void> => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function saveJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
async function adminQuery(query: string): Promise<{ rows: Array<Record<string, unknown>> }> {
  const response = await fetch(`${adminUrl}/query`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ query }) });
  if (!response.ok) throw new Error(`Restate SQL HTTP ${response.status}: ${await response.text()}`);
  return await response.json() as { rows: Array<Record<string, unknown>> };
}
async function getDeployments(): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${adminUrl}/deployments`);
  if (!response.ok) throw new Error(`Restate deployments HTTP ${response.status}: ${await response.text()}`);
  const body = asRecord(await response.json());
  return Array.isArray(body.deployments) ? body.deployments.map(asRecord) : [];
}
function containerInfo(): Record<string, unknown> {
  const rawState = execFileSync("podman", ["inspect", "--format", "{{json .State}}", containerName], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const state = asRecord(JSON.parse(rawState));
  const row = execFileSync("podman", ["ps", "-a", "--filter", `name=${containerName}`, "--format", "{{.ID}}|{{.Names}}|{{.Status}}"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split(/\r?\n/)[0] ?? "";
  const [id = "", name = containerName, status = "unknown"] = row.split("|");
  return { id, name, status, state: { running: state.Running, status: state.Status, exitCode: state.ExitCode, startedAt: state.StartedAt, finishedAt: state.FinishedAt } };
}
function portAcceptingConnections(target: number): Promise<boolean> {
  return new Promise((resolveConnection) => {
    const socket = createConnection({ host: "127.0.0.1", port: target });
    socket.once("connect", () => { socket.destroy(); resolveConnection(true); });
    socket.once("error", () => { socket.destroy(); resolveConnection(false); });
  });
}
async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert(address && typeof address !== "string", "could not allocate a local TCP port");
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return address.port;
}
async function stopProcess(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = once(child, "exit").then(() => true, () => true);
  if (await Promise.race([exited, delay(2_000).then(() => false)])) return;
  child.kill("SIGKILL");
  await Promise.race([once(child, "exit"), delay(2_000)]);
}
function terminal(status: string): boolean { return ["completed", "failed", "cancelled"].includes(status); }
async function queryInvocation(invocationId: string): Promise<{ statusRows: Record<string, unknown>[]; journalRows: Record<string, unknown>[] }> {
  const id = invocationId.replaceAll("'", "''");
  const [status, journal] = await Promise.all([
    adminQuery(`SELECT id, target, status, invoked_by, invoked_by_id, invoked_by_target FROM sys_invocation_status WHERE id = '${id}'`),
    adminQuery(`SELECT id, index, entry_type, name FROM sys_journal WHERE id = '${id}' ORDER BY index`),
  ]);
  return { statusRows: status.rows, journalRows: journal.rows };
}
async function runTrial(scenario: string, decide: (event: OperationEvent) => "ALLOW" | "DENY" | "REJECT", duplicate = false): Promise<Trial> {
  const operationId = `op-${runTag}-${scenario}`;
  const workspace = join(workspaces, operationId);
  const outputFile = evidence(`${scenario}.json`);
  const trial: Trial = { scenario, operationId, workspace, events: [], evidenceFile: outputFile };
  try {
    await mkdir(workspace, { recursive: true });
    if (["core-tools", "recovery"].includes(scenario)) await writeFile(join(workspace, "readme.txt"), "before\n");
    const request: OperationRequest = {
      operationId,
      prompt: `Deterministic acceptance scenario: ${scenario}`,
      workspace,
      provider: "faux",
      model: "faux-1",
      testScenario: scenario,
    };
    trial.request = request;
    const client = ingress.workflowClient(OperationWorkflow, operationId);
    const submission = await client.workflowSubmit(request);
    trial.submission = { invocationId: submission.invocationId, status: submission.status };
    if (duplicate) {
      const repeated = await client.workflowSubmit(request);
      trial.duplicateSubmission = { invocationId: repeated.invocationId, status: repeated.status };
    }
    let cancelSent = false;
    const resolvedAwakeables = new Set<string>();
    const deadline = Date.now() + (scenario === "recovery" ? 50_000 : 35_000);
    while (Date.now() < deadline) {
      const status = await client.status() as ServiceStatus;
      trial.status = status;
      trial.events = status.events ?? [];
      for (const pending of trial.events.filter((event) => event.type === "gate_pending")) {
        const payload = payloadOf(pending);
        const awakeableId = typeof payload.awakeableId === "string" ? payload.awakeableId : "";
        if (!awakeableId || resolvedAwakeables.has(awakeableId)) continue;
        resolvedAwakeables.add(awakeableId);
        const decision = decide(pending);
        if (decision === "REJECT") await ingress.rejectAwakeable(awakeableId, "deterministic acceptance gate failure");
        else await ingress.resolveAwakeable(awakeableId, decision);
      }
      if (scenario === "cancel" && !cancelSent && trial.events.some((event) => event.type === "test_wait_started")) {
        trial.cancelResponse = await client.cancel();
        cancelSent = true;
      }
      if (terminal(status.status)) {
        try { trial.result = await client.workflowAttach(); }
        catch (error) { trial.error = errorText(error); }
        break;
      }
      await delay(75);
    }
    trial.timedOut = !trial.status || !terminal(trial.status.status);
    if (trial.timedOut) {
      try { trial.cancelResponse = await ingress.workflowClient(OperationWorkflow, operationId).cancel(); } catch { /* best-effort cleanup of a failed specimen */ }
      trial.error ??= `scenario timed out; last status=${trial.status?.status ?? "unavailable"}`;
    }
  } catch (error) {
    trial.error = errorText(error);
  }
  try {
    const client = ingress.workflowClient(OperationWorkflow, operationId);
    trial.status ??= await client.status() as ServiceStatus;
    trial.events = trial.status.events ?? trial.events;
  } catch { /* preserve the primary failure */ }
  await saveJson(outputFile, trial);
  return trial;
}
function hasEvent(trial: Trial | undefined, type: string, predicate: (event: OperationEvent) => boolean = () => true): boolean {
  return Boolean(trial?.events.some((event) => event.type === type && predicate(event)));
}
function eventsOf(trial: Trial | undefined, type: string): OperationEvent[] {
  return trial?.events.filter((event) => event.type === type) ?? [];
}
function eventIndex(trial: Trial | undefined, type: string, predicate: (event: OperationEvent) => boolean = () => true): number {
  return trial?.events.findIndex((event) => event.type === type && predicate(event)) ?? -1;
}
function artifact(trial: Trial | undefined): string[] { return trial ? [trial.evidenceFile] : []; }
function checkCondition(id: string, condition: boolean, observed: unknown, file: string[] = [], blocks: string[] = []): void {
  setCheck(id, condition ? "PASS" : "FAIL", observed, file, blocks);
}
async function fileText(path: string): Promise<string | undefined> {
  try { return await readFile(path, "utf8"); } catch { return undefined; }
}

await mkdir(runRoot, { recursive: true });
await mkdir(workspaces, { recursive: true });
await mkdir(sessions, { recursive: true });
await mkdir(home, { recursive: true });
await saveJson(evidence("run-context.json"), {
  runTag, repo, piRoot, adminUrl, ingressUrl, containerName, startedAt: new Date().toISOString(),
  boundaries: { model: "faux/faux-1", piSourceModified: false, restateSourceModified: false, networkModelUsed: false },
});

let core: Trial | undefined;
let denied: Trial | undefined;
let gateError: Trial | undefined;
let recovery: Trial | undefined;
let cancellation: Trial | undefined;
let child: Trial | undefined;
let registeredServices: string[] = [];
let queryReady: unknown;
let deploymentListBefore: Record<string, unknown>[] = [];
let serviceProcessExit: unknown;
let uiObservation: Record<string, unknown> = { status: "UI_BLOCKED", reason: "not inspected" };
let effectJournals: Record<string, unknown> = {};
let childLineage: Record<string, unknown> | undefined;

try {
  const initialContainer = containerInfo();
  await saveJson(evidence("container-before.json"), initialContainer);
  const initialState = asRecord(initialContainer.state);
  podmanContainerWasStarted = initialState.running !== true;
  if (podmanContainerWasStarted) execFileSync("podman", ["start", containerName], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  let readyError: string | undefined;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const ingressResponse = await fetch(ingressUrl, { signal: AbortSignal.timeout(1_000) });
      const sql = await adminQuery("SELECT 1 AS ready");
      if (ingressResponse.status >= 500) throw new Error(`unexpected ingress status ${ingressResponse.status}`);
      if (Number(sql.rows[0]?.ready) !== 1) throw new Error(`unexpected readiness SQL result: ${JSON.stringify(sql.rows)}`);
      queryReady = { ingressStatus: ingressResponse.status, query: sql.rows[0] };
      break;
    } catch (error) {
      readyError = errorText(error);
      await delay(1_000);
    }
  }
  if (!queryReady) throw new Error(`Restate readiness failed: ${readyError ?? "no response"}`);
  await saveJson(evidence("restate-ready.json"), queryReady);
  deploymentListBefore = await getDeployments();
  await saveJson(evidence("deployments-before.json"), deploymentListBefore);

  const actualPort = await availablePort();
  serviceLog = createWriteStream(evidence("operational-node-service.log"), { flags: "a" });
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: home,
    PI_OFFLINE: "1",
    PORT: String(actualPort),
    RESTATE_INGRESS: ingressUrl,
    KILO_EVENT_INGRESS: ingressUrl,
    KILO_WORKSPACE_ROOT: workspaces,
    KILO_PI_SESSION_ROOT: sessions,
    KILO_PI_HOME: home,
    KILO_PI_SOURCE: piRoot,
    KILO_PI_TURN_TIMEOUT_MS: "8000",
    KILO_GATE_TIMEOUT_MS: "5000",
    KILO_ALLOW_TEST_EXTENSION: "1",
    KILO_TEST_KILL_AFTER_ALLOW_FOR: "recover-read",
    KILO_TEST_CRASH_MARKER: evidence("recovery-crash-once.marker"),
  };
  serviceProcess = spawn(process.execPath, ["--import", tsxLoader, servicePath], { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
  serviceProcess.stdout?.pipe(serviceLog);
  serviceProcess.stderr?.pipe(serviceLog);
  serviceProcess.once("exit", (code, signal) => { serviceProcessExit = { code, signal }; });
  serviceProcess.once("error", (error) => { serviceProcessExit = { error: errorText(error) }; });
  let listening = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serviceProcess.exitCode !== null || serviceProcess.signalCode !== null) throw new Error(`Kilo service exited before listen: ${JSON.stringify(serviceProcessExit)}`);
    if (await portAcceptingConnections(actualPort)) { listening = true; break; }
    await delay(100);
  }
  if (!listening) throw new Error(`Kilo service did not listen on port ${actualPort}`);
  const deploymentResponse = await fetch(`${adminUrl}/deployments`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ uri: `http://host.containers.internal:${actualPort}` }),
  });
  const deploymentBody: unknown = await deploymentResponse.json();
  if (!deploymentResponse.ok) throw new Error(`Kilo deployment registration HTTP ${deploymentResponse.status}: ${JSON.stringify(deploymentBody)}`);
  deploymentId = String(asRecord(deploymentBody).id ?? "");
  if (!deploymentId) throw new Error(`Kilo deployment response lacks id: ${JSON.stringify(deploymentBody)}`);
  await saveJson(evidence("deployment-registration.json"), { status: deploymentResponse.status, body: deploymentBody });
  let discovered = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const deployments = await getDeployments();
    const own = deployments.find((deployment) => deployment.id === deploymentId);
    registeredServices = Array.isArray(own?.services) ? own.services.map((service) => String(asRecord(service).name)) : [];
    if (["KiloPiOperation", "KiloOperationGate", "KiloToolEffect", "KiloChildRelay", "KiloOperationEvents"].every((name) => registeredServices.includes(name))) { discovered = true; break; }
    await delay(500);
  }
  const deploymentsAfterRegister = await getDeployments();
  await saveJson(evidence("deployments-after-registration.json"), deploymentsAfterRegister);
  if (!discovered) throw new Error(`Restate did not discover expected services: ${JSON.stringify(registeredServices)}`);
  setCheck("A01", "PASS", queryReady, [evidence("restate-ready.json")]);
  setCheck("A02", "PASS", { deploymentId, services: registeredServices }, [evidence("deployment-registration.json"), evidence("deployments-after-registration.json")]);

  const decision = (value: "ALLOW" | "DENY" | "REJECT") => (): "ALLOW" | "DENY" | "REJECT" => value;
  core = await runTrial("core-tools", decision("ALLOW"), true);
  denied = await runTrial("deny", decision("DENY"));
  gateError = await runTrial("gate-error", decision("REJECT"));
  recovery = await runTrial("recovery", decision("ALLOW"));
  cancellation = await runTrial("cancel", decision("ALLOW"));
  child = await runTrial("child", decision("ALLOW"));

  const coreEvents = core.events;
  const coreOutput = core.result?.output;
  const coreSessionFile = core.result?.identity.sessionFile;
  const sessionExists = typeof coreSessionFile === "string" && coreSessionFile.length > 0 && await access(coreSessionFile).then(() => true, () => false);
  const coreLifecycle = ["pi_process_started", "agent_start", "turn_start", "turn_end", "agent_settled", "operation_settled"];
  const deniedFile = await fileText(join(denied.workspace, "denied.txt"));
  const failedGateFile = await fileText(join(gateError.workspace, "gate-error.txt"));
  const coreToolEnds = coreEvents.filter((event) => event.type === "tool_execution_end");
  const expectedCalls = ["read-core", "write-core", "edit-core", "bash-core"];
  const coreToolCallEnds = expectedCalls.map((toolCallId) => coreToolEnds.find((event) => payloadOf(event).toolCallId === toolCallId));
  const coreEffectResults = eventsOf(core, "tool_effect_result");
  const coreEffects = eventsOf(core, "effect_started");
  const effectEvidence: Record<string, unknown>[] = [];
  for (const event of coreEffects) {
    const invocationId = event.invocationId ?? "";
    if (!invocationId) continue;
    try {
      const journal = await queryInvocation(invocationId);
      effectEvidence.push({ effect: payloadOf(event), invocation: journal });
    } catch (error) { effectEvidence.push({ effect: payloadOf(event), error: errorText(error) }); }
  }
  effectJournals = { effectEvidence };
  await saveJson(evidence("core-effect-journals.json"), effectJournals);

  const actualPiRevision = execFileSync("git", ["-C", piRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const piStatus = execFileSync("git", ["-C", piRoot, "status", "--porcelain", "--", "packages/coding-agent", "packages/ai"], { encoding: "utf8" });
  checkCondition("A03", actualPiRevision === "b2b5c42f6138b73ec4b2f49ec0ca468800f88586" && !piStatus.trim() && hasEvent(core, "agent_start") && hasEvent(core, "pi_process_started"), { piRevision: actualPiRevision, extensionMarker: hasEvent(core, "agent_start"), piStarted: hasEvent(core, "pi_process_started"), piSourceChanges: piStatus.trim() }, artifact(core));
  setCheck("A04", core.submission?.invocationId === core.duplicateSubmission?.invocationId ? "PASS" : "FAIL", { first: core.submission, duplicate: core.duplicateSubmission }, artifact(core));
  checkCondition("A05", Boolean(core.result?.identity.sessionId && sessionExists), { identity: core.result?.identity, sessionFileExists: sessionExists }, artifact(core));
  checkCondition("B01", coreOutput === "CORE_TOOLS_SETTLED", { output: coreOutput, status: core.status?.status }, artifact(core));
  checkCondition("B02", hasEvent(core, "turn_start") && hasEvent(core, "turn_end"), { turnStart: hasEvent(core, "turn_start"), turnEnd: hasEvent(core, "turn_end"), events: coreLifecycle }, artifact(core));
  checkCondition("B03", hasEvent(core, "agent_settled"), { agentSettledEvents: eventsOf(core, "agent_settled").length }, artifact(core));
  checkCondition("B04", core.status?.status === "completed" && eventIndex(core, "agent_settled") >= 0 && eventIndex(core, "operation_settled") > eventIndex(core, "agent_settled"), { status: core.status?.status, eventOrder: coreLifecycle.map((type) => eventIndex(core, type)) }, artifact(core));

  const coreChecks: Array<[string, string, readonly string[]]> = [
    ["C01", "read-core", ["access", "detectImageMimeType", "read"]],
    ["C02", "write-core", ["mkdir", "write"]],
    ["C03", "edit-core", ["access", "read", "write"]],
    ["C04", "bash-core", ["bash"]],
  ];
  for (const [id, callId, operations] of coreChecks) {
    const requested = coreEvents.find((event) => event.type === "tool_requested" && payloadOf(event).toolCallId === callId);
    const allowedIndex = eventIndex(core, "gate_allowed", (event) => payloadOf(event).toolCallId === callId);
    const effectEvents = coreEvents.flatMap((event, index) => event.type === "effect_started" && payloadOf(event).toolCallId === callId && operations.includes(String(payloadOf(event).operation)) ? [{ event, index }] : []);
    const completedEffectIds = new Set(coreEvents.filter((event) => event.type === "effect_completed" && payloadOf(event).toolCallId === callId).map((event) => payloadOf(event).effectId).filter((id): id is string => typeof id === "string"));
    const observedOperations = [...new Set(effectEvents.map(({ event }) => String(payloadOf(event).operation)))];
    const allAfterGate = effectEvents.length > 0 && effectEvents.every(({ index }) => index > allowedIndex);
    const allCompleted = effectEvents.length > 0 && effectEvents.every(({ event }) => completedEffectIds.has(String(payloadOf(event).effectId)));
    const editedFile = id === "C03" ? await fileText(join(core.workspace, "readme.txt")) : undefined;
    const outputCorrect = id !== "C03" || editedFile === "after\n";
    checkCondition(id, Boolean(requested && allowedIndex >= 0 && allAfterGate && operations.every((operation) => observedOperations.includes(operation)) && allCompleted && outputCorrect), {
      toolRequested: Boolean(requested), gateAllowedIndex: allowedIndex, effectStartedIndexes: effectEvents.map(({ index }) => index),
      observedOperations, allAfterGate, allCompleted, ...(id === "C03" ? { editedFile, outputCorrect } : {}),
    }, artifact(core));
  }
  checkCondition("C05", hasEvent(denied, "gate_denied") && deniedFile === undefined, { gateDenied: hasEvent(denied, "gate_denied"), deniedFile }, artifact(denied));
  checkCondition("C06", hasEvent(gateError, "gate_failed") && failedGateFile === undefined, { gateFailed: hasEvent(gateError, "gate_failed"), gateErrorFile: failedGateFile }, artifact(gateError));

  const expectedEffectResults = coreEffectResults.filter((event) => expectedCalls.includes(String(payloadOf(event).toolCallId)));
  const identityMatches = expectedEffectResults.length > 0 && expectedCalls.every((callId) => expectedEffectResults.some((event) => payloadOf(event).toolCallId === callId)) && expectedEffectResults.every((event) => {
    const payload = payloadOf(event);
    return payload.effectId === makeEffectId({ operationId: core.operationId, sessionId: String(event.sessionId), toolCallId: String(payload.toolCallId), operation: String(payload.operation), stage: Number(payload.stage) });
  });
  checkCondition("D01", expectedEffectResults.length >= 4 && identityMatches, { expectedCalls, resultCount: expectedEffectResults.length, identityMatches }, artifact(core));
  const effectRows = effectJournals.effectEvidence as Array<Record<string, unknown>>;
  const durableEffects = coreEffects.length > 0 && effectRows?.length === coreEffects.length && effectRows.every((entry) => {
    const invocation = asRecord(entry.invocation);
    const statusRows = invocation.statusRows as Array<Record<string, unknown>> | undefined;
    const journalRows = invocation.journalRows as Array<Record<string, unknown>> | undefined;
    return Boolean(statusRows?.some((row) => row.status === "completed") && journalRows?.some((row) => row.entry_type === "Command: Run"));
  });
  checkCondition("D02", Boolean(durableEffects), { invocationCount: effectRows?.length ?? 0, durableEffects }, [evidence("core-effect-journals.json")]);
  const nativeResults = coreToolCallEnds.map((event, index) => {
    const payload = event ? payloadOf(event) : {};
    return { toolCallId: expectedCalls[index], isError: payload.isError, returned: Array.isArray(payload.toolResult) };
  });
  checkCondition("D03", coreToolCallEnds.every((event) => event && payloadOf(event).isError === false && Array.isArray(payloadOf(event).toolResult)), nativeResults, artifact(core));
  const correlations = expectedCalls.map((callId) => {
    const request = coreEvents.find((event) => event.type === "tool_requested" && payloadOf(event).toolCallId === callId);
    const effect = coreEffects.find((event) => payloadOf(event).toolCallId === callId);
    const result = coreEffectResults.find((event) => payloadOf(event).toolCallId === callId);
    return { callId, operationId: request?.operationId, sessionId: request?.sessionId, effectId: payloadOf(result ?? {} as OperationEvent).effectId, invocationId: effect?.invocationId, result: Boolean(result) };
  });
  checkCondition("D04", correlations.every((row) => row.operationId === core.operationId && row.sessionId === core.result?.identity.sessionId && row.effectId && row.invocationId && row.result), correlations, artifact(core));

  const recoveryPiStarts = eventsOf(recovery, "agent_start").filter((event) => Number.isSafeInteger(event.processId));
  const recoveryProcessIds = [...new Set(recoveryPiStarts.map((event) => event.processId!))];
  const recoveryDriverStarts = eventsOf(recovery, "pi_process_started");
  const driverAttemptIds = recoveryDriverStarts.map((event) => payloadOf(event).driverAttemptId).filter((id): id is string => typeof id === "string");
  const killedPiEvent = eventsOf(recovery, "test_killing_pi_after_allow").find((event) => payloadOf(event).toolCallId === "recover-read");
  const killedPiProcessId = killedPiEvent?.processId;
  const killedEventIndex = killedPiEvent ? recovery.events.indexOf(killedPiEvent) : -1;
  const restartedAfterKill = recoveryPiStarts.some((event) => event.processId !== killedPiProcessId && recovery.events.indexOf(event) > killedEventIndex);
  const recoveryGateCalls = eventsOf(recovery, "gate_allowed").filter((event) => payloadOf(event).toolCallId === "recover-read");
  const recoveryEffects = eventsOf(recovery, "effect_started").filter((event) => payloadOf(event).toolCallId === "recover-read");
  const recoveryEffectIds = recoveryEffects.map((event) => payloadOf(event).effectId);
  const markerExists = await access(evidence("recovery-crash-once.marker")).then(() => true, () => false);
  checkCondition("E01", markerExists && Boolean(killedPiEvent), { markerExists, crashAfterAllow: Boolean(killedPiEvent), piProcesses: recoveryProcessIds.length }, artifact(recovery));
  checkCondition("E02", recovery.status?.status === "completed" && recovery.result?.identity.operationId === recovery.operationId && recovery.result.identity.invocationId === recovery.submission?.invocationId, { status: recovery.status?.status, operationId: recovery.result?.identity.operationId, invocationId: recovery.result?.identity.invocationId, submission: recovery.submission }, artifact(recovery));
  const sameRecoverySession = recoveryPiStarts.length >= 2 && recoveryPiStarts.every((event) => event.sessionId === recovery.result?.identity.sessionId);
  const uniqueDriverAttempts = new Set(driverAttemptIds).size;
  checkCondition("E03", recoveryProcessIds.length >= 2 && Number.isSafeInteger(killedPiProcessId) && restartedAfterKill && sameRecoverySession && recoveryDriverStarts.length >= 2 && uniqueDriverAttempts >= 2 && Boolean(recovery.result?.identity.sessionFile), {
    processIds: recoveryProcessIds, killedPiProcessId, restartedAfterKill, sameRecoverySession, driverAttemptIds, sessionId: recovery.result?.identity.sessionId, sessionFile: recovery.result?.identity.sessionFile,
  }, artifact(recovery));
  checkCondition("E04", recoveryGateCalls.length === 1 && recoveryEffectIds.length > 0 && new Set(recoveryEffectIds).size === recoveryEffectIds.length, { gateAllowedCount: recoveryGateCalls.length, effectInvocationCount: recoveryEffectIds.length, effectIds: recoveryEffectIds, noDuplicateEffectIds: new Set(recoveryEffectIds).size === recoveryEffectIds.length }, artifact(recovery));
  checkCondition("E05", recovery.status?.status === "completed" && recovery.result?.output === "RECOVERY_SETTLED" && hasEvent(recovery, "agent_settled"), { status: recovery.status?.status, output: recovery.result?.output, agentSettled: hasEvent(recovery, "agent_settled") }, artifact(recovery));

  const waitStarted = hasEvent(cancellation, "test_wait_started");
  const waitInterrupted = hasEvent(cancellation, "test_wait_interrupted");
  const waitCompleted = hasEvent(cancellation, "test_wait_completed");
  checkCondition("F01", asRecord(cancellation.cancelResponse).status === "requested" && hasEvent(cancellation, "cancellation_requested"), { cancelResponse: cancellation.cancelResponse, cancellationRequested: hasEvent(cancellation, "cancellation_requested") }, artifact(cancellation));
  checkCondition("F02", waitStarted && waitInterrupted && cancellation.result?.piSettlement === "aborted", { waitStarted, waitInterrupted, piSettlement: cancellation.result?.piSettlement }, artifact(cancellation));
  checkCondition("F03", waitInterrupted && !waitCompleted && cancellation.result?.status === "cancelled", { waitInterrupted, lateWaitCompleted: waitCompleted, resultStatus: cancellation.result?.status }, artifact(cancellation));
  checkCondition("F04", cancellation.status?.status === "cancelled" && hasEvent(cancellation, "operation_cancelled"), { status: cancellation.status?.status, result: cancellation.result }, artifact(cancellation));

  const childRequested = eventsOf(child, "child_requested")[0];
  const childCompleted = eventsOf(child, "child_completed")[0];
  const childPayload = payloadOf(childCompleted ?? {} as OperationEvent);
  const childOperationId = String(childPayload.childOperationId ?? "");
  const childInvocationId = String(childPayload.childInvocationId ?? "");
  let childRow: Record<string, unknown> | undefined;
  if (childInvocationId) {
    try {
      const childInvocation = await queryInvocation(childInvocationId);
      childRow = childInvocation.statusRows[0];
      childLineage = { childOperationId, childInvocationId, childInvocation, parentInvocationId: child.result?.identity.invocationId };
    } catch (error) { childLineage = { childOperationId, childInvocationId, error: errorText(error) }; }
  }
  childLineage ??= { childOperationId, childInvocationId, reason: "child invocation identity was not observed" };
  await saveJson(evidence("child-lineage.json"), childLineage);
  checkCondition("G01", Boolean(childRequested && hasEvent(child, "gate_allowed", (event) => payloadOf(event).toolCallId === "spawn-child")), { childRequested: Boolean(childRequested), gateAllowed: hasEvent(child, "gate_allowed", (event) => payloadOf(event).toolCallId === "spawn-child") }, artifact(child));
  checkCondition("G02", Boolean(childOperationId && childInvocationId && childCompleted && payloadOf(childCompleted).parentOperationId === child.operationId), { childOperationId, childInvocationId, childEvent: childPayload }, artifact(child));
  const lineageRows = asRecord(childLineage?.childInvocation).statusRows as Array<Record<string, unknown>> | undefined;
  const linked = Boolean(lineageRows?.some((row) => row.invoked_by === "service" && row.invoked_by_id === child.result?.identity.invocationId && row.status === "completed"));
  setCheck("G03", !childOperationId || !childCompleted ? "SKIPPED_DEPENDENCY" : linked ? "PASS" : "BLOCKED", { nativeLineage: childRow, correlation: { parentOperationId: child.operationId, childOperationId, childInvocationId }, reason: linked ? undefined : "Restate SQL did not prove service-invoked causal parent linkage" }, [evidence("child-lineage.json"), ...artifact(child)], !childOperationId || !childCompleted ? ["G02"] : []);
  const childToolResult = child.events.find((event) => event.type === "tool_execution_end" && payloadOf(event).toolCallId === "spawn-child");
  const childToolPayload = payloadOf(childToolResult ?? {} as OperationEvent);
  const childToolText = JSON.stringify(childToolPayload.toolResult ?? "");
  if (!childCompleted || !childOperationId) setCheck("G04", "SKIPPED_DEPENDENCY", { reason: "child operation/result was not created" }, artifact(child), ["G02"]);
  else checkCondition("G04", Boolean(childToolResult && childToolPayload.isError === false && childToolText.includes(childOperationId) && childToolText.includes("OPERATIONAL_NODE_OK") && child.result?.output === "PARENT_CHILD_SETTLED"), { childOperationId, returnedPiResult: childToolPayload.toolResult, parentOutput: child.result?.output }, artifact(child));

  try {
    const rootResponse = await fetch(`${adminUrl}/`, { signal: AbortSignal.timeout(3_000) });
    const body = await rootResponse.text();
    uiObservation = { status: rootResponse.ok && body.includes("<html") ? "UI_PENDING" : "UI_BLOCKED", reason: "admin UI root responded, but operation specimen visibility is not established by an HTTP probe", httpStatus: rootResponse.status, contentType: rootResponse.headers.get("content-type"), html: body.includes("<html"), bodyPrefix: body.slice(0, 240) };
  } catch (error) { uiObservation = { status: "UI_BLOCKED", reason: errorText(error) }; }
  await saveJson(evidence("restate-ui-inspection.json"), uiObservation);
} catch (error) {
  setupError = errorText(error);
  await saveJson(evidence("setup-error.json"), { error: setupError, registeredServices, deploymentId, serviceProcessExit });
  setCheck("A01", queryReady ? "PASS" : "FAIL", queryReady ?? { error: setupError }, queryReady ? [evidence("restate-ready.json")] : [evidence("setup-error.json")]);
  const discoveryPass = ["KiloPiOperation", "KiloOperationGate", "KiloToolEffect", "KiloChildRelay", "KiloOperationEvents"].every((name) => registeredServices.includes(name));
  setCheck("A02", !queryReady ? "SKIPPED_DEPENDENCY" : discoveryPass ? "PASS" : "FAIL", { deploymentId, registeredServices, error: setupError }, [evidence("setup-error.json"), ...(deploymentId ? [evidence("deployment-registration.json")] : [])], queryReady ? [] : ["A01"]);
  for (const [id] of specs.slice(2)) {
    if (checks.get(id)?.observed === "not run") setCheck(id, discoveryPass ? "BLOCKED" : "SKIPPED_DEPENDENCY", { reason: "verifier stopped before observing this check", error: setupError }, [evidence("setup-error.json")], discoveryPass ? [] : ["A02"]);
  }
} finally {
  await stopProcess(serviceProcess);
  serviceLog?.end();
  if (deploymentId) {
    try {
      const response = await fetch(`${adminUrl}/deployments/${deploymentId}?force=true`, { method: "DELETE" });
      const body = await response.text();
      const list = await getDeployments();
      cleanup.deploymentDeletion = { httpStatus: response.status, body, absentAfterDelete: !list.some((deployment) => deployment.id === deploymentId) };
      await saveJson(evidence("deployment-cleanup.json"), cleanup.deploymentDeletion);
    } catch (error) { cleanup.deploymentDeletion = { error: errorText(error), verified: false }; }
  }
  if (podmanContainerWasStarted) {
    try {
      execFileSync("podman", ["stop", containerName], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      cleanup.containerStopped = true;
    } catch (error) { cleanup.containerStopped = false; cleanup.containerStopError = errorText(error); }
  }
  try { await saveJson(evidence("container-after.json"), containerInfo()); }
  catch (error) { cleanup.containerInspectError = errorText(error); }
  cleanup.serviceExit = serviceProcessExit;
  cleanup.originalContainerWasStarted = !podmanContainerWasStarted;
  cleanup.completedAt = new Date().toISOString();
  await saveJson(evidence("cleanup.json"), cleanup);
}

for (const [id] of specs) {
  const check = checks.get(id);
  if (check?.status === "BLOCKED" && setupError && check.observed === "not run") setCheck(id, "BLOCKED", { reason: setupError }, [evidence("setup-error.json")]);
  else if (check?.observed === "not run") setCheck(id, "BLOCKED", { reason: "check was not reached before verifier failure" }, [evidence("setup-error.json")]);
}
const result = {
  schemaVersion: 1,
  goalId: "2026-10-05-004-kilo-restate-operational-node",
  runTag,
  runRoot,
  completeMatrix: checks.size === 32,
  summary: Object.fromEntries(["PASS", "FAIL", "BLOCKED", "SKIPPED_DEPENDENCY"].map((status) => [status, [...checks.values()].filter((check) => check.status === status).length])),
  checks: [...checks.values()].map((check) => ({ CHECK_ID: check.checkId, STATUS: check.status, OBSERVED: check.observed, EXPECTED: check.expected, EVIDENCE_POINTER: check.evidencePointer, BLOCKS: check.blocks })),
  setupError,
  cleanup,
  uiObservation,
  processExit: serviceProcessExit,
};
await saveJson(evidence("acceptance-matrix.json"), result);
console.log(JSON.stringify(result, null, 2));
process.exitCode = [...checks.values()].every((check) => check.status === "PASS") ? 0 : 1;
