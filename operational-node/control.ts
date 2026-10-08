import {createServer} from 'node:http';
import {readFile,stat,realpath,chmod,lstat,unlink} from 'node:fs/promises';
import {createConnection} from 'node:net';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {connect} from '@restatedev/restate-sdk-clients';
import {OperationWorkflow} from './restate/service.ts';
import type {OperationRequest} from './contract.ts';
import {validatePiConfiguration} from './daily-driver.ts';
import {factorySpec,factoryAdmissionHash} from './factory.ts';
import {writeInteractiveInput,resizeInteractive} from './drivers/pi/driver.ts';
import {capabilities,recentMessages,projectTranscriptMessage,authorize,validateAddress,selectNode,ControlError,type Address,type Grant,type Selector,type Capability} from './control-policy.ts';
import {subscribeLive,liveOwners} from './control-live.ts';

export async function prepareControlSocket(socket:string){
 let before;try{before=await lstat(socket);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 if(!before.isSocket()||before.uid!==process.getuid?.())throw Error('refusing to replace non-owned control socket');
 const stale=await new Promise<boolean>((yes,no)=>{const connection=createConnection(socket);connection.once('connect',()=>{connection.destroy();yes(false);});connection.once('error',error=>{connection.destroy();if(['ECONNREFUSED','ENOENT'].includes((error as NodeJS.ErrnoException).code??''))yes(true);else no(error);});connection.setTimeout(1000,()=>{connection.destroy();no(Error('control socket owner probe timed out'));});});
 if(!stale)throw Error('control socket already has a live owner');
 const after=await lstat(socket).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(after){if(after.ino!==before.ino||after.dev!==before.dev)throw Error('control socket changed during owner probe');await unlink(socket);}
}
export async function startControl(){
 const socket=process.env.KILO_CONTROL_SOCKET!,grantFile=process.env.KILO_CONTROL_GRANTS!;
 const terminalViews=new Map<string,{operationId:string;workspace:string;address:Address;identity:string}>();
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
 async function snapshot(id:string){const state=await client(id).status();let messages:unknown[]=[],sessionSize=0;const sessionFile=state.identity?.sessionFile!=='pending'?state.identity?.sessionFile:state.events.find(e=>e.type==='pi_process_started')?.payload?.sessionFile as string|undefined;if(sessionFile&&sessionFile!=='pending'){if((await stat(sessionFile)).size>2*1024*1024)throw new ControlError(413,'V0 transcript catch-up exceeds2MiB');const contents=await readFile(sessionFile,'utf8');sessionSize=Buffer.byteLength(contents);messages=contents.split('\n').filter(Boolean).flatMap(line=>{const e=JSON.parse(line);return e.type==='message'?[e.message]:[];});}return {state,messages,sessionFile,sessionSize,live:liveOwners.get(id)??null};}
 const server=createServer(async(req,res)=>{
  let stop:(()=>void)|undefined;
  try{
   if(req.method!=='POST'||!['/command','/events','/input'].includes(req.url??''))throw new ControlError(404,'unknown control endpoint');
   const token=(req.headers.authorization??'').replace(/^Bearer /,'');const digest=(s:string)=>createHash('sha256').update(s).digest();const grant=grants.find(g=>timingSafeEqual(digest(g.token),digest(token)));if(!grant)throw new ControlError(401,'control credential required');
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32768)throw new ControlError(413,'control request too large');}const p=JSON.parse(body);if(!p||typeof p!=='object'||Array.isArray(p))throw new ControlError(400,'command object required');
   const action=p.action as Capability;if(!capabilities.includes(action))throw new ControlError(400,'unknown capability');const raw=p.selector??p.spec?.address??(p.spec?.factoryPackage?{workspace:p.spec.factoryPackage.WORKSPACE}:undefined);if(!raw||Object.keys(raw).some(k=>!['workspace','responsibility','role','instance'].includes(k)))throw new ControlError(400,'semantic selector required');
   const workspace=await realpath(raw.workspace);authorize(grant,action,workspace);const selector:Selector={...raw,workspace};for(const k of ['responsibility','role','instance'])if(selector[k as keyof Selector]!==undefined&&!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(String(selector[k as keyof Selector])))throw new ControlError(400,'invalid semantic name');
   if(req.url==='/input'){
    if(action!=='LAUNCH'||typeof p.terminalKey!=='string'||(!p.resize&&(typeof p.data!=='string'||p.data.length>22000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(p.data))))throw new ControlError(400,'bounded terminal input required');
    const view=terminalViews.get(p.terminalKey);if(!view||view.workspace!==workspace||view.identity!==grant.identity)throw new ControlError(403,'terminal owner capability expired');
    const inputAddress={...raw,workspace} as Address;validateAddress(inputAddress);if(['workspace','responsibility','role','instance'].some(key=>inputAddress[key as keyof Address]!==view.address[key as keyof Address]))throw new ControlError(403,'terminal semantic address mismatch');
    if(p.resize){const {rows,columns}=p.resize;if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||columns<1||rows>1000||columns>1000)throw new ControlError(400,'invalid terminal size');if(!resizeInteractive(view.operationId,rows,columns))throw new ControlError(409,'terminal not active');res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:'resized'}));return;}
    const data=Buffer.from(p.data,'base64');if(!data.length||data.length>16384)throw new ControlError(413,'terminal input exceeds 16 KiB');
    if(!writeInteractiveInput(view.operationId,data))throw new ControlError(409,'native interactive actor is not attached');
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({identity:grant.identity,status:'written',bytes:data.length}));return;
   }
   if(req.url==='/events'&&!['ATTACH','DEBUG'].includes(action)&&!(action==='LAUNCH'&&p.attach===true))throw new ControlError(400,'stream requires ATTACH or DEBUG');
   if(action==='DEBUG'&&p.layer&&!['context','provider-request'].includes(p.layer))throw new ControlError(400,'unknown debug layer');
   async function observe(id:string,address:unknown,submit?:()=>Promise<unknown>,terminalKey?:string){const c=client(id);let settled=false,admitted=false,disconnected=false;
      res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store'});const send=(value:unknown)=>{if(res.destroyed||res.writableEnded)return;if(res.writableLength>1024*1024){res.destroy();return;}res.write('data: '+JSON.stringify(value)+'\n\n');}; // ponytail: disconnect >1MiB stalled consumer; catch-up remains native transcript/state.
      let timer:ReturnType<typeof setInterval>|undefined;
      stop=subscribeLive(id,event=>{if((action==='DEBUG')!==(event.kind==='debug')||event.kind==='terminal'&&!terminalKey)return;if(action==='DEBUG'&&p.layer&&event.event.layer!==p.layer)return;send(event);});res.on('close',()=>{stop?.();if(timer)clearInterval(timer);if(terminalKey){terminalViews.delete(terminalKey);disconnected=true;if(admitted&&!settled)void Promise.resolve(c.cancel()).catch(()=>undefined);}});
      if(submit){send({kind:'viewer-ready',address,operationId:id,terminalKey,at:Date.now()});const admission=await submit();admitted=true;send({kind:'admitted',address,operationId:id,at:Date.now(),admitted:admission});if(disconnected&&terminalKey)await Promise.resolve(c.cancel()).catch(()=>undefined);}
      const caught=submit?undefined:await snapshot(id);
      if(caught){send(action==='DEBUG'?{kind:'catch-up',address:address,status:caught.state.status,live:caught.live}:{kind:'catch-up',address:address,...caught,...(p.history===true?{}:{state:{status:caught.state.status},messages:recentMessages(caught.messages),historyCount:caught.messages.length,recentEvents:caught.state.events.slice(-3).map(e=>e.type)})});if(action==='DEBUG')for(const event of caught.state.events.filter(e=>String(e.type).startsWith('debug_')).slice(-20))send({kind:'debug',event:event.payload});}
      if(res.destroyed||res.writableEnded)return;
      let transcriptFile=caught?.sessionFile,transcriptOffset=caught?.sessionSize??0;const seen=new Set<string>(caught?.state.events.map(e=>e.eventId)??[]);let polling=false;
      timer=setInterval(async()=>{if(polling||res.destroyed)return;polling=true;try{const s=await c.status();for(const e of s.events){if(seen.has(e.eventId))continue;seen.add(e.eventId);if(action==='DEBUG'&&String(e.type).startsWith('debug_')&&(!p.layer||e.payload?.layer===p.layer))send({kind:'debug',event:e.payload});else if(!terminalKey&&['gate_pending','gate_allowed','gate_denied','effect_started','effect_completed','operation_settled','operation_failed','operation_cancelled','agent_start','agent_settled','turn_start','turn_end'].includes(e.type))send({kind:'annotation',event:{type:e.type,at:e.at,toolCallId:e.toolCallId,operation:e.payload?.operation,effectId:e.payload?.effectId}});}
       const currentFile=s.identity?.sessionFile!=='pending'?s.identity?.sessionFile:s.events.find(e=>e.type==='pi_process_started')?.payload?.sessionFile as string|undefined;
       if(action==='ATTACH'&&!terminalKey&&currentFile&&currentFile!=='pending'){if(currentFile!==transcriptFile){transcriptFile=currentFile;transcriptOffset=0;}const size=(await stat(currentFile)).size;if(size<=2*1024*1024&&size>transcriptOffset){const bytes=await readFile(currentFile);let cursor=transcriptOffset,end;while((end=bytes.indexOf(10,cursor))>=0){try{const row=JSON.parse(bytes.subarray(cursor,end).toString('utf8'));if(row.type==='message')send({kind:'pi',event:{type:'transcript_message',message:projectTranscriptMessage(row.message)}});}catch{}cursor=end+1;}transcriptOffset=cursor;}}
       if(['completed','failed','cancelled'].includes(s.status)){settled=true;if(terminalKey)terminalViews.delete(terminalKey);send(action==='DEBUG'?{kind:'settlement',status:s.status}:{kind:'settlement',state:s});res.end();}}catch{res.destroy();}finally{polling=false;}},500);

   }
   let result:unknown;
   if(action==='LAUNCH'){
    if(req.url==='/events')authorize(grant,'ATTACH',workspace);const spec=p.spec;
    if(p.interactive===true){
     if(req.url!=='/events'||p.attach!==true||!spec||typeof spec!=='object'||Array.isArray(spec)||!spec.factoryPackage||Object.keys(spec).some(k=>k!=='factoryPackage')||Object.keys(p).some(k=>!['action','attach','interactive','spec','terminalSize'].includes(k)))throw new ControlError(400,'interactive Factory launch requires one attached Factory package');
     const factory=await factorySpec(spec.factoryPackage);if(factory.workContract.REALIZATION!=='INTERACTIVE_DEBUG'||factory.workspace!==workspace)throw new ControlError(400,'Factory package must admit INTERACTIVE_DEBUG for this workspace');
     if(typeof factory.provider!=='string'||!factory.provider||typeof factory.model!=='string'||!factory.model)throw new ControlError(400,'Factory provider/model must be explicit');
     const debugExtension=join(dirname(fileURLToPath(import.meta.url)),'control-debug.ts');if(factory.pi.extensions?.some(path=>resolve(path)===resolve(debugExtension)))authorize(grant,'DEBUG',workspace);
     const address=factory.controlAddress!;const request:OperationRequest={operationId:factory.operationId,prompt:JSON.stringify(factory.workContract),workContract:factory.workContract,workspace:factory.workspace,provider:factory.provider,model:factory.model,pi:factory.pi,controlAddress:address};
     if(p.terminalSize){const {rows,columns}=p.terminalSize;if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||columns<1||rows>1000||columns>1000)throw new ControlError(400,'invalid terminal size');request.terminalSize={rows,columns};}
     const hash=factoryAdmissionHash(request),c=client(request.operationId),prior=await c.status();if(prior.factoryAdmissionHash&&prior.factoryAdmissionHash!==hash)throw new ControlError(409,'Factory identity already admitted with different work/configuration');if(prior.status&&!['accepted','not_found'].includes(prior.status))throw new ControlError(409,`INTERACTIVE_DEBUG cannot reattach to an existing ${prior.status} operation`);
     if([...terminalViews.values()].some(view=>view.operationId===request.operationId))throw new ControlError(409,'interactive terminal already owned');
     const terminalKey=randomUUID();terminalViews.set(terminalKey,{operationId:request.operationId,workspace,address,identity:grant.identity});
     await observe(request.operationId,address,()=>c.workflowSubmit(request),terminalKey);return;
    }
    validateAddress({...spec.address,workspace});if(Object.keys(spec).some(k=>!['address','prompt','provider','model','pi','debug'].includes(k))||typeof spec.prompt!=='string'||!spec.prompt||spec.prompt.length>16000||typeof spec.provider!=='string'||!spec.provider||typeof spec.model!=='string'||!spec.model)throw new ControlError(400,'bounded launch spec required');
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
 await prepareControlSocket(socket);
 await new Promise<void>((yes,no)=>server.once('error',no).listen(socket,yes));await chmod(socket,0o600);console.log(JSON.stringify({event:'kilo_control_listening',socket}));return server;
}
