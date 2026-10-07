import {createServer} from 'node:http';
import {readFile,stat,realpath,chmod} from 'node:fs/promises';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {connect} from '@restatedev/restate-sdk-clients';
import {OperationWorkflow} from './restate/service.ts';
import {validatePiConfiguration} from './daily-driver.ts';
import {capabilities,recentMessages,authorize,validateAddress,selectNode,ControlError,type Grant,type Selector,type Capability} from './control-policy.ts';
import {subscribeLive,liveOwners} from './control-live.ts';

export async function startControl(){
 const socket=process.env.KILO_CONTROL_SOCKET!,grantFile=process.env.KILO_CONTROL_GRANTS!;
 if(!socket?.startsWith('/')||Buffer.byteLength(socket)>100)throw Error('Unix control socket requires a short absolute path (max100 bytes)');
 if(!socket||!grantFile||(await stat(dirname(socket))).mode&0o077||(await stat(grantFile)).mode&0o077)throw Error('private socket directory and grants file required');
 const grants:Grant[]=JSON.parse(await readFile(grantFile,'utf8'));
 for(const g of grants){if(!g.identity||!/^[a-f0-9]{64}$/.test(g.token)||!Array.isArray(g.capabilities)||g.capabilities.some(c=>!capabilities.includes(c))||!Array.isArray(g.workspaces)||!g.workspaces.length)throw Error('invalid local control grant');g.workspaces=await Promise.all(g.workspaces.map(p=>realpath(p)));}
 const ingress=connect({url:process.env.RESTATE_INGRESS??'http://127.0.0.1:8180'}),admin=process.env.RESTATE_ADMIN??'http://127.0.0.1:9170';
 const client=(id:string)=>ingress.workflowClient(OperationWorkflow,id);
 async function nodes(workspace:string){
  const r=await fetch(admin+'/query',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({query:"SELECT DISTINCT target_service_key FROM sys_invocation_status WHERE target_service_name = 'KiloPiOperation' AND target_handler_name = 'run' LIMIT 201"})});
  if(!r.ok)throw new ControlError(503,'native discovery query unavailable');const data:any=await r.json();if(data.rows.length>200)throw new ControlError(503,'V0 native discovery limit exceeded');
  // ponytail: bounded native scan, add a native address index only if >200 nodes becomes real.
  const result=[];for(const row of data.rows){const s=await client(row.target_service_key).status();if(s.address?.workspace===workspace)result.push({operationId:s.operationId,address:s.address,status:s.status,sessionId:s.identity?.sessionId??null,live:liveOwners.get(s.operationId)??null});}return result;
 }
 async function snapshot(id:string){const state=await client(id).status();let messages:unknown[]=[];const file=state.identity?.sessionFile!=='pending'?state.identity?.sessionFile:state.events.find(e=>e.type==='pi_process_started')?.payload?.sessionFile as string|undefined;if(file&&file!=='pending'){if((await stat(file)).size>2*1024*1024)throw new ControlError(413,'V0 transcript catch-up exceeds2MiB');messages=(await readFile(file,'utf8')).split('\n').filter(Boolean).flatMap(line=>{const e=JSON.parse(line);return e.type==='message'?[e.message]:[];});}return {state,messages,live:liveOwners.get(id)??null};}
 const server=createServer(async(req,res)=>{
  let stop:(()=>void)|undefined;
  try{
   if(req.method!=='POST'||!['/command','/events'].includes(req.url??''))throw new ControlError(404,'unknown control endpoint');
   const token=(req.headers.authorization??'').replace(/^Bearer /,'');const digest=(s:string)=>createHash('sha256').update(s).digest();const grant=grants.find(g=>timingSafeEqual(digest(g.token),digest(token)));if(!grant)throw new ControlError(401,'control credential required');
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32768)throw new ControlError(413,'control request too large');}const p=JSON.parse(body);if(!p||typeof p!=='object'||Array.isArray(p))throw new ControlError(400,'command object required');
   const action=p.action as Capability;if(!capabilities.includes(action))throw new ControlError(400,'unknown capability');const raw=p.selector??p.spec?.address;if(!raw||Object.keys(raw).some(k=>!['workspace','responsibility','role','instance'].includes(k)))throw new ControlError(400,'semantic selector required');
   const workspace=await realpath(raw.workspace);authorize(grant,action,workspace);const selector:Selector={...raw,workspace};for(const k of ['responsibility','role','instance'])if(selector[k as keyof Selector]!==undefined&&!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(String(selector[k as keyof Selector])))throw new ControlError(400,'invalid semantic name');
   if(req.url==='/events'&&!['ATTACH','DEBUG'].includes(action)&&!(action==='LAUNCH'&&p.attach===true))throw new ControlError(400,'stream requires ATTACH or DEBUG');
   if(action==='DEBUG'&&p.layer&&!['context','provider-request'].includes(p.layer))throw new ControlError(400,'unknown debug layer');
   async function observe(id:string,address:unknown,submit?:()=>Promise<unknown>){const c=client(id);
      res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store'});const send=(value:unknown)=>{if(res.destroyed||res.writableEnded)return;if(res.writableLength>1024*1024){res.destroy();return;}res.write('data: '+JSON.stringify(value)+'\n\n');}; // ponytail: disconnect >1MiB stalled consumer; catch-up remains native transcript/state.
      let timer:ReturnType<typeof setInterval>|undefined;
      stop=subscribeLive(id,event=>{if((action==='DEBUG')!==(event.kind==='debug'))return;if(action==='DEBUG'&&p.layer&&event.event.layer!==p.layer)return;send(event);});res.on('close',()=>{stop?.();if(timer)clearInterval(timer);});
      if(submit){send({kind:'viewer-ready',address,operationId:id,at:Date.now()});const admitted=await submit();send({kind:'admitted',address,operationId:id,at:Date.now(),admitted});}
      const caught=submit?undefined:await snapshot(id);
      if(caught)send(action==='DEBUG'?{kind:'catch-up',address:address,status:caught.state.status,live:caught.live}:{kind:'catch-up',address:address,...caught,...(p.history===true?{}:{state:{status:caught.state.status},messages:recentMessages(caught.messages),historyCount:caught.messages.length,recentEvents:caught.state.events.slice(-3).map(e=>e.type)})});
      if(res.destroyed||res.writableEnded)return;
      const seen=new Set<string>(caught?.state.events.map(e=>e.eventId)??[]);let polling=false;
      timer=setInterval(async()=>{if(polling||res.destroyed)return;polling=true;try{const s=await c.status();for(const e of s.events){if(seen.has(e.eventId))continue;seen.add(e.eventId);if(['gate_pending','gate_allowed','gate_denied','effect_started','effect_completed','operation_settled','operation_failed','operation_cancelled'].includes(e.type))send({kind:'annotation',event:{type:e.type,at:e.at,toolCallId:e.toolCallId,operation:e.payload?.operation,effectId:e.payload?.effectId}});}if(['completed','failed','cancelled'].includes(s.status)){send(action==='DEBUG'?{kind:'settlement',status:s.status}:{kind:'settlement',state:s});res.end();}}catch{res.destroy();}finally{polling=false;}},500);

   }
   let result:unknown;
   if(action==='LAUNCH'){
    if(req.url==='/events')authorize(grant,'ATTACH',workspace);const spec=p.spec;validateAddress({...spec.address,workspace});if(Object.keys(spec).some(k=>!['address','prompt','provider','model','pi','debug'].includes(k))||typeof spec.prompt!=='string'||!spec.prompt||spec.prompt.length>16000||typeof spec.provider!=='string'||!spec.provider||typeof spec.model!=='string'||!spec.model)throw new ControlError(400,'bounded launch spec required');
    const pi=validatePiConfiguration(spec.pi??{});if(spec.debug){authorize(grant,'DEBUG',workspace);pi.extensions=[...(pi.extensions??[]),join(dirname(fileURLToPath(import.meta.url)),'control-debug.ts')];}
    const operationId='control-'+randomUUID(),address={...spec.address,workspace};const submit=()=>client(operationId).workflowSubmit({operationId,workspace,controlAddress:address,prompt:spec.prompt,provider:spec.provider,model:spec.model,pi});
    if(req.url==='/events'){await observe(operationId,address,submit);return;}
    const submitted=await submit();result={operationId,...submitted,address};
   }else{
    const available=await nodes(workspace);if(action==='VIEW')result=available;else{
     const node=selectNode(available,selector),c=client(node.operationId);
     if(req.url==='/events'){
      await observe(node.operationId,node.address);return;
     }
     if(action==='INSPECT')result={address:node.address,...await snapshot(node.operationId)};
     else if(action==='STEER'){if(typeof p.message!=='string'||!p.message||p.message.length>16000)throw new ControlError(400,'bounded steer message required');result=await c.steer({message:p.message});}
     else if(action==='CANCEL')result=await c.cancel();
     else throw new ControlError(400,'ATTACH/DEBUG use event subscription');
    }
   }
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({identity:grant.identity,result}));
  }catch(e){stop?.();if(res.headersSent){res.destroy();return;}res.writeHead(e instanceof ControlError?e.status:500,{'content-type':'application/json'});res.end(JSON.stringify({error:e instanceof Error?e.message:String(e)}));}
 });
 await new Promise<void>((yes,no)=>server.once('error',no).listen(socket,yes));await chmod(socket,0o600);console.log(JSON.stringify({event:'kilo_control_listening',socket}));return server;
}
