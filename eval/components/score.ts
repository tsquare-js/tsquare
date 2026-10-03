/**
 * Scores the component eval outputs in eval/components/out/<model>/<run>/<task>.tsq.
 *   npx tsx eval/components/score.ts            → table + eval/components/results.json
 *   npx tsx eval/components/score.ts --prompt   → write the prompt and tasks being tested
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { compileWireframe } from "../../src/compile";
import { renderWireframePng } from "../../src/render";
import { wireframePrompt } from "../../src/prompt";
import { componentTasks, runComponentChecks } from "./tasks";

const MODELS = ["sonnet", "haiku"] as const;
const RUNS = ["run1", "run2"] as const;
const DIR = "eval/components";

if (process.argv.includes("--prompt")) {
  writeFileSync(`${DIR}/prompt.md`, wireframePrompt());
  writeFileSync(`${DIR}/tasks.md`, componentTasks.map((t) => `## ${t.id}\n${t.prompt}\n`).join("\n"));
  console.log(`wrote ${DIR}/prompt.md and ${DIR}/tasks.md`);
  process.exit(0);
}

const body = (raw: string) => (raw.match(/```[\w-]*\n([\s\S]*?)```/)?.[1] ?? raw).trim();
const rows: any[] = [];
for (const model of MODELS) {
  for (const run of RUNS) {
    for (const task of componentTasks) {
      const file = `${DIR}/out/${model}/${run}/${task.id}.tsq`;
      if (!existsSync(file)) { rows.push({ model, run, task: task.id, missing: true }); continue; }
      const { spec, issues } = compileWireframe(body(readFileSync(file, "utf8")));
      const checks = spec ? runComponentChecks(task, spec) : [];
      if (spec && !issues.length) {
        mkdirSync(`${DIR}/renders/${model}/${run}`, { recursive: true });
        writeFileSync(`${DIR}/renders/${model}/${run}/${task.id}.png`, await renderWireframePng(spec, { skipValidation: true, scale: 1 }));
      }
      rows.push({
        model, run, task: task.id, valid: !!spec && !issues.length, issues: issues.map((i) => `line ${i.line}: ${i.message}`),
        passed: checks.filter((c) => c.pass).length, total: task.checks.length, failed: checks.filter((c) => !c.pass).map((c) => c.name),
      });
    }
  }
}
writeFileSync(`${DIR}/results.json`, JSON.stringify(rows, null, 2) + "\n");

console.log("model   run   valid  checks");
for (const model of MODELS) for (const run of RUNS) {
  const rs = rows.filter((r) => r.model === model && r.run === run && !r.missing);
  const v = rs.filter((r) => r.valid).length, p = rs.reduce((s, r) => s + r.passed, 0), t = rs.reduce((s, r) => s + r.total, 0);
  console.log(`${model.padEnd(8)}${run.padEnd(6)}${`${v}/${rs.length}`.padEnd(7)}${p}/${t}`);
}
console.log("\nProblems and missed checks:");
for (const r of rows) if (!r.missing && (!r.valid || r.failed.length)) console.log(`  ${r.model} ${r.run} ${r.task} | ${[...r.failed.map((f: string) => `✗ ${f}`), ...r.issues].join(" ; ").slice(0, 220)}`);
