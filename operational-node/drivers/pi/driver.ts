import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readdir, readFile, writeFile, symlink, copyFile } from "node:fs/promises";
import { homedir } from 'node:os';
import { reportInstruction, validatePiConfiguration } from '../../daily-driver.ts';
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ActorOutcome, OperationEvent, OperationRequest } from "../../contract.ts";
import { createOperationEventSink } from "../../restate/events.ts";
import { publishLive, liveOwners } from '../../control-live.ts';

interface RpcState {
  sessionId: string;
  sessionFile?: string;
  model?: { provider: string; id: string };
  thinkingLevel?: string;
}

interface RpcEvent {
  type: string;
  [key: string]: unknown;
}

interface RpcClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  abort(): Promise<void>;
  steer(message: string): Promise<unknown>;
  onEvent(listener: (event: RpcEvent) => void): () => void;
  getState(): Promise<RpcState>;
  getCommands(): Promise<Array<{ name: string; source: string }>>;
  setModel(provider: string, modelId: string): Promise<unknown>;
  setThinkingLevel(level: string): Promise<void>;
  getLastAssistantText(): Promise<string | null>;
  promptAndWait(message: string, images?: unknown[], timeout?: number): Promise<RpcEvent[]>;
  getStderr(): string;
}

interface RpcClientConstructor {
  new (options: {
    cliPath: string;
    cwd: string;
    env: Record<string, string>;
    args: string[];
  }): RpcClient;
}

export interface PiDriverInput extends OperationRequest {
  invocationId: string;
  sessionId: string;
  sessionDir: string;
  completionToken?: string;
}

export interface PiDriverResult {
  sessionId: string;
  sessionFile: string;
  lastAssistantText: string | null;
  eventTypes: string[];
  settlement: "agent_settled" | "aborted";
  actorOutcome: ActorOutcome;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
// Same-host live RPC control only; Restate remains operation/terminal-state owner.
interface PiControl { steer(message:string):Promise<unknown>; input?(data:Buffer):boolean; resize?(rows:number,columns:number):boolean }
const active = new Map<string, PiControl>();
export async function steerPi(operationId: string, message: string): Promise<unknown> {
  const pi = active.get(operationId);
  if (!pi) return { status: 'not_active', reason: 'no active Pi process on this service host' };
  const disposition = await pi.steer(message);
  return { status: 'queued', disposition };
}
export function writeInteractiveInput(operationId:string,data:Buffer):boolean{return active.get(operationId)?.input?.(data)??false;}
export function resizeInteractive(operationId:string,rows:number,columns:number):boolean{return active.get(operationId)?.resize?.(rows,columns)??false;}

export function translateActorOutcome(events:RpcEvent[]):ActorOutcome {
  const message=events.filter(e=>e.type==='message_end'&& (e.message as any)?.role==='assistant').at(-1)?.message as Record<string,unknown>|undefined;
  const reason=typeof message?.stopReason==='string'?message.stopReason.slice(0,80):undefined;
  const kind=reason==='stop'?'normal':reason==='error'?'error':reason==='length'?'truncated':reason==='aborted'?'aborted':'unknown';
  return {kind,...(reason?{reason}:{}),...(typeof message?.errorMessage==='string'?{detail:message.errorMessage.slice(0,1000)}:{})};
}

export function terminateInteractive(child:import('node:child_process').ChildProcess,piPid:()=>number|undefined):void{
 child.kill('SIGTERM');
 const killActor=setTimeout(()=>{const pid=piPid();if(pid)try{process.kill(-pid,'SIGKILL');}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')child.kill('SIGKILL');}},1000);
 const killBridge=setTimeout(()=>child.kill('SIGKILL'),2000);
 child.once('close',()=>{clearTimeout(killActor);clearTimeout(killBridge);});
}
async function runInteractivePi(input:PiDriverInput,signal:AbortSignal,launch:{cliPath:string;args:string[];env:Record<string,string>;driverAttemptId:string;emit:(type:string,payload?:Record<string,unknown>,processId?:number)=>Promise<void>}):Promise<PiDriverResult>{
  const helper=join(repoRoot,'operational-node/drivers/pi/pty-bridge.py'),child=spawn('python3',['-B',helper,process.execPath,launch.cliPath,...launch.args],{cwd:input.workspace,env:launch.env,stdio:['pipe','pipe','pipe','pipe']});
  const resizePipe=child.stdio[3] as import('node:stream').Writable;
  resizePipe.on('error',()=>{});
  resizePipe.write(JSON.stringify(input.terminalSize??{rows:24,columns:80})+'\n');
  let stderr='',handshake='',piPid:number|undefined,sessionFile:string|undefined,closed=false;
  const exited=new Promise<{code:number|null;signal:NodeJS.Signals|null}>(resolveExit=>child.once('close',(code,signal)=>{closed=true;resolveExit({code,signal});}));
  const ready=new Promise<number>((resolveReady,reject)=>{
    child.once('error',reject);
    child.stderr.on('data',(chunk:Buffer)=>{stderr+=chunk.toString();handshake+=chunk.toString();let end;while((end=handshake.indexOf('\n'))>=0){const line=handshake.slice(0,end);handshake=handshake.slice(end+1);try{const value=JSON.parse(line);if(value.type==='pty_ready'&&Number.isInteger(value.piPid)){piPid=value.piPid;resolveReady(piPid);}}catch{}}});
  });
  const control:PiControl={resize(rows,columns){return resizePipe.writable&&resizePipe.write(JSON.stringify({rows,columns})+'\n');},input(data){return !!child.stdin?.writable&&child.stdin.write(data);},async steer(message){const clean=message.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,16000);return this.input(Buffer.from(`\x1b[200~[Kilo Control STEER]\n${clean}\x1b[201~\r`))?{status:'submitted-to-native-editor'}:{status:'not_active'};}};
  child.stdin?.on('error',()=>{});
  child.stdout.on('data',(chunk:Buffer)=>publishLive({operationId:input.operationId,sessionId:input.sessionId,attemptId:launch.driverAttemptId,ownerPid:process.pid,at:Date.now(),kind:'terminal',event:{data:chunk.toString('base64')}}));
  active.set(input.operationId,control);
  let terminating=false;
  const onAbort=()=>{if(!closed&&!terminating){terminating=true;terminateInteractive(child,()=>piPid);}};
  signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort();
  try{
    await launch.emit('pi_process_starting',{sessionId:input.sessionId,driverAttemptId:launch.driverAttemptId,realization:'INTERACTIVE_DEBUG'});
    try{
      piPid=await ready;
      for(let attempt=0;attempt<80;attempt++){
        const match=(await readdir(input.sessionDir)).filter(name=>name.endsWith(`_${input.sessionId}.jsonl`));
        if(match.length===1){sessionFile=join(input.sessionDir,match[0]);break;}
        if(signal.aborted)break;
        await new Promise(resolveDelay=>setTimeout(resolveDelay,100));
      }
      if(!sessionFile&&!signal.aborted)throw new Error('native Pi session file did not appear');
      if(sessionFile){liveOwners.set(input.operationId,{sessionId:input.sessionId,attemptId:launch.driverAttemptId,ownerPid:process.pid,piPid});await launch.emit('pi_process_started',{sessionId:input.sessionId,sessionFile,driverAttemptId:launch.driverAttemptId,realization:'INTERACTIVE_DEBUG',piPid,agentDir:launch.env.PI_CODING_AGENT_DIR},piPid);}
    }catch(error){if(!signal.aborted)throw error;}
    const exit=await exited;
    if(!signal.aborted&&exit.code!==0)throw new Error(`native Pi TUI exited ${exit.code??exit.signal}: ${stderr.slice(-2000)}`);
    if(!sessionFile){const match=(await readdir(input.sessionDir)).filter(name=>name.endsWith(`_${input.sessionId}.jsonl`));if(match.length===1)sessionFile=join(input.sessionDir,match[0]);}
    if(!sessionFile&&!signal.aborted)throw new Error('native Pi TUI exited without a session file');
    const file=sessionFile??'pending';
    const rows=sessionFile?(await readFile(sessionFile,'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
    const message=rows.filter(row=>row.type==='message'&&row.message?.role==='assistant').at(-1)?.message as Record<string,unknown>|undefined;
    const text=Array.isArray(message?.content)?message.content.filter((item:any)=>item.type==='text').map((item:any)=>item.text).join('\n'):null;
    return {sessionId:input.sessionId,sessionFile:file,lastAssistantText:typeof text==='string'?text:null,eventTypes:message?['agent_settled']:[],settlement:signal.aborted?'aborted':'agent_settled',actorOutcome:signal.aborted?{kind:'aborted',reason:'Kilo cancellation'}:translateActorOutcome(message?[{type:'message_end',message}]:[])};
  }finally{
    signal.removeEventListener('abort',onAbort);
    if(!closed){onAbort();await exited;}
    if(active.get(input.operationId)===control)active.delete(input.operationId);
    if(liveOwners.get(input.operationId)?.attemptId===launch.driverAttemptId)liveOwners.delete(input.operationId);
    await launch.emit('pi_process_stopped',{sessionId:input.sessionId,aborted:signal.aborted,driverAttemptId:launch.driverAttemptId,piPid},piPid);
  }
}

function eventPayload(event: RpcEvent): Record<string, unknown> | undefined {
  const payload: Record<string, unknown> = {};
  for (const key of ["turnIndex", "toolCallId", "toolName", "parentToolCallId", "isError"]) {
    if (event[key] !== undefined) payload[key] = event[key];
  }
  if (event.type === "tool_execution_end" && event.result && typeof event.result === "object") {
    const result = event.result as Record<string, unknown>;
    if (Array.isArray(result.content)) payload.toolResult = result.content;
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
}

export async function runPi(input: PiDriverInput, signal: AbortSignal): Promise<PiDriverResult> {
  const piRoot = resolve(process.env.KILO_PI_SOURCE ?? "/home/miles/repos/agent-harnesses/kilo-pi-durable");
  const realization=input.workContract?.REALIZATION;
  if(realization!==undefined&&!['HEADLESS','INTERACTIVE_DEBUG'].includes(String(realization)))throw new Error('unsupported Pi realization');
  const cliPath = join(piRoot, "packages/coding-agent/src/cli.ts");
  const extensionPath = join(repoRoot, "operational-node/drivers/pi/extension.ts");
  const tsxLoader = join(repoRoot, "node_modules/tsx/dist/esm/index.mjs");
  const nativeConfig = input.pi ? validatePiConfiguration(input.pi) : undefined;
  const home = resolve(nativeConfig ? homedir() : process.env.KILO_PI_HOME ?? join(dirname(input.sessionDir), "home"));
  await Promise.all([mkdir(input.sessionDir, { recursive: true }), mkdir(home, { recursive: true })]);

  const testExtensionAllowed = process.env.KILO_ALLOW_TEST_EXTENSION === "1";
  const env: Record<string, string> = {
    HOME: home,
    PI_SESSION_ID: input.sessionId,
    KILO_OPERATION_ID: input.operationId,
    KILO_OPERATION_INVOCATION_ID: input.invocationId,
    KILO_SESSION_ID: input.sessionId,
    KILO_OPERATION_DEPTH: String(input.depth ?? 0),
    KILO_EVENT_INGRESS: process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180",
    TSX_TSCONFIG_PATH: join(piRoot, "tsconfig.json"),
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import ${tsxLoader}`].filter(Boolean).join(" "),
  };
  const profile=input.workContract?.OPERATIONAL_PROFILE as import('../../operational-profile.ts').OperationalProfile|undefined;
  if(input.completionToken&&profile){env.KILO_COMPLETION_TOKEN=input.completionToken;env.KILO_ALLOWED_TOOLS=JSON.stringify(profile.ingress.tools);}
  const prompt=profile?`Goal: ${input.workContract!.GOAL}\n\nWorking instructions:\n${input.workContract!.WORK}\n\nWorkspace: ${input.workspace}\nTool candidates: ${profile.ingress.tools.join(', ')}; all Kilo gates remain authoritative.\nWhen finished call submit_completion with report containing string fields GOAL, RESULT (ACHIEVED|PARTIAL|BLOCKED), GAP, AGENT WORK, ROOT CAUSE, NEXT PROMPT. You have ${profile.egress.maxSubmissions} total submissions. Correct errors in this same session. Do not exit or merely print a report. ACHIEVED is subject to ${profile.egress.checks.length} configured acceptance checks, not self-certifying.`:input.workContract?JSON.stringify(input.workContract)+reportInstruction:input.prompt;
  if (nativeConfig?.agentDir) env.PI_CODING_AGENT_DIR = nativeConfig.agentDir;
  if(profile){
    if(!nativeConfig?.agentDir)throw Error('operational profile requires an explicit native agentDir');
    const effectiveAgentDir=join(input.sessionDir,'native-profile');await mkdir(effectiveAgentDir,{recursive:true,mode:0o700});
    await writeFile(join(effectiveAgentDir,'settings.json'),JSON.stringify({defaultProvider:input.provider,defaultModel:input.model,defaultThinkingLevel:nativeConfig.thinking??'low',defaultProjectTrust:'never',packages:[],extensions:['-builtin:mcp'],skills:[],prompts:[],defaultTools:[...profile.ingress.tools,'submit_completion']}),{mode:0o600});
    try{await symlink(join(nativeConfig.agentDir,'auth.json'),join(effectiveAgentDir,'auth.json'));}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
    try{await copyFile(join(nativeConfig.agentDir,'models.json'),join(effectiveAgentDir,'models.json'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    env.PI_CODING_AGENT_DIR=effectiveAgentDir;
  }
  env.KILO_PI_PROVIDER = input.provider;
  env.KILO_PI_MODEL = input.model;
  env.KILO_EVENT_INGRESS = process.env.RESTATE_INGRESS ?? "http://127.0.0.1:8180";
  if (input.parentOperationId) env.KILO_PARENT_OPERATION_ID = input.parentOperationId;
  if (input.parentToolCallId) env.KILO_PARENT_TOOL_CALL_ID = input.parentToolCallId;
  if (testExtensionAllowed) env.KILO_ALLOW_TEST_EXTENSION = "1";
  if (testExtensionAllowed && input.testScenario) env.KILO_FAUX_SCENARIO = input.testScenario;
  if (input.provider === "faux") env.PI_OFFLINE = "1";

  const timeout = Number(process.env.KILO_PI_TURN_TIMEOUT_MS ?? 60_000);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 900_000) throw new Error("KILO_PI_TURN_TIMEOUT_MS must be 1000-900000");
  const args = [
    "--no-extensions", "--extension", extensionPath, "--no-skills", "--no-builtin-tools",
    "--session-id", input.sessionId, "--session-dir", input.sessionDir,
  ];
  if (nativeConfig) {
    // Kilo interception is loaded last; explicit profiles suppress automatic discovery.
    args.splice(0, args.length, '--no-builtin-tools', '--tools', profile?[...profile.ingress.tools,'submit_completion'].join(','):'read,write,edit,bash', '--session-id', input.sessionId, '--session-dir', input.sessionDir);
    for (const skill of nativeConfig.skills ?? []) args.push('--skill', skill);
    for (const extension of nativeConfig.extensions ?? []) args.push('--extension', extension);
    if (nativeConfig.thinking) args.push('--thinking', nativeConfig.thinking);
    args.push('--extension', extensionPath);
  }
  if(profile)args.push('--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--no-themes');
  if (testExtensionAllowed) args.push("--extension", join(repoRoot, "operational-node/test/faux-extension.ts"));

  const eventSink = createOperationEventSink(env.KILO_EVENT_INGRESS);
  const driverAttemptId = randomUUID();
  let eventSequence = 0;
  const emit = async (type: string, payload?: Record<string, unknown>, processId?:number): Promise<void> => {
    const event: OperationEvent = {
      eventId: `${process.pid}-${driverAttemptId}-${eventSequence++}-${type}`,
      operationId: input.operationId,
      invocationId: input.invocationId,
      sessionId: input.sessionId,
      type,
      at: new Date().toISOString(),
      ...(processId?{processId}:{}),
      ...(input.parentOperationId ? { parentOperationId: input.parentOperationId } : {}),
      ...(input.parentToolCallId ? { parentToolCallId: input.parentToolCallId } : {}),
      ...(payload ? { payload } : {}),
    };
    await eventSink(event);
  };
  if(realization==='INTERACTIVE_DEBUG'){
    env.PATH=process.env.PATH??'/usr/local/bin:/usr/bin:/bin';
    env.TERM=process.env.TERM??'xterm-256color';
    env.KILO_INTERACTIVE_DEBUG='1';
    args.push('--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--no-themes');
    args.push('--provider',input.provider,'--model',input.model,prompt);
    return runInteractivePi(input,signal,{cliPath,args,env,driverAttemptId,emit});
  }
  const rpcClientPath = pathToFileURL(join(piRoot, "packages/coding-agent/src/modes/rpc/rpc-client.ts")).href;
  const rpcModule: unknown = await import(rpcClientPath);
  const RpcClient = (rpcModule as { RpcClient: RpcClientConstructor }).RpcClient;
  const rpc = new RpcClient({ cliPath, cwd: input.workspace, env, args });
  const events: RpcEvent[] = [];
  const unsubscribe = rpc.onEvent((event) => {
    events.push(event);
    const debug = event.type === 'extension_ui_request' && typeof event.message === 'string' && event.message.startsWith('KILO_DEBUG_V0:');
    if (event.type === 'extension_ui_request' && !debug) return;
    let data: Record<string, unknown> = event;
    if (debug) {
      try {
        const d = JSON.parse(String(event.message).slice('KILO_DEBUG_V0:'.length));
        if (!['context','provider-request'].includes(d.layer) || !/^[a-f0-9]{64}$/.test(d.sha256)) return;
        data = { layer: d.layer, sha256: d.sha256 };
        if (Number.isSafeInteger(d.messages)) data.messages = d.messages;
        if (Number.isSafeInteger(d.request)) data.request = d.request;
        if (Array.isArray(d.fields) && d.fields.length < 64 && d.fields.every((s:unknown) => typeof s === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(s))) data.fields = d.fields;
      } catch { return; }
    }
    publishLive({ operationId: input.operationId, sessionId: input.sessionId, attemptId: driverAttemptId, ownerPid: process.pid, at: Date.now(), kind: debug ? 'debug' : 'pi', event: data });
  });
  let abortRequest: Promise<void> | undefined;
  const onAbort = (): void => { abortRequest = rpc.abort().catch(() => undefined); };
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();

  try {
    await emit("pi_process_starting", { sessionId: input.sessionId, driverAttemptId });
    await rpc.start();
    await rpc.setModel(input.provider, input.model);
    // Pi model switching restores saved thinking preferences; explicit launch override wins.
    if (nativeConfig?.thinking) await rpc.setThinkingLevel(nativeConfig.thinking);
    active.set(input.operationId, rpc);
    liveOwners.set(input.operationId, { sessionId: input.sessionId, attemptId: driverAttemptId, ownerPid: process.pid });
    const initialState = await rpc.getState();
    if (initialState.sessionId !== input.sessionId) throw new Error("Pi opened a different session ID");
    await emit("pi_process_started", { sessionId: initialState.sessionId, sessionFile: initialState.sessionFile ?? null, driverAttemptId, agentDir:env.PI_CODING_AGENT_DIR });
    if (nativeConfig) await emit('pi_configuration', {
      model: initialState.model, thinkingLevel: initialState.thinkingLevel,
      agentDir: env.PI_CODING_AGENT_DIR ?? process.env.PI_CODING_AGENT_DIR ?? null,
      commands: (await rpc.getCommands()).map(({ name, source }) => ({ name, source })),
      skills: nativeConfig.skills ?? [], extensions: nativeConfig.extensions ?? [],
    });

    let runEvents: RpcEvent[];
    try {
      runEvents = await rpc.promptAndWait(prompt, undefined, timeout);
    } catch (error) {
      if (!signal.aborted) throw error;
      runEvents = events;
    }
    for (const event of runEvents) {
      if (["agent_start", "turn_start", "turn_end", "tool_execution_start", "tool_execution_end", "agent_settled"].includes(event.type)) {
        await emit(event.type, eventPayload(event));
      }
    }

    if (!signal.aborted && !runEvents.some((event) => event.type === "agent_settled")) {
      throw new Error(`Pi prompt ended without agent_settled. ${rpc.getStderr()}`);
    }
    const finalState = await rpc.getState();
    if (finalState.sessionId !== input.sessionId || !finalState.sessionFile) throw new Error("Pi session identity or locator was not preserved");
    return {
      sessionId: finalState.sessionId,
      sessionFile: finalState.sessionFile,
      lastAssistantText: await rpc.getLastAssistantText(),
      eventTypes: runEvents.map((event) => event.type),
      settlement: signal.aborted ? "aborted" : "agent_settled",
      actorOutcome: translateActorOutcome(runEvents),
    };
  } finally {
    if (active.get(input.operationId) === rpc) { active.delete(input.operationId); liveOwners.delete(input.operationId); }
    signal.removeEventListener("abort", onAbort);
    unsubscribe();
    await abortRequest;
    await rpc.stop();
    await emit("pi_process_stopped", { sessionId: input.sessionId, aborted: signal.aborted, driverAttemptId });
  }
}
