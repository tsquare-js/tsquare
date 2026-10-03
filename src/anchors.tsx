/**
 * Anchored overlays: things drawn over the board at an element's position (an open
 * select's options, an open date picker, a button's menu, tooltips).
 *
 * Satori lays out and draws in one go without reporting positions, so a board that
 * has any of these renders twice:
 *   1. Measuring pass: each anchored element (and its screen) gets a marker, a box in a
 *      unique color filling it. Satori's SVG uses absolute coordinates, so reading the
 *      markers' rects back gives every box on the board.
 *   2. Final pass: the board as usual, plus a top layer on the Board with each overlay
 *      placed from those boxes, clipped to its screen, so it covers the content below.
 * Boards without anchored elements render once, exactly as before.
 *
 * Precision: a marker fills its box inside the box's border, so bordered elements measure up to
 * 1.5px in from their outer edge. That's invisible in the output, so overlays don't correct for it.
 */
import React, { type ReactNode } from "react";
import type { Spec } from "@json-render/core";
import { IconGlyph } from "./components.js";
import type { Palette } from "./colors.js";
import { theme as t } from "./layout.js";

export interface Rect { x: number; y: number; w: number; h: number }
export type AnchorKind = "tooltip" | "options" | "calendar" | "menu";
export interface Anchor { id: string; kind: AnchorKind; screen: string; field: boolean }

type Elements = Spec["elements"];
const propsOf = (els: Elements, id: string) => (els[id].props ?? {}) as Record<string, any>;

/** Every anchored overlay on the board, in drawing order (document order; tooltips last). */
export function findAnchors(spec: Spec): Anchor[] {
  const out: Anchor[] = [];
  const visit = (id: string, screen: string) => {
    const el = spec.elements[id];
    if (!el) return;
    const p = propsOf(spec.elements, id);
    if (el.type === "Screen") screen = id;
    if (screen) {
      if (el.type === "Select" && p.open) out.push({ id, kind: "options", screen, field: true });
      if (el.type === "Input" && p.open && p.type === "date") out.push({ id, kind: "calendar", screen, field: true });
      if (el.type === "Button" && p.open && Array.isArray(p.menu) && p.menu.length) out.push({ id, kind: "menu", screen, field: false });
    }
    for (const child of el.children ?? []) visit(child, screen);
  };
  visit(spec.root, "");
  // tooltips draw over the other overlays
  const tips: Anchor[] = [];
  const visitTips = (id: string, screen: string) => {
    const el = spec.elements[id];
    if (!el) return;
    if (el.type === "Screen") screen = id;
    if (screen && el.type !== "Screen" && typeof propsOf(spec.elements, id).tooltip === "string") tips.push({ id, kind: "tooltip", screen, field: false });
    for (const child of el.children ?? []) visitTips(child, screen);
  };
  visitTips(spec.root, "");
  return [...out, ...tips];
}

const MARK = (i: number) => `#fe${(i >> 8).toString(16).padStart(2, "0")}${(i & 255).toString(16).padStart(2, "0")}`;

/**
 * A copy of the spec whose anchored elements and screens carry marker colors in hidden props:
 * `__mark` on the outer box (menus, tooltips, screens), `__markField` on a field (options, calendar).
 * Box keys are the element id, or `<id>#field`.
 */
export function tagForMeasuring(spec: Spec, anchors: Anchor[]) {
  const tagged = structuredClone(spec);
  const colors = new Map<string, string>();
  let n = 1;
  const tag = (id: string, field: boolean) => {
    const key = field ? `${id}#field` : id;
    if (colors.has(key)) return;
    const color = MARK(n++);
    colors.set(key, color);
    const el = tagged.elements[id];
    el.props = { ...(el.props ?? {}), [field ? "__markField" : "__mark"]: color };
  };
  for (const a of anchors) {
    tag(a.screen, false);
    tag(a.id, a.field);
  }
  return { tagged, colors };
}

/** The boxes of the markers in a measuring-pass SVG, by the ids they were tagged with. */
export function readMarkers(svg: string, colors: Map<string, string>): Record<string, Rect> {
  const rects = [...svg.matchAll(/<rect ([^>]*?)\/?>/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])),
  );
  const boxes: Record<string, Rect> = {};
  for (const [id, color] of colors) {
    const r = rects.find((a) => a.fill === color);
    if (r) boxes[id] = { x: +r.x, y: +r.y, w: +r.width, h: +r.height };
  }
  return boxes;
}

/**
 * Where an overlay of `size` goes next to `anchor`, inside `screen`: below (or above, for
 * tooltips) when it fits, otherwise the side with more room; horizontally aligned as asked,
 * then kept inside the screen. Coordinates are relative to the screen.
 */
export function place(anchor: Rect, size: { w: number; h: number }, screen: Rect, opts: { prefer: "below" | "above"; align: "start" | "center" | "end"; gap: number }) {
  const room = { above: anchor.y - screen.y - opts.gap, below: screen.y + screen.h - (anchor.y + anchor.h) - opts.gap };
  const other = opts.prefer === "below" ? "above" : "below";
  const side = room[opts.prefer] >= size.h || room[opts.prefer] >= room[other] ? opts.prefer : other;
  const y = side === "below" ? anchor.y + anchor.h + opts.gap : anchor.y - opts.gap - size.h;
  const x0 = opts.align === "start" ? anchor.x : opts.align === "end" ? anchor.x + anchor.w - size.w : anchor.x + anchor.w / 2 - size.w / 2;
  const x = Math.max(screen.x + 8, Math.min(x0, screen.x + screen.w - 8 - size.w));
  // above: pinned by its bottom edge (`bottom`, from the screen's bottom), so the estimated height doesn't matter
  return { x: x - screen.x, y: y - screen.y, bottom: screen.y + screen.h - (anchor.y - opts.gap), side };
}

// ── Overlays ───────────────────────────────────────────────────────────

const ROW = 36;

function ListCard({ items, width, selected, c }: { items: { label: string; icon?: string | null }[]; width: number; selected?: string; c: Palette }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width, padding: 4, backgroundColor: t.paper, border: `1.5px solid ${t.lineStrong}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
      {items.map((item, i) => {
        const on = selected != null && item.label === selected;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, height: ROW - 4, padding: "0 10px", borderRadius: 6, fontSize: 15, color: t.ink, backgroundColor: on ? t.fill : "transparent", fontWeight: on ? 600 : 400 }}>
            {item.icon ? <IconGlyph name={item.icon} size={16} color={t.text} /> : null}
            <div style={{ display: "flex", flexGrow: 1 }}>{item.label}</div>
            {on ? <IconGlyph name="check" size={16} color={c.accentText} /> : null}
          </div>
        );
      })}
    </div>
  );
}

/** "Oct 14, 2026", "October 14 2026", "14 Oct 2026", "2026-10-14" → the month for the calendar and the day. */
export function parseDate(value: unknown): { month: string; day?: number } | null {
  const s = String(value ?? "").trim();
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const iso = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (iso) return { month: `${MONTHS[+iso[2] - 1]} ${iso[1]}`, day: iso[3] ? +iso[3] : undefined };
  const name = s.match(/([A-Za-z]{3,})/)?.[1];
  const index = name ? MONTHS.findIndex((m) => m.toLowerCase().startsWith(name.toLowerCase().slice(0, 3))) : -1;
  const year = s.match(/\b(\d{4})\b/)?.[1];
  if (index < 0 || !year) return null;
  const day = s.replace(year, "").match(/\b(\d{1,2})\b/)?.[1];
  return { month: `${MONTHS[index]} ${year}`, day: day ? +day : undefined };
}

/** `arrowX`: where the arrow points, from the tooltip's left edge (the anchor's center, after clamping). */
function Tooltip({ text, side, width, arrowX }: { text: string; side: string; width: number; arrowX: number }) {
  const arrow = (
    <svg width="12" height="6" viewBox="0 0 12 6" style={{ flexShrink: 0, marginLeft: Math.max(6, Math.min(arrowX, width - 6)) - 6 }}>
      <path d={side === "above" ? "M0 0 L6 6 L12 0 Z" : "M0 6 L6 0 L12 6 Z"} fill={t.ink} />
    </svg>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width }}>
      {side === "below" ? arrow : null}
      <div style={{ display: "flex", justifyContent: "center", width, padding: "6px 10px", borderRadius: 6, backgroundColor: t.ink, color: t.onPrimary, fontSize: 13, lineHeight: 1.35, textAlign: "center" }}>{text}</div>
      {side === "above" ? arrow : null}
    </div>
  );
}

/**
 * A tooltip's size, estimated from its text: 13px Inter averages about 6.6px a character; the
 * estimate allows 7.4 so short text never wraps (extra width is just a little centered space).
 */
function tooltipSize(text: string) {
  const width = Math.min(240, Math.ceil(text.length * 7.4) + 24);
  const lines = Math.max(1, Math.ceil((text.length * 7.4) / 216));
  return { w: width, h: lines * 18 + 12 + 6 };
}

/**
 * The top layer: each overlay inside a box covering its screen (clipped to it), placed from the
 * measured boxes. `Calendar` is the board's own calendar component, reused for date pickers.
 */
export function overlayLayer(spec: Spec, anchors: Anchor[], boxes: Record<string, Rect>, c: Palette, Calendar: (props: any) => ReactNode): ReactNode {
  const byScreen = new Map<string, ReactNode[]>();
  for (const a of anchors) {
    const screen = boxes[a.screen];
    const anchor = boxes[a.field ? `${a.id}#field` : a.id];
    if (!screen || !anchor) continue;
    const p = propsOf(spec.elements, a.id);
    let node: ReactNode = null;
    let pos: { x: number; y: number; bottom: number; side: string } | null = null;
    if (a.kind === "options") {
      const options: string[] = p.options?.length ? p.options : [p.value ?? "Option 1", "Option 2", "Option 3"];
      const size = { w: anchor.w, h: options.length * ROW + 8 };
      pos = place(anchor, size, screen, { prefer: "below", align: "start", gap: 4 });
      node = <ListCard items={options.map((label) => ({ label }))} width={size.w} selected={p.value} c={c} />;
    } else if (a.kind === "menu") {
      const items = (p.menu as any[]).map((i) => (typeof i === "string" ? { label: i } : i));
      const width = Math.max(180, anchor.w);
      const inRightHalf = anchor.x + anchor.w / 2 > screen.x + screen.w / 2;
      pos = place(anchor, { w: width, h: items.length * ROW + 8 }, screen, { prefer: "below", align: inRightHalf ? "end" : "start", gap: 4 });
      node = <ListCard items={items} width={width} c={c} />;
    } else if (a.kind === "calendar") {
      const date = parseDate(p.value);
      const weeks = 6;
      pos = place(anchor, { w: 296, h: 92 + weeks * 38 }, screen, { prefer: "below", align: "start", gap: 4 });
      node = (
        <div style={{ display: "flex", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", borderRadius: 12 }}>
          {Calendar({ element: { type: "Calendar", props: { month: date?.month ?? "Month", selected: date?.day } }, colors: c })}
        </div>
      );
    } else {
      const size = tooltipSize(p.tooltip);
      pos = place(anchor, size, screen, { prefer: "above", align: "center", gap: 4 });
      node = <Tooltip text={p.tooltip} side={pos.side} width={size.w} arrowX={anchor.x + anchor.w / 2 - (screen.x + pos.x)} />;
    }
    const list = byScreen.get(a.screen) ?? [];
    const vertical = pos.side === "above" ? { bottom: pos.bottom } : { top: pos.y };
    list.push(<div key={`${a.id}-${a.kind}`} style={{ position: "absolute", left: pos.x, ...vertical, display: "flex" }}>{node}</div>);
    byScreen.set(a.screen, list);
  }
  return (
    <div key="__overlays" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" }}>
      {[...byScreen].map(([screenId, nodes]) => {
        const s = boxes[screenId];
        return (
          <div key={screenId} style={{ position: "absolute", left: s.x, top: s.y, width: s.w, height: s.h, overflow: "hidden", display: "flex" }}>
            {nodes}
          </div>
        );
      })}
    </div>
  );
}
