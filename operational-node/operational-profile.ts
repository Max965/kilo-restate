import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePiConfiguration,type PiConfiguration,type WorkReport} from './daily-driver.ts';
export interface OperationalProfile {
 name:string; version:number;
 ingress:{maxGoalCharacters:number;maxWorkCharacters:number;tools:string[]};
 pi:{provider:string;model:string;settings:PiConfiguration};
 egress:{maxSubmissions:number;timeoutMs:number;checks:Array<{path:string;contains?:string}>};
 return:'cli-and-control';
}
export function validateOperationalProfile(raw:any):OperationalProfile {
 const exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
 if(!exact(raw,['name','version','ingress','pi','egress','return'])||!/^[-a-z0-9]{1,64}$/.test(raw.name)||!Number.isInteger(raw.version)||raw.version<1)throw Error('invalid profile name/version');
 const p=structuredClone(raw);p.ingress??={};p.egress??={};
 if(!exact(p.ingress,['maxGoalCharacters','maxWorkCharacters','tools'])||!exact(p.pi,['provider','model','settings'])||!exact(p.egress,['maxSubmissions','timeoutMs','checks'])||p.return!=='cli-and-control')throw Error('invalid profile sections/return');
 p.ingress.maxGoalCharacters??=6000;p.ingress.maxWorkCharacters??=6000;p.ingress.tools??=['read','write','edit','bash'];
 for(const k of ['maxGoalCharacters','maxWorkCharacters'])if(!Number.isInteger(p.ingress[k])||p.ingress[k]<1||p.ingress[k]>6000)throw Error('invalid ingress limit');
 if(!Array.isArray(p.ingress.tools)||!p.ingress.tools.length||new Set(p.ingress.tools).size!==p.ingress.tools.length||p.ingress.tools.some((t:string)=>!['read','write','edit','bash'].includes(t)))throw Error('invalid profile tools');
 if(typeof p.pi.provider!=='string'||!p.pi.provider||typeof p.pi.model!=='string'||!p.pi.model)throw Error('profile provider/model required');p.pi.settings=validatePiConfiguration(p.pi.settings??{});if(!p.pi.settings.agentDir)throw Error('profile requires an explicit native agentDir');p.pi.settings.thinking??='low';
 p.egress.maxSubmissions??=3;p.egress.timeoutMs??=900000;p.egress.checks??=[];
 if(!Number.isInteger(p.egress.maxSubmissions)||p.egress.maxSubmissions<1||p.egress.maxSubmissions>10||!Number.isInteger(p.egress.timeoutMs)||p.egress.timeoutMs<1000||p.egress.timeoutMs>900000)throw Error('invalid completion limits');
 if(!Array.isArray(p.egress.checks)||p.egress.checks.length>16||p.egress.checks.some((c:any)=>!exact(c,['path','contains'])||typeof c.path!=='string'||!c.path||c.path.length>1024||c.path.startsWith('/')||c.path.split(/[\\/]/).includes('..')||c.contains!==undefined&&(typeof c.contains!=='string'||c.contains.length>4096)))throw Error('invalid bounded acceptance checks');
 return p;
}
export async function resolveOperationalProfile(name:unknown):Promise<OperationalProfile>{
 if(typeof name!=='string'||!/^[-a-z0-9]{1,64}$/.test(name))throw Error('invalid profile reference');
 const root=process.env.KILO_OPERATIONAL_PROFILES??resolve(dirname(fileURLToPath(import.meta.url)),'profiles');
 const p=validateOperationalProfile(JSON.parse(await readFile(resolve(root,name+'.json'),'utf8')));if(p.name!==name)throw Error('profile name mismatch');return p;
}
export function reportErrors(value:any):string[]{
 if(!value||typeof value!=='object'||Array.isArray(value))return ['report must be an object'];
 const fields=['GOAL','RESULT','GAP','AGENT WORK','ROOT CAUSE','NEXT PROMPT'];const errors=fields.filter(k=>typeof value[k]!=='string').map(k=>k+' must be a string');
 for(const k of Object.keys(value))if(!fields.includes(k))errors.push('unknown field: '+k);
 if(!['ACHIEVED','PARTIAL','BLOCKED'].includes(value.RESULT))errors.push('RESULT must be ACHIEVED, PARTIAL or BLOCKED');
 for(const k of fields)if(typeof value[k]==='string'&&value[k].length>16000)errors.push(k+' exceeds 16000 characters');return errors;
}
export function machineReport(goal:string,failure:string):WorkReport{return {GOAL:goal,RESULT:'BLOCKED',GAP:failure,'AGENT WORK':'Machine-owned terminal result','ROOT CAUSE':failure,'NEXT PROMPT':''};}
export interface CompletionReply{report:unknown;errors:string[];remaining:number;terminal:boolean;status?:'completed'|'failed';failure?:string;acceptance?:{configured:number;evaluated:boolean;errors:string[]};}
export interface CompletionState{sessionId:string;token:string;maximum:number;submissions:Record<string,{fingerprint:string;reply:CompletionReply}>;count:number;terminal?:CompletionReply;}
export function submitReport(s:CompletionState,request:{sessionId:string;token:string;submissionId:string;report:unknown},acceptanceErrors:string[]=[]):CompletionReply{
 if(request.sessionId!==s.sessionId||request.token!==s.token)throw Error('completion capability denied');
 if(typeof request.submissionId!=='string'||!/^[A-Za-z0-9_.:|\-]{1,256}$/.test(request.submissionId)||['__proto__','constructor','prototype'].includes(request.submissionId))throw Error('invalid submission id');
 const fingerprint=JSON.stringify(request.report);const prior=Object.hasOwn(s.submissions,request.submissionId)?s.submissions[request.submissionId]:undefined;if(prior){if(prior.fingerprint!==fingerprint)throw Error('submission id reused with different report');return prior.reply;}
 if(s.terminal)throw Error('completion already terminal');
 const errors=[...reportErrors(request.report),...acceptanceErrors];s.count++;
 const reply:CompletionReply={report:request.report,errors,remaining:s.maximum-s.count,terminal:errors.length===0||s.count>=s.maximum};
 if(reply.terminal){reply.status=!errors.length&&(request.report as WorkReport).RESULT==='ACHIEVED'?'completed':'failed';if(reply.status==='failed')reply.failure=errors.length?'Completion submissions exhausted: '+errors.join('; '):'WorkReport RESULT: '+(request.report as WorkReport).RESULT;s.terminal=reply;}
 s.submissions[request.submissionId]={fingerprint,reply};return reply;
}
