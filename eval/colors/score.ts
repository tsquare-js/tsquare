/**
 * Scores the color eval outputs in eval/colors/out/<model>/<task>.wf.
 *   npx tsx eval/colors/score.ts            → table + eval/colors/results.json
 *   npx tsx eval/colors/score.ts --prompt   → write the prompt being tested to eval/colors/prompt.md
 *
 * "invented color props" counts props with color-ish names that don't exist
 * (color, background, bg, fill…), which validation reports as unknown props.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { compileWireframe } from "../../src/compile";
import { renderWireframePng } from "../../src/render";
import { wireframePrompt } from "../../src/prompt";
import { colorTasks, runColorChecks } from "./tasks";

const MODELS = ["sonnet", "haiku"] as const;
const DIR = "eval/colors";

if (process.argv.includes("--prompt")) {
  writeFileSync(`${DIR}/prompt.md`, wireframePrompt());
  writeFileSync(`${DIR}/tasks.md`, colorTasks.map((t) => `## ${t.id}\n${t.prompt}\n`).join("\n"));
  console.log(`wrote ${DIR}/prompt.md and ${DIR}/tasks.md`);
  process.exit(0);
}

const rows = [];
for (const model of MODELS) {
  for (const task of colorTasks) {
    const file = `${DIR}/out/${model}/${task.id}.wf`;
    if (!existsSync(file)) { rows.push({ model, task: task.id, missing: true }); continue; }
    const { spec, issues } = compileWireframe(readFileSync(file, "utf8"));
    const messages = issues.map((i) => `line ${i.line}: ${i.message}`);
    const invented = messages.filter((m) => /no prop "(colou?r|background|bg|fill|tint|theme|textColor|accentColor)"/i.test(m) || /don't know what "(red|blue|green|navy|teal|purple|dark)"/i.test(m));
    const checks = spec ? runColorChecks(task, spec) : [];
    if (spec && !issues.length) {
      mkdirSync(`${DIR}/renders/${model}`, { recursive: true });
      writeFileSync(`${DIR}/renders/${model}/${task.id}.png`, await renderWireframePng(spec, { skipValidation: true }));
    }
    rows.push({
      model, task: task.id, valid: !!spec && !issues.length, issues: messages, invented: invented.length,
      passed: checks.filter((c) => c.pass).length, total: task.checks.length,
      failed: checks.filter((c) => !c.pass).map((c) => c.name),
    });
  }
}
writeFileSync(`${DIR}/results.json`, JSON.stringify(rows, null, 2) + "\n");

console.log("model   task               valid  checks  invented  notes");
for (const r of rows as any[]) {
  if (r.missing) { console.log(`${r.model.padEnd(8)}${r.task.padEnd(19)}missing`); continue; }
  const notes = [...r.failed.map((f: string) => `✗ ${f}`), ...r.issues].join(" | ");
  console.log(`${r.model.padEnd(8)}${r.task.padEnd(19)}${(r.valid ? "yes" : "NO").padEnd(7)}${`${r.passed}/${r.total}`.padEnd(8)}${String(r.invented).padEnd(10)}${notes}`);
}
