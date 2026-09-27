/**
 * Scores every generated spec: parses, validates, runs the task checks,
 * counts tokens, and renders a PNG.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { nestedToFlat, type Spec } from "@json-render/core";
import { encode } from "gpt-tokenizer/encoding/o200k_base";
import { checkSpec, renderWireframePng } from "../src/render";
import { compileWireframe } from "../src/compile";
import { runChecks, tasks } from "./tasks";

const MODELS = ["sonnet", "haiku"] as const;
const FORMATS = ["flat", "nested", "text"] as const;
const EXT = { flat: "json", nested: "json", text: "wf" } as const;

function extractBlock(reply: string) {
  const m = reply.match(/```[\w-]*\n([\s\S]*?)```/);
  return (m ? m[1] : reply).trim();
}

function category(msg: string) {
  if (/does not exist/.test(msg)) return "dangling child id";
  if (/unknown component/.test(msg)) return "unknown component";
  if (/must be a direct child|root must be|only one top-level/.test(msg)) return "structure";
  if (/Too small|Too big|Invalid option|expected/.test(msg)) return "invalid prop";
  if (/\.props|has no prop|don't know what|takes no text|more than one text/.test(msg)) return "invalid prop";
  if (/catalog|elements|root/.test(msg)) return "spec shape";
  return "syntax";
}

export interface Row {
  model: string;
  format: string;
  task: string;
  tokens: number;
  chars: number;
  elements: number;
  parsed: boolean;
  valid: boolean;
  rendered: boolean;
  issues: string[];
  categories: string[];
  checksPassed: number;
  checksTotal: number;
  failedChecks: string[];
}

async function scoreOne(model: string, format: (typeof FORMATS)[number], taskId: string): Promise<Row> {
  const file = `eval/out/${model}/${format}/${taskId}.${EXT[format]}`;
  const task = tasks.find((t) => t.id === taskId)!;
  const row: Row = {
    model, format, task: taskId, tokens: 0, chars: 0, elements: 0,
    parsed: false, valid: false, rendered: false, issues: [], categories: [],
    checksPassed: 0, checksTotal: task.checks.length, failedChecks: [],
  };
  if (!existsSync(file)) { row.issues.push("missing output"); row.categories.push("missing"); return row; }

  const body = extractBlock(readFileSync(file, "utf8"));
  row.tokens = encode(body).length;
  row.chars = body.length;

  let spec: Spec | null = null;
  let textCompiled = false; // compileWireframe already ran checkSpec
  try {
    if (format === "text") {
      const r = compileWireframe(body);
      spec = r.spec;
      row.issues.push(...r.issues.map((i) => `line ${i.line}: ${i.message}`));
      textCompiled = true;
    } else {
      const json = JSON.parse(body);
      spec = format === "flat" ? json : nestedToFlat(json);
    }
  } catch (e) {
    row.issues.push(`parse error: ${(e as Error).message}`);
  }
  row.parsed = spec !== null;

  if (spec) {
    row.elements = Object.keys(spec.elements ?? {}).length;
    try {
      if (!textCompiled) row.issues.push(...checkSpec(spec));
    } catch (e) {
      row.issues.push(`check crashed: ${(e as Error).message}`);
    }
    row.valid = row.issues.length === 0;
    const checks = runChecks(task, spec);
    row.checksPassed = checks.filter((c) => c.pass).length;
    row.failedChecks = checks.filter((c) => !c.pass).map((c) => c.name);

    // Render regardless of validation issues: does something usable come out?
    try {
      const png = await renderWireframePng(spec, { skipValidation: true, scale: 0.5 });
      const dir = `eval/renders/${model}/${format}`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, `${taskId}.png`), png);
      row.rendered = true;
    } catch (e) {
      row.issues.push(`render error: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  row.categories = [...new Set(row.issues.map(category))];
  return row;
}

const rows: Row[] = [];
for (const model of MODELS) {
  for (const format of FORMATS) {
    for (const t of tasks) rows.push(await scoreOne(model, format, t.id));
  }
}
writeFileSync("eval/results.json", JSON.stringify(rows, null, 2));

// ── Summary ─────────────────────────────────────────────────────────────
const pct = (n: number, d: number) => `${Math.round((100 * n) / d)}%`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

console.log("model   format  valid  renders  checks   med.tokens  tok/element  issue types");
for (const model of MODELS) {
  for (const format of FORMATS) {
    const rs = rows.filter((r) => r.model === model && r.format === format);
    const valid = rs.filter((r) => r.valid).length;
    const rendered = rs.filter((r) => r.rendered).length;
    const cp = rs.reduce((s, r) => s + r.checksPassed, 0);
    const ct = rs.reduce((s, r) => s + r.checksTotal, 0);
    const tpe = rs.filter((r) => r.elements).map((r) => r.tokens / r.elements);
    const cats: Record<string, number> = {};
    rs.forEach((r) => r.categories.forEach((c) => (cats[c] = (cats[c] ?? 0) + 1)));
    console.log(
      `${model.padEnd(7)} ${format.padEnd(7)} ${pct(valid, rs.length).padStart(5)}  ${pct(rendered, rs.length).padStart(7)}  ${pct(cp, ct).padStart(6)}   ${String(median(rs.map((r) => r.tokens))).padStart(10)}  ${(tpe.reduce((a, b) => a + b, 0) / tpe.length).toFixed(1).padStart(11)}  ${JSON.stringify(cats)}`,
    );
  }
}
