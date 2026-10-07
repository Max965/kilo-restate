import {request} from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function controlCall(body:unknown,stream=false,onEvent?:(value:any)=>void){
 const socketPath=process.env.KILO_CONTROL_SOCKET,tokenFile=process.env.KILO_CONTROL_TOKEN_FILE;
 if(!socketPath||!tokenFile||(await stat(tokenFile)).mode&0o077)throw Error('private control socket/token file required');const token=(await readFile(tokenFile,'utf8')).trim();
 return new Promise<any>((yes,no)=>{
  const req=request({socketPath,path:stream?'/events':'/command',method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'}},res=>{
   let data='';res.setEncoding('utf8');res.on('data',chunk=>{data+=chunk;if(stream&&res.statusCode===200){let i;while((i=data.indexOf('\n\n'))>=0){const line=data.slice(0,i);data=data.slice(i+2);if(line.startsWith('data: '))onEvent?.(JSON.parse(line.slice(6)));}}});res.on('error',no);res.on('end',()=>{if(res.statusCode!==200){const e=new Error(data);Object.assign(e,{status:res.statusCode});no(e);}else yes(stream?{status:'disconnected'}:JSON.parse(data));});
   if(stream){const detach=()=>{res.destroy();yes({status:'detached'});};process.once('SIGINT',detach);res.once('close',()=>process.off('SIGINT',detach));}
  });req.on('error',no);req.end(JSON.stringify(body));
 });
}
export function renderLive(e:any){
 if(e.kind==='viewer-ready'||e.kind==='admitted'){console.log(`[${e.kind}] ${e.address.responsibility}/${e.address.role}/${e.address.instance}`);return;}
 const clean=(s:unknown)=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'');
 if(e.kind==='catch-up'){console.log(`[catch-up ${e.address.responsibility}/${e.address.role}/${e.address.instance}] ${e.state?.status??e.status}${e.historyCount===undefined?'':` — recent3 of ${e.historyCount} messages; --history for full transcript`}`);if(e.recentEvents?.length)console.log('[recent state] '+e.recentEvents.join(', '));for(const m of e.messages??[])for(const c of m.content??[])if(c.type==='text'||c.type==='thinking')console.log(`[${m.role}/${c.type}] ${clean(c.text??c.thinking)}`);else if(c.type==='toolCall')console.log(`[tool catch-up] ${clean(c.name)} ${clean(JSON.stringify(c.arguments))}`);return;}
 if(e.kind==='debug'){console.log('[debug] '+JSON.stringify(e.event));return;}
 if(e.kind==='annotation'){console.log('[kilo] '+JSON.stringify(e.event));return;}
 if(e.kind==='settlement'){console.log('[node] '+(e.state?.status??e.status));return;}
 const v=e.event??{},delta=v.assistantMessageEvent;
 if(v.type==='message_update'){
  if(['text_start','thinking_start'].includes(delta?.type))console.log(`\n[${delta.type==='thinking_start'?'thinking':'assistant'}]`);
  if(['text_delta','thinking_delta'].includes(delta?.type)&&typeof delta.delta==='string')process.stdout.write(clean(delta.delta));
  if(delta?.type==='toolcall_end')console.log('\n[tool request] '+clean(JSON.stringify(delta.toolCall)));
 }else if(v.type==='tool_execution_start')console.log('\n[tool executing] '+clean(v.toolName));
 else if(v.type==='tool_execution_end')console.log('\n[tool result] '+clean(JSON.stringify(v.result?.content??v.result)));
 else if(['turn_start','turn_end','agent_settled'].includes(v.type))console.log('\n[pi] '+v.type);
}
export async function controlCommand(args:string[]){
 const json=args.includes('--json'),history=args.includes('--history'),attach=args.includes('--attach');args=args.filter(x=>!['--json','--history','--attach'].includes(x));if(args[0]==='node')args.shift();const [action,name,...extra]=args;const workspace=await realpath(process.cwd());
 if(action==='launch'||action==='run'){if(!name||extra.length||(action==='run'&&!attach))throw Error('usage: node run --attach spec.json | node launch spec.json [--attach]');return controlCall({action:'LAUNCH',attach,spec:JSON.parse(await readFile(name,'utf8'))},attach,e=>json?console.log(JSON.stringify(e)):renderLive(e));}
 const parts=name?.split('/')??[];if(parts.length>3)throw Error('selector is responsibility/role/instance');const selector={workspace,...parts[0]?{responsibility:parts[0]}:{},...parts[1]?{role:parts[1]}:{},...parts[2]?{instance:parts[2]}:{}};
 const map:Record<string,string>={here:'VIEW',list:'VIEW',attach:'ATTACH',inspect:'INSPECT',debug:'DEBUG',steer:'STEER',cancel:'CANCEL'};if(!map[action])throw Error('usage: node here|list|attach|inspect|debug|steer|cancel|launch');
 if(['attach','debug'].includes(action))return controlCall({action:map[action],selector,history,layer:action==='debug'?extra[0]:undefined},true,e=>json?console.log(JSON.stringify(e)):renderLive(e));
 const response=await controlCall({action:map[action],selector,message:extra.join(' ')});
 if(!json&&map[action]==='VIEW'){for(const n of response.result)console.log(`${n.address.responsibility}/${n.address.role}/${n.address.instance} ${n.status}${n.live?' (live)':''}`);if(!response.result.length)console.log('no nodes in this workspace');return null;}
 return response;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const result=await controlCommand(process.argv.slice(2));if(result)console.log(JSON.stringify(result,null,2));}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}}
