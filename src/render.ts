import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { Spec } from "@json-render/core";
import { renderToSvg } from "@json-render/image/render";
import { ID_PATTERN, UNIVERSAL_PROPS, catalog, componentDefinitions, listItemEnds, takesId, takesUniversalProps, universalPropMessage } from "./catalog.js";
import { monthGrid, withMarkers, withPalette, withTopLayer } from "./components.js";
import { findAnchors, overlayLayer, readMarkers, tagForMeasuring, type Anchor, type Rect } from "./anchors.js";
import { flowLabelWidth, flowLayer, flowMargin, type FlowBoxes } from "./flows.js";
import { paletteFor } from "./colors.js";
import { closeMatches, unknownComponentMessage } from "./suggest.js";
import { belongsElsewhere } from "./text.js";
import { upgradeSpec } from "./upgrade.js";
import {
  BOARD_GAP,
  BOARD_PADDING,
  LABEL_H,
  NOTE_WIDTH,
  TITLE_H,
  estimateNoteHeight,
  screenSize,
} from "./layout.js";

// Inter from @fontsource/inter, pinned to an exact version: a font change shifts
// text metrics and line wraps, so treat a bump like a renderer change.
const fontFile = (name: string) =>
  createRequire(import.meta.url).resolve(`@fontsource/inter/files/${name}`);

let fontCache: Promise<any[]> | null = null;
function loadFonts() {
  fontCache ??= Promise.all([
    readFile(fontFile("inter-latin-400-normal.woff")),
    readFile(fontFile("inter-latin-600-normal.woff")),
  ]).then(([regular, semibold]) => [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: semibold, weight: 600, style: "normal" },
  ]);
  return fontCache;
}

export class SpecError extends Error {
  constructor(public issues: string[]) {
    super(`Invalid wireframe spec:\n  - ${issues.join("\n  - ")}`);
  }
}

/**
 * `trailingIcon=chevron` on a list item: chevron is what the side shows, not an icon name.
 * Say so instead of suggesting chevron-right.
 */
function listItemKindHint(el: { type: string; props?: Record<string, unknown> }, path: PropertyKey[]): string | undefined {
  const prop = path[0];
  if (el.type !== "ListItem" || path.length !== 1 || (prop !== "leadingIcon" && prop !== "trailingIcon")) return undefined;
  const side = prop === "leadingIcon" ? "leading" : "trailing";
  const value = String(el.props?.[prop]);
  let schema = (componentDefinitions.ListItem.props as any).shape[side];
  while (schema && ["optional", "nullable", "default"].includes(schema.def?.type)) schema = schema.def.innerType;
  const kinds: string[] = schema?.options ?? [];
  if (value === "icon" || !kinds.includes(value)) return undefined;
  return `${value} is a ${side} kind, not an icon name: write ${side}=${value} instead of ${prop}=${value}`;
}

/** A prop value as it would be written: otp, "two words", 3, [a, b]. */
function written(v: unknown): string {
  if (typeof v === "string") return /^[^\s"[\]{}=,]+$/.test(v) ? v : JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(written).join(", ")}]`;
  return JSON.stringify(v) ?? String(v);
}

/**
 * Zod's message for an invalid prop, rewritten to name the prop and the value it got: the parser
 * strips the path when it maps errors to lines, and "Invalid option" alone doesn't say which prop
 * on the line is wrong. Messages written for one prop (an accent's "did you mean") are kept as they are.
 */
function propIssueMessage(props: Record<string, unknown>, issue: any): string {
  const path: PropertyKey[] = issue.path ?? [];
  if (!path.length || issue.code === "custom") return issue.message;
  const key = path.map(String).join(".");
  const value = path.reduce<any>((v, k) => (v == null ? v : v[k as any]), props);
  const given = `${key}=${written(value)}`;
  switch (issue.code) {
    case "invalid_value":
      return `${given} isn't an option; use one of ${(issue.values ?? []).map(written).join(", ")}`;
    case "invalid_union": {
      // a union of literals (Heading level 1 | 2 | 3): list what each branch accepts
      const options = (issue.errors ?? []).flat().flatMap((e: any) => (e.code === "invalid_value" ? e.values : []));
      if (options.length) return `${given} isn't an option; use one of ${options.map(written).join(", ")}`;
      return `${given} isn't a valid value`;
    }
    case "invalid_type":
      return `${given} should be ${issue.expected === "array" ? "a list like [a, b]" : `a ${issue.expected}`}`;
    case "too_small":
    case "too_big": {
      const [bound, n] = issue.code === "too_small" ? ["at least", issue.minimum] : ["at most", issue.maximum];
      if (issue.origin === "array") return `${given} needs ${bound} ${n} item${n == 1 ? "" : "s"}`;
      if (issue.origin === "string") return `${given} needs ${bound} ${n} character${n == 1 ? "" : "s"}`;
      return `${given} is too ${issue.code === "too_small" ? "small" : "large"} (${bound} ${n})`;
    }
    default:
      return `${given}: ${issue.message}`;
  }
}

/** Catalog validation plus the structural rules the renderer depends on. */
export function checkSpec(spec: Spec): string[] {
  upgradeSpec(spec as any); // older JSON is fine (icon → leadingIcon); see upgrade.ts
  const issues: string[] = [];
  const result = catalog.validate(spec);
  if (!result.success) {
    const err: any = (result as any).error;
    const zodIssues = err?.issues ?? [];
    if (zodIssues.length) {
      for (const i of zodIssues) issues.push(`${(i.path ?? []).join(".")}: ${i.message}`);
    } else {
      issues.push(String(err ?? "catalog validation failed"));
    }
  }

  const root = spec.elements?.[spec.root];
  if (!root) {
    issues.push(`root "${spec.root}" is not in elements`);
    return issues;
  }
  if (root.type !== "Board") issues.push(`root must be a Board (got ${root.type})`);

  for (const [id, el] of Object.entries(spec.elements)) {
    // catalog.validate checks the spec's shape but not each element's props,
    // so validate props against the component's Zod schema here.
    const def = (componentDefinitions as Record<string, { props: any }>)[el.type];
    // Props that failed validation: a check that uses one of their values is skipped below, so one
    // wrong value (type=otp) is one error, not also "digits only applies to type=code". Checks that
    // only see that a prop is set (an icon on an avatar item) still run: fixing the value won't fix them.
    const bad = new Set<string>();
    const failed = (...keys: string[]) => keys.some((k) => bad.has(k));
    if (!def) {
      issues.push(`${id}: ${unknownComponentMessage(el.type, Object.keys(componentDefinitions))}`);
    } else {
      const parsed = def.props.safeParse(el.props ?? {});
      if (!parsed.success) {
        for (const i of parsed.error.issues) {
          if (i.path.length) bad.add(String(i.path[0]));
          issues.push(`${id}.props${i.path.length ? "." + i.path.join(".") : ""}: ${listItemKindHint(el, i.path) ?? propIssueMessage(el.props ?? {}, i)}`);
        }
      }
      // Zod drops unknown keys silently; report them so the author (or model) hears about it.
      for (const key of Object.keys(el.props ?? {})) {
        if (key === "id" && takesId(el.type)) {
          const v = (el.props as any).id;
          if (typeof v !== "string" || !ID_PATTERN.test(v)) issues.push(`${id}: the id "${v}" should be a word: letters, digits, - and _, starting with a letter`);
          continue;
        }
        if (key in UNIVERSAL_PROPS) {
          if (!takesUniversalProps(el.type)) issues.push(`${id}: ${universalPropMessage(el.type, key)}`);
          else {
            const r = (UNIVERSAL_PROPS as any)[key].safeParse((el.props as any)[key]);
            if (!r.success) issues.push(`${id}.props.${key}: ${r.error.issues[0].message}`);
          }
          continue;
        }
        if (!(key in def.props.shape)) {
          const elsewhere = belongsElsewhere(el.type, key, true, (el.props as any)[key]);
          issues.push(`${id}.props: ${el.type} has no prop "${key}"${elsewhere ? `: ${elsewhere}` : ""}`);
        }
      }
    }
    for (const child of el.children ?? []) {
      if (!spec.elements[child]) issues.push(`${id}: child "${child}" does not exist`);
    }
    if (el.type === "Screen" && !(root.children ?? []).includes(id)) {
      issues.push(`${id}: Screen must be a direct child of the Board`);
    }
    if (el.type === "Modal" || el.type === "Drawer" || el.type === "Toast") {
      const parent = Object.entries(spec.elements).find(([, p]) => p.children?.includes(id));
      if (parent && parent[1].type !== "Screen") {
        issues.push(`${id}: ${el.type} must be a direct child of a Screen (found in ${parent[1].type} "${parent[0]}")`);
      }
    }
    // A ListItem value that its leading/trailing kind wouldn't show (icon=star with leading=avatar).
    if (el.type === "ListItem") {
      const p = (el.props ?? {}) as Record<string, string | undefined>;
      const { leading, trailing } = listItemEnds(p);
      const conflict = (prop: string, needs: string, kind: string, has: string) =>
        issues.push(`${id}: ${prop} only shows with ${needs} (this item has ${kind}=${has}); remove one of them`);
      if (p.leadingIcon && leading !== "icon" && !failed("leading")) conflict("leadingIcon", "leading=icon", "leading", leading!);
      if (p.trailingIcon && trailing !== "icon" && !failed("trailing")) conflict("trailingIcon", "trailing=icon", "trailing", trailing!);
      if (p.trailingText && trailing !== "text" && trailing !== "badge" && !failed("trailing")) conflict("trailingText", "trailing=text or badge", "trailing", trailing!);
    }
    // Values that contradict each other would draw something odd rather than fail; say which.
    {
      const p = (el.props ?? {}) as Record<string, any>;
      // reads: the props whose values a check uses; it's skipped if one of them already failed validation
      const say = (msg: string, ...reads: string[]) => !failed(...reads) && issues.push(`${id}: ${msg}`); // compile adds the component name
      const backwards = (r: unknown) => Array.isArray(r) && r.length === 2 && r[0] > r[1];
      if (el.type === "Progress") {
        if (p.step != null && p.steps == null) say(`step only shows with steps (e.g. steps=4 step=${typeof p.step === "number" ? p.step : 2})`);
        if (p.step != null && p.steps != null && p.step > p.steps) say(`step=${p.step} is past the last step (steps=${p.steps})`, "step", "steps");
        if (p.steps != null && p.shape === "circle") say("a stepper (steps) can't also be a circle; remove one of them", "shape");
      }
      if (el.type === "Pagination" && p.current != null && p.pages != null && p.current > p.pages) {
        say(`current=${p.current} is past the last page (pages=${p.pages})`, "current", "pages");
      }
      if (el.type === "Slider" && backwards(p.range)) say(`range=[${p.range.join(", ")}] goes backwards; write the smaller number first`, "range");
      if (el.type === "Slider" && p.range && p.value != null) say("a slider has value (one handle) or range (two), not both");
      if (el.type === "Calendar") {
        const { days } = monthGrid(p.month);
        const all = [p.selected, ...(p.range ?? []), ...(p.marked ?? [])].filter((d) => typeof d === "number");
        const late = all.find((d: number) => d > days);
        if (late) say(`day ${late} isn't in ${p.month ?? "the month"} (it has ${days} days)`, "month", "selected", "range", "marked");
        if (backwards(p.range)) say(`range=[${p.range.join(", ")}] goes backwards; write the earlier day first`, "range");
        if (p.range && p.selected != null) say("a calendar has selected (one day) or range (several), not both");
      }
      if (el.type === "Input" && p.type === "code" && p.value != null && String(p.value).length > (p.digits ?? 6)) {
        say(`value has ${String(p.value).length} characters but the code has ${p.digits ?? 6} boxes (digits)`, "type", "value", "digits");
      }
      if (el.type === "Input" && p.digits != null && p.type !== "code") say("digits only applies to type=code", "type");
      if (el.type === "Input" && p.open && p.type !== "date") say("open shows a date picker, so it needs type=date", "type");
      if ((el.type === "Button" || el.type === "ListItem" || el.type === "NavBar") && p.open && !(Array.isArray(p.menu) && p.menu.length)) say("open shows the menu; add menu=[…] with its items", "menu");
      if (el.type === "Select" && p.open && !(Array.isArray(p.options) && p.options.length)) say("open shows the options list; add options=[…] with the choices", "options");
    }
    // The renderer would silently drop extra cells. Usually the cause is an unquoted
    // cell with a space, which the text syntax splits into two.
    if (el.type === "Table") {
      const { columns, data } = (el.props ?? {}) as { columns?: unknown; data?: unknown };
      if (Array.isArray(columns) && Array.isArray(data)) {
        const bad = data
          .map((row, i) => ({ row: i + 1, cells: Array.isArray(row) ? row.length : 1 }))
          .filter((r) => r.cells !== columns.length);
        if (bad.length) {
          const cells = (n: number) => `${n} cell${n === 1 ? "" : "s"}`;
          const rows = bad.length === 1
            ? `data row ${bad[0].row} has ${cells(bad[0].cells)}`
            : `data rows ${bad.map((r) => `${r.row} (${cells(r.cells)})`).join(", ")} don't match`;
          const hints = [
            bad.some((r) => r.cells > columns.length) && `quote cells that contain a comma, e.g. ["$1,200", Paid]`,
            bad.some((r) => r.cells < columns.length) && `use "" for an empty cell`,
          ].filter(Boolean);
          issues.push(`${id}: Table has ${columns.length} columns, but ${rows} (${hints.join("; ")})`);
        }
      }
    }
  }
  // Element ids (#name) and the flows that point at them. Ids ignore case: #Home and home match.
  const owners = new Map<string, { key: string; id: string }>(); // lowercased id → element key, id as written
  for (const [key, el] of Object.entries(spec.elements)) {
    const ref = (el.props as any)?.id;
    if (typeof ref !== "string" || !takesId(el.type)) continue;
    const other = owners.get(ref.toLowerCase());
    if (other) issues.push(`${key}: the id #${ref} is also used by ${spec.elements[other.key].type} "${other.key}"${other.id === ref ? "" : ` (as #${other.id}; ids ignore case)`}; ids must be unique`);
    else owners.set(ref.toLowerCase(), { key, id: ref });
  }
  const written = [...owners.values()].map((o) => o.id);
  const parentOf = new Map<string, string>();
  for (const [k, el] of Object.entries(spec.elements)) for (const c of el.children ?? []) parentOf.set(c, k);
  for (const [key, el] of Object.entries(spec.elements)) {
    if (el.type !== "Flow") continue;
    if (!(root.children ?? []).includes(key)) issues.push(`${key}: flow lines go at the board level, after the screens (indented like a screen)`);
    const p = (el.props ?? {}) as Record<string, any>;
    for (const end of ["from", "to"] as const) {
      if (typeof p[end] !== "string") continue;
      const owner = owners.get(p[end].toLowerCase());
      if (owner) {
        // a closed accordion doesn't draw its contents, so an arrow can't point at them
        for (let k = parentOf.get(owner.key); k; k = parentOf.get(k)) {
          const el = spec.elements[k];
          if (el?.type === "Accordion" && !(el.props as any)?.open) {
            issues.push(`${key}: #${owner.id} is inside Accordion "${k}", which is closed, so it isn't drawn; add open to the accordion, or give the accordion the id instead`);
            break;
          }
        }
        continue;
      }
      const close = closeMatches(p[end], written);
      issues.push(
        `${key}: no element has the id #${p[end]}` +
          (close.length ? ` (did you mean ${close.map((c) => "#" + c).join(", ")}?)` : owners.size ? ` (ids on this board: ${written.map((c) => "#" + c).join(", ")})` : "; name an element by writing #name after it"),
      );
    }
    if (typeof p.from === "string" && typeof p.to === "string" && p.from.toLowerCase() === p.to.toLowerCase()) issues.push(`${key}: a flow needs two different ends (both are #${p.from})`);
  }
  return issues;
}

export interface BoardItem {
  type: "Screen" | "Note";
  /** Screen name or note text, for labels in tools like the playground. */
  name: string;
  /** Box on the board in px, including the screen's name label above its frame. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where everything sits on the board: the canvas size (Satori needs it up
 * front) and each screen's and note's box, laid out in rows exactly as the
 * Board component does.
 */
export function boardLayout(spec: Spec, opts: { flows?: boolean } = {}): { width: number; height: number; items: BoardItem[]; gap: number } {
  const board = spec.elements[spec.root];
  const p = (board.props ?? {}) as Record<string, any>;
  const pad = p.padding ?? BOARD_PADDING;
  // screens and notes are laid out; flow lines are drawn over them
  const laidOut = (board.children ?? []).filter((id) => spec.elements[id]?.type === "Screen" || spec.elements[id]?.type === "Note");
  const kids = laidOut.map((id) => spec.elements[id]);
  // a labeled flow between neighboring screens needs a gap its label fits in (unless the board sets gap=)
  const gap = p.gap ?? (opts.flows !== false ? Math.max(BOARD_GAP, flowLabelGap(spec, laidOut, p.layout === "grid" ? Math.max(1, p.columns ?? 3) : laidOut.length)) : BOARD_GAP);

  const boxes = kids.map((el) => {
    const props = (el.props ?? {}) as Record<string, any>;
    if (el.type === "Screen") {
      const s = screenSize(props);
      return { type: "Screen" as const, name: String(props.name ?? ""), w: s.width, h: s.height + LABEL_H };
    }
    if (el.type === "Note") {
      const w = props.width ?? NOTE_WIDTH;
      return { type: "Note" as const, name: String(props.text ?? ""), w, h: LABEL_H + estimateNoteHeight(props.text ?? "", w) };
    }
    return null;
  });

  const perRow = p.layout === "grid" ? Math.max(1, p.columns ?? 3) : Math.max(1, boxes.length);
  const items: BoardItem[] = [];
  let width = 0;
  let y = pad + (p.title ? TITLE_H : 0);
  for (let i = 0; i < boxes.length; i += perRow) {
    const row = boxes.slice(i, i + perRow);
    if (i > 0) y += gap;
    let x = pad;
    for (const b of row) {
      if (b) items.push({ type: b.type, name: b.name, x, y, width: b.w, height: b.h });
      x += (b?.w ?? 0) + gap;
    }
    width = Math.max(width, row.reduce((sum, b) => sum + (b?.w ?? 0), 0) + gap * (row.length - 1));
    y += Math.max(...row.map((b) => b?.h ?? 0));
  }
  // room under the screens for backward flows, when flows are drawn
  const flowCount = (board.children ?? []).filter((id) => spec.elements[id]?.type === "Flow").length;
  const flowRoom = opts.flows !== false && flowCount ? flowMargin(flowCount) : 0;
  return { width: Math.ceil(width + pad * 2), height: Math.ceil(y + pad + flowRoom), items, gap };
}

/** The widest label on a flow between neighboring screens, plus room for its line on each side (0 if none). */
function flowLabelGap(spec: Spec, laidOut: string[], perRow: number) {
  const els = spec.elements;
  const parent = new Map<string, string>();
  for (const [key, el] of Object.entries(els)) for (const c of el.children ?? []) parent.set(c, key);
  const ids = new Map<string, string>();
  for (const [key, el] of Object.entries(els)) if (typeof (el.props as any)?.id === "string") ids.set((el.props as any).id.toLowerCase(), key);
  const slot = (id: unknown) => {
    let k = ids.get(String(id).toLowerCase());
    while (k && els[k]?.type !== "Screen") k = parent.get(k);
    return k ? laidOut.indexOf(k) : -1;
  };
  let widest = 0;
  for (const key of els[spec.root].children ?? []) {
    const f = els[key];
    if (f?.type !== "Flow" || !(f.props as any)?.label) continue;
    const a = slot((f.props as any).from), b = slot((f.props as any).to);
    if (a < 0 || b < 0 || Math.abs(a - b) !== 1 || Math.floor(a / perRow) !== Math.floor(b / perRow)) continue;
    widest = Math.max(widest, flowLabelWidth(String((f.props as any).label)));
  }
  return widest ? widest + 32 : 0;
}

/** The canvas size for a board. */
export function boardSize(spec: Spec, opts: { flows?: boolean } = {}) {
  const { width, height } = boardLayout(spec, opts);
  return { width, height };
}

export interface RenderWireframeOptions {
  /** Skip validation (e.g. while a spec is still streaming in). */
  skipValidation?: boolean;
  /** Draw flow arrows (default true). Off, the board looks exactly as if it had no flow lines. */
  flows?: boolean;
}

export async function renderWireframeSvg(spec: Spec, opts: RenderWireframeOptions = {}) {
  upgradeSpec(spec as any);
  if (!opts.skipValidation) {
    const issues = checkSpec(spec);
    if (issues.length) throw new SpecError(issues);
  }
  const flowsOn = opts.flows !== false;
  const { width, height, gap } = boardLayout(spec, { flows: opts.flows });
  // the board's gap may have grown to fit flow labels: the Board component reads it from its props
  const board = spec.elements[spec.root];
  if (((board.props ?? {}) as Record<string, any>).gap == null && gap !== BOARD_GAP)
    spec = { ...spec, elements: { ...spec.elements, [spec.root]: { ...board, props: { ...board.props, gap } } } };
  const palette = paletteFor((spec.elements[spec.root]?.props as any)?.accent);
  const registry = withPalette(palette);
  const draw = async (s: Spec, reg: typeof registry) =>
    renderToSvg(s, { registry: reg as any, includeStandard: false, fonts: await loadFonts(), width, height });

  // Anchored overlays (open selects and date pickers, menus, tooltips) and flow arrows need element
  // positions, which Satori doesn't report: measure in a first pass, then draw them on top.
  const flows = flowsOn ? flowEnds(spec) : null;
  const { anchors, boxes } = await measureAnchors(spec, flows?.measure ?? []);
  if (!anchors.length && !flows?.list.length) return draw(spec, registry);
  const layers = [];
  // flows first: open menus, pickers and tooltips are part of the screen's UI and stay on top
  if (flows?.list.length) {
    const resolved = flows.list
      // an end that wasn't measured (not drawn) falls back to its screen rather than dropping the arrow
      .map(({ key, from, to }) => ({ key, ends: { from: flows.box(from, boxes) ?? flows.screenBox(from), to: flows.box(to, boxes) ?? flows.screenBox(to), fromScreen: flows.screenBox(from), toScreen: flows.screenBox(to) } }))
      .filter((f): f is { key: string; ends: FlowBoxes } => !!(f.ends.from && f.ends.to && f.ends.fromScreen && f.ends.toScreen));
    layers.push(flowLayer(spec, resolved, flows.screens, flows.gap, palette, { width, height }));
  }
  if (anchors.length) layers.push(overlayLayer(spec, anchors, boxes, palette, registry.Calendar as any));
  return draw(spec, withTopLayer(registry, layers));
}

/**
 * The flows on a board and how to find their ends: element ends are measured (`measure`), screen
 * ends come from the board layout. `box(key, boxes)` gives an end's box once measured.
 */
function flowEnds(spec: Spec) {
  const els = spec.elements;
  const byId = new Map<string, string>(); // #id → element key
  for (const [key, el] of Object.entries(els)) if (typeof (el.props as any)?.id === "string") byId.set((el.props as any).id.toLowerCase(), key);
  const parent = new Map<string, string>();
  for (const [key, el] of Object.entries(els)) for (const c of el.children ?? []) parent.set(c, key);
  const screenOf = (key: string): string | undefined => {
    let k: string | undefined = key;
    while (k && els[k]?.type !== "Screen") k = parent.get(k);
    return k;
  };
  // screen frames, from the layout (screens and notes are laid out in board order)
  const { items } = boardLayout(spec);
  const laidOut = (els[spec.root].children ?? []).filter((k) => els[k]?.type === "Screen" || els[k]?.type === "Note");
  const screenRects = new Map<string, Rect>();
  laidOut.forEach((k, i) => {
    const it = items[i];
    if (it && els[k].type === "Screen") screenRects.set(k, { x: it.x, y: it.y + LABEL_H, w: it.width, h: it.height - LABEL_H });
  });
  const list = (els[spec.root].children ?? [])
    .filter((k) => els[k]?.type === "Flow")
    .map((key) => {
      const p = (els[key].props ?? {}) as Record<string, any>;
      return { key, from: byId.get(String(p.from).toLowerCase()), to: byId.get(String(p.to).toLowerCase()) };
    })
    .filter((f): f is { key: string; from: string; to: string } => !!f.from && !!f.to);
  const measure = [...new Set(list.flatMap((f) => [f.from, f.to]))].filter((k) => els[k].type !== "Screen");
  return {
    list,
    measure,
    screens: [...screenRects.values()],
    screenBox: (key: string) => screenRects.get(screenOf(key) ?? ""),
    gap: ((els[spec.root].props ?? {}) as Record<string, any>).gap ?? BOARD_GAP,
    box: (key: string, boxes: Record<string, Rect>) => (els[key].type === "Screen" ? screenRects.get(key) : boxes[key]),
  };
}

/**
 * The measuring pass: the board's anchored elements (and their screens) and their boxes on the
 * canvas, keyed by element id (`<id>#field` for a field). No render at all when there are none.
 */
export async function measureAnchors(spec: Spec, extra: string[] = []) {
  const anchors = findAnchors(spec);
  // other elements to measure (flow ends): tagged like a tooltip's element, as their own "screen"
  const extras: Anchor[] = extra.map((id) => ({ id, screen: id, kind: "tooltip", field: false }));
  if (!anchors.length && !extras.length) return { anchors, boxes: {} as Record<string, Rect> };
  const { width, height } = boardSize(spec);
  // Measured without the accent: color never changes layout, and a custom accent could otherwise
  // share a marker's color (#feXXXX). No theme color starts with #fe.
  const registry = withPalette(paletteFor());
  const { tagged, colors } = tagForMeasuring(spec, [...anchors, ...extras]);
  const svg = await renderToSvg(tagged, { registry: withMarkers(registry) as any, includeStandard: false, fonts: await loadFonts(), width, height });
  return { anchors, boxes: readMarkers(svg, colors) };
}

export async function renderWireframePng(spec: Spec, opts: RenderWireframeOptions & { scale?: number } = {}) {
  const svg = await renderWireframeSvg(spec, opts);
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, { fitTo: { mode: "zoom", value: opts.scale ?? 1 } });
  return resvg.render().asPng();
}
