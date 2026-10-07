import * as restate from "@restatedev/restate-sdk";
import { access as fsAccess, mkdir as fsMkdir, readFile as fsReadFile, realpath, stat as fsStat, lstat as fsLstat, writeFile as fsWriteFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir, tmpdir } from "node:os";
import { makeChildOperationId, makeEffectId, makeGateId, assertOperationId } from "../contract.ts";
import type {
  ChildRelayMessage,
  ChildRelayRequest,
  ChildResult,
  EffectOperation,
  GateRequest,
  GateResult,
  OperationEvent,
  OperationIdentity,
  OperationRequest,
  OperationResult,
  OperationStatus,
  ToolEffectRequest,
  ToolEffectResult,
} from "../contract.ts";
import { runPi, steerPi } from "../drivers/pi/driver.ts";
import { verifyWorkResult, validatePiConfiguration } from '../daily-driver.ts';
import { OperationEvents } from "./events.ts";
import {factoryAdmissionHash} from '../factory.ts';
import { validateAddress, type Address } from '../control-policy.ts';

const CANCEL_SIGNAL = "kilo-cancel";
const CHILD_SIGNAL = "kilo-child";
const ALLOWED_TOOLS = new Set(["read", "write", "edit", "bash", "spawn_child", "test_wait"]);
const OPERATION_RETRIES = 3;

interface StoredOperation {
  status: OperationStatus;
  identity: OperationIdentity;
  invocationId: string;
  result?: OperationResult;
  childIds: string[];
  address?: Address;
  factoryWorkspace?: string;
  factoryAdmissionHash?: string;
}

async function newEvent(ctx: restate.Context, operationId: string, invocationId: string, type: string, payload?: Record<string, unknown>): Promise<OperationEvent> {
  const now = await ctx.date.now();
  return {
    eventId: `${invocationId}-${type}-${now}`,
    operationId,
    invocationId,
    type,
    at: new Date(now).toISOString(),
    ...(payload?.sessionId ? { sessionId: String(payload.sessionId) } : {}),
    ...(payload?.toolCallId ? { toolCallId: String(payload.toolCallId) } : {}),
    ...(payload?.parentOperationId ? { parentOperationId: String(payload.parentOperationId) } : {}),
    ...(payload?.parentToolCallId ? { parentToolCallId: String(payload.parentToolCallId) } : {}),
    ...(payload ? { payload } : {}),
  };
}

async function appendEvent(ctx: restate.Context, event: OperationEvent | Promise<OperationEvent>): Promise<void> {
  const resolved = await event;
  await ctx.objectClient(OperationEvents, resolved.operationId).append(resolved, restate.rpc.opts({ idempotencyKey: resolved.eventId }));
}

function validateInput(input: OperationRequest, key: string): OperationRequest {
  if (!input || typeof input !== "object") throw new restate.TerminalError("operation request must be an object");
  const operationId = assertOperationId(input.operationId);
  if (operationId !== key) throw new restate.TerminalError("operation key and operationId differ");
  if (typeof input.prompt !== "string" || input.prompt.length < 1 || input.prompt.length > 16_000) throw new restate.TerminalError("prompt must be 1-16000 characters");
  if (typeof input.workspace !== "string" || !isAbsolute(input.workspace)) throw new restate.TerminalError("workspace must be an absolute path");
  if (typeof input.provider !== "string" || input.provider.length > 100 || typeof input.model !== "string" || input.model.length < 1 || input.model.length > 200) throw new restate.TerminalError("provider/model are required");
  if (input.driverId && input.driverId !== "pi") throw new restate.TerminalError("only the ordinary Pi driver is installed");
  if (input.parentOperationId) assertOperationId(input.parentOperationId);
  if (input.depth !== undefined && (!Number.isInteger(input.depth) || input.depth < 0 || input.depth > 1)) throw new restate.TerminalError("operation depth must be 0 or 1");
  if (input.testScenario && (process.env.KILO_ALLOW_TEST_EXTENSION !== "1" || !["plain", "core-tools", "deny", "gate-error", "recovery", "cancel", "child"].includes(input.testScenario))) throw new restate.TerminalError("test scenarios are disabled or unknown");
  if (input.pi) validatePiConfiguration(input.pi);
  if (input.controlAddress) { validateAddress(input.controlAddress); if (input.controlAddress.workspace !== input.workspace) throw new restate.TerminalError('control address/workspace mismatch'); }
  if (input.workContract && (typeof input.workContract !== 'object' || Array.isArray(input.workContract) || JSON.stringify(input.workContract).length > 16000)) throw new restate.TerminalError('workContract must be an object no larger than 16000 characters');
  return { ...input, driverId: "pi" };
}

async function workspacePath(requested: string): Promise<string> {
  const configuredRoot = process.env.KILO_WORKSPACE_ROOT;
  if (!configuredRoot) throw new Error("KILO_WORKSPACE_ROOT must be configured");
  const root = await realpath(resolve(configuredRoot));
  const workspace = await realpath(resolve(requested));
  const rel = relative(root, workspace);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("workspace is outside KILO_WORKSPACE_ROOT");
  return workspace;
}

async function safePath(workspace: string, requested: unknown): Promise<string> {
  if (typeof requested !== "string" || !requested) throw new Error("tool path is required");
  const root = await realpath(workspace);
  const target = resolve(root, requested);
  const rel = relative(root, target);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("tool path escapes the operation workspace");
  let current = root;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      const real = await realpath(current);
      const currentRel = relative(root, real);
      if (currentRel === ".." || currentRel.startsWith(`..${sep}`) || isAbsolute(currentRel)) throw new Error("tool path follows a symlink outside the operation workspace");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return target;
}

export async function factoryDevPolicy(workspace:string,tool:string,input:Record<string,unknown>):Promise<'ALLOW'|'DENY'> {
  try{
    if(tool==='bash'){
      if(typeof input.command!=='string'||!input.command.trim()||input.command.length>32000||input.timeout!==undefined&&(typeof input.timeout!=='number'||input.timeout<=0||input.timeout>120))return 'DENY';
      const cwd=await safePath(workspace,input.cwd??workspace);return (await fsStat(await realpath(cwd))).isDirectory()?'ALLOW':'DENY';
    }
    if(!['read','write','edit'].includes(tool))return 'DENY';
    const target=await safePath(workspace,input.path);
    if(tool!=='write'){if(!(await fsStat(await realpath(target))).isFile())return 'DENY';}
    else {await realpath(resolve(target,'..'));try{const info=await fsLstat(target);if(!info.isFile()||info.isSymbolicLink())return 'DENY';}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
    return 'ALLOW';
  }catch{return 'DENY';}
}

async function runBash(command: string, cwd: string, timeoutSeconds?: number): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }> {
  if (command.length > 32_000) throw new Error("bash command exceeds 32000 characters");
  const timeoutMs = timeoutSeconds === undefined ? 30_000 : Math.min(Math.max(timeoutSeconds * 1000, 1), 120_000);
  const child = spawn("/bin/bash", ["-lc", command], {
    cwd,
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: process.env.KILO_PI_HOME ?? homedir(),
      LANG: process.env.LANG ?? "C.UTF-8",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  const maxOutput = 1024 * 1024;
  const collect = (target: "stdout" | "stderr", chunk: Buffer): void => {
    if (stdout.length + stderr.length < maxOutput) {
      const available = maxOutput - stdout.length - stderr.length;
      if (target === "stdout") stdout += chunk.toString("utf8", 0, available);
      else stderr += chunk.toString("utf8", 0, available);
    }
  };
  child.stdout.on("data", (chunk: Buffer) => collect("stdout", chunk));
  child.stderr.on("data", (chunk: Buffer) => collect("stderr", chunk));
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, timeoutMs);
  return new Promise((resolvePromise, reject) => {
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => { clearTimeout(timer); resolvePromise({ stdout, stderr, exitCode: code, timedOut }); });
  });
}

async function executeEffect(request: ToolEffectRequest): Promise<Record<string, unknown>> {
  const workspace = await workspacePath(request.workspace);
  const input = request.input;
  const operation = request.operation as EffectOperation;
  if (operation === "bash") {
    const cwd = await safePath(workspace, input.cwd ?? workspace);
    const result = await runBash(String(input.command ?? ""), cwd, typeof input.timeout === "number" ? input.timeout : undefined);
    return result;
  }
  const path = await safePath(workspace, input.path);
  switch (operation) {
    case "access":
      await fsAccess(path, fsConstants.R_OK);
      return { ok: true };
    case "read": {
      const data = await fsReadFile(path);
      return { base64: data.toString("base64"), size: data.byteLength };
    }
    case "detectImageMimeType": {
      const piRoot = resolve(process.env.KILO_PI_SOURCE ?? "/home/miles/repos/agent-harnesses/kilo-pi-durable");
      const mimeModule: unknown = await import(pathToFileURL(join(piRoot, "packages/coding-agent/src/utils/mime.ts")).href);
      const detect = (mimeModule as { detectSupportedImageMimeTypeFromFile(path: string): Promise<string | undefined> }).detectSupportedImageMimeTypeFromFile;
      return { mimeType: await detect(path) ?? null };
    }
    case "mkdir":
      await fsMkdir(path, { recursive: true });
      return { ok: true };
    case "write":
      if (typeof input.content !== "string") throw new Error("write content must be a string");
      await fsWriteFile(path, input.content, "utf8");
      return { ok: true, bytes: Buffer.byteLength(input.content) };
    default:
      throw new Error(`unsupported effect operation: ${operation}`);
  }
}

export const OperationGate = restate.workflow({
  name: "KiloOperationGate",
  handlers: {
    run: async (ctx: restate.WorkflowContext, request: GateRequest): Promise<GateResult> => {
      assertOperationId(request.operationId);
      if (!ALLOWED_TOOLS.has(request.toolName) || (request.toolName === "test_wait" && process.env.KILO_ALLOW_TEST_EXTENSION !== "1")) throw new restate.TerminalError(`unsupported tool ${request.toolName}`);
      if (ctx.key !== makeGateId(request)) throw new restate.TerminalError("gate identity mismatch");
      const gateId = ctx.key;
      const awakeable = ctx.awakeable<"ALLOW" | "DENY">();
      const pending = { gateId, awakeableId: awakeable.id, toolCallId: request.toolCallId, toolName: request.toolName };
      ctx.set("pending", pending);
      await appendEvent(ctx, newEvent(ctx, request.operationId, ctx.request().id, "gate_pending", {
        gateId, awakeableId: awakeable.id, toolCallId: request.toolCallId,
        sessionId: request.sessionId, parentInvocationId: request.parentInvocationId,
        parentToolCallId: request.parentToolCallId, toolName: request.toolName, input: request.input,
      }));
      const parent=await ctx.workflowClient(OperationWorkflow,request.operationId).status();
      if(parent.factoryWorkspace&&parent.identity?.invocationId===request.parentInvocationId&&parent.identity?.sessionId===request.sessionId){
        const decision=await ctx.run('factory-dev-policy',()=>factoryDevPolicy(parent.factoryWorkspace!,request.toolName,request.input),{maxRetryAttempts:1});
        ctx.resolveAwakeable(awakeable.id,decision);
      }
      const decision = await awakeable.promise;
      const result: GateResult = { decision, gateId, invocationId: ctx.request().id, ...(decision === "DENY" ? { reason: "controller denied tool call" } : {}) };
      ctx.set("result", result);
      await appendEvent(ctx, newEvent(ctx, request.operationId, ctx.request().id, decision === "ALLOW" ? "gate_allowed" : "gate_denied", {
        gateId, toolCallId: request.toolCallId, sessionId: request.sessionId, decision,
      }));
      return result;
    },
    status: async (ctx: restate.WorkflowSharedContext): Promise<{ pending: unknown; result: GateResult | null }> => ({
      pending: await ctx.get("pending"),
      result: await ctx.get<GateResult>("result"),
    }),
  },
});

export const ToolEffect = restate.object({
  name: "KiloToolEffect",
  handlers: {
    execute: async (ctx: restate.ObjectContext, request: ToolEffectRequest): Promise<ToolEffectResult> => {
      assertOperationId(request.operationId);
      if (request.effectId !== ctx.key || request.effectId !== makeEffectId(request)) throw new restate.TerminalError("effect identity mismatch");
      const invocationId = ctx.request().id;
      await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "effect_started", {
        effectId: request.effectId, stage: request.stage, toolCallId: request.toolCallId, sessionId: request.sessionId,
        parentToolCallId: request.parentToolCallId, operation: request.operation,
      }));
      try {
        const result = await ctx.run(`effect:${request.operation}`, () => executeEffect(request), {
          maxRetryAttempts: 2,
          maxRetryDuration: 30_000,
        });
        await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "effect_completed", {
          effectId: request.effectId, stage: request.stage, toolCallId: request.toolCallId, sessionId: request.sessionId,
          operation: request.operation, result,
        }));
        return { effectId: request.effectId, invocationId, result };
      } catch (error) {
        await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "effect_failed", {
          effectId: request.effectId, stage: request.stage, toolCallId: request.toolCallId, sessionId: request.sessionId,
          operation: request.operation, error: String(error),
        }));
        throw error;
      }
    },
  },
});

export const ChildRelay = restate.service({
  name: "KiloChildRelay",
  handlers: {
    request: async (ctx: restate.Context, request: ChildRelayRequest): Promise<ChildResult> => {
      const reply = ctx.awakeable<ChildResult>();
      const message: ChildRelayMessage = {
        ...request,
        relayInvocationId: ctx.request().id,
        replyAwakeableId: reply.id,
      };
      await ctx.invocation(restate.InvocationIdParser.fromString(request.parentInvocationId)).signal(CHILD_SIGNAL).resolve(message);
      return reply.promise;
    },
  },
});

export const OperationWorkflow = restate.workflow({
  name: "KiloPiOperation",
  handlers: {
    run: async (ctx: restate.WorkflowContext, rawRequest: OperationRequest): Promise<OperationResult> => {
      const request = validateInput(rawRequest, ctx.key);
      const invocationId = ctx.request().id;
      const existing = await ctx.get<StoredOperation>("state");
      const sessionId = existing?.identity.sessionId ?? ctx.rand.uuidv4();
      const identity: OperationIdentity = existing?.identity ?? {
        operationId: request.operationId,
        driverId: "pi",
        invocationId,
        sessionId,
        sessionFile: "pending",
        ...(request.parentOperationId ? { parentOperationId: request.parentOperationId } : {}),
        ...(request.parentToolCallId ? { parentToolCallId: request.parentToolCallId } : {}),
      };
      const sessionRoot = resolve(process.env.KILO_PI_SESSION_ROOT ?? join(tmpdir(), "kilo-pi-operational-node"));
      const sessionDir = join(sessionRoot, request.operationId);
      const canonicalWorkspace = await ctx.run("validate-workspace", () => workspacePath(request.workspace));
      const running: StoredOperation = { status: "running", identity, invocationId, childIds: existing?.childIds ?? [], ...(request.controlAddress ? { address: { ...request.controlAddress, workspace: canonicalWorkspace } } : {}) };
      if(request.workContract?.FACTORY_DEV_POLICY==='factory-dev-v0'){
        if(process.env.KILO_FACTORY_DEV_POLICY!=='1'||!request.workContract.FACTORY_IDENTITY)throw new restate.TerminalError('Factory DEV policy not admitted');
        running.factoryWorkspace=canonicalWorkspace;running.factoryAdmissionHash=factoryAdmissionHash(request);
      }
      ctx.set("state", running);
      await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "operation_started", {
        sessionId, sessionFile: identity.sessionFile, parentOperationId: request.parentOperationId,
        parentToolCallId: request.parentToolCallId,
      }));

      const abortController = new AbortController();
      const cancellation = ctx.signal<{ requestedBy: string }>(CANCEL_SIGNAL);
      const childRequest = ctx.signal<ChildRelayMessage>(CHILD_SIGNAL);
      const driverInput = { ...request, workspace: canonicalWorkspace, invocationId, sessionId, sessionDir };
      const driverRun = ctx.run("ordinary-pi-rpc-turn", () => runPi(driverInput, abortController.signal), {
        maxRetryAttempts: OPERATION_RETRIES,
        maxRetryDuration: 120_000,
        initialRetryInterval: 250,
      });
      const driverOutcome = driverRun.map((result, failure) => failure
        ? { type: "failed" as const, error: String(failure) }
        : { type: "settled" as const, result: result! });
      const cancellationOutcome = cancellation.map((value) => ({ type: "cancel" as const, value }));
      const childOutcome = childRequest.map((value) => ({ type: "child" as const, value }));
      const outcome = await restate.RestatePromise.race([driverOutcome, cancellationOutcome, childOutcome]);

      if (outcome.type === "child") {
        const childId = makeChildOperationId(request.operationId, outcome.value.toolCallId);
        const childInput: OperationRequest = {
          operationId: childId,
          prompt: outcome.value.prompt,
          workspace: canonicalWorkspace,
          provider: outcome.value.provider,
          model: outcome.value.model,
          parentOperationId: request.operationId,
          parentToolCallId: outcome.value.toolCallId,
          depth: (request.depth ?? 0) + 1,
        };
        try {
          const childResult = await ctx.workflowClient(OperationWorkflow, childId).run(childInput);
          const result: ChildResult = {
            operationId: childId,
            invocationId: childResult.identity.invocationId,
            sessionId: childResult.identity.sessionId,
            status: childResult.status,
            output: childResult.output,
          };
          const childIds = running.childIds.includes(childId) ? running.childIds : [...running.childIds, childId];
          ctx.set("state", { ...running, childIds });
          await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "child_completed", {
            sessionId, parentOperationId: request.operationId, parentToolCallId: outcome.value.toolCallId,
            childOperationId: childId, childInvocationId: result.invocationId, childSessionId: result.sessionId,
          }));
          ctx.resolveAwakeable(outcome.value.replyAwakeableId, result);
        } catch (error) {
          ctx.rejectAwakeable(outcome.value.replyAwakeableId, String(error));
          throw error;
        }
        const afterChild = await restate.RestatePromise.race([driverOutcome, cancellationOutcome]);
        if (afterChild.type === "cancel") {
          abortController.abort();
          try {
            const driverResult = await driverRun;
            const result: OperationResult = { status: "cancelled", identity: { ...identity, sessionFile: driverResult.sessionFile }, piSettlement: driverResult.settlement, output: driverResult.lastAssistantText, actorOutcome: driverResult.actorOutcome };
            ctx.set("state", { ...running, status: "cancelled", identity: result.identity, childIds: [...new Set([...running.childIds, childId])], result });
            await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "operation_cancelled", { sessionId, sessionFile: result.identity.sessionFile, piSettlement: result.piSettlement }));
            return result;
          } catch (error) {
            const result: OperationResult = { status: "cancelled", identity, piSettlement: "aborted", failure: String(error) };
            ctx.set("state", { ...running, status: "cancelled", childIds: [...new Set([...running.childIds, childId])], result });
            await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "operation_cancelled", { sessionId, error: String(error) }));
            return result;
          }
        }
        if (afterChild.type === "failed") {
          const result: OperationResult = { status: "failed", identity, piSettlement: "failed", failure: String(afterChild.error) };
          ctx.set("state", { ...running, status: "failed", childIds: [...new Set([...running.childIds, childId])], result });
          await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "operation_failed", { sessionId, error: result.failure }));
          return result;
        }
        const driverResult = afterChild.result;
        const result: OperationResult = {
          status: driverResult.settlement === "aborted" ? "cancelled" : "completed",
          identity: { ...identity, sessionFile: driverResult.sessionFile },
          piSettlement: driverResult.settlement,
          output: driverResult.lastAssistantText, actorOutcome: driverResult.actorOutcome,
        };
        verifyWorkResult(result,request.workContract);
        const terminal: StoredOperation = { ...running, status: result.status, identity: result.identity, childIds: [...new Set([...running.childIds, childId])], result };
        ctx.set("state", terminal);
        await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, result.status==='failed'?'operation_failed':result.status==='cancelled'?'operation_cancelled':"operation_settled", {
          sessionId, sessionFile: result.identity.sessionFile, status: result.status, piSettlement: result.piSettlement,
        }));
        return result;
      }

      if (outcome.type === "cancel") {
        abortController.abort();
        await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "cancellation_received", { sessionId, requestedBy: outcome.value.requestedBy }));
        try {
          const driverResult = await driverRun;
          const result: OperationResult = {
            status: "cancelled", identity: { ...identity, sessionFile: driverResult.sessionFile },
            piSettlement: driverResult.settlement, output: driverResult.lastAssistantText, actorOutcome: driverResult.actorOutcome,
          };
          ctx.set("state", { ...running, status: "cancelled", identity: result.identity, result });
          await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "operation_cancelled", {
            sessionId, sessionFile: result.identity.sessionFile, piSettlement: result.piSettlement,
          }));
          return result;
        } catch (error) {
          const result: OperationResult = { status: "cancelled", identity, piSettlement: "aborted", failure: String(error) };
          ctx.set("state", { ...running, status: "cancelled", result });
          await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "operation_cancelled", { sessionId, error: String(error) }));
          return result;
        }
      }

      if (outcome.type === "failed") {
        const result: OperationResult = { status: "failed", identity, piSettlement: "failed", failure: String(outcome.error) };
        ctx.set("state", { ...running, status: "failed", result });
        await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, "operation_failed", { sessionId, error: result.failure }));
        return result;
      }

      const driverResult = outcome.result;
      const result: OperationResult = {
        status: driverResult.settlement === "aborted" ? "cancelled" : "completed",
        identity: { ...identity, sessionFile: driverResult.sessionFile },
        piSettlement: driverResult.settlement,
        output: driverResult.lastAssistantText, actorOutcome: driverResult.actorOutcome,
      };
      verifyWorkResult(result,request.workContract);
      ctx.set("state", { ...running, status: result.status, identity: result.identity, result });
      await appendEvent(ctx, newEvent(ctx, request.operationId, invocationId, result.status === "cancelled" ? "operation_cancelled" : result.status === 'failed' ? 'operation_failed' : "operation_settled", {
        sessionId, sessionFile: result.identity.sessionFile, status: result.status, piSettlement: result.piSettlement,
      }));
      return result;
    },
    steer: async (ctx: restate.WorkflowSharedContext, request: { message: string }): Promise<unknown> => {
      if (!request || typeof request.message !== 'string' || request.message.length < 1 || request.message.length > 16000) throw new restate.TerminalError('steer message must be 1-16000 characters');
      const state = await ctx.get<StoredOperation>('state');
      if (!state || state.status !== 'running') return { status: 'not_active' };
      const result = await ctx.run('pi-steer', () => steerPi(ctx.key, request.message), { maxRetryAttempts: 1 });
      await appendEvent(ctx, newEvent(ctx, ctx.key, ctx.request().id, 'steer_response', { response: result }));
      return result;
    },
    cancel: async (ctx: restate.WorkflowSharedContext): Promise<{ status: string; invocationId?: string }> => {
      const state = await ctx.get<StoredOperation>("state");
      if (!state) return { status: "not-started" };
      ctx.invocation(restate.InvocationIdParser.fromString(state.invocationId)).signal(CANCEL_SIGNAL).resolve({ requestedBy: ctx.request().id });
      await appendEvent(ctx, newEvent(ctx, state.identity.operationId, ctx.request().id, "cancellation_requested", {
        sessionId: state.identity.sessionId, targetInvocationId: state.invocationId,
      }));
      return { status: "requested", invocationId: state.invocationId };
    },
    status: async (ctx: restate.WorkflowSharedContext): Promise<{
      operationId: string;
      status: OperationStatus | "not_found";
      identity?: OperationIdentity;
      result?: OperationResult;
      childIds: string[];
      events: OperationEvent[];
      address?: Address;
      factoryWorkspace?: string;
      factoryAdmissionHash?: string;
    }> => {
      const state = await ctx.get<StoredOperation>("state");
      const events = await ctx.objectClient(OperationEvents, ctx.key).events();
      return {
        operationId: ctx.key,
        status: state?.status ?? "not_found",
        ...(state ? { identity: state.identity } : {}),
        ...(state?.address ? { address: state.address } : {}),
        ...(state?.factoryWorkspace?{factoryWorkspace:state.factoryWorkspace,factoryAdmissionHash:state.factoryAdmissionHash}:{}),
        ...(state?.result ? { result: state.result } : {}),
        childIds: state?.childIds ?? [],
        events,
      };
    },
  },
});

export const operationalNodeServices = [OperationWorkflow, OperationGate, ToolEffect, ChildRelay, OperationEvents] as const;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 19083);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port");
  void restate.serve({ services: [...operationalNodeServices], port }).then((boundPort) => {
    console.log(JSON.stringify({ event: "operational_node_listening", port: boundPort, services: operationalNodeServices.map((service) => service.name) }));
    if (process.env.KILO_CONTROL_SOCKET) void import('../control.ts').then(({ startControl }) => startControl()).catch(error => { console.error(String(error)); process.exitCode = 1; });
  });
}
