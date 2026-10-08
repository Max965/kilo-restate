import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {factorySpec,factoryAdmissionHash} from '../factory.ts';
import {factoryDevPolicy} from '../restate/service.ts';
const home=await mkdtemp(join(tmpdir(),'factory-test-')),workspace=join(home,'work');await mkdir(workspace);await writeFile(join(workspace,'file'),'value');await writeFile(join(home,'outside'),'secret');await symlink(join(home,'outside'),join(workspace,'escape'));await symlink(join(home,'missing'),join(workspace,'dangling'));
try{
 const p={SUBJECT:'client',SUBJECT_ROOT:home,GOAL_ID:'repair',ITERATION:'01',GOAL:'Repair one test',WORK:'Fix test deterministically',WORKSPACE:workspace,AUTHORITY:{policy:'factory-dev-v0',workspace},provider:'faux',model:'faux-1'};
 const a=await factorySpec(p),b=await factorySpec({...p,ITERATION:1});assert.equal(a.operationId,b.operationId);assert.equal(factoryAdmissionHash(a),factoryAdmissionHash(b));assert.notEqual(factoryAdmissionHash(a),factoryAdmissionHash(await factorySpec({...p,WORK:'different'})));
 const interactive=await factorySpec({...p,REALIZATION:'INTERACTIVE_DEBUG'});assert.equal(interactive.operationId,a.operationId);assert.equal(interactive.workContract.REALIZATION,'INTERACTIVE_DEBUG');assert.notEqual(factoryAdmissionHash(interactive),factoryAdmissionHash(a));assert.equal('REALIZATION' in a.workContract,false);await assert.rejects(factorySpec({...p,REALIZATION:'TTY'}));
 await assert.rejects(factorySpec({...p,WORK:''}));await assert.rejects(factorySpec({...p,AUTHORITY:{policy:'other',workspace}}));
 for(const tool of ['read','edit'])assert.equal(await factoryDevPolicy(workspace,tool,{path:'file'}),'ALLOW');assert.equal(await factoryDevPolicy(workspace,'write',{path:'new',content:'value'}),'ALLOW');assert.equal(await factoryDevPolicy(workspace,'bash',{command:'node test.mjs',timeout:5}),'ALLOW');
 for(const path of ['../outside','escape','dangling','missing'])assert.equal(await factoryDevPolicy(workspace,'read',{path}),'DENY');assert.equal(await factoryDevPolicy(workspace,'write',{path:'dangling'}),'DENY');assert.equal(await factoryDevPolicy(workspace,'bash',{command:'pwd',cwd:home}),'DENY');assert.equal(await factoryDevPolicy(workspace,'unknown',{}),'DENY');assert.equal(await factoryDevPolicy(workspace,'bash',{command:'pwd',timeout:121}),'DENY');
 console.log('Factory identity/reconciliation fingerprint/DEV policy: PASS');
}finally{await rm(home,{recursive:true,force:true});}
