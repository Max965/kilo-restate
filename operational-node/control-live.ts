import { EventEmitter } from 'node:events';
// Ephemeral fan-out only. Restate and Pi remain the lifecycle/history authorities.
const emitter=new EventEmitter();emitter.setMaxListeners(64);
export interface LiveEnvelope {operationId:string;sessionId:string;attemptId:string;ownerPid:number;at:number;kind:'pi'|'debug';event:Record<string,unknown>}
export const liveOwners=new Map<string,{sessionId:string;attemptId:string;ownerPid:number}>();
export function publishLive(event:LiveEnvelope){emitter.emit(event.operationId,event);}
export function subscribeLive(operationId:string,listener:(event:LiveEnvelope)=>void){emitter.on(operationId,listener);return ()=>{emitter.off(operationId,listener);};}
