/**
 * Element positions: where every element and flow of a board is drawn, for laying hit boxes over
 * the image (click an element to comment on it or ask for a change), and what is under a point.
 *
 * measureElements renders the board once more with a marker on every element (the measuring pass
 * of anchored overlays, see anchors.tsx) and reads the boxes back. Flow lines come from the same
 * layout the renderer draws them with. elementsAt and elementsAtLine are plain lookups on its result,
 * so measure once per text and look up as often as needed (they also run on the JSON in a browser).
 */
import type { Spec } from "@json-render/core";
import { renderToSvg } from "@json-render/image/render";
import { findAnchors, overlayBoxes, readMarkers, tagForMeasuring, type Anchor, type Rect } from "./anchors.js";
import { paletteFor } from "./colors.js";
import { withMarkers, withPalette } from "./components.js";
import { flowPolyline, layoutFlows } from "./flows.js";
import { loadFonts } from "./fonts.js";
import { LABEL_H } from "./layout.js";
import { componentDefinitions, type ComponentName } from "./catalog.js";
import { boardLayout, checkSpec, flowEnds, SpecError, withBoardGap, withNoteHeights } from "./render.js";
import { PRIMARY_PROP } from "./text.js";
import { upgradeSpec } from "./upgrade.js";

/** A box on the board, in board pixels: the same coordinates as the rendered SVG. */
export interface MeasuredBox { x: number; y: number; width: number; height: number }

export interface MeasuredElement {
  /** The element's line in the wireframe text; 0 when `lines` doesn't have it. */
  line: number;
  /** The last line of its block (its children included); `line` when it has no children. */
  endLine: number;
  /** Its #id, when the text gives one. */
  id?: string;
  /** "Button", "Screen", … */
  type: Exclude<ComponentName, "Flow">;
  /** Its main text: a button's label, a screen's name, a heading's text. */
  label?: string;
  /** The line of the screen it's on; null for the board, screens and notes beside them. */
  screenLine: number | null;
  /** The line of the element containing it; null for the board. */
  parentLine: number | null;
  /**
   * Where it's drawn: the part that shows, for content cut off by its screen (past the bottom, or
   * under a tab bar) or by a drawer's panel. A screen's box is its frame. Can be 0 wide or 0 tall
   * (a spacer in a row): such an element is listed, but never under a point.
   */
  box: MeasuredBox;
  /** Screens: the band above the frame with the screen's name. */
  labelBox?: MeasuredBox;
  /** Its open menu, option list or date picker, and its tooltip, in drawing order (a tooltip's and a date picker's size within a few px). */
  overlays?: MeasuredBox[];
  /** Modals and drawers: whether the screen behind is dimmed (on unless the text says no-scrim). */
  scrim?: boolean;
}

export interface MeasuredFlow {
  /** The flow's line in the wireframe text; 0 when `lines` doesn't have it. */
  line: number;
  /** Always `line`: a flow has no children. */
  endLine: number;
  type: "Flow";
  label?: string;
  /** The ids it connects, as written in the flow line. */
  from: string;
  to: string;
  /** The lines of the elements (or screens) it connects. */
  fromLine: number;
  toLine: number;
  /** The drawn line as points, from the tip of one end's marker to the other's; curves and corners are sampled. */
  path: [number, number][];
  /** The label pill. */
  labelBox?: MeasuredBox;
}

export type Measured = MeasuredElement | MeasuredFlow;

const isFlow = (e: Measured): e is MeasuredFlow => e.type === "Flow";

export interface MeasureOptions {
  /** As passed to renderWireframeSvg (default true): flow labels can widen the gaps between screens, so the boxes only match a render with the same setting. */
  flows?: boolean;
  /** Skip validation (as renderWireframeSvg). */
  skipValidation?: boolean;
}

/** Dim their screen while open (unless no-scrim): a click on the dimmed part is a click on the screen. */
const COVERS_SCREEN = new Set(["Modal", "Drawer"]);
const OVERLAYS = new Set(["Modal", "Drawer", "Toast"]);

/** Components that hold others (stacks, cards, modals, screens, …): from the catalog, not from the lines. */
const CONTAINERS = new Set(Object.entries(componentDefinitions).filter(([, d]) => d.slots.length).map(([name]) => name));
/** A screen's bars: drawn over its whole frame, not cut off with its content. */
const BARS = new Set(["NavBar", "TabBar"]);

const toBox = (r: Rect): MeasuredBox => ({ x: round(r.x), y: round(r.y), width: round(r.w), height: round(r.h) });
const round = (n: number) => Math.round(n * 100) / 100;
/** The part of `r` inside `to`; null when none of it is (an element 0 wide or 0 tall is kept). */
function clip(r: Rect, to: Rect | null | undefined): Rect | null {
  if (!to) return r;
  const x = Math.max(r.x, to.x), y = Math.max(r.y, to.y);
  const w = Math.min(r.x + r.w, to.x + to.w) - x, h = Math.min(r.y + r.h, to.y + to.h) - y;
  return w >= 0 && h >= 0 && (w > 0 || r.w === 0) && (h > 0 || r.h === 0) ? { x, y, w, h } : null;
}

/**
 * Every element and flow on the board and where it's drawn, in drawing order (what's drawn later
 * sits on top), starting with the board. `lines` maps the spec's element keys to source lines:
 * compileWireframe returns it.
 * Elements that aren't drawn (content entirely cut off, children of a closed accordion) are left out.
 */
export async function measureElements(spec: Spec, lines: Record<string, number>, opts: MeasureOptions = {}): Promise<[MeasuredElement, ...Measured[]]> {
  upgradeSpec(spec as any);
  if (!opts.skipValidation) {
    const issues = checkSpec(spec);
    if (issues.length) throw new SpecError(issues);
  }
  spec = await withNoteHeights(spec);
  const { width, height } = boardLayout(spec, { flows: opts.flows });
  spec = withBoardGap(spec, opts.flows);
  const els = spec.elements;

  // one measuring pass: a marker on every element, plus what anchored overlays are placed from
  const anchors = findAnchors(spec);
  const every: Anchor[] = Object.keys(els)
    .filter((k) => !["Board", "Screen", "Flow"].includes(els[k].type))
    .map((id) => ({ id, screen: id, kind: "tooltip", field: false }));
  const screens = Object.keys(els).filter((k) => els[k].type === "Screen");
  const { tagged, colors } = tagForMeasuring(spec, [...anchors, ...every], screens);
  const svg = await renderToSvg(tagged, { registry: withMarkers(withPalette(paletteFor())) as any, includeStandard: false, fonts: await loadFonts(), width, height });
  const boxes = readMarkers(svg, colors);

  // screens from the layout: the frame below the name band
  const { items } = boardLayout(spec, { flows: opts.flows });
  const laidOut = (els[spec.root].children ?? []).filter((k) => els[k]?.type === "Screen" || els[k]?.type === "Note");
  const frames = new Map<string, Rect>(), bands = new Map<string, Rect>();
  laidOut.forEach((k, i) => {
    const it = items[i];
    if (!it || els[k].type !== "Screen") return;
    frames.set(k, { x: it.x, y: it.y + LABEL_H, w: it.width, h: it.height - LABEL_H });
    bands.set(k, { x: it.x, y: it.y, w: it.width, h: LABEL_H });
  });
  const overlays = new Map<string, Rect[]>();
  for (const o of overlayBoxes(spec, anchors, boxes)) overlays.set(o.id, [...(overlays.get(o.id) ?? []), o.box]);

  const lineOf = (k: string | null) => (k == null ? null : lines[k] ?? 0);
  const endLine = (k: string): number => Math.max(lines[k] ?? 0, ...(els[k].children ?? []).filter((c) => els[c]).map(endLine));
  const labelOf = (k: string) => {
    const p = (els[k].props ?? {}) as Record<string, any>;
    const v = p[PRIMARY_PROP[els[k].type] ?? ""];
    return typeof v === "string" ? v : undefined;
  };

  const out: Measured[] = [];
  // `cut`: what clips the element (its screen's content area or frame, a drawer's panel)
  const visit = (k: string, parent: string | null, screen: string | null, cut: Rect | null) => {
    const el = els[k];
    if (!el || el.type === "Flow") return;
    const p = (el.props ?? {}) as Record<string, any>;
    const base = { line: lineOf(k)!, endLine: endLine(k), ...(typeof p.id === "string" ? { id: p.id } : {}), type: el.type as MeasuredElement["type"], ...(labelOf(k) != null ? { label: labelOf(k) } : {}), screenLine: lineOf(screen), parentLine: lineOf(parent) };
    let entry: MeasuredElement | null = null;
    if (el.type === "Board") entry = { ...base, box: { x: 0, y: 0, width, height } };
    else if (el.type === "Screen") {
      const frame = frames.get(k);
      if (frame) entry = { ...base, box: toBox(frame), labelBox: toBox(bands.get(k)!) };
    } else {
      const r = boxes[k];
      const seen = r && clip(r, cut);
      if (seen) {
        // menus and tooltips are drawn over the screen below its status or browser bar, clipped there
        const view = screen ? boxes[screen] ?? frames.get(screen) : undefined;
        const os = (overlays.get(k) ?? []).map((o) => clip(o, view)).filter((o): o is Rect => !!o && o.w > 0 && o.h > 0);
        entry = { ...base, box: toBox(seen), ...(os.length ? { overlays: os.map(toBox) } : {}), ...(COVERS_SCREEN.has(el.type) ? { scrim: p.scrim ?? true } : {}) };
      }
    }
    if (entry) out.push(entry);
    const inScreen = el.type === "Screen" ? k : screen;
    const kids = el.children ?? [];
    if (el.type === "Screen") {
      // its bars and overlays are drawn over the frame; its content is cut off between the bars
      const frame = frames.get(k) ?? null;
      const body = clip(boxes[`${k}#body`] ?? frame!, frame);
      const over = (c: string) => OVERLAYS.has(els[c]?.type);
      for (const c of [...kids.filter((c) => !over(c)), ...kids.filter(over)]) visit(c, k, k, BARS.has(els[c]?.type) || over(c) ? frame : body);
    } else {
      // a drawer's panel clips what's in it
      const inner = el.type === "Drawer" && boxes[k] ? clip(boxes[k], cut) : cut;
      for (const c of kids) visit(c, k, inScreen, inner);
    }
  };
  visit(spec.root, null, null, null);

  // flows, drawn over the screens
  if (opts.flows !== false) {
    const flows = flowEnds(spec);
    const resolved = flows.resolve(boxes);
    const ends = new Map(flows.list.map((f) => [f.key, f]));
    layoutFlows(spec, resolved, flows.screens, flows.gap, paletteFor()).forEach((f) => {
      const p = (els[f.key].props ?? {}) as Record<string, any>;
      const e = ends.get(f.key)!;
      out.push({
        line: lineOf(f.key)!,
        endLine: lineOf(f.key)!,
        type: "Flow",
        ...(f.label ? { label: f.label.text } : {}),
        from: String(p.from),
        to: String(p.to),
        fromLine: lineOf(e.from)!,
        toLine: lineOf(e.to)!,
        path: flowPolyline(f).map((q) => [round(q.x), round(q.y)] as [number, number]),
        ...(f.label ? { labelBox: toBox(f.label) } : {}),
      });
    });
  }
  return out as [MeasuredElement, ...Measured[]]; // the board comes first
}

/** Whether a point is in a box; never in one 0 wide or 0 tall. */
const inside = (b: MeasuredBox | undefined, x: number, y: number) => !!b && b.width > 0 && b.height > 0 && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
const center = (b: MeasuredBox) => [b.x + b.width / 2, b.y + b.height / 2] as const;

function distanceToPath(path: [number, number][], x: number, y: number) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

const isContainer = (e: MeasuredElement) => CONTAINERS.has(e.type);

/**
 * Everything under a point (board pixels), most likely meant first:
 *   1. an open menu, option list, date picker or tooltip: the element it belongs to
 *   2. a flow's label
 *   3. elements that hold no others (buttons, inputs, text, …), topmost first
 *   4. a flow's line, within `tolerance` px of it (default 6; pass more when the board is shown zoomed out)
 *   5. stacks, cards, modals and drawers, then the screen, then the board
 * A modal, drawer or toast hides the screen's content under it. One that dims its screen (modals and
 * drawers, unless no-scrim) hides all of it: on the dimmed part, only the screen and the board.
 */
export function elementsAt(elements: Measured[], x: number, y: number, opts: { tolerance?: number } = {}): Measured[] {
  const tolerance = opts.tolerance ?? 6;
  const order = new Map(elements.map((e, i) => [e, i]));
  const topFirst = (a: Measured, b: Measured) => order.get(b)! - order.get(a)!;

  // a modal, drawer or toast hides what's drawn before it on its screen, under it, or anywhere on
  // the screen when it dims it (its screen is the one around it: screens never overlap, and this
  // doesn't depend on the lines)
  const covered = new Set<Measured>();
  const screens = elements.filter((e): e is MeasuredElement => e.type === "Screen");
  const screenAround = (b: MeasuredBox) => screens.find((s) => inside(s.box, ...center(b)));
  for (const [i, m] of elements.entries()) {
    if (isFlow(m) || !OVERLAYS.has(m.type)) continue;
    const screen = screenAround(m.box);
    if (!screen || (!inside(m.box, x, y) && !(m.scrim && inside(screen.box, x, y)))) continue;
    for (const e of elements.slice(0, i)) if (!isFlow(e) && e.type !== "Screen" && e.type !== "Board" && screenAround(e.box) === screen) covered.add(e);
  }

  const owners: Measured[] = [], labels: Measured[] = [], leaves: Measured[] = [], lines: Measured[] = [], containers: Measured[] = [];
  for (const e of elements) {
    if (isFlow(e)) {
      if (inside(e.labelBox, x, y)) labels.push(e);
      else if (distanceToPath(e.path, x, y) <= tolerance) lines.push(e);
    } else if (e.overlays?.some((o) => inside(o, x, y))) owners.push(e);
    else if (!covered.has(e) && (inside(e.box, x, y) || inside(e.labelBox, x, y))) (isContainer(e) ? containers : leaves).push(e);
  }
  return [owners, labels, leaves, lines, containers].flatMap((g) => g.sort(topFirst));
}

/**
 * The element on a line and every block around it, innermost first: for a code view that follows
 * the caret. A comment or blank line between an element's children gives that element. A flow's
 * line gives the flow, then the board.
 */
export function elementsAtLine(elements: Measured[], line: number): Measured[] {
  return elements.filter((e) => e.line > 0 && e.line <= line && line <= e.endLine).sort((a, b) => b.line - a.line);
}
