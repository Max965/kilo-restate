import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, realpath, stat, unlink, appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import http2 from 'node:http2';
import { connect } from '@restatedev/restate-sdk-clients';
import { OperationWorkflow } from './restate/service.ts';
import { assertOperationId } from './contract.ts';
import { validateGoal, goalIdentity, demoReadonly, formatEvent, projectResult, verifyResult, type GoalIR, type DemoContext, type DemoStatus, type Journal } from './demo-contract.ts';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runtime=resolve(process.env.KILO_DEMO_HOME??join(homedir(),'.local/state/kilo-restate/dev-demo'));
const container='kilo-restate-pi-lifecycle';
const shell=(s:string)=>`'${s.replaceAll("'","'\\''")}'`;
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
export interface DemoReceipt extends Omit<DemoContext,'invocationId'> {
  version:1; invocationId:string|null; sessionId:string|null; phase:string;
  directory:string; unit:string; description:string; serviceUri:string;
  containerId:string; containerStarted:boolean; priorDeploymentIds:string[]; deploymentId:string|null;
  adminUrl:string; ingressUrl:string; fixtureCreated:boolean; fixtureHash:string;
  source:{head:string; files:Record<string,string>};
  inspectionUrl:string|null; retention:string; commands:Record<string,string>;
}
const save=async(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});
const context=(r:DemoReceipt):DemoContext=>{if(!r.invocationId)throw Error('operation has no acknowledged submission');return {...r,invocationId:r.invocationId};};
const client=(r:DemoReceipt)=>connect({url:r.ingressUrl}).workflowClient(OperationWorkflow,r.operationId);
const terminal=(s:string)=>['completed','failed','cancelled'].includes(s);
function localUrl(value:string):string {const url=new URL(value);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||url.search||url.hash)throw Error('DEV Restate URL must be credential-free local HTTP');return url.origin;}
function containerState(){const info=JSON.parse(execFileSync('podman',['inspect',container],{encoding:'utf8'}))[0];return {id:info.Id,running:info.State.Running,status:info.State.Status};}
async function deployments(admin:string){const r=await fetch(admin+'/deployments');if(!r.ok)throw Error(`deployment list HTTP ${r.status}`);return (await r.json() as {deployments:any[]}).deployments;}
async function query(r:DemoReceipt,sql:string){for(let n=0;n<40;n++){const response=await fetch(r.adminUrl+'/query',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({query:sql})});const data:any=await response.json();if(response.ok)return data;if(n===39)throw Error(JSON.stringify(data));await delay(250);}}
async function unusedPort(){const server=createServer();await new Promise<void>((yes,no)=>server.once('error',no).listen(0,'127.0.0.1',yes));const port=(server.address() as {port:number}).port;await new Promise<void>((yes,no)=>server.close(e=>e?no(e):yes()));return port;}
async function discovery(port:number):Promise<any>{return new Promise((yes,no)=>{const session=http2.connect(`http://127.0.0.1:${port}`);const timeout=setTimeout(()=>{session.destroy();no(Error('native discovery timeout'));},2000);session.on('error',e=>{clearTimeout(timeout);session.destroy();no(e);});const request=session.request({':path':'/discover',accept:'application/vnd.restate.endpointmanifest.v3+json'});let data='',code:unknown;request.on('response',h=>code=h[':status']);request.on('data',b=>data+=b);request.on('error',e=>{clearTimeout(timeout);session.destroy();no(e);});request.on('end',()=>{clearTimeout(timeout);session.close();try{if(code!==200)throw Error(`discovery HTTP ${code}`);yes(JSON.parse(data));}catch(e){no(e);}});request.end();});}
async function receiptFor(id:string):Promise<DemoReceipt>{assertOperationId(id);const r=JSON.parse(await readFile(join(runtime,id,'receipt.json'),'utf8')) as DemoReceipt;if(r.version!==1||r.operationId!==id||r.directory!==join(runtime,id)||r.unit!==`kilo-node-dev-${id}.service`||r.description!==`Kilo DEV ${id} ${r.goalId}`||r.goalId!==goalIdentity(r.goal))throw Error('invalid ownership receipt');return r;}
async function persist(r:DemoReceipt){await save(join(r.directory,'receipt.json'),r);}
export async function resolvePendingGates(ingress:ReturnType<typeof connect>,status:DemoStatus,workspace:string,decided:Set<string>,record:(value:unknown)=>Promise<void>){
  for(const event of status.events){
    if(event.type!=='gate_pending')continue;
    const p=event.payload;if(typeof p?.gateId!=='string'||typeof p.awakeableId!=='string'||typeof p.toolName!=='string')throw Error('invalid pending gate');
    if(decided.has(p.gateId)||status.events.some(e=>['gate_allowed','gate_denied'].includes(e.type)&&e.payload?.gateId===p.gateId))continue;
    const decision=await demoReadonly(workspace,p.toolName,(p.input??{}) as Record<string,unknown>);
    try {await ingress.resolveAwakeable(p.awakeableId,decision);decided.add(p.gateId);await record({gateId:p.gateId,toolCallId:event.toolCallId,decision,policy:'demo-readonly',at:new Date().toISOString()});}
    catch(error){await ingress.rejectAwakeable(p.awakeableId,'demo resolver failed').catch(()=>undefined);await record({gateId:p.gateId,error:String(error),failClosed:true});throw error;}
  }
}
async function collect(r:DemoReceipt,s:DemoStatus){const result=projectResult(context(r),s);const ids=[r.invocationId!,...s.events.filter(e=>e.type==='gate_pending').map(e=>e.invocationId!),...result.effects.map(e=>e.invocationId)];const journals:Journal[]=[];for(const id of [...new Set(ids)])journals.push({invocationId:id,...await query(r,`SELECT id,index,entry_type,name FROM sys_journal WHERE id = '${id.replaceAll("'","''")}' ORDER BY index`)});const verification=verifyResult(context(r),s,result,journals);await save(join(r.directory,'status.json'),s);await save(join(r.directory,'journals.json'),journals);await save(join(r.directory,'result.json'),result);await save(join(r.directory,'verification.json'),verification);return {result,verification};}
export async function runDemo(path:string){
  const goal:unknown=JSON.parse(await readFile(path,'utf8'));validateGoal(goal);goal.workspace=await realpath(goal.workspace);
  const operationId=`demo-${randomUUID()}`,directory=join(runtime,operationId);await mkdir(directory,{recursive:true,mode:0o700});
  // One owned DEV launch at a time; explicit cleanup releases this local resource lease.
  await writeFile(join(runtime,'active.json'),JSON.stringify({operationId}),{flag:'wx',mode:0o600}).catch(()=>{throw Error(`another DEV receipt is active; inspect ${join(runtime,'active.json')} and use its cleanup command`);});
  const loader=join(repo,'node_modules/tsx/dist/loader.mjs');const prefix=`${shell(process.execPath)} --import ${shell(loader)} ${shell(join(repo,'operational-node/demo.ts'))}`;
  const r:DemoReceipt={version:1,goal,goalId:goalIdentity(goal),operationId,invocationId:null,sessionId:null,phase:'admitting',directory,unit:`kilo-node-dev-${operationId}.service`,description:`Kilo DEV ${operationId} ${goalIdentity(goal)}`,serviceUri:'',containerId:'',containerStarted:false,priorDeploymentIds:[],deploymentId:null,adminUrl:localUrl(process.env.RESTATE_ADMIN??'http://127.0.0.1:9170'),ingressUrl:localUrl(process.env.RESTATE_INGRESS??'http://127.0.0.1:8180'),fixturePath:join(goal.workspace,'probe.txt'),expectedObservation:'',fixtureCreated:false,fixtureHash:'',source:{head:execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:{}},inspectionUrl:null,retention:'Native UI observed approximately 24h journal/result retention after completion; not indefinite. Owned unit/deployment/container remain until explicit cleanup.',commands:{watch:`${prefix} watch ${operationId}`,result:`${prefix} result ${operationId}`,verify:`${prefix} verify ${operationId}`,cleanup:`${prefix} cleanup ${operationId}`}};
  await persist(r);
  try {
    for(const name of ['contract.ts','daily-driver.ts','restate/service.ts','restate/events.ts','drivers/pi/driver.ts','drivers/pi/extension.ts','demo.ts','demo-contract.ts'])r.source.files[`operational-node/${name}`]=hash(await readFile(join(repo,'operational-node',name)));
    try{await writeFile(r.fixturePath,`KILO_READ_ONLY_${randomUUID()}\n`,{flag:'wx'});r.fixtureCreated=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
    if(await demoReadonly(goal.workspace,'read',{path:'probe.txt'})!=='ALLOW'||(await stat(r.fixturePath)).size>4096)throw Error('probe.txt must be a harmless contained regular file of at most 4096 bytes');
    r.expectedObservation=await readFile(r.fixturePath,'utf8');if(!r.expectedObservation.trim())throw Error('probe fixture must identify an observation');r.fixtureHash=hash(r.expectedObservation);await persist(r);
    const before=containerState();r.containerId=before.id;
    if(!before.running){execFileSync('podman',['start',container],{stdio:'pipe'});r.containerStarted=true;await persist(r);}
    let ready=false;for(let n=0;n<40;n++){try{await deployments(r.adminUrl);ready=true;break;}catch{}await delay(250);}if(!ready)throw Error('Restate Admin unavailable');
    const prior=await deployments(r.adminUrl);r.priorDeploymentIds=prior.map(d=>d.id);await persist(r);
    if(prior.some(d=>d.services?.some((s:any)=>['KiloPiOperation','KiloOperationGate','KiloToolEffect','KiloChildRelay','KiloOperationEvents'].includes(s.name))))throw Error('refusing to replace a deployment already owning these node services');
    const port=await unusedPort();r.serviceUri=`http://host.containers.internal:${port}`;await persist(r);
    execFileSync('systemd-run',['--user',`--unit=${r.unit}`,'--collect',`--description=${r.description}`,`--property=WorkingDirectory=${repo}`,`--setenv=PATH=${dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin`,`--setenv=PORT=${port}`,`--setenv=KILO_WORKSPACE_ROOT=${goal.workspace}`,`--setenv=KILO_PI_SESSION_ROOT=${join(directory,'sessions')}`,'--setenv=KILO_PI_TURN_TIMEOUT_MS=180000','--setenv=KILO_GATE_TIMEOUT_MS=30000','--setenv=KILO_ALLOW_TEST_EXTENSION=0',`--setenv=RESTATE_INGRESS=${r.ingressUrl}`,process.execPath,'--import',loader,join(repo,'operational-node/restate/service.ts')],{encoding:'utf8'});
    let manifest:any;for(let n=0;n<40;n++){try{manifest=await discovery(port);break;}catch(e){if(n===39)throw e;await delay(250);}}
    if(!['KiloPiOperation','KiloOperationGate','KiloToolEffect','KiloOperationEvents'].every(name=>manifest.services?.some((s:any)=>s.name===name)))throw Error('unexpected native service manifest');await save(join(directory,'discovery.json'),manifest);
    const registration=await fetch(r.adminUrl+'/deployments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uri:r.serviceUri})});const deployment:any=await registration.json();await save(join(directory,'registration.json'),{status:registration.status,...deployment});if(!registration.ok)throw Error(`registration HTTP ${registration.status}`);r.deploymentId=deployment.id;await persist(r);
    const {provider,model,...pi}=goal.pi;
    const prompt=JSON.stringify(goal)+'\nFor this structural DEV probe, use only read to read probe.txt exactly once. Return its marker. Do not modify anything, call other tools, or delegate. All tool decisions are automatic.';
    if(prompt.length>16000)throw Error('lowered prompt exceeds native contract limit');
    const submission=await client(r).workflowSubmit({operationId,prompt,workspace:goal.workspace,provider,model,pi});r.invocationId=submission.invocationId;r.phase='running';r.inspectionUrl=`${r.adminUrl}/ui/invocations/${r.invocationId}?detail=errors&detail=completions&detail=lifecycle&detail=size`;
    r.commands.inspect=r.inspectionUrl;r.commands.nativeQuery=`curl -sS ${shell(r.adminUrl+'/query')} -H 'content-type: application/json' -H 'accept: application/json' --data-binary ${shell(JSON.stringify({query:`SELECT id,target,status FROM sys_invocation_status WHERE id = '${r.invocationId}'`}))}`;
    await persist(r);console.log(JSON.stringify({event:'DEMO_ADMITTED',receipt:r},null,2));
    const seen=new Set<string>(),decided=new Set<string>();let sampledRunning=false;const deadline=Date.now()+210000;
    while(Date.now()<deadline){
      const s=await client(r).status();r.sessionId=s.identity?.sessionId??null;
      if(s.status==='running'&&!sampledRunning){sampledRunning=true;await save(join(directory,'running-status.json'),s);await save(join(directory,'running-native-status.json'),await query(r,`SELECT id,target,status FROM sys_invocation_status WHERE id = '${r.invocationId}'`));}
      for(const e of s.events){if(seen.has(e.eventId))continue;seen.add(e.eventId);const line=formatEvent(e);if(line){console.log(line);await appendFile(join(directory,'watch.txt'),line+'\n');}}
      await resolvePendingGates(connect({url:r.ingressUrl}),s,goal.workspace,decided,value=>appendFile(join(directory,'policy-decisions.jsonl'),JSON.stringify(value)+'\n'));
      if(terminal(s.status)){await client(r).workflowAttach();const final=await client(r).status();r.sessionId=final.result?.identity.sessionId??null;const report=await collect(r,final);r.phase=report.verification.pass?'completed':'verification_failed';await persist(r);console.log(JSON.stringify({event:'DEMO_RESULT',...report,receipt:r,receiptPath:join(directory,'receipt.json')},null,2));return report;}
      await delay(200);
    }
    await client(r).cancel();throw Error('bounded demo deadline reached; cancellation requested');
  }catch(error){r.phase='failed';await save(join(directory,'failure.json'),{error:String(error)});await persist(r);console.error(JSON.stringify({error:String(error),operationId,cleanup:r.commands.cleanup,receiptPath:join(directory,'receipt.json')}));throw error;}
}
export async function cleanupDemo(id:string){
  const r=await receiptFor(id);const loaded=execFileSync('systemctl',['--user','show',r.unit,'-p','LoadState','--value'],{encoding:'utf8'}).trim();
  const description=loaded==='not-found'?'':execFileSync('systemctl',['--user','show',r.unit,'-p','Description','--value'],{encoding:'utf8'}).trim();
  if(description&&description!==r.description)throw Error('native unit ownership does not match receipt');
  if(r.invocationId){try{let s=await client(r).status();if(s.status==='running'){await client(r).cancel();for(let n=0;n<100&&s.status==='running';n++){await delay(200);s=await client(r).status();}if(s.status==='running')throw Error('cancellation not yet terminal; refuse to stop active operation');}}catch(error){if(description)throw error;}}
  if(description)execFileSync('systemctl',['--user','stop',r.unit]);
  if(r.deploymentId){const existing=(await deployments(r.adminUrl)).find(d=>d.id===r.deploymentId);if(existing){if(!JSON.stringify(existing).includes(r.serviceUri))throw Error('deployment endpoint ownership mismatch');const response=await fetch(r.adminUrl+`/deployments/${r.deploymentId}?force=true`,{method:'DELETE'});if(!response.ok)throw Error(`deployment delete HTTP ${response.status}`);}if((await deployments(r.adminUrl)).some(d=>d.id===r.deploymentId))throw Error('owned deployment remains');}
  let stopped=false;if(r.containerStarted){const current=containerState();if(current.id!==r.containerId)throw Error('container identity changed; refusing stop');if(current.running&&(await deployments(r.adminUrl)).every(d=>r.priorDeploymentIds.includes(d.id))){execFileSync('podman',['stop',container],{stdio:'pipe'});stopped=true;}}
  if(r.fixtureCreated){try{if(hash(await readFile(r.fixturePath))===r.fixtureHash)await unlink(r.fixturePath);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
  const active=JSON.parse(await readFile(join(runtime,'active.json'),'utf8').catch(()=>'null'));if(active?.operationId===id)await unlink(join(runtime,'active.json'));
  r.phase='cleaned';await persist(r);const result={operationId:id,ownedUnit:r.unit,ownedDeployment:r.deploymentId,containerStopped:stopped,foreignResourcesPreserved:true};await save(join(r.directory,'cleanup.json'),result);return result;
}
export async function demoCommand(args:string[]){
  const [action,arg,flag]=args;
  if(action==='run'){if(!arg||flag!=='--dev'||args.length!==3)throw Error('usage: run goal.json --dev');return runDemo(arg);}
  if(!arg||args.length!==2)throw Error('usage: watch|result|verify|cleanup OPERATION_ID');
  if(action==='cleanup')return cleanupDemo(arg);
  const r=await receiptFor(arg);
  if(action==='result'||action==='verify'){await client(r).workflowAttach();const report=await collect(r,await client(r).status());return action==='result'?report.result:report.verification;}
  if(action==='watch'){const seen=new Set<string>();const until=Date.now()+210000;while(Date.now()<until){const s=await client(r).status();for(const e of s.events){if(seen.has(e.eventId))continue;seen.add(e.eventId);const text=formatEvent(e);if(text)console.log(text);}if(terminal(s.status))return {operationId:r.operationId,status:s.status};await delay(200);}throw Error('bounded watch deadline reached');}
  throw Error(`unknown demo command ${action}`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result:any=await demoCommand(process.argv.slice(2));if(process.argv[2]!=='run')console.log(JSON.stringify(result,null,2));if(result?.verification?.pass===false||result?.pass===false)process.exitCode=1;}
  catch(error){console.error(JSON.stringify({error:error instanceof Error?error.message:String(error)}));process.exitCode=1;}
}
