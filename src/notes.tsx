/**
 * Notes are about what they're indented under: the board, a screen, or an element. A note never takes
 * space in a screen's layout. prepareNotes takes the notes out of their parents and gives each screen
 * the notes about it and its elements (`__marks`), numbered in document order across the board. The
 * Screen draws them under its frame and puts a numbered marker after its name for notes about itself;
 * markers on elements need the elements' boxes, so they're drawn in a top layer (noteMarkerLayer)
 * after the measuring pass, like flow arrows.
 *
 * Render modes: "on" draws everything; "markers" draws the numbered markers only (no note text, so no
 * board notes either); "off" draws no notes at all, exactly like a board without note lines. Numbers
 * come from the text alone, so they're the same in every mode.
 */
import React, { type CSSProperties, type ReactNode } from "react";
import type { Spec } from "@json-render/core";
import type { Rect } from "./anchors.js";
import { FIELD_LABEL, NOTE_MARKER, NOTE_MARKER_OUT, theme as t } from "./layout.js";

export type NotesMode = "on" | "markers" | "off";
export const NOTES_MODES: readonly NotesMode[] = ["on", "markers", "off"];

/** A note about a screen (`onScreen`) or one of its elements (`target`), numbered on the board. `h`: its drawn height, once measured. */
export interface ScreenNote { key: string; n: number; text: string; color?: string; target: string; onScreen: boolean; h?: number }

type Elements = Spec["elements"];
/** Set on the board's props once its notes are prepared, so preparing again changes nothing. */
const PREPARED = "__notesMode";

/** The notes about a screen and its elements, as prepareNotes left them on the screen's props. */
export const screenMarks = (el: Elements[string] | undefined): ScreenNote[] => ((el?.props as any)?.__marks ?? []) as ScreenNote[];

/**
 * The spec as it's drawn in `mode`: notes under screens and elements leave the layout and become
 * each screen's `__marks` (plus `__notesBand` when their text is drawn). Notes on the board stay where
 * they are when their text is drawn and go otherwise. A board with nothing to change comes back as is.
 */
export function prepareNotes(spec: Spec, mode: NotesMode = "on"): Spec {
  const els = spec.elements;
  const board = els?.[spec.root];
  if (!board || (board.props as any)?.[PREPARED]) return spec;
  const changed: Elements = {};
  const marks = new Map<string, ScreenNote[]>();
  let n = 0;
  const visit = (key: string, screen: string | null) => {
    const el = els[key];
    if (!el?.children?.length) return;
    const inScreen = el.type === "Screen" ? key : screen;
    const kept: string[] = [];
    for (const c of el.children) {
      const child = els[c];
      if (child?.type !== "Note") {
        kept.push(c);
        visit(c, inScreen);
        continue;
      }
      if (key === spec.root) {
        if (mode === "on") kept.push(c);
        continue;
      }
      // a note outside any screen (under a flow line) isn't drawn; checkSpec reports it
      if (!inScreen) continue;
      n++;
      if (mode === "off") continue;
      const p = (child.props ?? {}) as Record<string, any>;
      const note: ScreenNote = { key: c, n, text: String(p.text ?? ""), ...(p.color ? { color: p.color } : {}), target: key, onScreen: key === inScreen };
      marks.set(inScreen, [...(marks.get(inScreen) ?? []), note]);
    }
    if (kept.length !== el.children.length) changed[key] = { ...el, children: kept };
  };
  visit(spec.root, null);
  if (!Object.keys(changed).length) return spec;
  const elements: Elements = { ...els, ...changed };
  for (const [screen, list] of marks) {
    const s = elements[screen];
    elements[screen] = { ...s, props: { ...(s.props ?? {}), __marks: list, ...(mode === "on" ? { __notesBand: true } : {}) } };
  }
  const root = elements[spec.root];
  elements[spec.root] = { ...root, props: { ...(root.props ?? {}), [PREPARED]: mode } };
  return { ...spec, elements };
}

/** The elements (not screens) that notes are about. */
export function noteTargets(spec: Spec): string[] {
  const out = new Set<string>();
  for (const el of Object.values(spec.elements)) for (const m of screenMarks(el)) if (!m.onScreen) out.add(m.target);
  return [...out];
}

/** A stack or grid with nothing to see of its own (no border, fill or fixed width): its box is wherever its children put it. */
function boxless(el: Elements[string] | undefined) {
  const p = (el?.props ?? {}) as Record<string, any>;
  return (el?.type === "Stack" && !p.width && !p.fill && (!p.border || p.border === "none")) || el?.type === "Grid";
}

/** What the measuring pass needs for the markers: each element a note is about, and the children of the boxless ones. */
export function markerMeasures(spec: Spec): string[] {
  const out = new Set<string>();
  for (const k of noteTargets(spec)) {
    out.add(k);
    if (boxless(spec.elements[k])) for (const c of spec.elements[k].children ?? []) out.add(c);
  }
  return [...out];
}

/**
 * The box a marker hangs on: the element's, except a labeled field's (its box, not its label: on
 * the label the marker sat at the corner of the field above) and a boxless stack's or grid's (the
 * area its children cover: a stack spans its column, so its corner can be far from what's in it).
 */
function markedBox(spec: Spec, key: string, boxes: Record<string, Rect>): Rect | undefined {
  const el = spec.elements[key];
  let box = boxes[key];
  if (!box || !el) return box;
  if (boxless(el)) {
    const kids = (el.children ?? []).map((c) => boxes[c]).filter((b): b is Rect => !!b && b.w > 0 && b.h > 0);
    if (kids.length) {
      const x = Math.min(...kids.map((b) => b.x)), y = Math.min(...kids.map((b) => b.y));
      box = { x, y, w: Math.max(...kids.map((b) => b.x + b.w)) - x, h: Math.max(...kids.map((b) => b.y + b.h)) - y };
    }
  }
  if ((el.type === "Input" || el.type === "Select") && (el.props as any)?.label) box = { ...box, y: box.y + FIELD_LABEL, h: box.h - FIELD_LABEL };
  return box;
}

/** The look of a note's number: on an element, after a screen's name, and (smaller, without the ring) in the note itself. */
export function numberStyle(size: number, ring: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: t.ink,
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 600,
    ...(ring ? { border: "2px solid #ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" } : {}),
  };
}

/**
 * Where the markers of an element's notes go: just outside its top-right corner, up and out by
 * NOTE_MARKER_OUT so an arrow leaving the middle of a short element's side passes under it; a second
 * note's marker goes to the left of the first. Centers, in board pixels.
 */
export function markerCenters(box: Rect, count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => ({ x: box.x + box.w + NOTE_MARKER_OUT - i * (NOTE_MARKER + 4), y: box.y - NOTE_MARKER_OUT }));
}

/**
 * The numbered markers on elements that have notes, from the measured boxes. An element that isn't
 * drawn (inside a closed accordion) or is entirely outside its screen's frame (cut off at the bottom)
 * gets none; its note is still listed under the screen.
 */
export function noteMarkers(spec: Spec, boxes: Record<string, Rect>, frames: Map<string, Rect>): { key: string; n: number; x: number; y: number }[] {
  const out: { key: string; n: number; x: number; y: number }[] = [];
  for (const [screen, el] of Object.entries(spec.elements)) {
    const frame = frames.get(screen);
    const byTarget = new Map<string, ScreenNote[]>();
    for (const m of screenMarks(el)) if (!m.onScreen) byTarget.set(m.target, [...(byTarget.get(m.target) ?? []), m]);
    for (const [target, notes] of byTarget) {
      const box = markedBox(spec, target, boxes);
      if (!box || (frame && (box.y >= frame.y + frame.h || box.y + box.h <= frame.y || box.x >= frame.x + frame.w || box.x + box.w <= frame.x))) continue;
      markerCenters(box, notes.length).forEach((c, i) => out.push({ key: notes[i].key, n: notes[i].n, ...c }));
    }
  }
  return out;
}

/** The markers as a layer over the board (see withTopLayer). */
export function noteMarkerLayer(markers: { n: number; x: number; y: number }[], size: { width: number; height: number }): ReactNode {
  return (
    <div key="__notes" style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height, display: "flex" }}>
      {markers.map((m) => (
        <div key={m.n} style={{ ...numberStyle(NOTE_MARKER, true), position: "absolute", left: m.x - NOTE_MARKER / 2, top: m.y - NOTE_MARKER / 2 }}>
          {String(m.n)}
        </div>
      ))}
    </div>
  );
}
