/**
 * Component eval (0.4.0): do models reach for the new components (chart,
 * calendar, date and code inputs, progress, slider, pagination, bullets)
 * when a request needs them, and write them correctly? Requests describe the
 * screen, not the components. Separate from the format eval so its stored
 * outputs stay as tested.
 */
import type { Spec } from "@json-render/core";

type El = { type: string; props: Record<string, any> };
type Check = [label: string, test: (els: El[]) => boolean];

const of = (els: El[], type: string, pred: (p: Record<string, any>) => boolean = () => true) =>
  els.filter((e) => e.type === type && pred(e.props ?? {}));
const has = (type: string, pred?: (p: Record<string, any>) => boolean) => (els: El[]) => of(els, type, pred).length > 0;

export interface ComponentTask { id: string; prompt: string; checks: Check[] }

export const componentTasks: ComponentTask[] = [
  {
    id: "k01-analytics",
    prompt: "A desktop analytics dashboard: 4 stat cards in a row, a line chart of revenue over time, a bar chart of weekly signups, and a pie chart of traffic sources.",
    checks: [
      ["line chart", has("Chart", (p) => (p.kind ?? "line") === "line")],
      ["bar chart", has("Chart", (p) => p.kind === "bar")],
      ["pie or donut chart", has("Chart", (p) => p.kind === "pie" || p.kind === "donut")],
    ],
  },
  {
    id: "k02-booking",
    prompt: "A mobile hotel booking screen: check-in and check-out date fields, a guests selector, and a month calendar for October 2026 showing the selected stay from the 12th to the 18th. A primary Reserve button at the bottom.",
    checks: [
      ["two date inputs", (e) => of(e, "Input", (p) => p.type === "date").length >= 2],
      ["calendar with the stay as a range", has("Calendar", (p) => Array.isArray(p.range) && p.range[0] === 12 && p.range[1] === 18)],
    ],
  },
  {
    id: "k03-verify",
    prompt: "A mobile phone verification screen: a heading, 'Enter the 6-digit code we sent to (555) 010-2400', the code entry with the first 3 digits typed, a 'Resend code' link and a primary Verify button.",
    checks: [
      ["code input", has("Input", (p) => p.type === "code")],
      ["3 digits typed", has("Input", (p) => p.type === "code" && String(p.value ?? "").length === 3)],
    ],
  },
  {
    id: "k04-upload",
    prompt: "A desktop upload screen: an onboarding stepper at the top on step 2 of 4, two files uploading at 40% and 85%, and storage used shown as a circular indicator at 72%.",
    checks: [
      ["stepper 2 of 4", has("Progress", (p) => p.steps === 4 && p.step === 2)],
      ["two progress bars", (e) => of(e, "Progress", (p) => !p.steps && p.shape !== "circle").length >= 2],
      ["circular progress", has("Progress", (p) => p.shape === "circle")],
    ],
  },
  {
    id: "k05-pricing",
    prompt: "A desktop pricing page with three plan cards (Free, Pro, Team), each with a price and a button. Each plan lists its features with check marks; features a plan doesn't include are shown with a cross and greyed out.",
    checks: [
      ["feature lists with an icon", has("Bullets", (p) => !!p.icon || (p.items ?? []).some((i: any) => typeof i === "object" && i.icon))],
      ["a greyed-out item", has("Bullets", (p) => (p.items ?? []).some((i: any) => typeof i === "object" && i.muted))],
    ],
  },
  {
    id: "k06-results",
    prompt: "A mobile shop search results screen: a price range filter you can drag from both ends, a list of 5 products, and page navigation at the bottom showing page 2 of 9.",
    checks: [
      ["range slider", has("Slider", (p) => Array.isArray(p.range))],
      ["pagination 2 of 9", has("Pagination", (p) => p.pages === 9 && p.current === 2)],
    ],
  },
  {
    id: "k07-help",
    prompt: "A help article page on desktop: a title, a short intro, the setup steps as a numbered list, and a bulleted list of tips.",
    checks: [
      ["numbered list", has("Bullets", (p) => p.numbered === true)],
      ["bulleted list", has("Bullets", (p) => !p.numbered && !p.icon)],
    ],
  },
];

// 0.4.1: map, accordion, toast (scored in run1/run2 alongside the 0.4.0 tasks; their prompt is prompt-0.4.1.md)
componentTasks.push(
  {
    id: "k08-ride",
    prompt: "A mobile ride-hailing home screen: a map with the pickup location, a 'Where to?' search field over it, and two recent destinations below.",
    checks: [["map", has("Image", (p) => p.kind === "map")]],
  },
  {
    id: "k09-faq",
    prompt: "A desktop help page with an FAQ section: five questions, the first one expanded to show its answer, the rest collapsed.",
    checks: [
      ["an open accordion", has("Accordion", (p) => p.open === true)],
      ["four collapsed accordions", (e) => of(e, "Accordion", (p) => !p.open).length >= 4],
    ],
  },
  {
    id: "k10-saved",
    prompt: "A mobile settings screen right after the user saved changes: the settings form, and a brief 'Settings saved' confirmation message with an Undo action floating near the bottom.",
    checks: [["toast with an action", has("Toast", (p) => !!p.action)]],
  },
);

// 0.5.0: anchored overlays (prompt-0.5.0.md)
componentTasks.push(
  {
    id: "k11-country",
    prompt: "A mobile shipping address form with the Country dropdown opened, showing five countries with Mexico selected.",
    checks: [["open select with options", has("Select", (p) => p.open === true && (p.options ?? []).length >= 5 && p.value === "Mexico")]],
  },
  {
    id: "k12-datepicker",
    prompt: "A mobile flight search screen: from and to fields, and the departure date field with its calendar picker open on November 2026, the 20th selected.",
    checks: [["open date input", has("Input", (p) => p.type === "date" && p.open === true)]],
  },
  {
    id: "k13-kebab",
    prompt: "A desktop file list where the user has clicked the '…' button on one row, opening a menu with Rename, Move, Share and Delete.",
    checks: [
      ["open menu with 4 items", (e) => e.some((x) => ["Button", "ListItem", "NavBar"].includes(x.type) && x.props.open === true && (x.props.menu ?? []).length === 4)],
      ["menu on the row itself", has("ListItem", (p) => p.open === true && (p.menu ?? []).length === 4)],
    ],
  },
  {
    id: "k14-tooltip",
    prompt: "A desktop editor toolbar with icon buttons for bold, italic, link and image, with the tooltip 'Insert link (⌘K)' showing on the link button.",
    checks: [["a tooltip", (e) => e.some((x) => typeof x.props.tooltip === "string" && /link/i.test(x.props.tooltip))]],
  },
);

export function runComponentChecks(task: ComponentTask, spec: Spec) {
  const els = Object.values(spec.elements) as El[];
  return task.checks.map(([name, test]) => ({ name, pass: test(els) }));
}
