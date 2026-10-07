import {createHash} from 'node:crypto';
// Opt-in metadata only, using documented Pi UI notification -> RPC event transport.
export default function(pi:any){let request=0;
 pi.on('context_with_system',(event:any,ctx:any)=>ctx.ui.notify('KILO_DEBUG_V0:'+JSON.stringify({layer:'context',messages:event.messages.length,sha256:createHash('sha256').update(JSON.stringify(event.messages)).digest('hex')}),'info'));
 pi.on('before_provider_request',(event:any,ctx:any)=>ctx.ui.notify('KILO_DEBUG_V0:'+JSON.stringify({layer:'provider-request',request:++request,fields:Object.keys(event.payload??{}),sha256:createHash('sha256').update(JSON.stringify(event.payload)).digest('hex')}),'info'));
}
