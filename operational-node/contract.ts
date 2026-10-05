import { createHash } from "node:crypto";

export type DriverId = "pi" | (string & {});
export type OperationStatus = "accepted" | "running" | "completed" | "failed" | "cancelled";
export type ToolName = string;
export type EffectOperation = "access" | "read" | "detectImageMimeType" | "mkdir" | "write" | "bash";

export interface OperationIdentity {
  operationId: string;
  driverId: DriverId;
  invocationId: string;
  sessionId: string;
  sessionFile: string;
  parentOperationId?: string;
  parentToolCallId?: string;
}

export interface OperationRequest {
  operationId: string;
  prompt: string;
  workspace: string;
  provider: string;
  model: string;
  driverId?: DriverId;
  parentOperationId?: string;
  parentToolCallId?: string;
  depth?: number;
  testScenario?: string;
}

export interface OperationResult {
  status: OperationStatus;
  identity: OperationIdentity;
  piSettlement: "agent_settled" | "aborted" | "failed";
  output?: string | null;
  failure?: string;
}

export interface EffectIdentity {
  operationId: string;
  sessionId: string;
  toolCallId: string;
  operation: string;
  stage: number;
}

export interface GateRequest {
  operationId: string;
  parentInvocationId: string;
  sessionId: string;
  toolCallId: string;
  parentToolCallId?: string;
  toolName: ToolName;
  input: Record<string, unknown>;
}

export interface GateResult {
  decision: "ALLOW" | "DENY";
  gateId: string;
  invocationId: string;
  reason?: string;
}

export interface ToolEffectRequest extends EffectIdentity {
  effectId: string;
  parentInvocationId: string;
  parentToolCallId?: string;
  workspace: string;
  input: Record<string, unknown>;
}

export interface ToolEffectResult {
  effectId: string;
  invocationId: string;
  result: Record<string, unknown>;
}

export interface OperationEvent {
  eventId: string;
  operationId: string;
  type: string;
  at: string;
  invocationId?: string;
  sessionId?: string;
  processId?: number;
  toolCallId?: string;
  effectId?: string;
  parentOperationId?: string;
  parentToolCallId?: string;
  payload?: Record<string, unknown>;
}

export interface ChildRelayRequest {
  parentOperationId: string;
  parentInvocationId: string;
  parentSessionId: string;
  toolCallId: string;
  parentToolCallId?: string;
  prompt: string;
  workspacePath: string;
  provider: string;
  model: string;
}

export interface ChildRelayMessage extends ChildRelayRequest {
  relayInvocationId: string;
  replyAwakeableId: string;
}

export interface ChildResult {
  operationId: string;
  invocationId: string;
  sessionId: string;
  status: OperationStatus;
  output?: string | null;
}

export function assertOperationId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value)) {
    throw new Error("operation ID must be 1-128 safe ASCII letters, digits, '.', '_' or '-' characters");
  }
  return value;
}

function stableId(prefix: string, parts: readonly string[]): string {
  if (parts.some((part) => typeof part !== "string" || part.length === 0 || part.length > 2048)) {
    throw new Error("identity dimensions must be non-empty strings no longer than 2048 characters");
  }
  const digest = createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 40);
  return `${prefix}_${digest}`;
}

export function makeEffectId(identity: EffectIdentity): string {
  if (!Number.isSafeInteger(identity.stage) || identity.stage < 0) throw new Error("effect stage must be a non-negative integer");
  return stableId("effect", [
    assertOperationId(identity.operationId),
    identity.sessionId,
    identity.toolCallId,
    identity.operation,
    String(identity.stage),
  ]);
}

export function makeGateId(identity: Pick<EffectIdentity, "operationId" | "sessionId" | "toolCallId">): string {
  return stableId("gate", [
    assertOperationId(identity.operationId),
    identity.sessionId,
    identity.toolCallId,
  ]);
}

export function makeChildOperationId(parentOperationId: string, toolCallId: string): string {
  return stableId("child", [assertOperationId(parentOperationId), toolCallId]);
}
