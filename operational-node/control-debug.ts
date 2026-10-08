import {createHash} from 'node:crypto';
import {connect,rpc} from '@restatedev/restate-sdk-clients';
import {OperationEvents} from './restate/events.ts';
// Opt-in metadata only; never persist context or provider request contents.
export default function(pi:any){let request=0,sequence=0;const operationId=process.env.KILO_OPERATION_ID,invocationId=process.env.KILO_OPERATION_INVOCATION_ID,sessionId=process.env.KILO_SESSION_ID,ingress=connect({url:process.env.KILO_EVENT_INGRESS??'http://127.0.0.1:8180'});
 const publish=async(data:any)=>{if(!operationId||!invocationId||!sessionId)return;const eventId=`${process.pid}-debug-${sequence++}`;await ingress.objectClient(OperationEvents,operationId).append({eventId,operationId,invocationId,sessionId,processId:process.pid,type:`debug_${data.layer}`,at:new Date().toISOString(),payload:data},rpc.opts({idempotencyKey:eventId}));};
 pi.on('context_with_system',(event:any,ctx:any)=>{const data={layer:'context',messages:event.messages.length,sha256:createHash('sha256').update(JSON.stringify(event.messages)).digest('hex')};void publish(data).catch(()=>undefined);ctx.ui.notify('KILO_DEBUG_V0:'+JSON.stringify(data),'info');});
 pi.on('before_provider_request',(event:any,ctx:any)=>{const data={layer:'provider-request',request:++request,fields:Object.keys(event.payload??{}),sha256:createHash('sha256').update(JSON.stringify(event.payload)).digest('hex')};void publish(data).catch(()=>undefined);ctx.ui.notify('KILO_DEBUG_V0:'+JSON.stringify(data),'info');});
}
