import assert from 'node:assert/strict';
const module=await import('../control-policy.ts').catch(()=>undefined);assert(module,'control boundary/selector must exist');
const {authorize,selectNode,validateAddress}=module;
const address={workspace:'/safe/work',responsibility:'proof',role:'worker',instance:'alpha'};
validateAddress(address);
const reader={identity:'reader',token:'not-printed',capabilities:['VIEW','ATTACH'],workspaces:['/safe/work']};
authorize(reader,'ATTACH','/safe/work');
for(const action of ['CANCEL','STEER','DEBUG','INSPECT','LAUNCH'])assert.throws(()=>authorize(reader,action,'/safe/work'),/permission/);
assert.throws(()=>authorize(reader,'VIEW','/else'),/permission/);
assert.throws(()=>validateAddress({...address,instance:''}));
const nodes=[{operationId:'machine-one',address},{operationId:'machine-two',address:{...address,instance:'beta'}}];
assert.equal(selectNode(nodes,address).operationId,'machine-one');
assert.throws(()=>selectNode(nodes,{...address,instance:undefined}),/ambiguous/);
assert.throws(()=>selectNode(nodes,{...address,responsibility:'none'}),/no matches/);
const {renderLive}=await import('../control-cli.ts');let captured='';const old=process.stdout.write;
process.stdout.write=((value:any)=>{captured+=String(value);return true;}) as any;
try{renderLive({kind:'pi',event:{type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:'visible thinking'}}});renderLive({kind:'catch-up',address,state:{status:'running'},messages:[{role:'assistant',content:[{type:'toolCall',name:'read',arguments:{path:'probe.txt'}}]}]});}finally{process.stdout.write=old;}
assert(captured.includes('visible thinking'));assert(captured.includes('tool catch-up'));
console.log('control capability boundary, semantic resolution and terminal projection: PASS');
