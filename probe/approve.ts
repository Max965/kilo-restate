import { resolveAwakeable } from "./client.js";
import { readFile } from "node:fs/promises";
const request = JSON.parse(await readFile("evidence/approval-ticket.json", "utf8"));
await resolveAwakeable(request.awakeableId, true);
console.log(JSON.stringify({ awakeableId: request.awakeableId, decision: true }));
