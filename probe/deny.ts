import { send, rejectAwakeable } from "./client.js";
import { readFile } from "node:fs/promises";
const sent = await send("Approval", "request", "approval-deny", { effect: "denied probe effect" });
let ticket: any;
const deadline = Date.now() + 5000;
while (Date.now() < deadline) {
  try {
    ticket = JSON.parse(await readFile("evidence/approval-ticket.json", "utf8"));
    if (ticket.invocationId === sent.invocationId) break;
  } catch {}
  await new Promise<void>((resolve) => setTimeout(resolve, 25));
}
if (ticket?.invocationId !== sent.invocationId) throw new Error("approval ticket was not recorded");
await rejectAwakeable(ticket.awakeableId, "operator denied");
console.log(JSON.stringify({ invocationId: sent.invocationId, awakeableId: ticket.awakeableId, decision: false }));
