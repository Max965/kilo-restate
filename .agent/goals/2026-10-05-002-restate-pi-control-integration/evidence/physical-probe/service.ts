import * as restate from "@restatedev/restate-sdk";
import { execFile } from "node:child_process";
import { appendFile, access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, resolve, sep } from "node:path";
import { RpcClient } from "/home/miles/repos/agent-harnesses/kilo-pi-durable/packages/coding-agent/src/modes/rpc/rpc-client.ts";

const PI_SOURCE = "/home/miles/repos/agent-harnesses/kilo-pi-durable";
const TSX_LOADER = "/home/miles/repos/agent-harnesses/kilo-restate/node_modules/tsx/dist/esm/index.mjs";
const execFileAsync = promisify(execFile);
const evidenceRoot = resolve(process.env.PROBE_ROOT ?? ".");

type ToolName = "read" | "write" | "edit" | "bash";
type Operation = "access" | "read" | "mkdir" | "write" | "bash";

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

interface GateRequest {
  runId: string;
  parentInvocationId: string;
  sessionId: string;
  toolCallId: string;
  parentToolCallId?: string;
  toolName: ToolName;
  input: Record<string, unknown>;
}

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

function underEvidenceRoot(value: string): string {
  const target = resolve(value);
  if (!target.startsWith(evidenceRoot + sep)) throw new restate.TerminalError("path outside probe evidence");
  return target;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new restate.TerminalError(`invalid ${label}`);
  return value;
}

function confinedPath(root: string, value: unknown, allowRoot = false): string {
  const candidate = requiredString(value, "path");
  const target = resolve(root, candidate);
  if (!(allowRoot && target === root) && !target.startsWith(root + sep)) throw new restate.TerminalError("path outside workspace");
  return target;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new restate.TerminalError("invalid tool input");
  return value as Record<string, unknown>;
}

async function log(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(value)}\n`);
}

const Gate = restate.object({
  name: "KiloPiControlProbeGate20261005",
  handlers: {
    request: async (ctx: restate.ObjectContext, request: GateRequest) => {
      const runId = requiredString(request.runId, "runId");
      const callId = requiredString(request.toolCallId, "toolCallId");
      if (!/^[a-z0-9-]+$/.test(runId)) throw new restate.TerminalError("invalid runId");
      if (ctx.key !== runId) throw new restate.TerminalError("runId does not match gate key");
      requiredString(request.parentInvocationId, "parentInvocationId");
      requiredString(request.sessionId, "sessionId");
      if (!/^[A-Za-z0-9._-]+$/.test(callId)) throw new restate.TerminalError("invalid toolCallId");
      if (!(request.toolName === "read" || request.toolName === "write" || request.toolName === "edit" || request.toolName === "bash")) throw new restate.TerminalError("invalid toolName");
      if (callId === "edit-fail") {
        const failurePath = resolve(underEvidenceRoot(`${evidenceRoot}/runtime/${runId}`), "gate-errors.jsonl");
        await ctx.run("record-gate-error", () => log(failurePath, { invocationId: ctx.request().id, toolCallId: callId, parentInvocationId: request.parentInvocationId }));
        throw new restate.TerminalError("intentional gate failure for fail-closed probe");
      }
      const awakeable = ctx.awakeable<"ALLOW" | "DENY">();
      const ticketPath = resolve(underEvidenceRoot(`${evidenceRoot}/runtime/${runId}/tickets`), `${callId}.json`);
      await ctx.run("record-gate-ticket", async () => {
        await mkdir(dirname(ticketPath), { recursive: true });
        const temporary = `${ticketPath}.tmp`;
        await writeFile(temporary, JSON.stringify({
          runId,
          parentInvocationId: request.parentInvocationId,
          sessionId: request.sessionId,
          toolCallId: callId,
          parentToolCallId: request.parentToolCallId ?? null,
          toolName: request.toolName,
          input: request.input,
          invocationId: ctx.request().id,
          awakeableId: awakeable.id,
        }, null, 2));
        await rename(temporary, ticketPath);
      });
      const decision = await awakeable.promise;
      return { decision, invocationId: ctx.request().id, toolCallId: callId };
    },
  },
});

const Tool = restate.object({
  name: "KiloPiControlProbeTool20261005",
  handlers: {
    execute: async (ctx: restate.ObjectContext, request: ToolRequest) => {
      const runId = requiredString(request.runId, "runId");
      const callId = requiredString(request.toolCallId, "toolCallId");
      if (!/^[a-z0-9-]+$/.test(runId)) throw new restate.TerminalError("invalid runId");
      if (ctx.key !== runId) throw new restate.TerminalError("runId does not match tool key");
      requiredString(request.parentInvocationId, "parentInvocationId");
      requiredString(request.sessionId, "sessionId");
      const workspace = underEvidenceRoot(request.workspace);
      const input = parseObject(request.input);
      const allowed: Record<ToolName, readonly Operation[]> = {
        read: ["access", "read"], write: ["mkdir", "write"], edit: ["access", "read", "write"], bash: ["bash"],
      };
      if (!allowed[request.toolName]?.includes(request.operation)) throw new restate.TerminalError("operation does not match toolName");
      const result = await ctx.run(`tool:${request.operation}`, async () => {
        switch (request.operation) {
          case "access": {
            const target = confinedPath(workspace, input.path);
            await access(target);
            return { accessible: true, target };
          }
          case "read": {
            const target = confinedPath(workspace, input.path);
            return { text: await readFile(target, "utf8"), target };
          }
          case "mkdir": {
            const target = confinedPath(workspace, input.path, true);
            await mkdir(target, { recursive: true });
            return { created: true, target };
          }
          case "write": {
            const target = confinedPath(workspace, input.path);
            if (typeof input.content !== "string") throw new restate.TerminalError("invalid content");
            await writeFile(target, input.content, "utf8");
            return { written: true, target };
          }
          case "bash": {
            const command = requiredString(input.command, "command");
            if (command !== "printf 'bash-ok\\n'") throw new restate.TerminalError("probe bash command is not allowlisted");
            const cwd = confinedPath(workspace, input.cwd, true);
            const timeoutSeconds = typeof input.timeout === "number" ? input.timeout : 5;
            if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) throw new restate.TerminalError("invalid bash timeout");
            const output = await execFileAsync("bash", ["-lc", command], { cwd, timeout: timeoutSeconds * 1000, encoding: "utf8" });
            return { stdout: output.stdout, stderr: output.stderr, exitCode: 0, cwd };
          }
          default:
            throw new restate.TerminalError("unsupported operation");
        }
      });
      return {
        runId,
        parentInvocationId: request.parentInvocationId,
        sessionId: request.sessionId,
        toolCallId: callId,
        parentToolCallId: request.parentToolCallId ?? null,
        toolName: request.toolName,
        operation: request.operation,
        invocationId: ctx.request().id,
        input,
        result,
      };
    },
  },
});

const Run = restate.workflow({
  name: "KiloPiControlProbeRun20261005",
  handlers: {
    run: async (ctx: restate.WorkflowContext, request: RunRequest) => {
      if (!/^[a-z0-9-]+$/.test(request.runId)) throw new restate.TerminalError("invalid runId");
      const invocationId = ctx.request().id;
      const workspace = underEvidenceRoot(request.workspace);
      const sessionDir = underEvidenceRoot(request.sessionDir);
      const homeDir = underEvidenceRoot(request.homeDir);
      const extensionPath = underEvidenceRoot(request.extensionPath);
      const eventLogPath = underEvidenceRoot(request.eventLogPath);
      const processLogPath = underEvidenceRoot(request.processLogPath);
      const crashMarkerPath = underEvidenceRoot(request.crashMarkerPath);
      const sessionId = requiredString(request.sessionId, "sessionId");

      const piResult = await ctx.run("ordinary-pi-rpc-turn", async () => {
        const rpc = new RpcClient({
          cliPath: `${PI_SOURCE}/packages/coding-agent/src/cli.ts`,
          cwd: workspace,
          env: {
            HOME: homeDir,
            PI_OFFLINE: "1",
            PI_SESSION_ID: sessionId,
            KILO_RUN_ID: request.runId,
            KILO_WORKFLOW_KEY: ctx.key,
            KILO_PARENT_INVOCATION_ID: invocationId,
            KILO_PROBE_ROOT: evidenceRoot,
            KILO_PROBE_EVENTS: eventLogPath,
            KILO_PROBE_CRASH_MARKER: crashMarkerPath,
            RESTATE_INGRESS: process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180",
            TSX_TSCONFIG_PATH: `${PI_SOURCE}/tsconfig.json`,
            NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import ${TSX_LOADER}`].filter(Boolean).join(" "),
          },
          args: [
            "--no-extensions", "--extension", extensionPath, "--no-skills",
            "--session-id", sessionId, "--session-dir", sessionDir,
          ],
        });

        try {
          await rpc.start();
          await rpc.setModel("faux", "faux-1");
          const initialState = await rpc.getState();
          await log(processLogPath, { phase: "started", sessionId: initialState.sessionId, sessionFile: initialState.sessionFile, at: new Date().toISOString() });
          const events = await rpc.promptAndWait(request.prompt, undefined, 6000);
          const state = await rpc.getState();
          const entries = await rpc.getEntries();
          return {
            state,
            rpcEvents: events,
            entries: entries.entries.map((entry) => ({ type: entry.type, id: entry.id, parentId: entry.parentId })),
            leafId: entries.leafId,
            lastAssistantText: await rpc.getLastAssistantText(),
          };
        } catch (error) {
          await log(processLogPath, { phase: "turn-error", message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() });
          throw error;
        } finally {
          await rpc.stop();
        }
      });

      return {
        settlement: "completed",
        invocationId,
        workflowKey: ctx.key,
        runId: request.runId,
        sessionId: piResult.state.sessionId,
        sessionFile: piResult.state.sessionFile,
        rpcEvents: piResult.rpcEvents,
        sessionEntries: piResult.entries,
        leafId: piResult.leafId,
        lastAssistantText: piResult.lastAssistantText,
      };
    },
  },
});

restate.serve({ services: [Run, Gate, Tool], port: Number(process.env.SERVICE_PORT ?? 19082) });
