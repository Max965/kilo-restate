import assert from 'node:assert/strict';
import {verifyWorkResult} from '../daily-driver.ts';
import {translateActorOutcome} from '../drivers/pi/driver.ts';
import type {OperationResult} from '../contract.ts';
const report={GOAL:'test',RESULT:'ACHIEVED',GAP:'','AGENT WORK':'done','ROOT CAUSE':'','NEXT PROMPT':''};
const result=(output:any,kind='normal'):OperationResult=>({status:'completed',identity:{operationId:'test',driverId:'pi',invocationId:'inv',sessionId:'sid',sessionFile:'/session'},piSettlement:'agent_settled',output,actorOutcome:{kind} as any});
assert.equal(verifyWorkResult(result(JSON.stringify(report)),{}).status,'completed');
for(const value of [null,undefined,'','prose','{}',JSON.stringify({...report,RESULT:'PASS'}),JSON.stringify({...report,RESULT:'PARTIAL'}),JSON.stringify({...report,RESULT:'BLOCKED'})]){const r=verifyWorkResult(result(value),{});assert.equal(r.status,'failed');assert.equal(r.piSettlement,'agent_settled');assert(r.failure);}
for(const kind of ['error','truncated','unknown','aborted'])assert.equal(verifyWorkResult(result(JSON.stringify(report),kind),{}).status,'failed');
assert.equal(verifyWorkResult(result(null),undefined).status,'completed','uncontracted policy unchanged');
assert.equal(translateActorOutcome([{type:'message_end',message:{role:'assistant',stopReason:'length'}}]).kind,'truncated');
assert.equal(translateActorOutcome([{type:'message_end',message:{role:'assistant',stopReason:'error',errorMessage:'503 unavailable'}}]).detail,'503 unavailable');
assert.equal(translateActorOutcome([{type:'message_end',message:{role:'assistant',stopReason:'error'}},{type:'message_end',message:{role:'assistant',stopReason:'stop'}}]).kind,'normal','recovered errors do not override final success');
assert.equal(translateActorOutcome([]).kind,'unknown');
console.log('actor settlement != contracted success: PASS');
