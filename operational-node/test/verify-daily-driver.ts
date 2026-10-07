import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { resolve, join } from 'node:path';
import { command } from '../cli.ts';

const repo = process.cwd();
const root = resolve('.agent/goals/2026-10-06-kilo-restate-daily-driver-v0/iterations/01/evidence', `real-${Date.now()}`);
const workspace = join(root, 'workspace');
const ingress = process.env.RESTATE_INGRESS ?? 'http://127.0.0.1:8180';
const admin = process.env.RESTATE_ADMIN ?? 'http://127.0.0.1:9170';
const container = 'kilo-restate-pi-lifecycle';
const checks = Array.from({length:13},(_,i)=>({id:`D${String(i+1).padStart(2,'0')}`,status:'BLOCKED',observed:'not reached'}));
const save = async (name:string, value:unknown) => writeFile(join(root,name),JSON.stringify(value,null,2)+'\n');
const check = (id:string, condition:boolean, observed:unknown) => Object.assign(checks.find(x=>x.id===id)!, {status:condition?'PASS':'FAIL',observed});
const wait = (ms:number) => new Promise(r=>setTimeout(r,ms));
let service:ChildProcess|undefined, deployment:string|undefined, started=false, operationId:string|undefined;
const before = JSON.parse(execFileSync('podman',['inspect','--format','{{json .State}}',container],{encoding:'utf8'}));
await mkdir(workspace,{recursive:true});
await save('container-before.json',before);
try {
  const matrices = execFileSync('find',[resolve('.agent/goals/2026-10-06-kilo-restate-daily-driver-v0/iterations/01/evidence/regression'),'-name','acceptance-matrix.json'],{encoding:'utf8'}).trim().split('\n');
  const regression = JSON.parse(await readFile(matrices.at(-1)!,'utf8'));
  check('D01',regression.checks.every((r:any)=>r.STATUS==='PASS'),{matrix:matrices.at(-1),checks:regression.checks.length});
  check('D10',regression.checks.filter((r:any)=>r.CHECK_ID.startsWith('F')).every((r:any)=>r.STATUS==='PASS'),{regression:'F01-F04'});
  assert(checks[0].status==='PASS','deterministic regression prerequisite');
  if (!before.Running) { execFileSync('podman',['start',container]); started=true; }
  for(let i=0;i<40;i++){try{if((await fetch(admin+'/deployments')).ok)break;}catch{} await wait(250);}
  service=spawn(process.execPath,['--import','tsx','operational-node/restate/service.ts'],{cwd:repo,env:{...process.env,PORT:'19084',KILO_WORKSPACE_ROOT:root,KILO_PI_SESSION_ROOT:join(root,'sessions'),KILO_PI_TURN_TIMEOUT_MS:'120000',KILO_GATE_TIMEOUT_MS:'120000',KILO_ALLOW_TEST_EXTENSION:'0'},stdio:['ignore','pipe','pipe']});
  const logs:string[]=[]; service.stdout?.on('data',b=>logs.push(b.toString())); service.stderr?.on('data',b=>logs.push(b.toString()));
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:19084/discover')).ok)break;}catch{} await wait(250);}
  const registration=await fetch(admin+'/deployments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uri:'http://host.containers.internal:19084',force:true})});
  const reg:any=await registration.json(); await save('registration.json',{status:registration.status,...reg}); assert(registration.ok,'service registration'); deployment=reg.id;
  await writeFile(join(workspace,'TASK.md'),'Implement slugify(value): lowercase ASCII letters/digits, replace any run of other characters with one hyphen, trim edge hyphens. Export from solution.js as named slugify. Handle empty input. Do not add dependencies.\n');
  await writeFile(join(workspace,'test.mjs'),"import assert from 'node:assert/strict'; import {slugify} from './solution.js'; assert.equal(slugify(' Hello, WORLD! '),'hello-world'); assert.equal(slugify('a---b'),'a-b'); assert.equal(slugify(''), ''); assert.equal(slugify(' -- '),''); assert.equal(slugify(' A_12/B '),'a-12-b'); console.log('SPECIMEN_PASS');\n");
  await writeFile(join(workspace,'package.json'),'{"type":"module"}\n');
  const skill=join(root,'SKILL.md'), extension=join(root,'receipt-extension.ts');
  await writeFile(skill,'---\nname: daily-driver-specimen\ndescription: Bounded daily-driver coding specimen instructions\n---\nImplement only TASK.md in the safe workspace. No delegation.\n');
  await writeFile(extension,"export default function(pi) { pi.registerCommand('daily-driver-loaded', {description:'Native extension load receipt', handler:async()=>{}}); }\n");
  const contract=join(root,'contract.json');
  await writeFile(contract,JSON.stringify({workspace,provider:process.env.PI_PROVIDER??'openai-codex',model:process.env.PI_MODEL??'gpt-6.1-sol',pi:{agentDir:'/home/miles/repos/runtime/.pi/agent',skills:[skill],extensions:[extension],thinking:'low'},workContract:{GOAL:'Daily Driver V0 bounded coding task',WORK:'Read TASK.md and test.mjs, implement solution.js, run node test.mjs. Use only read/write/edit/bash. Do not delegate or change configuration. Return the required structured report after the test passes.',WORKING_AREA:workspace}}));
  const cli=execFileSync(process.execPath,['--import','tsx','operational-node/cli.ts','start',contract],{cwd:repo,encoding:'utf8',timeout:15000}); const submitted=JSON.parse(cli); operationId=submitted.operationId;
  await save('start.json',submitted); check('D02',Boolean(submitted.invocationId),{command:'node --import tsx operational-node/cli.ts start contract.json',response:submitted}); check('D03',typeof operationId==='string',submitted);
  const decided=new Set<string>(); let steered=false; let status:any;
  const deadline=Date.now()+155000;
  while(Date.now()<deadline){
    status=await command(['status',operationId!]);
    for(const e of status.events??[]){
      if(e.type!=='gate_pending'||decided.has(e.payload?.gateId))continue;
      if(!steered){const s=await command(['steer',operationId!,'Complete only the bounded slugify task; retain the structured report.']);await save('steer.json',s);check('D09',(s as any).status==='queued',s);steered=true;}
      const tool=e.payload?.toolName, input=e.payload?.input??{};
      const allowed=['read','write','edit'].includes(tool) ? typeof input.path==='string' && ['TASK.md','test.mjs','solution.js','package.json'].some(p=>input.path===p||input.path===join(workspace,p)) : tool==='bash' && input.command==='node test.mjs';
      await command([allowed?'allow':'deny',operationId!,e.toolCallId]);decided.add(e.payload.gateId);
    }
    if(['completed','failed','cancelled'].includes(status.status))break;
    await wait(250);
  }
  await save('status.json',status);
  if (!['completed','failed','cancelled'].includes(status?.status)) throw new Error('bounded real specimen deadline reached');
  const result:any=await command(['result',operationId!]); await save('result.json',result);
  const events=status.events??[], config=events.find((e:any)=>e.type==='pi_configuration')?.payload;
  check('D04',config?.model?.id===(process.env.PI_MODEL??'gpt-6.1-sol') && config?.thinkingLevel==='low',config??{reason:'native Pi configuration not observed'});
  check('D05',config?.commands?.some((c:any)=>c.name==='daily-driver-loaded') && config?.commands?.some((c:any)=>c.name.includes('daily-driver-specimen')),config??{reason:'resource receipt absent'});
  check('D06',status.operationId===operationId && events.length>0,{state:status.status,events:events.length,sessionId:status.identity?.sessionId});
  const text=await readFile(join(workspace,'solution.js'),'utf8').catch(()=>null);
  const success=text!==null && result.status==='completed' && result.workReport?.RESULT==='ACHIEVED';
  check('D07',success,{status:result.status,model:config?.model,workReport:result.workReport,reportError:result.reportError});
  check('D08',events.some((e:any)=>e.type==='gate_allowed') && events.some((e:any)=>e.type==='effect_completed'),{gates:events.filter((e:any)=>e.type==='gate_allowed').length,effects:events.filter((e:any)=>e.type==='effect_completed').length});
  check('D10',regression.checks.filter((r:any)=>r.CHECK_ID.startsWith('F')).every((r:any)=>r.STATUS==='PASS'),{regression:'F01-F04'});
  const settled=events.findIndex((e:any)=>e.type==='agent_settled'), terminal=events.findIndex((e:any)=>e.type==='operation_settled');
  check('D11',settled>=0&&terminal>settled&&result.piSettlement==='agent_settled',{settled,terminal,piSettlement:result.piSettlement});
  check('D12',Boolean(result.workReport)&&result.identity?.operationId===operationId,{workReport:result.workReport,reportError:result.reportError});
  if (steered && result.identity?.sessionFile) {
    const transcript = await readFile(result.identity.sessionFile, 'utf8');
    const delivered = transcript.split('\n').some(line => {
      try { const row = JSON.parse(line); return row.message?.role === 'user' && JSON.stringify(row.message.content).includes('Complete only the bounded slugify task'); } catch { return false; }
    });
    check('D09',delivered,{rpcQueued:true,transcriptContainsSteer:delivered});
  }
  const sql=await fetch(admin+'/query',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({query:`SELECT id, index, entry_type, name FROM sys_journal WHERE id = '${submitted.invocationId}' ORDER BY index`})});await save('journal.json',await sql.json());
  await save('service-log.json',logs);
} catch(error){await save('failure.json',{error:String(error)});}
finally {
  if(operationId){try{
    let status:any=await command(['status',operationId]);
    if(status.status==='running') {
      await command(['cancel',operationId]);
      for(let i=0;i<40&&status.status==='running';i++){await wait(250);status=await command(['status',operationId]);}
      await save('cancel-cleanup.json',status);
    }
  }catch(error){await save('cancel-cleanup-error.json',{error:String(error)});}}
  let deleted=false; if(deployment){const r=await fetch(admin+'/deployments/'+deployment+'?force=true',{method:'DELETE'});await save('deployment-delete.json',{status:r.status}); const list:any=await (await fetch(admin+'/deployments')).json(); deleted=r.ok&&!list.deployments?.some((d:any)=>d.id===deployment); await save('deployments-after.json',list);}
  if(service&&service.exitCode===null&&service.signalCode===null){const end=once(service,'exit');service.kill('SIGTERM');await Promise.race([end,wait(3000)]);if(service.exitCode===null&&service.signalCode===null){service.kill('SIGKILL');await Promise.race([once(service,'exit'),wait(2000)]);}}
  if(started)execFileSync('podman',['stop',container]);
  const after=JSON.parse(execFileSync('podman',['inspect','--format','{{json .State}}',container],{encoding:'utf8'}));await save('container-after.json',after);
  check('D13',Boolean(deleted&&service&&(service.exitCode!==null||service.signalCode!==null)&&before.Running===after.Running),{deleted,serviceExit:service?.exitCode,serviceSignal:service?.signalCode,beforeRunning:before.Running,afterRunning:after.Running});
  await save('acceptance-matrix.json',{checks,operationId,root,result:checks.every(c=>c.status==='PASS')?'ACHIEVED':'PARTIAL'});
  console.log(JSON.stringify({root,operationId,checks},null,2));process.exitCode=checks.every(c=>c.status==='PASS')?0:1;
}
