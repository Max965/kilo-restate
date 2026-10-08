import { isAbsolute } from 'node:path';
export const capabilities=['VIEW','ATTACH','INSPECT','DEBUG','STEER','CANCEL','LAUNCH'] as const;
export type Capability=typeof capabilities[number];
export interface Address {workspace:string;responsibility:string;role:string;instance:string}
export type Selector={workspace:string;responsibility?:string;role?:string;instance?:string};
export interface Grant {identity:string;token:string;capabilities:Capability[];workspaces:string[]}
export class ControlError extends Error {constructor(public status:number,message:string){super(message);}}
export function validateAddress(value:unknown):asserts value is Address {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ControlError(400,'address required');
 const a=value as Address;
 if(Object.keys(a).some(k=>!['workspace','responsibility','role','instance'].includes(k))||typeof a.workspace!=='string'||!isAbsolute(a.workspace)||['responsibility','role','instance'].some(k=>typeof a[k as keyof Address]!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(a[k as keyof Address])))throw new ControlError(400,'address requires absolute workspace and responsibility/role/instance names');
}
export function recentMessages(messages:any[]){return messages.slice(-3).map(m=>({role:m.role,content:(Array.isArray(m.content)?m.content:[{type:'text',text:m.content??''}]).slice(-3).map((c:any)=>c.type==='toolCall'?{type:c.type,name:c.name,arguments:JSON.stringify(c.arguments).slice(0,300)}:{type:c.type,text:String(c.text??c.thinking??'').slice(0,400)})}));}
export function projectTranscriptMessage(message:any){return recentMessages([message])[0]??{role:'unknown',content:[]};}
export function authorize(g:Grant,action:Capability,workspace:string){if(!g.capabilities.includes(action)||!g.workspaces.includes(workspace))throw new ControlError(403,`permission denied: ${action}`);}
export function selectNode<T extends {address:Address}>(nodes:T[],s:Selector):T {
 const matches=nodes.filter(n=>['workspace','responsibility','role','instance'].every(k=>s[k as keyof Selector]===undefined||n.address[k as keyof Address]===s[k as keyof Selector]));
 if(!matches.length)throw new ControlError(404,'no matches');
 if(matches.length!==1)throw new ControlError(409,`ambiguous: ${matches.map(n=>`${n.address.responsibility}/${n.address.role}/${n.address.instance}`).join(', ')}`);
 return matches[0];
}
