import { isAbsolute } from 'node:path';
import type {OperationResult} from './contract.ts';

// Native Pi resource/configuration passthroughs; no credentials in work contracts.
export interface PiConfiguration {
  agentDir?: string;
  skills?: string[];
  extensions?: string[];
  thinking?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}
export interface WorkReport {
  GOAL: string;
  RESULT: 'ACHIEVED' | 'PARTIAL' | 'BLOCKED';
  GAP: string;
  'AGENT WORK': string;
  'ROOT CAUSE': string;
  'NEXT PROMPT': string;
}
const fields = ['GOAL', 'RESULT', 'GAP', 'AGENT WORK', 'ROOT CAUSE', 'NEXT PROMPT'] as const;
export function validatePiConfiguration(value: unknown): PiConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('pi must be an object');
  const config = value as Record<string, unknown>;
  if (Object.keys(config).some(key => !['agentDir', 'skills', 'extensions', 'thinking'].includes(key))) throw new Error('unknown Pi configuration field');
  if (config.agentDir !== undefined && (typeof config.agentDir !== 'string' || !isAbsolute(config.agentDir))) throw new Error('agentDir must be absolute');
  for (const key of ['skills', 'extensions']) {
    const paths = config[key];
    if (paths !== undefined && (!Array.isArray(paths) || paths.length > 32 || paths.some(path => typeof path !== 'string' || !isAbsolute(path)))) throw new Error(`${key} must contain at most 32 absolute paths`);
  }
  if (config.thinking !== undefined && !['off','minimal','low','medium','high','xhigh','max'].includes(String(config.thinking))) throw new Error('invalid Pi thinking level');
  return config as PiConfiguration;
}
export function parseWorkReport(text: string | null | undefined): WorkReport | undefined {
  try {
    const report = JSON.parse((text ?? '').replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!report || fields.some(key => typeof report[key] !== 'string') || !['ACHIEVED','PARTIAL','BLOCKED'].includes(report.RESULT)) return undefined;
    return Object.fromEntries(fields.map(key => [key, report[key]])) as unknown as WorkReport;
  } catch { return undefined; }
}
export function verifyWorkResult(result:OperationResult,contract?:Record<string,unknown>):OperationResult {
  if(!contract||result.status!=='completed')return result;
  const report=parseWorkReport(result.output);if(report)result.workReport=report;
  const cause=result.actorOutcome;
  const failure=cause?.kind!=='normal'?`Actor terminal outcome: ${cause?.kind??'unknown'}${cause?.reason?` (${cause.reason})`:''}`:!report?'Actor settled without a valid structured WorkReport':report.RESULT!=='ACHIEVED'?`WorkReport RESULT: ${report.RESULT}`:undefined;
  if(failure){result.status='failed';result.failure=failure;result.reportError=failure;}
  return result;
}
export const reportInstruction = '\nReturn only a JSON object with string fields GOAL, RESULT (ACHIEVED|PARTIAL|BLOCKED), GAP, AGENT WORK, ROOT CAUSE, NEXT PROMPT. Do not delegate or launch sub-agents. Use only read/write/edit/bash tools; all calls require external Restate authorization. Never treat an emitted event as proof of effect or settlement.';
