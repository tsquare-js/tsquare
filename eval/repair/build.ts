/**
 * Repair-round eval, step 1: the repair set and the repair conversations.
 *
 * The set is every first try that failed validation in the runs that used the
 * 0.3.0 prompts (text-v3, text-v4 and their reruns). Each item becomes one
 * repair conversation per condition:
 *
 *   new   today's error messages
 *   old   the messages from before the clearer errors (old-messages.json)
 *
 * The conversation is what a real repair loop sends: the system prompt the
 * output was written with, the request, the model's first reply, then the
 * library's repairPrompt() with the problems.
 *
 *   npx tsx eval/repair/build.ts --set     write set.json (then produce old-messages.json, see old-messages.ts)
 *   npx tsx eval/repair/build.ts           write items/<condition>/<model>/<id>.md and batches.json
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compileWireframe } from "../../src/compile";
import { repairPrompt } from "../../src/prompt";
import { tasks } from "../tasks";

import { MODELS, RUNS, body } from "./common";

const promptFor = (run: string) => `eval/prompts/${run.replace(/-rerun$/, "")}.md`;
const dir = "eval/repair";

const issuesOf = (text: string) => compileWireframe(text).issues.map((i) => `line ${i.line}: ${i.message}`);

if (process.argv.includes("--set")) {
  const set = [];
  for (const model of MODELS) for (const run of RUNS) for (const t of tasks) {
    const file = `eval/out/${model}/${run}/${t.id}.tsq`;
    if (existsSync(file) && issuesOf(body(file)).length) set.push({ key: `${model}/${run}/${t.id}`, model, run, task: t.id, file });
  }
  writeFileSync(`${dir}/set.json`, JSON.stringify(set, null, 2));
  console.log(`set: ${set.length} failed first tries`);
} else {
  const set: { key: string; model: string; run: string; task: string; file: string }[] = JSON.parse(readFileSync(`${dir}/set.json`, "utf8"));
  const old: Record<string, string[]> = JSON.parse(readFileSync(`${dir}/old-messages.json`, "utf8"));
  rmSync(`${dir}/items`, { recursive: true, force: true });
  const batches: Record<string, string[]> = {};
  for (const condition of ["new", "old"]) {
    for (const item of set) {
      const first = body(item.file);
      const issues = condition === "new" ? issuesOf(first) : old[item.key];
      if (!issues?.length) throw new Error(`${item.key}: no ${condition} issues`);
      const task = tasks.find((t) => t.id === item.task)!;
      const id = `${item.run}--${item.task}`;
      const out = `${dir}/items/${condition}/${item.model}/${id}.md`;
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, [
        `# Repair conversation`,
        ``,
        `## System prompt`,
        `Read it from: ${promptFor(item.run)}`,
        ``,
        `## User`,
        task.prompt,
        ``,
        `## Assistant (your first reply)`,
        "```tsquare",
        first,
        "```",
        ``,
        `## User`,
        repairPrompt(issues.join("\n")),
        ``,
      ].join("\n"));
      (batches[`${condition}/${item.model}`] ??= []).push(id);
    }
  }
  writeFileSync(`${dir}/batches.json`, JSON.stringify(batches, null, 2));
  console.log(Object.entries(batches).map(([k, v]) => `${k}: ${v.length}`).join(", "));
}
