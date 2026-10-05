import * as restate from "@restatedev/restate-sdk";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = process.env.PERIMETER_EVIDENCE_DIR!;
const effectLog = path.join(evidenceDir, "effects.jsonl");

export const PerimeterProbe = restate.service({
  name: "PerimeterProbe",
  handlers: {
    effect: async (ctx, req: { tag: string; holdFirst?: boolean }) =>
      ctx.run("append-external-marker", async () => {
        await appendFile(effectLog, `${JSON.stringify({ tag: req.tag, pid: process.pid })}\n`);
        const matchingEffects = (await readFile(effectLog, "utf8"))
          .trim().split("\n").map((line) => JSON.parse(line)).filter((entry) => entry.tag === req.tag).length;
        if (req.holdFirst && matchingEffects === 1) {
          await writeFile(path.join(evidenceDir, "effect-committed-before-result"), "committed\n");
          await new Promise<void>(() => {});
        }
        return { tag: req.tag, ok: true };
      }),
    wait: async (ctx, req: { name: string }) => {
      const pending = ctx.awakeable<string>();
      await ctx.run("publish-awakeable-id", () =>
        writeFile(path.join(evidenceDir, `${req.name}.awakeable.json`), JSON.stringify({ id: pending.id })),
      );
      return { resolution: await pending.promise };
    },
  },
});

if (process.argv[2] === "serve") {
  const port = Number(process.env.PERIMETER_SERVICE_PORT ?? 19080);
  await restate.serve({ services: [PerimeterProbe], port });
  console.log(`PERIMETER_SERVICE_LISTENING port=${port} pid=${process.pid}`);
}
