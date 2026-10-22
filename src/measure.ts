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
import type { ComponentName } from "./catalog.js";
import { boardLayout, checkSpec, flowEnds, SpecError, withBoardGap } from "./render.js";
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
  /** Where it's drawn: the part inside its screen, for content that runs past the screen's edge. A screen's box is its frame. */
  box: MeasuredBox;
  /** Screens: the band above the frame with the screen's name. */
  labelBox?: MeasuredBox;
  /** Its open menu, option list or date picker, or its tooltip (sizes partly estimated from the text). */
  overlay?: MeasuredBox;
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

/** Blocks the content of their screen while open: a click beside them is a click on the screen. */
const COVERS_SCREEN = new Set(["Modal", "Drawer"]);
const OVERLAYS = new Set(["Modal", "Drawer", "Toast"]);

const toBox = (r: Rect): MeasuredBox => ({ x: round(r.x), y: round(r.y), width: round(r.w), height: round(r.h) });
const round = (n: number) => Math.round(n * 100) / 100;
function clip(r: Rect, to: Rect): Rect | null {
  const x = Math.max(r.x, to.x), y = Math.max(r.y, to.y);
  const w = Math.min(r.x + r.w, to.x + to.w) - x, h = Math.min(r.y + r.h, to.y + to.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/**
 * Every element and flow on the board and where it's drawn, in drawing order (what's drawn later
 * sits on top), starting with the board. `lines` maps the spec's element keys to source lines:
 * compileWireframe returns it.
 * Elements that aren't drawn (content entirely past the bottom of its screen) are left out.
 */
export async function measureElements(spec: Spec, lines: Record<string, number>, opts: MeasureOptions = {}): Promise<[MeasuredElement, ...Measured[]]> {
  upgradeSpec(spec as any);
  if (!opts.skipValidation) {
    const issues = checkSpec(spec);
    if (issues.length) throw new SpecError(issues);
  }
  const { width, height } = boardLayout(spec, { flows: opts.flows });
  spec = withBoardGap(spec, opts.flows);
  const els = spec.elements;

  // one measuring pass: a marker on every element, plus what anchored overlays are placed from
  const anchors = findAnchors(spec);
  const every: Anchor[] = Object.keys(els)
    .filter((k) => !["Board", "Screen", "Flow"].includes(els[k].type))
    .map((id) => ({ id, screen: id, kind: "tooltip", field: false }));
  const { tagged, colors } = tagForMeasuring(spec, [...anchors, ...every]);
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
  const overlays = new Map<string, Rect>();
  for (const o of overlayBoxes(spec, anchors, boxes)) if (!overlays.has(o.id)) overlays.set(o.id, o.box);

  const lineOf = (k: string | null) => (k == null ? null : lines[k] ?? 0);
  const endLine = (k: string): number => Math.max(lines[k] ?? 0, ...(els[k].children ?? []).filter((c) => els[c]).map(endLine));
  const labelOf = (k: string) => {
    const p = (els[k].props ?? {}) as Record<string, any>;
    const v = p[PRIMARY_PROP[els[k].type] ?? ""];
    return typeof v === "string" ? v : undefined;
  };

  const out: Measured[] = [];
  const visit = (k: string, parent: string | null, screen: string | null) => {
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
      const frame = screen ? frames.get(screen) : undefined;
      const seen = r && (frame ? clip(r, frame) : r);
      if (seen) {
        const o = overlays.get(k);
        const oSeen = o && (frame ? clip(o, frame) : o);
        entry = { ...base, box: toBox(seen), ...(oSeen ? { overlay: toBox(oSeen) } : {}) };
      }
    }
    if (entry) out.push(entry);
    const inScreen = el.type === "Screen" ? k : screen;
    const kids = el.children ?? [];
    // a screen draws its modals, drawers and toasts over its content
    const order = el.type === "Screen" ? [...kids.filter((c) => !OVERLAYS.has(els[c]?.type)), ...kids.filter((c) => OVERLAYS.has(els[c]?.type))] : kids;
    for (const c of order) visit(c, k, inScreen);
  };
  visit(spec.root, null, null);

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

const inside = (b: MeasuredBox | undefined, x: number, y: number) => !!b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;

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

/** Holds other elements: a stack, card, modal, screen or the board (a leaf is a button, input, text, …). */
const isContainer = (e: MeasuredElement) => e.type === "Board" || e.type === "Screen" || e.endLine > e.line;

/**
 * Everything under a point (board pixels), most likely meant first:
 *   1. an open menu, option list, date picker or tooltip: the element it belongs to
 *   2. a flow's label
 *   3. elements that hold no others (buttons, inputs, text, …), topmost first
 *   4. a flow's line, within `tolerance` px of it (default 6; pass more when the board is shown zoomed out)
 *   5. stacks, cards, modals and drawers, then the screen, then the board
 * An open modal or drawer covers its screen: inside it, nothing of the screen's content beneath is
 * returned; beside it, only the screen and the board.
 */
export function elementsAt(elements: Measured[], x: number, y: number, opts: { tolerance?: number } = {}): Measured[] {
  const tolerance = opts.tolerance ?? 6;
  const order = new Map(elements.map((e, i) => [e, i]));
  const topFirst = (a: Measured, b: Measured) => order.get(b)! - order.get(a)!;

  // content covered by an open modal or drawer, by its screen's line: everything drawn before it on that screen
  const covered = new Set<Measured>();
  for (const [i, m] of elements.entries()) {
    if (isFlow(m) || !COVERS_SCREEN.has(m.type) || m.screenLine == null) continue;
    const screen = elements.find((e): e is MeasuredElement => e.type === "Screen" && e.line === m.screenLine);
    if (!inside(screen?.box, x, y)) continue;
    for (const e of elements.slice(0, i)) if (!isFlow(e) && e.screenLine === m.screenLine) covered.add(e);
  }

  const owners: Measured[] = [], labels: Measured[] = [], leaves: Measured[] = [], lines: Measured[] = [], containers: Measured[] = [];
  for (const e of elements) {
    if (isFlow(e)) {
      if (inside(e.labelBox, x, y)) labels.push(e);
      else if (distanceToPath(e.path, x, y) <= tolerance) lines.push(e);
    } else if (inside(e.overlay, x, y)) owners.push(e);
    else if (!covered.has(e) && (inside(e.box, x, y) || inside(e.labelBox, x, y))) (isContainer(e) ? containers : leaves).push(e);
  }
  return [owners, labels, leaves, lines, containers].flatMap((g) => g.sort(topFirst));
}

/**
 * The element on a line and every block around it, innermost first: for a code view that follows
 * the caret. A comment or blank line inside a block gives that block. A flow's line gives the flow, then the board.
 */
export function elementsAtLine(elements: Measured[], line: number): Measured[] {
  return elements.filter((e) => e.line > 0 && e.line <= line && line <= e.endLine).sort((a, b) => b.line - a.line);
}
