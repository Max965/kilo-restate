import assert from 'node:assert/strict';
import {recentMessages} from '../control-policy.ts';
const messages=Array.from({length:100},(_,i)=>({role:'assistant',content:[{type:'text',text:i+':'+ 'x'.repeat(10000)}]}));
assert(recentMessages([{role:'user',content:'x'.repeat(10000)}])[0].content[0].text.length===400);
const summary=recentMessages(messages);assert.equal(summary.length,3);assert(JSON.stringify(summary).length<1600);assert(summary[0].content[0].text.startsWith('97:'));assert.equal(messages.length,100);
console.log('bounded native catch-up, including native string user content: PASS');
