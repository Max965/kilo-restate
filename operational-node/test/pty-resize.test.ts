import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import type {Writable} from 'node:stream';
const child=spawn('python3',['-B','operational-node/drivers/pi/pty-bridge.py',process.execPath,'-e',`setTimeout(()=>{console.log('SIZE:'+process.stdout.rows+':'+process.stdout.columns);},100);process.stdout.on('resize',()=>{console.log('RESIZED:'+process.stdout.rows+':'+process.stdout.columns);process.exit(0)});setInterval(()=>{},1000)`],{stdio:['pipe','pipe','pipe','pipe']});
const resize=child.stdio[3] as Writable;resize.write('{"rows":50,"columns":160}\n');
let output='';const timer=setTimeout(()=>child.kill(),5000);
child.stdout!.on('data',b=>{output+=b;if(output.includes('SIZE:50:160'))resize.write('{"rows":65,"columns":190}\n');});
const code=await new Promise<number|null>(r=>child.once('close',r));clearTimeout(timer);
assert.equal(code,0,output);assert.match(output,/SIZE:50:160/);assert.match(output,/RESIZED:65:190/);console.log('native PTY startup/resize: PASS');
