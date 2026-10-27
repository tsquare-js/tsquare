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
import { IconGlyph, monthGrid } from "./components.js";
import type { Palette } from "./colors.js";
import { theme as t } from "./layout.js";

export interface Rect { x: number; y: number; w: number; h: number }
export type AnchorKind = "tooltip" | "options" | "calendar" | "menu";
/** `end`: the menu opens from the element's right end (a list row's …, a navbar's ⋮). */
export interface Anchor { id: string; kind: AnchorKind; screen: string; field: boolean; end?: boolean }

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
      if ((el.type === "ListItem" || el.type === "NavBar") && p.open && Array.isArray(p.menu) && p.menu.length) out.push({ id, kind: "menu", screen, field: false, end: true });
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
 * `__mark` on the outer box (menus, tooltips, screens), `__markField` on a field (options, calendar),
 * `__markBody` on the content area of each screen in `bodies` (between its bars, where content is cut off).
 * Box keys are the element id, `<id>#field` or `<id>#body`.
 */
export function tagForMeasuring(spec: Spec, anchors: Anchor[], bodies: string[] = []) {
  const tagged = structuredClone(spec);
  const colors = new Map<string, string>();
  let n = 1;
  const tag = (id: string, part: "" | "field" | "body") => {
    const key = part ? `${id}#${part}` : id;
    if (colors.has(key)) return;
    const color = MARK(n++);
    colors.set(key, color);
    const el = tagged.elements[id];
    el.props = { ...(el.props ?? {}), [part === "field" ? "__markField" : part === "body" ? "__markBody" : "__mark"]: color };
  };
  for (const a of anchors) {
    tag(a.screen, "");
    tag(a.id, a.field ? "field" : "");
  }
  for (const id of bodies) tag(id, "body");
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
/** A ListCard's real height: rows of ROW - 4, 4px padding and a 1.5px border on each side (placement uses the rounder ROW). */
const listHeight = (rows: number) => rows * (ROW - 4) + 2 * 4 + 2 * 1.5;

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
 * Where an anchor's overlay goes and its size: `pos` relative to the screen (as place() returns it),
 * or null when the anchor or its screen wasn't measured.
 */
function placeOverlay(spec: Spec, a: Anchor, boxes: Record<string, Rect>) {
  const screen = boxes[a.screen];
  const anchor = boxes[a.field ? `${a.id}#field` : a.id];
  if (!screen || !anchor) return null;
  const p = propsOf(spec.elements, a.id);
  if (a.kind === "options") {
    const options: string[] = p.options?.length ? p.options : [p.value ?? "Option 1", "Option 2", "Option 3"];
    const size = { w: anchor.w, h: options.length * ROW + 8 };
    return { screen, anchor, size, drawnH: listHeight(options.length), pos: place(anchor, size, screen, { prefer: "below", align: "start", gap: 4 }), options };
  }
  if (a.kind === "menu") {
    const items = (p.menu as any[]).map((i) => (typeof i === "string" ? { label: i } : i));
    const width = a.end ? 200 : Math.max(180, anchor.w);
    const inRightHalf = anchor.x + anchor.w / 2 > screen.x + screen.w / 2;
    const size = { w: width, h: items.length * ROW + 8 };
    return { screen, anchor, size, drawnH: listHeight(items.length), pos: place(anchor, size, screen, { prefer: "below", align: a.end || inRightHalf ? "end" : "start", gap: a.end ? -6 : 4 }), items };
  }
  if (a.kind === "calendar") {
    const date = parseDate(p.value);
    const { start, days } = monthGrid(date?.month);
    const weeks = Math.ceil((start + days) / 7); // as the Calendar draws it: 4, 5 or 6 rows
    const size = { w: 296, h: 92 + weeks * 38 };
    return { screen, anchor, size, pos: place(anchor, size, screen, { prefer: "below", align: "start", gap: 4 }), date };
  }
  const size = tooltipSize(p.tooltip);
  return { screen, anchor, size, pos: place(anchor, size, screen, { prefer: "above", align: "center", gap: 4 }) };
}

/**
 * Each anchored overlay's box on the board, by the id of the element it belongs to (an element with
 * an open menu and a tooltip gets both). Menus and option lists get the height they're drawn at; a
 * tooltip's comes from its text and a date picker's from its weeks (within a few px).
 */
export function overlayBoxes(spec: Spec, anchors: Anchor[], boxes: Record<string, Rect>): { id: string; box: Rect }[] {
  return anchors.flatMap((a) => {
    const o = placeOverlay(spec, a, boxes);
    if (!o) return [];
    const h = "drawnH" in o && o.drawnH != null ? o.drawnH : o.size.h;
    // placed by its top below the element, by its bottom above it (overlayLayer pins it there)
    const top = o.screen.y + o.pos.y + (o.pos.side === "above" ? o.size.h - h : 0);
    return [{ id: a.id, box: { x: o.screen.x + o.pos.x, y: top, w: o.size.w, h } }];
  });
}

/**
 * The top layer: each overlay inside a box covering its screen (clipped to it), placed from the
 * measured boxes. `Calendar` is the board's own calendar component, reused for date pickers.
 */
export function overlayLayer(spec: Spec, anchors: Anchor[], boxes: Record<string, Rect>, c: Palette, Calendar: (props: any) => ReactNode): ReactNode {
  const byScreen = new Map<string, ReactNode[]>();
  for (const a of anchors) {
    const o = placeOverlay(spec, a, boxes);
    if (!o) continue;
    const { screen, anchor, size, pos } = o;
    const p = propsOf(spec.elements, a.id);
    let node: ReactNode = null;
    if (a.kind === "options") {
      node = <ListCard items={o.options!.map((label) => ({ label }))} width={size.w} selected={p.value} c={c} />;
    } else if (a.kind === "menu") {
      node = <ListCard items={o.items!} width={size.w} c={c} />;
    } else if (a.kind === "calendar") {
      node = (
        <div style={{ display: "flex", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", borderRadius: 12 }}>
          {Calendar({ element: { type: "Calendar", props: { month: o.date?.month ?? "Month", selected: o.date?.day } }, colors: c })}
        </div>
      );
    } else {
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
