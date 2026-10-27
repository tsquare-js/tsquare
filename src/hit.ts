/**
 * What's under a point or a line, from measureElements' entries: plain data in, plain data out, and
 * nothing heavy imported, so the viewer (tsquare/viewer) can hit-test in the browser without the
 * renderer. measure.ts produces the entries and re-exports all of this.
 */
import type { ComponentName } from "./catalog.js";

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
   * Where it's drawn: the part that shows, for content cut off by its screen (past the bottom, under
   * a tab bar, or under the status or browser bar) or by a drawer's panel. A screen's box is its frame. Can be 0 wide or 0 tall
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

export const isFlow = (e: Measured): e is MeasuredFlow => e.type === "Flow";

/** Dim their screen while open (unless no-scrim): a click on the dimmed part is a click on the screen. */
export const COVERS_SCREEN = new Set(["Modal", "Drawer"]);
export const OVERLAYS = new Set(["Modal", "Drawer", "Toast"]);

/**
 * Components that hold others (the catalog's components with slots; a test keeps the two equal):
 * from the type, not from the lines, so the order doesn't depend on them.
 */
export const CONTAINERS: ReadonlySet<string> = new Set(["Board", "Screen", "Stack", "Grid", "Card", "Accordion", "List", "Modal", "Drawer"]);
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
