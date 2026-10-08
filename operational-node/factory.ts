import {createHash} from 'node:crypto';
import {realpath} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {validatePiConfiguration} from './daily-driver.ts';
import {resolveOperationalProfile} from './operational-profile.ts';
export async function factorySpec(p:any){
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['SUBJECT','SUBJECT_ROOT','GOAL_ID','ITERATION','GOAL','WORK','WORKSPACE','AUTHORITY','provider','model','pi','REALIZATION','PROFILE'].includes(k)))throw Error('unsupported Factory work-package fields');
 const effectiveProfile=p.PROFILE===undefined?undefined:await resolveOperationalProfile(p.PROFILE);
 if(effectiveProfile){for(const k of ['provider','model'])if(p[k]!==undefined&&p[k]!==effectiveProfile.pi[k as 'provider'|'model'])throw Error('explicit '+k+' conflicts with profile');if(p.pi!==undefined&&JSON.stringify(p.pi)!==JSON.stringify(effectiveProfile.pi.settings))throw Error('explicit pi conflicts with profile');p={...p,provider:effectiveProfile.pi.provider,model:effectiveProfile.pi.model,pi:effectiveProfile.pi.settings};if(p.GOAL?.length>effectiveProfile.ingress.maxGoalCharacters||p.WORK?.length>effectiveProfile.ingress.maxWorkCharacters)throw Error('profile ingress limit exceeded');}
 const realization=p.REALIZATION??'HEADLESS';if(!['HEADLESS','INTERACTIVE_DEBUG'].includes(realization))throw Error('REALIZATION must be HEADLESS or INTERACTIVE_DEBUG');
 for(const k of ['SUBJECT','GOAL_ID'])if(typeof p[k]!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(p[k]))throw Error(k+' must be a stable safe identifier');
 for(const k of ['GOAL','WORK'])if(typeof p[k]!=='string'||!p[k].trim()||p[k].length>6000)throw Error(k+' required (max6000 characters)');
 if(!/^\d{1,4}$/.test(String(p.ITERATION))||Number(p.ITERATION)<1)throw Error('positive Factory ITERATION required');
 for(const k of ['SUBJECT_ROOT','WORKSPACE'])if(typeof p[k]!=='string'||!isAbsolute(p[k]))throw Error(k+' must be absolute');
 const root=await realpath(p.SUBJECT_ROOT),workspace=await realpath(p.WORKSPACE),iteration=String(Number(p.ITERATION)).padStart(2,'0');
 if(!p.AUTHORITY||p.AUTHORITY.policy!=='factory-dev-v0'||typeof p.AUTHORITY.workspace!=='string'||await realpath(p.AUTHORITY.workspace)!==workspace)throw Error('explicit matching factory-dev-v0 workspace authority required');
 const identity={SUBJECT:p.SUBJECT,SUBJECT_ROOT:root,GOAL_ID:p.GOAL_ID,ITERATION:iteration};
 const operationId='factory-'+createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0,40);
 const workContract={GOAL:p.GOAL,WORK:p.WORK,WORKING_AREA:workspace,FACTORY_IDENTITY:identity,FACTORY_DEV_POLICY:'factory-dev-v0',...(effectiveProfile?{OPERATIONAL_PROFILE:effectiveProfile}:{}),AUTHORITY:'Same-host DEV native workspace files and bounded bash; not an OS/network sandbox. Return the required WorkReport after deterministic verification.',...(realization==='INTERACTIVE_DEBUG'?{REALIZATION:realization}:{})};
 return {operationId,workspace,provider:p.provider,model:p.model,pi:validatePiConfiguration(p.pi??{}),controlAddress:{workspace,responsibility:p.GOAL_ID,role:'factory',instance:'iteration-'+iteration},workContract};
}
export function factoryAdmissionHash(request:any){
 const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 return createHash('sha256').update(JSON.stringify(canonical([request.workspace,request.provider,request.model,request.pi??{},request.workContract,request.controlAddress]))).digest('hex');
}
