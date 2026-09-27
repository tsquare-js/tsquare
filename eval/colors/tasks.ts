/**
 * Color eval: do models use the three color props (Board accent, Badge tone,
 * Input error) when asked, leave them out when not, and avoid inventing others?
 * Separate from the format eval so its stored outputs and prompts stay as tested.
 */
import type { Spec } from "@json-render/core";

type El = { type: string; props: Record<string, any> };
type Check = [label: string, test: (els: El[]) => boolean];

const of = (els: El[], type: string, pred: (p: Record<string, any>) => boolean = () => true) =>
  els.filter((e) => e.type === type && pred(e.props ?? {}));
const accent = (els: El[]) => String(of(els, "Board")[0]?.props.accent ?? "").toLowerCase();
const label = (re: RegExp) => (p: Record<string, any>) => re.test(String(p.label ?? ""));

export interface ColorTask { id: string; prompt: string; checks: Check[] }

export const colorTasks: ColorTask[] = [
  {
    id: "c01-brand-name",
    prompt: "A mobile checkout screen for a coffee shop app whose brand color is green: order summary, a payment method select, a 'Save card' toggle and a primary Pay button.",
    checks: [
      ["accent green", (e) => accent(e) === "green" || /^#[0-9a-f]{6}$/.test(accent(e))],
      ["primary button", (e) => of(e, "Button", (p) => (p.variant ?? "primary") === "primary").length > 0],
      ["toggle", (e) => of(e, "Toggle").length > 0],
    ],
  },
  {
    id: "c02-brand-hex",
    prompt: "A desktop sign-up page in our brand color #FF5A1F: name, email and password fields, a terms checkbox, and a primary Create account button.",
    checks: [
      ["accent is the hex", (e) => accent(e) === "#ff5a1f"],
      ["checkbox", (e) => of(e, "Checkbox").length > 0],
      ["primary button", (e) => of(e, "Button", (p) => (p.variant ?? "primary") === "primary").length > 0],
    ],
  },
  {
    id: "c03-status-badges",
    prompt: "A desktop orders page: a table of recent orders, and below it a list of 3 orders each showing a colored status badge — Paid (green), Pending (amber) and Failed (red).",
    checks: [
      ["success badge", (e) => of(e, "Badge", (p) => p.tone === "success").length > 0],
      ["warning badge", (e) => of(e, "Badge", (p) => p.tone === "warning").length > 0],
      ["danger badge", (e) => of(e, "Badge", (p) => p.tone === "danger").length > 0],
    ],
  },
  {
    id: "c04-form-errors",
    prompt: "A mobile sign-up form after a failed submit: the email field shows 'Enter a valid email' and the password field shows 'At least 8 characters', both as validation errors. The name field is fine.",
    checks: [
      ["2 error inputs", (e) => of(e, "Input", (p) => p.error === true).length >= 2],
      ["error helper text", (e) => of(e, "Input", (p) => p.error === true && !!p.helper).length >= 2],
      ["name not in error", (e) => of(e, "Input", (p) => !p.error).length >= 1],
    ],
  },
  {
    id: "c05-purple",
    prompt: "A mobile habit tracker home screen with a purple theme: tabs for Today and Week, a list of habits with checkboxes (two checked), and a tab bar with 3 tabs.",
    checks: [
      ["purple-ish accent", (e) => ["violet", "indigo"].includes(accent(e)) || /^#[0-9a-f]{6}$/.test(accent(e))],
      ["tabs", (e) => of(e, "Tabs").length > 0],
      ["tab bar", (e) => of(e, "TabBar").length > 0],
    ],
  },
  {
    id: "c06-unsupported",
    prompt: "A mobile account settings screen. Make the top bar dark navy, the section headings teal, and the Delete account button red.",
    checks: [
      ["delete button", (e) => of(e, "Button", label(/delete/i)).length > 0],
    ],
  },
  {
    id: "c07-no-color",
    prompt: "A mobile notes list screen with a search field, filter tabs (All, Pinned), 4 notes, and a New note button.",
    checks: [
      ["stays grayscale", (e) => !accent(e)],
      ["no badge tones", (e) => of(e, "Badge", (p) => !!p.tone).length === 0],
    ],
  },
];

export function runColorChecks(task: ColorTask, spec: Spec) {
  const els = Object.values(spec.elements) as El[];
  return task.checks.map(([name, test]) => {
    let pass = false;
    try { pass = test(els); } catch {}
    return { name, pass };
  });
}
