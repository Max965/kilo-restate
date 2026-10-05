import { randomUUID } from "node:crypto";
import { access, copyFile, mkdir, chmod, rm, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resumePersistentThread, startPersistentThread } from "./appserver-driver.js";

const probeRoot = dirname(fileURLToPath(import.meta.url));
const runId = `thread-identity-${Date.now()}-${randomUUID().slice(0, 8)}`;
const runDir = join(probeRoot, runId);
const codexHome = join(runDir, "codex-home");
const workspace = join(runDir, "workspace");
const sourceHome = join(process.env.HOME ?? "", ".codex");

async function main(): Promise<void> {
  let phase = "prepare-private-home";
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  try {
    phase = "copy-private-auth-config";
    await copyFile(join(sourceHome, "auth.json"), join(codexHome, "auth.json"));
    await copyFile(join(sourceHome, "config.toml"), join(codexHome, "config.toml"));
    await chmod(join(codexHome, "auth.json"), 0o600);
    await chmod(join(codexHome, "config.toml"), 0o600);
    const started = await startPersistentThread({
      codexHome,
      workspace,
      stderrPath: join(runDir, "appserver-start.stderr.log"),
    }, (stage) => { phase = stage; });
    await writeFile(join(runDir, "start.json"), JSON.stringify(started, null, 2), { mode: 0o600 });
    phase = "thread-resume";
    const resumed = await resumePersistentThread({
      codexHome,
      workspace,
      stderrPath: join(runDir, "appserver-resume.stderr.log"),
    }, String(started.threadId), (stage) => { phase = stage; });
    await writeFile(join(runDir, "resumed.json"), JSON.stringify(resumed, null, 2), { mode: 0o600 });
    const result = {
      status: "PASS",
      runId,
      modelTurnRequested: false,
      turnStartRequests: 0,
      sameThreadId: started.threadId === resumed.threadId,
      differentAppServerProcesses: started.processId !== resumed.processId,
      sameCodexHome: resolve(String(started.codexHome)) === resolve(codexHome) && resolve(String(resumed.codexHome)) === resolve(codexHome),
      ephemeral: started.ephemeral,
      resumedTurnCount: resumed.turnCount,
      threadId: started.threadId,
      resumedThreadId: resumed.threadId,
      sessionId: started.sessionId,
      resumedSessionId: resumed.sessionId,
      processIdBeforeRestart: started.processId,
      processIdAfterRestart: resumed.processId,
      threadStatusBeforeRestart: started.status,
      threadStatusAfterRestart: resumed.status,
    };
    phase = "validate-identity-result";
    if (!result.sameThreadId || !result.differentAppServerProcesses || !result.sameCodexHome || result.ephemeral !== false || result.resumedTurnCount !== 0) {
      throw new Error("persistent-thread identity acceptance failed");
    }
    phase = "write-result";
    await writeFile(join(runDir, "persistent-thread.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ status: result.status, runId, sameThreadId: result.sameThreadId, modelTurnRequested: false }));
  } catch (error) {
    await writeFile(join(runDir, "failure.json"), JSON.stringify({ status: "FAIL", phase, errorName: error instanceof Error ? error.name : "UnknownError" }, null, 2), { mode: 0o600 });
    console.error(`Persistent-thread probe failed (${error instanceof Error ? error.name : "UnknownError"})`);
    process.exitCode = 1;
  } finally {
    await rm(codexHome, { recursive: true, force: true });
    await writeFile(join(runDir, "cleanup.json"), JSON.stringify({ temporaryCodexHomeRemoved: !(await exists(codexHome)) }, null, 2), { mode: 0o600 });
  }
}
async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; }
  catch { return false; }
}

await main();
