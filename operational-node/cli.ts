import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '@restatedev/restate-sdk-clients';
import { OperationWorkflow } from './restate/service.ts';
import { assertOperationId, type OperationRequest } from './contract.ts';
import { validatePiConfiguration } from './daily-driver.ts';
import {factorySpec,factoryAdmissionHash} from './factory.ts';

export async function command(args: string[]): Promise<unknown> {
  const [action, identity, ...rest] = args;
  const ingress = connect({ url: process.env.RESTATE_INGRESS ?? 'http://127.0.0.1:8180' });
  if (action === 'start' || action === 'factory') {
    if (!identity || rest.length) throw new Error('usage: start contract.json');
    const raw = JSON.parse(await readFile(identity, 'utf8'));
    const spec = action==='factory'?await factorySpec(raw):raw;
    if (!spec || typeof spec !== 'object' || !spec.workContract || typeof spec.workspace !== 'string') throw new Error('contract requires workContract and workspace');
    const operationId = spec.operationId ? assertOperationId(spec.operationId) : `daily-${randomUUID()}`;
    const request: OperationRequest = {
      operationId, prompt: JSON.stringify(spec.workContract), workContract: spec.workContract,
      workspace: resolve(spec.workspace), provider: spec.provider ?? process.env.PI_PROVIDER ?? '',
      model: spec.model ?? process.env.PI_MODEL ?? '', pi: validatePiConfiguration(spec.pi ?? {}),
      ...(spec.controlAddress?{controlAddress:spec.controlAddress}:{}),
    };
    if (!request.provider || !request.model) throw new Error('provider/model required explicitly or via PI_PROVIDER/PI_MODEL');
    const client=ingress.workflowClient(OperationWorkflow,operationId),hash=factoryAdmissionHash(request);
    if(action==='factory'){const prior=await client.status();if(prior.factoryAdmissionHash&&prior.factoryAdmissionHash!==hash)throw Error('Factory identity already admitted with different work/configuration');}
    const submission = await client.workflowSubmit(request);
    if(action==='factory'){
      const result=await client.workflowAttach(),state=await client.status();
      if(state.factoryAdmissionHash!==hash)throw Error('Factory admission reconciliation mismatch');
      return {operationId,...submission,factoryIdentity:spec.workContract.FACTORY_IDENTITY,semanticAddress:spec.controlAddress,result};
    }
    return { operationId, ...submission };
  }
  if (!identity) throw new Error('usage: start contract.json | status|result|cancel OPERATION_ID | steer OPERATION_ID MESSAGE | allow|deny OPERATION_ID TOOL_CALL_ID');
  const operationId = assertOperationId(identity);
  const client = ingress.workflowClient(OperationWorkflow, operationId);
  if (action === 'status') return client.status();
  if (action === 'result') return client.workflowAttach();
  if (action === 'cancel') return client.cancel();
  if (action === 'steer') {
    if (!rest.length) throw new Error('steer requires a message');
    return client.steer({ message: rest.join(' ') });
  }
  if (action === 'allow' || action === 'deny') {
    if (rest.length !== 1) throw new Error('allow/deny requires exactly one tool call ID from status');
    const status = await client.status();
    const pending = status.events.slice().reverse().find(event => event.type === 'gate_pending' && event.toolCallId === rest[0]);
    if (!pending || typeof pending.payload?.awakeableId !== 'string') throw new Error('no matching pending gate');
    if (status.events.some(event => ['gate_allowed','gate_denied'].includes(event.type) && event.payload?.gateId === pending.payload?.gateId)) throw new Error('gate already decided');
    await ingress.resolveAwakeable(pending.payload.awakeableId, action === 'allow' ? 'ALLOW' : 'DENY');
    return { operationId, toolCallId: rest[0], decision: action.toUpperCase(), status: 'submitted' };
  }
  throw new Error(`unknown command ${action}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await command(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }
}
