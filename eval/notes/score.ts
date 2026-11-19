/**
 * Where models put notes under the rule "a note is about what it's indented under" (prompt rule 12):
 * eval/notes/out/<model>/<run>/<task>.tsq, written by subagents from prompt.md and tasks.md with no
 * self-checking. Each targeted note is found by its text and checked against the element it should
 * sit under.
 *   npx tsx eval/notes/score.ts   → table + eval/notes/results.json
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { compileWireframe } from "../../src/compile.js";

const DIR = "eval/notes";
const MODELS = ["sonnet", "haiku"];
const RUNS = ["run1", "run2"];

type El = { type: string; props?: Record<string, any>; children?: string[] };
type Target = { type: string | string[]; label?: RegExp; screen?: RegExp; prop?: [string, unknown] };
type Expect = { what: string; text: RegExp; want: Target; accept?: Target };

// every text-like prop, so an input named by its placeholder still matches
const label = (e?: El) => e ? ["label", "text", "title", "name", "placeholder", "value", "initials"].map((k) => e.props?.[k]).filter((v) => typeof v === "string" && v).join(" / ") : "";

// For each task: which note (found by its text) should sit under what. `accept` = an acceptable second choice.
const EXPECT: Record<string, Expect[]> = {
  "n1-checkout": [
    { what: "promo note → promo input", text: /promo|one code/i, want: { type: "Input", label: /promo/i } },
    { what: "pay note → Pay button", text: /disabled|valid/i, want: { type: "Button", label: /pay/i } },
  ],
  "n2-signup-flow": [
    { what: "expiry note → code input", text: /expire|10 min/i, want: { type: "Input", prop: ["type", "code"] } },
    { what: "draft note → board", text: /draft/i, want: { type: "Board" } },
  ],
  "n3-settings-decisions": [],
  "n4-profile-tooltip": [
    { what: "5 MB note → avatar", text: /5 ?MB|upload/i, want: { type: ["Avatar", "Image"] } },
  ],
  "n5-responsive-board-note": [
    { what: "comparison note → board", text: /phone|mobile|desktop/i, want: { type: "Board" } },
  ],
  "n6-onboarding-screen-note": [
    { what: "skip note → notifications screen", text: /skip|already|granted|permission/i, want: { type: "Screen", label: /notif/i } },
    { what: "3 interests note → Continue button", text: /3|three|at least/i, want: { type: "Button", label: /continue/i, screen: /interest/i }, accept: { type: "Screen", label: /interest/i } },
  ],
  "n7-orders-table": [
    { what: "sortable note → table", text: /sort/i, want: { type: "Table" } },
    { what: "export note → Export button", text: /filter|export|download/i, want: { type: "Button", label: /export/i } },
  ],
};

function matches(t: Target, el: El | undefined, screenName: string) {
  if (!el) return false;
  const types = Array.isArray(t.type) ? t.type : [t.type];
  if (!types.includes(el.type)) return false;
  if (t.label && !t.label.test(label(el))) return false;
  if (t.screen && !t.screen.test(screenName)) return false;
  if (t.prop && el.props?.[t.prop[0]] !== t.prop[1]) return false;
  return true;
}

const body = (raw: string) => (raw.match(/```[\w-]*\n([\s\S]*?)```/)?.[1] ?? raw).trim();
const rows: any[] = [];
const totals: Record<string, { ok: number; partial: number; n: number; valid: number; files: number; misplaced: string[] }> = {};

for (const model of MODELS) {
  totals[model] = { ok: 0, partial: 0, n: 0, valid: 0, files: 0, misplaced: [] };
  for (const run of RUNS) {
    for (const task of Object.keys(EXPECT)) {
      const file = `${DIR}/out/${model}/${run}/${task}.tsq`;
      // a missing or unparseable file fails its checks instead of dropping out of the totals
      const unscored = (why: string) => {
        for (const x of EXPECT[task]) {
          totals[model].n++;
          totals[model].misplaced.push(`${run} ${task}: ${x.what}: ${why}`);
        }
      };
      if (!existsSync(file)) { rows.push({ model, run, task, missing: true }); unscored("missing file"); continue; }
      const { spec, issues } = compileWireframe(body(readFileSync(file, "utf8")));
      totals[model].files++;
      if (!issues.length) totals[model].valid++;
      if (!spec) { rows.push({ model, run, task, issues }); unscored("doesn't parse"); continue; }
      const els = spec.elements as Record<string, El>;
      const parent: Record<string, string> = {};
      for (const [id, e] of Object.entries(els)) for (const c of e.children ?? []) parent[c] = id;
      const screenOf = (id: string): string => {
        for (let p: string | undefined = id; p; p = parent[p]) if (els[p]?.type === "Screen") return label(els[p]);
        return "";
      };
      const notes = Object.entries(els).filter(([, e]) => e.type === "Note").map(([id, e]) => ({
        id, text: String(e.props?.text ?? ""), parentType: els[parent[id]]?.type, parentLabel: label(els[parent[id]]), screen: screenOf(parent[id]), parentEl: els[parent[id]],
      }));
      const tooltips = Object.entries(els).filter(([, e]) => typeof e.props?.tooltip === "string").map(([, e]) => ({ type: e.type, label: label(e), tooltip: e.props!.tooltip }));
      const checks = EXPECT[task].map((x) => {
        const note = notes.find((n) => x.text.test(n.text));
        let result = "no note";
        if (note) result = matches(x.want, note.parentEl, note.screen) ? "ok" : x.accept && matches(x.accept, note.parentEl, note.screen) ? "partial" : `under ${note.parentType} "${note.parentLabel}"`;
        totals[model].n++;
        if (result === "ok") totals[model].ok++;
        else if (result === "partial") totals[model].partial++;
        else totals[model].misplaced.push(`${run} ${task}: ${x.what}: ${result}`);
        return { what: x.what, result };
      });
      rows.push({ model, run, task, issues: issues.map((i) => `${i.line}: ${i.message}`), notes: notes.map(({ parentEl, ...n }) => n), tooltips, checks });
    }
  }
}

writeFileSync(`${DIR}/results.json`, JSON.stringify({ totals, rows }, null, 1));
for (const r of rows) {
  console.log(`\n== ${r.model} ${r.run} ${r.task}${r.missing ? " MISSING" : ""}`);
  if (r.missing) continue;
  if (r.issues?.length) console.log("  issues:", r.issues.join(" | "));
  for (const n of r.notes ?? []) console.log(`  note under ${n.parentType} "${n.parentLabel}"${n.screen ? ` [${n.screen}]` : ""}: ${n.text}`);
  for (const t of r.tooltips ?? []) console.log(`  tooltip on ${t.type} "${t.label}": ${t.tooltip}`);
  for (const c of r.checks ?? []) console.log(`  ${c.result === "ok" ? "✓" : c.result === "partial" ? "~" : "✗"} ${c.what}${c.result === "ok" ? "" : ` (${c.result})`}`);
}
console.log("\n== totals");
for (const [m, t] of Object.entries(totals)) console.log(`${m}: placement ${t.ok}/${t.n} ok, ${t.partial} acceptable; valid ${t.valid}/${t.files}`);
