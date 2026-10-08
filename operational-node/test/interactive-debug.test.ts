import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { factorySpec, factoryAdmissionHash } from '../factory.ts';
import { OperationWorkflow } from '../restate/service.ts';

const root = await mkdtemp(join(tmpdir(), 'interactive-debug-'));
const workspace = join(root, 'workspace');
await mkdir(workspace);
const base = { SUBJECT: 'client', SUBJECT_ROOT: root, GOAL_ID: 'interactive', ITERATION: 1, GOAL: 'Fix a tiny bug', WORK: 'Fix the bug and test it', WORKSPACE: workspace, AUTHORITY: { policy: 'factory-dev-v0', workspace }, provider: 'faux', model: 'faux-1' };
try {
  const workflowOptions = (OperationWorkflow as unknown as { options?: { inactivityTimeout?: number; abortTimeout?: number } }).options;
  assert.equal(workflowOptions?.inactivityTimeout, 86_400_000);
  assert.equal(workflowOptions?.abortTimeout, 60_000);
  const headless = await factorySpec(base);
  const interactive = await factorySpec({ ...base, REALIZATION: 'INTERACTIVE_DEBUG' });
  assert.equal('REALIZATION' in headless.workContract, false);
  assert.equal(interactive.workContract.REALIZATION, 'INTERACTIVE_DEBUG');
  assert.equal(headless.operationId, interactive.operationId);
  assert.notEqual(factoryAdmissionHash(headless), factoryAdmissionHash(interactive));
  await assert.rejects(factorySpec({ ...base, REALIZATION: 'TUI' }));

  const child = spawn('python3', ['-B', join(process.cwd(), 'operational-node/drivers/pi/pty-bridge.py'), process.execPath, '-e', "process.stdout.write('NATIVE_TTY:'+process.stdin.isTTY+':'+process.stdout.isTTY+'\\n');process.stdin.once('data',b=>{process.stdout.write('USER_INPUT:'+b.toString());process.exit(0)})"], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = '', started = false;
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`PTY startup timeout: ${output} ${errors}`)); }, 5000);
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); if (output.includes('NATIVE_TTY:true:true')) { started = true; clearTimeout(timeout); resolve(); } });
    child.stderr.on('data', (chunk: Buffer) => { errors += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code) => { if (!started) { clearTimeout(timeout); reject(new Error(`PTY exited before TTY startup (${code}): ${errors}`)); } });
  });
  await ready;
  child.stdin.write('FROM_USER\n');
  const [code] = await new Promise<[number | null, NodeJS.Signals | null]>((resolve, reject) => { child.once('error', reject); child.once('close', (exitCode, signal) => resolve([exitCode, signal])); });
  assert.equal(code, 0, output);
  assert.match(output, /USER_INPUT:FROM_USER/);
  assert.match(output, /NATIVE_TTY:true:true/);
  console.log('INTERACTIVE_DEBUG contract and native PTY input/output: PASS');
} finally {
  await rm(root, { recursive: true, force: true });
}
