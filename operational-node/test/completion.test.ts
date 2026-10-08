import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {factorySpec} from '../factory.ts';
import {validateOperationalProfile,submitReport,machineReport,reportErrors,type CompletionState} from '../operational-profile.ts';
import {Completion,OperationWorkflow} from '../restate/service.ts';
const report={GOAL:'Probe',RESULT:'ACHIEVED',GAP:'','AGENT WORK':'Checked','ROOT CAUSE':'','NEXT PROMPT':''};
const state=():CompletionState=>({sessionId:'s',token:'secret',maximum:3,count:0,submissions:{}});
const request=(id:string,r:unknown=report)=>({sessionId:'s',token:'secret',submissionId:id,report:r});
let s=state();const good=submitReport(s,request('call|id'));assert.equal(good.status,'completed');assert.deepEqual(submitReport(s,request('call|id')),good);assert.equal(s.count,1);assert.throws(()=>submitReport(s,request('next')),/terminal/);assert.throws(()=>submitReport(s,{...request('call|id'),report:{}}),/reused/);
s=state();let bad=submitReport(s,request('a',{}));assert.equal(bad.remaining,2);assert.deepEqual(bad.report,{});assert.ok(bad.errors.includes('GOAL must be a string'));assert.equal(submitReport(s,request('b')).status,'completed');assert.equal(s.count,2);
s=state();for(let i=1;i<=3;i++){bad=submitReport(s,request(String(i),{}));assert.equal(bad.remaining,3-i);assert.equal(bad.terminal,i===3);}assert.equal(bad.status,'failed');assert.match(bad.failure!,/exhausted/);
for(const result of ['PARTIAL','BLOCKED']){s=state();assert.equal(submitReport(s,request('x',{...report,RESULT:result})).status,'failed');assert.equal(s.count,1);}
s=state();assert.throws(()=>submitReport(s,{...request('x'),token:'foreign'}),/denied/);assert.throws(()=>submitReport(s,{...request('x'),sessionId:'other-operation-session'}),/denied/);assert.equal(s.count,0);assert.throws(()=>submitReport(s,request('__proto__')),/invalid/);
assert.equal(submitReport(state(),request('x'),['acceptance missing: required file']).terminal,false);
for(const failure of ['Actor disappeared without submit_completion','Completion timeout']){const r=machineReport('Probe',failure);assert.deepEqual(reportErrors(r),[]);assert.equal(r.RESULT,'BLOCKED');assert.equal(r['ROOT CAUSE'],failure);}
const root=await mkdtemp(join(tmpdir(),'kilo-completion-tests-'));const old=process.env.KILO_OPERATIONAL_PROFILES;
try{
 const profile=validateOperationalProfile({name:'test-v1',version:1,ingress:{tools:['read']},pi:{provider:'faux',model:'faux-1',settings:{agentDir:root}},egress:{checks:[{path:'proof.txt',contains:'PASS'}]},return:'cli-and-control'});
 assert.equal(profile.egress.maxSubmissions,3);assert.throws(()=>validateOperationalProfile({...profile,ingress:{tools:['unauthorized']}}));assert.throws(()=>validateOperationalProfile({...profile,egress:{checks:[{path:'../outside'}]}}));
 await writeFile(join(root,'test-v1.json'),JSON.stringify(profile));process.env.KILO_OPERATIONAL_PROFILES=root;
 const base={SUBJECT:'test',SUBJECT_ROOT:root,WORKSPACE:root,GOAL_ID:'probe',ITERATION:1,GOAL:'Probe',WORK:'Read only',AUTHORITY:{policy:'factory-dev-v0',workspace:root},provider:'faux',model:'faux-1'};
 const legacy=await factorySpec(base);assert.equal(legacy.workContract.OPERATIONAL_PROFILE,undefined);
 const selected=await factorySpec({...base,PROFILE:'test-v1'});assert.deepEqual(selected.workContract.OPERATIONAL_PROFILE,profile);assert.equal(selected.operationId,legacy.operationId);
 await writeFile(join(root,'test-v1.json'),JSON.stringify({...profile,version:2}));assert.equal(selected.workContract.OPERATIONAL_PROFILE.version,1);
 await assert.rejects(factorySpec({...base,PROFILE:'../escape'}));await assert.rejects(factorySpec({...base,PROFILE:'test-v1',model:'different'}));
 // Execute the actual Restate handler functions against a bounded in-memory context.
 // This proves handler wiring/validation; it is not a live durability claim.
 let stored:any=null;let active=true;const signals:any[]=[];
 const operationState={status:'running',identity:{sessionId:'s'},completionToken:'secret',effectiveProfile:profile,factoryWorkspace:root,invocationId:'inv_1ffxJBEfOQ6i1NbNdC6oo43C4MrJUQrA0b'};
 const workflow=(OperationWorkflow as any).workflow;
 const scope=(req:any)=>workflow.completionScope({get:async()=>({...operationState,status:active?'running':'failed'})},req);
 const ctx:any={key:'test-operation',get:async()=>structuredClone(stored),set:(_k:string,v:any)=>{stored=structuredClone(v)},workflowClient:()=>({completionScope:scope}),run:(_name:string,fn:any)=>fn(),invocation:()=>({signal:()=>({resolve:(v:any)=>signals.push(v)})})};
 const submit=(req:any)=>(Completion as any).object.submit(ctx,req);
 await assert.rejects(submit({...request('foreign'),token:'wrong'}),/denied/);assert.equal(stored,null);
 const rejected=await submit(request('missing-file'));assert.match(rejected.errors.join(';'),/acceptance proof.txt/);assert.equal(rejected.remaining,2);assert.equal(signals.length,0);
 await writeFile(join(root,'proof.txt'),'PASS');const accepted=await submit(request('corrected'));assert.equal(accepted.status,'completed');assert.equal(signals.length,1);active=false;
 assert.deepEqual(await submit(request('corrected')),accepted);assert.equal(signals.length,1);await assert.rejects(submit(request('later')),/not active/);
 assert.equal((await (Completion as any).object.terminal(ctx)).status,'completed');
 for(const failure of ['Actor disappeared without submit_completion','Completion timeout']){stored=null;active=true;const closed=await (Completion as any).object.close(ctx,{sessionId:'s',token:'secret',failure});assert.equal(closed.status,'failed');assert.equal(closed.failure,failure);await assert.rejects(submit(request('late')),/terminal/);assert.equal(stored.count,0);}
 await assert.rejects((Completion as any).object.close(ctx,{sessionId:'other',token:'secret',failure:'Actor died'}),/denied/);
 console.log('profile compatibility/snapshot, same-session completion, exact errors, limits, acceptance, partial, duplicate and foreign capability: PASS');
 console.log('actor-death/timeout durable-handler closure and machine report: PASS (mock context; physical lifecycle NOT exercised)');
}finally{if(old===undefined)delete process.env.KILO_OPERATIONAL_PROFILES;else process.env.KILO_OPERATIONAL_PROFILES=old;await rm(root,{recursive:true,force:true});}
