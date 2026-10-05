import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { connect, rpc } from "@restatedev/restate-sdk-clients";

const CODEX = process.env.CODEX_BIN ?? "/home/miles/repos/runtime/vendors/bin/codex";
const GATE = "KiloCodexTaxProbeGate20261005";
const APPROVAL_METHOD = "item/commandExecution/requestApproval";
const PROMPT = "Use the terminal to create a file named codex-effect-marker.txt in the current working directory with the contents 'executed'. Run only that single command; do not edit other files. If an approval request appears, wait for the decision.";

type RpcId = string | number;
interface RpcMessage {
  jsonrpc?: string;
  id?: RpcId | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string };
}
interface PendingResponse {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}
interface GateRequest {
  runId: string;
  outerInvocationId: string;
  requestId: RpcId;
  threadId: string;
  turnId: string;
  itemId: string;
  commandSha256: string;
}
interface GateResponse {
  decision: "decline" | "accept";
  invocationId: string;
  awakeableId: string;
}
interface ProbePaths {
  runId: string;
  outerInvocationId: string;
  codexHome: string;
  workspace: string;
  stderrPath: string;
  ingressUrl: string;
}
interface IdentityProbePaths {
  codexHome: string;
  workspace: string;
  stderrPath: string;
}
interface ApprovalSummary {
  method: string;
  requestId: RpcId;
  threadId: string;
  turnId: string;
  itemId: string;
  commandSha256: string;
  gateInvocationId: string;
  awakeableId: string;
  decision: "decline" | "accept";
}
interface AppServerClient {
  readonly pid: number;
  readonly events: Array<Record<string, unknown>>;
  request<T>(method: string, params: Record<string, unknown>): Promise<T>;
  notify(method: string, params?: Record<string, unknown>): void;
  waitForEvent(predicate: (message: RpcMessage) => boolean, timeoutMs?: number): Promise<RpcMessage>;
  close(): Promise<void>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid App Server object");
  return value as Record<string, unknown>;
}
function stringField(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`invalid App Server ${name}`);
  return value;
}
function itemSummary(value: unknown): Record<string, unknown> {
  const item = record(value);
  return { itemId: item.id ?? null, itemType: item.type ?? null, status: item.status ?? null };
}
function notificationSummary(message: RpcMessage): Record<string, unknown> | undefined {
  if (!message.method) return undefined;
  const params = message.params && typeof message.params === "object" ? record(message.params) : {};
  switch (message.method) {
    case "thread/started":
      return { type: "thread_started", threadId: record(params.thread).id ?? null };
    case "thread/status/changed":
      return { type: "thread_status_changed", threadId: params.threadId ?? null, status: params.status ?? null };
    case "turn/started":
      return { type: "turn_started", threadId: params.threadId ?? null, turnId: record(params.turn).id ?? null };
    case "turn/completed": {
      const turn = record(params.turn);
      return { type: "turn_completed", threadId: params.threadId ?? null, turnId: turn.id ?? null, status: turn.status ?? null, items: Array.isArray(turn.items) ? turn.items.map(itemSummary) : [] };
    }
    case "item/started":
      return { type: "item_started", threadId: params.threadId ?? null, turnId: params.turnId ?? null, ...itemSummary(params.item) };
    case "item/completed":
      return { type: "item_completed", threadId: params.threadId ?? null, turnId: params.turnId ?? null, ...itemSummary(params.item) };
    default:
      return undefined;
  }
}

function startAppServer(
  cwd: string,
  codexHome: string,
  stderrPath: string,
  onServerRequest: (message: RpcMessage, log: (event: Record<string, unknown>) => void) => Promise<unknown>,
): AppServerClient {
  const child: ChildProcessWithoutNullStreams = spawn(CODEX, ["app-server", "--stdio"], {
    cwd,
    env: { ...process.env, CODEX_HOME: codexHome },
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (!child.pid) throw new Error("Codex App Server did not start");
  const stderr = createWriteStream(stderrPath, { flags: "wx" });
  child.stderr.pipe(stderr);
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map<RpcId, PendingResponse>();
  const notifications: RpcMessage[] = [];
  const waiters = new Set<{ predicate(message: RpcMessage): boolean; resolve(message: RpcMessage): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
  const events: Array<Record<string, unknown>> = [];
  let nextId = 1;
  let closed = false;
  const log = (event: Record<string, unknown>) => events.push(event);
  const write = (message: Record<string, unknown>) => {
    if (closed || !child.stdin.writable) throw new Error("Codex App Server stdin is closed");
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const failPending = (error: Error) => {
    for (const response of pending.values()) {
      clearTimeout(response.timer);
      response.reject(error);
    }
    pending.clear();
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    waiters.clear();
  };

  lines.on("line", (line) => {
    let message: RpcMessage;
    try { message = JSON.parse(line) as RpcMessage; }
    catch { failPending(new Error("Codex App Server emitted non-JSON stdout")); return; }
    if (typeof message.method === "string") {
      if (message.id !== undefined && message.id !== null) {
        void onServerRequest(message, log).then(
          (result) => write({ jsonrpc: "2.0", id: message.id, result }),
          () => write({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: "Kilo probe rejected server request" } }),
        );
      } else {
        notifications.push(message);
        const summary = notificationSummary(message);
        if (summary) log(summary);
        for (const waiter of waiters) {
          if (!waiter.predicate(message)) continue;
          clearTimeout(waiter.timer);
          waiters.delete(waiter);
          waiter.resolve(message);
        }
      }
      return;
    }
    if (message.id === undefined || message.id === null) return;
    const response = pending.get(message.id);
    if (!response) return;
    clearTimeout(response.timer);
    pending.delete(message.id);
    if (message.error) response.reject(new Error(`Codex App Server ${message.error.code ?? "error"}`));
    else response.resolve(message.result);
  });
  child.once("error", (error) => failPending(error));
  child.once("exit", (code, signal) => {
    closed = true;
    failPending(new Error(`Codex App Server exited (${code ?? signal ?? "unknown"})`));
  });

  return {
    pid: child.pid,
    events,
    request<T>(method: string, params: Record<string, unknown>): Promise<T> {
      const id = nextId++;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Codex App Server timeout: ${method}`));
        }, 120_000);
        pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
        try { write({ jsonrpc: "2.0", id, method, params }); }
        catch (error) { clearTimeout(timer); pending.delete(id); reject(error as Error); }
      });
    },
    notify(method, params = {}): void { write({ jsonrpc: "2.0", method, params }); },
    waitForEvent(predicate, timeoutMs = 180_000): Promise<RpcMessage> {
      const found = notifications.find(predicate);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(waiter);
          reject(new Error("Timed out waiting for Codex turn completion"));
        }, timeoutMs);
        const waiter = { predicate, resolve, reject, timer };
        waiters.add(waiter);
      });
    },
    async close(): Promise<void> {
      if (closed) return;
      child.stdin.end();
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (closed) return resolve();
        child.once("exit", () => resolve());
        setTimeout(() => { if (!closed) child.kill("SIGKILL"); }, 3_000).unref();
      });
      stderr.end();
    },
  };
}

export async function startPersistentThread(paths: IdentityProbePaths, reportStage: (stage: string) => void = () => {}): Promise<Record<string, unknown>> {
  reportStage("spawn-start-server");
  const client = startAppServer(paths.workspace, paths.codexHome, paths.stderrPath, async () => {
    throw new Error("unexpected server request without a turn");
  });
  try {
    reportStage("initialize");
    const initialized = await client.request<Record<string, unknown>>("initialize", {
      clientInfo: { name: "kilo-restate-probe", title: "Kilo Restate Codex Probe", version: "0.1.0" },
      capabilities: null,
    });
    client.notify("initialized");
    reportStage("thread-start");
    const started = await client.request<Record<string, unknown>>("thread/start", {
      cwd: paths.workspace,
      approvalPolicy: "untrusted",
      sandbox: "workspace-write",
      ephemeral: false,
    });
    const thread = record(started.thread);
    reportStage("thread-start-returned");
    return {
      processId: client.pid,
      codexHome: initialized.codexHome ?? null,
      threadId: stringField(thread.id, "thread id"),
      sessionId: thread.sessionId ?? null,
      ephemeral: thread.ephemeral,
      status: thread.status ?? null,
    };
  } finally {
    await client.close();
  }
}

export async function resumePersistentThread(paths: IdentityProbePaths, threadId: string, reportStage: (stage: string) => void = () => {}): Promise<Record<string, unknown>> {
  reportStage("spawn-resume-server");
  const client = startAppServer(paths.workspace, paths.codexHome, paths.stderrPath, async () => {
    throw new Error("unexpected server request during thread resume");
  });
  try {
    reportStage("initialize-resume");
    const initialized = await client.request<Record<string, unknown>>("initialize", {
      clientInfo: { name: "kilo-restate-probe", title: "Kilo Restate Codex Probe", version: "0.1.0" },
      capabilities: null,
    });
    client.notify("initialized");
    reportStage("thread-resume");
    const resumed = await client.request<Record<string, unknown>>("thread/resume", { threadId });
    const thread = record(resumed.thread);
    const turns = Array.isArray(thread.turns) ? thread.turns.map(record) : [];
    reportStage("thread-resume-returned");
    return {
      processId: client.pid,
      codexHome: initialized.codexHome ?? null,
      threadId: stringField(thread.id, "resumed thread id"),
      sessionId: thread.sessionId ?? null,
      ephemeral: thread.ephemeral,
      status: thread.status ?? null,
      turnCount: turns.length,
      events: client.events,
    };
  } finally {
    await client.close();
  }
}

export async function runCodexTurn(paths: ProbePaths): Promise<Record<string, unknown>> {
  const ingress = connect({ url: paths.ingressUrl });
  let approval: ApprovalSummary | undefined;
  const client = startAppServer(paths.workspace, paths.codexHome, paths.stderrPath, async (message, log) => {
    if (message.method !== APPROVAL_METHOD || message.id === undefined || message.id === null) throw new Error("unexpected Codex server request");
    const params = record(message.params);
    const threadId = stringField(params.threadId, "approval threadId");
    const turnId = stringField(params.turnId, "approval turnId");
    const itemId = stringField(params.itemId, "approval itemId");
    const command = typeof params.command === "string" ? params.command : "";
    const commandSha256 = createHash("sha256").update(command).digest("hex");
    log({ type: "approval_request", requestId: message.id, threadId, turnId, itemId, commandSha256 });
    const gate = await ingress.call<GateRequest, GateResponse>({
      service: GATE,
      handler: "request",
      key: paths.runId,
      parameter: { runId: paths.runId, outerInvocationId: paths.outerInvocationId, requestId: message.id, threadId, turnId, itemId, commandSha256 },
      opts: rpc.opts({ idempotencyKey: `approval-${turnId}-${itemId}` }),
    });
    approval = { method: APPROVAL_METHOD, requestId: message.id, threadId, turnId, itemId, commandSha256, gateInvocationId: gate.invocationId, awakeableId: gate.awakeableId, decision: gate.decision };
    log({ type: "gate_decision", gateInvocationId: gate.invocationId, itemId, decision: gate.decision });
    return { decision: gate.decision };
  });

  try {
    const initialized = await client.request<Record<string, unknown>>("initialize", {
      clientInfo: { name: "kilo-restate-probe", title: "Kilo Restate Codex Probe", version: "0.1.0" },
      capabilities: null,
    });
    client.notify("initialized");
    const started = await client.request<Record<string, unknown>>("thread/start", {
      cwd: paths.workspace,
      approvalPolicy: "untrusted",
      sandbox: "workspace-write",
      ephemeral: false,
    });
    const thread = record(started.thread);
    const threadId = stringField(thread.id, "thread id");
    const turnStart = await client.request<Record<string, unknown>>("turn/start", {
      threadId,
      input: [{ type: "text", text: PROMPT, text_elements: [] }],
    });
    const turn = record(turnStart.turn);
    const turnId = stringField(turn.id, "turn id");
    const completedMessage = await client.waitForEvent((message) => message.method === "turn/completed" && isRecord(message.params) && record(message.params).threadId === threadId && isRecord(record(message.params).turn) && record(record(message.params).turn).id === turnId);
    const completed = record(record(completedMessage.params).turn);
    if (!approval) throw new Error("Codex completed without a client-facing command approval request");
    if (approval.threadId !== threadId || approval.turnId !== turnId) throw new Error("approval identity did not match the active turn");
    return {
      appServerUserAgent: initialized.userAgent ?? null,
      codexHome: initialized.codexHome ?? null,
      processIdBeforeRestart: client.pid,
      threadId,
      sessionId: thread.sessionId ?? null,
      ephemeral: thread.ephemeral,
      parentThreadId: thread.parentThreadId ?? null,
      cliVersion: thread.cliVersion ?? null,
      threadStatusAtStart: thread.status ?? null,
      turnId,
      turnStatus: completed.status,
      assistantMessagePresent: Array.isArray(completed.items) && completed.items.some((item) => isRecord(item) && item.type === "agentMessage" && typeof item.text === "string" && item.text.length > 0),
      approval,
      events: client.events,
    };
  } finally {
    await client.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function resumeCodexThread(paths: Pick<ProbePaths, "codexHome" | "workspace" | "stderrPath">, threadId: string, turnId: string): Promise<Record<string, unknown>> {
  const client = startAppServer(paths.workspace, paths.codexHome, paths.stderrPath, async () => {
    throw new Error("unexpected Codex server request during thread resume");
  });
  try {
    const initialized = await client.request<Record<string, unknown>>("initialize", {
      clientInfo: { name: "kilo-restate-probe", title: "Kilo Restate Codex Probe", version: "0.1.0" },
      capabilities: null,
    });
    client.notify("initialized");
    const resumed = await client.request<Record<string, unknown>>("thread/resume", { threadId });
    const thread = record(resumed.thread);
    const turns = Array.isArray(thread.turns) ? thread.turns.map(record) : [];
    const turn = turns.find((entry) => entry.id === turnId);
    return {
      processIdAfterRestart: client.pid,
      codexHome: initialized.codexHome ?? null,
      resumedThreadId: stringField(thread.id, "resumed thread id"),
      sessionId: thread.sessionId ?? null,
      ephemeral: thread.ephemeral,
      threadStatus: thread.status ?? null,
      persistedTurnFound: !!turn,
      resumedTurnStatus: turn?.status ?? null,
      turnCount: turns.length,
      events: client.events,
    };
  } finally {
    await client.close();
  }
}
