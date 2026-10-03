import { send } from "./client.js";
import { writeFile } from "node:fs/promises";
const ticket = await send("Approval", "request", "approval-1", { effect: "set durable approved-effect state" });
await writeFile("evidence/approval-send.json", JSON.stringify(ticket, null, 2));
console.log(JSON.stringify(ticket));
