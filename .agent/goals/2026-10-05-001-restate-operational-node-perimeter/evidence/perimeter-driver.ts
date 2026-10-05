import { connect, rpc } from "@restatedev/restate-sdk-clients";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PerimeterProbe } from "./perimeter-service.js";

const dir = process.env.PERIMETER_EVIDENCE_DIR!;
const ingress = connect({ url: process.env.PERIMETER_INGRESS ?? "http://127.0.0.1:19180" });
const client = ingress.serviceSendClient(PerimeterProbe);
const mode = process.argv[2];

if (mode === "gap") {
  const send = await client.effect({ tag: "gap", holdFirst: true }, rpc.sendOpts({ idempotencyKey: "perimeter-gap-001" }));
  await writeFile(path.join(dir, "gap-send.json"), JSON.stringify(send, null, 2));
} else if (mode === "dedupe") {
  const first = await client.effect({ tag: "same-key" }, rpc.sendOpts({ idempotencyKey: "perimeter-dedupe-001" }));
  const duplicate = await client.effect({ tag: "same-key" }, rpc.sendOpts({ idempotencyKey: "perimeter-dedupe-001" }));
  const unkeyedA = await client.effect({ tag: "unkeyed" });
  const unkeyedB = await client.effect({ tag: "unkeyed" });
  await writeFile(path.join(dir, "dedupe-sends.json"), JSON.stringify({ first, duplicate, unkeyedA, unkeyedB }, null, 2));
} else if (mode === "wait") {
  const name = process.argv[3] ?? "server-restart";
  const send = await client.wait({ name }, rpc.sendOpts({ idempotencyKey: `perimeter-wait-${name}` }));
  await writeFile(path.join(dir, `${name}-send.json`), JSON.stringify(send, null, 2));
} else if (mode === "resolve") {
  const name = process.argv[3] ?? "server-restart";
  const { id } = JSON.parse(await readFile(path.join(dir, `${name}.awakeable.json`), "utf8"));
  await ingress.resolveAwakeable(id, "RESUME");
} else if (mode === "result") {
  const name = process.argv[3] ?? "server-restart";
  const send = JSON.parse(await readFile(path.join(dir, `${name}-send.json`), "utf8"));
  const result = await ingress.result(send);
  await writeFile(path.join(dir, `${name}-result.json`), JSON.stringify(result, null, 2));
} else {
  throw new Error(`usage: gap | dedupe | wait [name] | resolve [name] | result [name]`);
}
