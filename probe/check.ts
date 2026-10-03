import { call } from "./client.js";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const assert = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const main = async () => {
  await writeFile(resolve("workspace/sample.txt"), "initial content\n");
  const read = await call("KiloNode", "run", "pi-read", { nodeId: "read-1", operation: "read", args: { path: "sample.txt" } });
  assert(read.result.text.includes("initial content"), "read failed");
  const edit = await call("KiloNode", "run", "pi-edit", { nodeId: "edit-1", operation: "edit", args: { path: "sample.txt", oldText: "initial content", newText: "edited by Restate\n" } });
  assert(edit.result.changed, "edit failed");
  const bash = await call("KiloNode", "run", "pi-bash", { nodeId: "bash-1", operation: "bash", args: { command: "printf 'bash-result'" } });
  assert(bash.result.stdout === "bash-result", "bash failed");
  const tree = await call("KiloNode", "parentChild", "A", { nodeA: "A", nodeB: "B", path: "sample.txt" });
  assert(tree.child.nodeId === "B" && tree.child.parentNodeId === "A", "child relation failed");
  await writeFile(resolve("evidence/tool-calls.json"), JSON.stringify({ read, edit, bash, tree }, null, 2));
  console.log(JSON.stringify({ read: read.result, edit: edit.result, bash: bash.result, tree }, null, 2));
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
