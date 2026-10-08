import assert from 'node:assert/strict';
import {projectTranscriptMessage,recentMessages} from '../control-policy.ts';
const messages=Array.from({length:100},(_,i)=>({role:'assistant',content:[{type:'text',text:i+':'+ 'x'.repeat(10000)}]}));
assert(recentMessages([{role:'user',content:'x'.repeat(10000)}])[0].content[0].text.length===400);
const summary=recentMessages(messages);assert.equal(summary.length,3);assert(JSON.stringify(summary).length<1600);assert(summary[0].content[0].text.startsWith('97:'));assert.equal(messages.length,100);
const projected=projectTranscriptMessage({role:'assistant',api:'provider',thinkingSignature:{encrypted_content:'must-not-leak'},content:[{type:'thinking',thinking:'bounded thought',thinkingSignature:'private-signature'},{type:'text',text:'public response',textSignature:'private-text-signature'}]});
assert.deepEqual(projected,{role:'assistant',content:[{type:'thinking',text:'bounded thought'},{type:'text',text:'public response'}]});
assert(!JSON.stringify(projected).includes('private'));
console.log('bounded native catch-up, including native string user content: PASS');
