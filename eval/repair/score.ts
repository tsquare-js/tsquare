/**
 * Repair-round eval, step 2: score the repaired outputs in out/<condition>/<model>/<id>.tsq
 * with today's compiler and the task checks, and compare the conditions.
 *
 *   npx tsx eval/repair/score.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { compileWireframe } from "../../src/compile";
import { runChecks, tasks } from "../tasks";
import { MODELS, RUNS, body } from "./common";

interface Item { key: string; model: string; run: string; task: string; file: string }
const set: Item[] = JSON.parse(readFileSync("eval/repair/set.json", "utf8"));

const rows = [];
for (const condition of ["new", "old"]) {
  for (const item of set) {
    const file = `eval/repair/out/${condition}/${item.model}/${item.run}--${item.task}.tsq`;
    const row = { condition, ...item, repaired: file, valid: false, checksPassed: 0, checksTotal: 0, issues: [] as string[] };
    if (!existsSync(file)) { row.issues.push("missing output"); rows.push(row); continue; }
    const { spec, issues } = compileWireframe(body(file));
    row.issues = issues.map((i) => `line ${i.line}: ${i.message}`);
    row.valid = !!spec && !issues.length;
    if (spec) {
      const checks = runChecks(tasks.find((t) => t.id === item.task)!, spec);
      row.checksPassed = checks.filter((c) => c.pass).length;
      row.checksTotal = checks.length;
    }
    rows.push(row);
  }
}
writeFileSync("eval/repair/results.json", JSON.stringify(rows, null, 2));

// Fixed by one repair, per model and condition
console.log("model   condition  fixed (valid after one repair)   checks after repair");
for (const model of MODELS) {
  for (const condition of ["new", "old"]) {
    const rs = rows.filter((r) => r.model === model && r.condition === condition);
    const fixed = rs.filter((r) => r.valid).length;
    const cp = rs.reduce((s, r) => s + r.checksPassed, 0), ct = rs.reduce((s, r) => s + r.checksTotal, 0);
    console.log(`${model.padEnd(7)} ${condition.padEnd(10)} ${`${fixed}/${rs.length}`.padStart(6)}${"".padEnd(26)}${ct ? Math.round((100 * cp) / ct) + "%" : "-"}`);
  }
}

// Valid on the first try, and after one repair with today's messages, per run of 20
const results: { model: string; format: string; valid: boolean }[] = JSON.parse(readFileSync("eval/results.json", "utf8"));
console.log("\nmodel   run              first try   after one repair (new messages)");
for (const model of MODELS) {
  for (const run of RUNS) {
    const first = results.filter((r) => r.model === model && r.format === run);
    const firstValid = first.filter((r) => r.valid).length;
    const fixed = rows.filter((r) => r.condition === "new" && r.model === model && r.run === run && r.valid).length;
    console.log(`${model.padEnd(7)} ${run.padEnd(16)} ${`${firstValid}/${first.length}`.padStart(9)}   ${`${firstValid + fixed}/${first.length}`.padStart(6)}`);
  }
}

console.log("\nStill invalid after repair:");
for (const r of rows.filter((r) => !r.valid)) console.log(`  ${r.condition} ${r.key} | ${r.issues.join(" ; ").slice(0, 180)}`);
