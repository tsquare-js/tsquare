/**
 * Flow arrows: `flow <from> -> <to> "label"` lines drawn between elements or screens,
 * on top of the board. Element positions come from the measuring pass (anchors.tsx);
 * screens' boxes come from boardLayout. Routing:
 *   - the next screen to the right: right side to left side, turning in the gap between them
 *   - skipping screens or going back: through the gaps and a lane under the screens, so lines
 *     never cross a screen they don't belong to
 *   - within one screen: the sides facing each other
 * Crossings between flows aren't avoided. Two flows at the same height between neighboring screens
 * share a narrow gap: ends and labels move apart where they can, but a crowded gap can still overlap.
 */
import React, { type ReactNode } from "react";
import type { Spec } from "@json-render/core";
import { ACCENTS, type Palette } from "./colors.js";
import { theme as t } from "./layout.js";
import type { Rect } from "./anchors.js";

type Pt = { x: number; y: number };
type Side = "left" | "right" | "top" | "bottom";
const DIR: Record<Side, Pt> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
const port = (b: Rect, s: Side): Pt =>
  s === "left" ? { x: b.x, y: b.y + b.h / 2 } : s === "right" ? { x: b.x + b.w, y: b.y + b.h / 2 } : s === "top" ? { x: b.x + b.w / 2, y: b.y } : { x: b.x + b.w / 2, y: b.y + b.h };
const add = (p: Pt, d: Pt, k: number): Pt => ({ x: p.x + d.x * k, y: p.y + d.y * k });

/** Extra space under the screens for lanes: one lane per flow that uses one, LANE_GAP apart. */
const LANE_GAP = 16;
export const flowMargin = (flows: number) => 40 + LANE_GAP * Math.max(0, flows - 1);

export interface Route { from: Side; to: Side; points: Pt[]; lane?: number }

/** Where a flow's ends are: each end's box and the frame of the screen it's in (a screen end is its own frame). */
export interface FlowBoxes { from: Rect; to: Rect; fromScreen: Rect; toScreen: Rect }

const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
const overlapsY = (a: Rect, b: Rect) => a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The sides and the right-angle path for a flow. Lines stay off screens they don't belong to:
 *   - same screen: right/left or top/bottom between the two elements
 *   - a neighboring screen: across the gap between the two screens
 *   - skipping over a screen: down the gap beside the source screen, along a lane under all the
 *     screens, and up the gap beside the target
 * `lane` and `track` count the flows already using lanes and gaps, so each gets its own.
 */
export function route(ends: FlowBoxes, screens: Rect[], gap: number, lane = 0, track = 0, nudge = 0): Route {
  const { from: a, to: b, fromScreen: sa, toScreen: sb } = ends;
  if (same(sa, sb)) {
    if (b.x >= a.x + a.w - 1) {
      const s = port(a, "right"), e = port(b, "left"), mx = (s.x + e.x) / 2;
      return { from: "right", to: "left", points: [s, { x: mx, y: s.y }, { x: mx, y: e.y }, e] };
    }
    if (b.x + b.w <= a.x + 1) {
      const s = port(a, "left"), e = port(b, "right"), mx = (s.x + e.x) / 2;
      return { from: "left", to: "right", points: [s, { x: mx, y: s.y }, { x: mx, y: e.y }, e] };
    }
    const down = b.y >= a.y + a.h / 2;
    const s = port(a, down ? "bottom" : "top"), e = port(b, down ? "top" : "bottom"), my = (s.y + e.y) / 2;
    return { from: down ? "bottom" : "top", to: down ? "top" : "bottom", points: [s, { x: s.x, y: my }, { x: e.x, y: my }, e] };
  }
  const right = sb.x >= sa.x + sa.w, left = sb.x + sb.w <= sa.x;
  const from: Side = right ? "right" : "left", to: Side = right ? "left" : "right";
  const s = port(a, from), e = port(b, to);
  // a screen end meets the line at the other end's height, so a button beside it gets a straight line
  const level = (y: number, r: Rect) => Math.max(r.y + 24, Math.min(r.y + r.h - 24, y));
  // (`nudge` moves that point down, off a line already drawn at the same height)
  if (same(b, sb) && !same(a, sa)) e.y = level(s.y + nudge, sb);
  if (same(a, sa) && !same(b, sb)) s.y = level(e.y + nudge, sa);
  // each flow through a gap gets its own track, a few px either side of the middle
  const shift = Math.max(-(gap / 2 - 8), Math.min(gap / 2 - 8, TRACKS[track % TRACKS.length]));
  const lo = right ? sa : sb, hi = right ? sb : sa; // the left and right screens
  const between = screens.some((r) => !same(r, sa) && !same(r, sb) && overlapsY(r, sa) && r.x >= lo.x + lo.w && r.x + r.w <= hi.x);
  if ((right || left) && !between && overlapsY(sa, sb)) {
    const mx = (lo.x + lo.w + hi.x) / 2 + shift;
    return { from, to, points: [s, { x: mx, y: s.y }, { x: mx, y: e.y }, e] };
  }
  // through a lane under all the screens
  const below = Math.max(...screens.map((r) => r.y + r.h)) + 24 + lane * LANE_GAP;
  const gx1 = right ? sa.x + sa.w + gap / 2 + shift : sa.x - gap / 2 + shift;
  const gx2 = right ? sb.x - gap / 2 + shift : sb.x + sb.w + gap / 2 + shift;
  return { from, to, lane: below, points: [s, { x: gx1, y: s.y }, { x: gx1, y: below }, { x: gx2, y: below }, { x: gx2, y: e.y }, e] };
}

/** A route's horizontal runs, to keep two flows from drawing along the same line. */
const runs = (r: Route) =>
  r.points.slice(1).flatMap((p, i) => {
    const q = r.points[i];
    return Math.abs(p.y - q.y) < 0.5 && Math.abs(p.x - q.x) > 0.5 ? [{ y: p.y, x1: Math.min(p.x, q.x), x2: Math.max(p.x, q.x) }] : [];
  });

const TRACKS = [0, -10, 10, -20, 20, -5, 5, -15, 15];

/** Drop repeated points and points on a straight run, so corners are only real turns. */
function simplify(points: Pt[]) {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - p.x) < 0.5) || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - p.y) < 0.5)) out.pop();
    }
    out.push(p);
  }
  return out;
}

function polylinePath(points: Pt[], radius: number) {
  const pts = simplify(points);
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (radius > 0 && i < pts.length - 1) {
      const prev = pts[i - 1], next = pts[i + 1];
      const r = Math.min(radius, Math.hypot(p.x - prev.x, p.y - prev.y) / 2, Math.hypot(next.x - p.x, next.y - p.y) / 2);
      const into = { x: Math.sign(p.x - prev.x), y: Math.sign(p.y - prev.y) }, out = { x: Math.sign(next.x - p.x), y: Math.sign(next.y - p.y) };
      d += ` L${p.x - into.x * r} ${p.y - into.y * r} Q${p.x} ${p.y} ${p.x + out.x * r} ${p.y + out.y * r}`;
    } else d += ` L${p.x} ${p.y}`;
  }
  return d;
}

/** The point a fraction `t` of the way along a polyline. */
function along(points: Pt[], t: number): Pt {
  const pts = simplify(points);
  const lengths = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let left = lengths.reduce((a, b) => a + b, 0) * t;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]) {
      const f = lengths[i] ? left / lengths[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    }
    left -= lengths[i];
  }
  return pts[pts.length - 1];
}

type End = "none" | "arrow" | "dot" | "circle" | "bar";
/** How far the line stops short of the element for each end, so the marker sits against it. */
const INSET: Record<End, number> = { none: 0, arrow: 9, dot: 4, circle: 9, bar: 0 };

/**
 * A marker whose tip touches `p`; `out` points away from the element, along the line. Called as a
 * function, not used as <Marker/>: Satori serializes an <svg>'s children as-is, without running
 * components inside it.
 */
function marker(kind: End, p: Pt, out: Pt, color: string, key: string): ReactNode {
  if (kind === "none") return null;
  const perp = { x: -out.y, y: out.x };
  if (kind === "arrow") {
    const base = add(p, out, 10);
    const pts = [p, add(base, perp, 5.5), add(base, perp, -5.5)].map((q) => `${q.x},${q.y}`).join(" ");
    return <polygon key={key} points={pts} fill={color} />;
  }
  if (kind === "dot") {
    const c = add(p, out, 4);
    return <circle key={key} cx={c.x} cy={c.y} r={4} fill={color} />;
  }
  if (kind === "circle") {
    const c = add(p, out, 5);
    return <circle key={key} cx={c.x} cy={c.y} r={4.5} fill={t.paper} stroke={color} strokeWidth={2} />;
  }
  const a = add(p, perp, 7), b = add(p, perp, -7);
  return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />;
}

const GRAY = "#5f6770";

/** A label pill's width, estimated from its text (labels are 12px semibold). */
export const flowLabelWidth = (label: string) => Math.min(220, Math.ceil(label.length * 7.2) + 20);

/** A flow's line color: gray, an accent name, a hex color, or the board's accent. */
export function flowColor(color: unknown, palette: Palette) {
  if (color == null) return GRAY;
  if (color === "accent") return palette.accent;
  const s = String(color);
  return (ACCENTS as Record<string, string>)[s] ?? s;
}

/** The top layer with every flow: one SVG for the lines and markers, labels as text pills. */
export function flowLayer(spec: Spec, flows: { key: string; ends: FlowBoxes }[], screens: Rect[], gap: number, palette: Palette, size: { width: number; height: number }): ReactNode {
  const shapes: ReactNode[] = [];
  const labels: ReactNode[] = [];
  const placed: Rect[] = [];
  const drawn: { y: number; x1: number; x2: number }[] = []; // horizontal runs so far
  // line ends so far, starting with every element end (those can't move; a screen end can)
  const tips: Pt[] = flows.flatMap(({ ends }) => {
    const r = route(ends, screens, gap);
    return [...(same(ends.from, ends.fromScreen) ? [] : [r.points[0]]), ...(same(ends.to, ends.toScreen) ? [] : [r.points[r.points.length - 1]])];
  });
  // route every flow first, so labels can keep clear of all the line ends
  let lanes = 0, tracks = 0;
  const routes = flows.map(({ ends }) => {
    let r = route(ends, screens, gap, lanes, tracks);
    const clash = (r: Route) =>
      runs(r).some((h) => drawn.some((g) => Math.abs(g.y - h.y) < 8 && g.x1 < h.x2 && h.x1 < g.x2)) ||
      [r.points[0], r.points[r.points.length - 1]].some((p) => tips.some((q) => q !== p && Math.hypot(p.x - q.x, p.y - q.y) > 0.5 && Math.hypot(p.x - q.x, p.y - q.y) < 24));
    for (let k = 1; k <= 4 && clash(r); k++) r = route(ends, screens, gap, lanes, tracks, 48 * k);
    drawn.push(...runs(r));
    tips.push(r.points[0], r.points[r.points.length - 1]);
    if (r.lane != null) lanes++;
    if (!same(ends.fromScreen, ends.toScreen)) tracks++;
    return r;
  });
  const ends = routes.flatMap((r) => [r.points[0], r.points[r.points.length - 1]]);
  flows.forEach(({ key }, i) => {
    const r = routes[i];
    const p = (spec.elements[key].props ?? {}) as Record<string, any>;
    const color = flowColor(p.color, palette);
    const start: End = p.start ?? "none", end: End = p.end ?? "arrow";
    // stop the line short of each element by its marker, so markers sit against the element
    const pts = [...r.points];
    pts[0] = add(pts[0], DIR[r.from], INSET[start]);
    pts[pts.length - 1] = add(pts[pts.length - 1], DIR[r.to], INSET[end]);
    const line = p.line ?? "rounded";
    let d: string;
    let at: (t: number) => Pt; // a point along the drawn line, for the label
    const s0 = pts[0], e0 = pts[pts.length - 1];
    if (line === "straight") {
      d = `M${s0.x} ${s0.y} L${e0.x} ${e0.y}`;
      at = (t) => ({ x: s0.x + (e0.x - s0.x) * t, y: s0.y + (e0.y - s0.y) * t });
    } else if (line === "curved" && r.lane == null) {
      const k = Math.max(40, Math.hypot(e0.x - s0.x, e0.y - s0.y) * 0.4);
      const c1 = add(s0, DIR[r.from], k), c2 = add(e0, DIR[r.to], k);
      d = `M${s0.x} ${s0.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e0.x} ${e0.y}`;
      const bez = (a: number, b: number, c: number, e: number, t: number) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * e;
      at = (t) => ({ x: bez(s0.x, c1.x, c2.x, e0.x, t), y: bez(s0.y, c1.y, c2.y, e0.y, t) });
    } else {
      // through the lane, a single curve would cut across screens: "curved" softens the corners instead
      d = polylinePath(pts, line === "curved" ? 40 : line === "rounded" ? 14 : 0);
      at = (t) => along(pts, t);
    }
    shapes.push(
      <path key={`${key}-line`} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" {...(p.dashed ? { strokeDasharray: "7 6" } : {})} />,
      marker(start, r.points[0], DIR[r.from], color, `${key}-start`),
      marker(end, r.points[r.points.length - 1], DIR[r.to], color, `${key}-end`),
    );
    if (p.label) {
      const w = flowLabelWidth(String(p.label));
      // the label sits on its line, as near the middle as it can without covering another label
      // or a line's end; when every spot covers something, the one that covers least
      const covers = (c: Pt) =>
        placed.filter((q) => c.x - w / 2 < q.x + q.w && q.x < c.x + w / 2 && c.y - 14 < q.y + q.h && q.y < c.y + 14).length +
        ends.filter((q) => Math.abs(q.x - c.x) < w / 2 + 12 && Math.abs(q.y - c.y) < 24).length;
      let mid = at(0.5), best = covers(mid);
      for (const t of [0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]) {
        if (!best) break;
        const c = at(t), n = covers(c);
        if (n < best) [mid, best] = [c, n];
      }
      const top = mid.y - 12;
      placed.push({ x: mid.x - w / 2, y: top, w, h: 24 });
      labels.push(
        <div key={`${key}-label`} style={{ position: "absolute", left: mid.x - w / 2, top, width: w, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: t.paper, border: `1.5px solid ${color}`, color, fontSize: 12, fontWeight: 600 }}>
          {p.label}
        </div>,
      );
    }
  });
  return (
    <div key="__flows" style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height, display: "flex" }}>
      <svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`} style={{ position: "absolute", top: 0, left: 0 }}>
        {shapes}
      </svg>
      {labels}
    </div>
  );
}
