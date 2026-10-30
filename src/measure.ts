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
import { boardLayout, checkSpec, flowEnds, SpecError, withBoardGap, withNoteHeights } from "./render.js";
import { PRIMARY_PROP } from "./text.js";
import { upgradeSpec } from "./upgrade.js";
import { COVERS_SCREEN, OVERLAYS, type Measured, type MeasuredBox, type MeasuredElement } from "./hit.js";

export { elementsAt, elementsAtLine, type Measured, type MeasuredBox, type MeasuredElement, type MeasuredFlow } from "./hit.js";

export interface MeasureOptions {
  /** As passed to renderWireframeSvg (default true): flow labels can widen the gaps between screens, so the boxes only match a render with the same setting. */
  flows?: boolean;
  /** Skip validation (as renderWireframeSvg). */
  skipValidation?: boolean;
}

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
  // every screen is marked twice: below its status or browser bar (where its bars and overlays are
  // clipped) and its content area between the bars (where its content is)
  const screens = Object.keys(els).filter((k) => els[k].type === "Screen");
  const inners: Anchor[] = screens.map((id) => ({ id, screen: id, kind: "tooltip", field: false }));
  const { tagged, colors } = tagForMeasuring(spec, [...anchors, ...every, ...inners], screens);
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
      // its bars and overlays are cut below its status or browser bar; its content between the bars
      const frame = frames.get(k) ?? null;
      const inner = clip(boxes[k] ?? frame!, frame);
      const body = clip(boxes[`${k}#body`] ?? inner!, inner);
      const over = (c: string) => OVERLAYS.has(els[c]?.type);
      for (const c of [...kids.filter((c) => !over(c)), ...kids.filter(over)]) visit(c, k, k, BARS.has(els[c]?.type) || over(c) ? inner : body);
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
