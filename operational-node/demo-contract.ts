import { createHash } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { validatePiConfiguration, type PiConfiguration } from './daily-driver.ts';
import { makeEffectId, makeGateId, type OperationEvent, type OperationIdentity, type OperationResult } from './contract.ts';

export interface GoalIR {
  schema: 'kilo-demo/v1'; goal: string; workspace: string; realization: 'DEV';
  pi: { provider: string; model: string; agentDir?: string; thinking?: PiConfiguration['thinking'] };
  policy: 'demo-readonly';
}
export interface DemoResult {
  schema: 'kilo-demo-result/v1'; goalId: string; operationId: string; invocationId: string;
  sessionId: string|null; status: 'completed'|'failed'|'cancelled';
  piSettlement: 'agent_settled'|'aborted'|'failed'|null; observation: string|null;
  gate: {id: string; decision: 'ALLOW'|'DENY'}|null;
  effects: {id: string; invocationId: string; status: 'completed'}[];
  checks: {readObserved: boolean; allowedBeforeEffects: boolean; settledAfterPi: boolean};
}
export interface DemoContext {
  goal: GoalIR; goalId: string; operationId: string; invocationId: string;
  fixturePath: string; expectedObservation: string;
}
export interface DemoStatus {
  operationId: string; status: string; identity?: OperationIdentity;
  result?: OperationResult; events: OperationEvent[];
}
export interface Journal { invocationId: string; rows: Array<{entry_type: string; name?: string}> }
export function validateGoal(value: unknown): asserts value is GoalIR {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Goal IR must be an object');
  const g=value as GoalIR;
  if (Object.keys(g).some(k=>!['schema','goal','workspace','realization','pi','policy'].includes(k)) || g.schema!=='kilo-demo/v1' || g.realization!=='DEV' || g.policy!=='demo-readonly') throw new Error('unsupported Goal IR version/fields/DEV policy');
  if (typeof g.goal!=='string'||!g.goal.trim()||g.goal.length>8000||typeof g.workspace!=='string'||!isAbsolute(g.workspace)) throw new Error('goal text and absolute workspace required');
  if (!g.pi || typeof g.pi!=='object'||Array.isArray(g.pi)) throw new Error('native Pi configuration required');
  if(Object.keys(g.pi).some(k=>!['provider','model','agentDir','thinking'].includes(k))) throw new Error('unknown native Pi Goal field');
  const {provider,model,...native}=g.pi;
  if(typeof provider!=='string'||!provider||provider.length>100||typeof model!=='string'||!model||model.length>200) throw new Error('native provider/model required');
  validatePiConfiguration(native);
}
export function goalIdentity(g: GoalIR): string {
  validateGoal(g);
  return createHash('sha256').update(JSON.stringify([g.schema,g.goal,g.workspace,g.realization,g.pi.provider,g.pi.model,g.pi.agentDir??null,g.pi.thinking??null,g.policy])).digest('hex');
}
export async function demoReadonly(workspace:string,tool:string,input:Record<string,unknown>):Promise<'ALLOW'|'DENY'> {
  if(tool!=='read'||typeof input.path!=='string'||!input.path)return 'DENY';
  try {const root=await realpath(workspace),path=await realpath(resolve(root,input.path)),rel=relative(root,path);return rel!=='..'&&!rel.startsWith(`..${sep}`)&&!isAbsolute(rel)&&(await stat(path)).isFile()?'ALLOW':'DENY';}
  catch {return 'DENY';} // Includes policy filesystem errors: never fall back to ALLOW.
}
const labels:Record<string,string>={pi_process_started:'PI_STARTED',turn_start:'TURN_STARTED',tool_requested:'TOOL_REQUEST',gate_allowed:'GATE ALLOW',gate_denied:'GATE DENY',gate_failed:'GATE FAILED',effect_started:'EFFECT',tool_effect_result:'EFFECT_RESULT',agent_settled:'PI_SETTLED',operation_settled:'COMPLETED',operation_failed:'FAILED',operation_cancelled:'CANCELLED'};
export function formatEvent(e:OperationEvent):string|null {
  if(!labels[e.type])return null;
  // Live extension records take precedence over the driver's deferred duplicate batch.
  if(['turn_start','agent_settled'].includes(e.type)&&!e.processId)return null;
  const input=e.payload?.input as Record<string,unknown>|undefined;
  return `${labels[e.type]} ${[e.payload?.toolName,input?.path,e.payload?.operation,e.payload?.stage,e.payload?.effectId,e.toolCallId??e.payload?.toolCallId].filter(x=>x!==undefined).join(' ')}`.trim();
}
export function projectResult(c:DemoContext,s:DemoStatus):DemoResult {
  const completed=s.events.filter(e=>e.type==='effect_completed');
  const read=completed.find(e=>e.payload?.operation==='read'&&s.events.some(t=>t.type==='tool_requested'&&t.toolCallId===e.toolCallId&&typeof (t.payload?.input as any)?.path==='string'&&resolve(c.goal.workspace,(t.payload!.input as any).path)===c.fixturePath));
  const allowed=s.events.find(e=>e.type==='gate_allowed'&&e.toolCallId===read?.toolCallId);
  const denied=s.events.find(e=>e.type==='gate_denied');const decision=allowed??denied;
  const encoded=(read?.payload?.result as Record<string,unknown>|undefined)?.base64;
  const observation=typeof encoded==='string'?Buffer.from(encoded,'base64').toString('utf8'):null;
  const started=s.events.find(e=>e.type==='pi_process_started');
  const pi=s.events.findIndex(e=>e.type==='agent_settled');const terminal=s.events.findIndex(e=>['operation_settled','operation_failed','operation_cancelled'].includes(e.type));
  return {schema:'kilo-demo-result/v1',goalId:c.goalId,operationId:c.operationId,invocationId:c.invocationId,
    sessionId:started?.sessionId??(typeof started?.payload?.sessionId==='string'?started.payload.sessionId:null),
    status:s.status==='completed'?'completed':s.status==='cancelled'?'cancelled':'failed',piSettlement:s.result?.piSettlement??null,observation,
    gate:decision&&typeof decision.payload?.gateId==='string'?{id:decision.payload.gateId,decision:allowed?'ALLOW':'DENY'}:null,
    effects:completed.filter(e=>typeof e.payload?.effectId==='string'&&e.invocationId).map(e=>({id:String(e.payload!.effectId),invocationId:e.invocationId!,status:'completed'})),
    checks:{readObserved:observation!==null&&observation===c.expectedObservation,allowedBeforeEffects:completed.length>0&&completed.every(e=>s.events.some(g=>g.type==='gate_allowed'&&g.toolCallId===e.toolCallId&&g.at<e.at)),settledAfterPi:pi>=0&&terminal>pi}};
}
export function verifyResult(c:DemoContext,s:DemoStatus,r:DemoResult,journals:Journal[]) {
  const expected=projectResult(c,s);
  const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const checks=[
    {name:'schema_and_goal',pass:r.schema==='kilo-demo-result/v1'&&r.goalId===goalIdentity(c.goal)},
    {name:'identity_alignment',pass:r.operationId===s.operationId&&r.invocationId===s.identity?.invocationId&&r.sessionId===s.identity?.sessionId&&r.sessionId===s.result?.identity.sessionId},
    {name:'actual_projection_not_model_prose',pass:JSON.stringify(canonical(r))===JSON.stringify(canonical(expected))},
    {name:'one_exact_read',pass:r.checks.readObserved&&s.events.filter(e=>e.type==='effect_completed'&&e.payload?.operation==='read').length===1},
    {name:'gate_before_all_effect_starts',pass:r.gate?.decision==='ALLOW'&&r.effects.length>0&&s.events.filter(e=>e.type==='effect_started').every(e=>s.events.some(g=>g.type==='gate_allowed'&&g.toolCallId===e.toolCallId&&g.at<e.at))},
    {name:'durable_effect_runs',pass:r.effects.length>0&&r.effects.every(e=>journals.find(j=>j.invocationId===e.invocationId)?.rows.some(row=>row.entry_type==='Command: Run'&&row.name?.startsWith('effect:')))},
    {name:'stable_gate_effect_session_correlation',pass:s.events.filter(e=>e.type==='effect_completed').every(e=>{
      const g=s.events.find(g=>g.type==='gate_allowed'&&g.toolCallId===e.toolCallId);
      if(!g||e.operationId!==r.operationId||e.sessionId!==r.sessionId||g.sessionId!==r.sessionId||!e.toolCallId||!r.sessionId||typeof e.payload?.stage!=='number')return false;
      return g.payload?.gateId===makeGateId({operationId:r.operationId,sessionId:r.sessionId,toolCallId:e.toolCallId})&&e.payload?.effectId===makeEffectId({operationId:r.operationId,sessionId:r.sessionId,toolCallId:e.toolCallId,operation:String(e.payload.operation),stage:e.payload.stage});
    })},
    {name:'coherent_terminal_settlement',pass:r.status==='completed'&&r.piSettlement==='agent_settled'&&r.checks.settledAfterPi},
  ];
  return {pass:checks.every(x=>x.pass),checks};
}
