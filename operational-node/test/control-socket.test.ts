import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {spawnSync} from 'node:child_process';
import {prepareControlSocket} from '../control.ts';
const root=await mkdtemp(join(tmpdir(),'kilo-socket-'));const path=join(root,'control.sock');
try{
 await prepareControlSocket(path);
 await writeFile(path,'not a socket');await assert.rejects(prepareControlSocket(path),/non-owned/);await rm(path);
 const s=createServer(c=>c.end());await new Promise<void>(r=>s.listen(path,r));await assert.rejects(prepareControlSocket(path),/live owner/);assert.ok((await stat(path)).isSocket());await new Promise<void>(r=>s.close(()=>r()));
 assert.equal(spawnSync('python3',['-c','import socket,sys;s=socket.socket(socket.AF_UNIX);s.bind(sys.argv[1]);s.close()',path]).status,0);
 await prepareControlSocket(path);await assert.rejects(stat(path),/ENOENT/);console.log('Control absent/stale socket recovery and live/non-socket refusal: PASS');
}finally{await rm(root,{recursive:true,force:true});}
