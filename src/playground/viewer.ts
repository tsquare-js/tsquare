/**
 * The zoomable board: zoom, pan, pinch, and zoom to a screen. Browser code,
 * published as `tsquare/viewer`: the playground page uses it, and so does the
 * VS Code extension's preview. Each brings its own markup and controls and
 * passes the elements in; the board comes from renderWireframeSvg + measureBoardLayout.
 *
 * The viewer sets the styles its math depends on (structuralStyles, and the
 * board image's size in show()), so the host only needs to size the stage and
 * optionally style the "panning", "animate" and "stale" classes it toggles on
 * the stage.
 *
 * Clicks and hovers on elements (0.14.0) need the board's measureElements
 * entries, which the host makes where it renders and hands over with
 * setElements: the viewer hit-tests them (hit.ts, nothing heavy) but never
 * renders or measures.
 */
import { elementsAt, isFlow, type Measured, type MeasuredBox } from "../hit.js";
import type { BoardItem } from "../render.js";

export type { BoardItem, Measured, MeasuredBox };

export interface ViewerOptions {
  /** A screen chip was clicked. */
  onScreenZoom?: () => void;
  /** The zoom level changed. */
  onZoom?: (scale: number) => void;
  /**
   * A click on the board (a press that hardly moves; dragging pans): the element most likely meant
   * and everything under the point, most likely first (elementsAt's order), from setElements'
   * entries. Only once elements are set; `hit` is null outside every element.
   */
  onElementClick?: (hit: Measured | null, hits: Measured[], event: PointerEvent) => void;
  /** The pointer is over a different element than before (null: over none), while no button is pressed. */
  onElementHover?: (hit: Measured | null, hits: Measured[]) => void;
}

export interface ViewerElements {
  /**
   * The visible area; give it a size. It gets these classes, for optional styling:
   * "panning" while dragging (cursor: grabbing), "animate" while zooming to a
   * screen or fitting (transition the canvas's transform), and "stale" from
   * setStale (dim the image).
   */
  stage: HTMLElement;
  /** Inside the stage; holds the board image and is transformed. */
  canvas: HTMLElement;
  /** Where the screen chips go ("All", then one per screen). */
  screens: HTMLElement;
  /** Removed when the first board shows. */
  empty?: HTMLElement | null;
  zoomIn?: HTMLElement | null;
  zoomOut?: HTMLElement | null;
  /** Shows the zoom level; clicking it fits the board. */
  zoomFit?: HTMLElement | null;
}

export interface Viewer {
  show(svg: string, width: number, height: number, items: BoardItem[]): void;
  refresh(animate?: boolean): void;
  /** Dims the board, for when the text has problems and this is the last valid render. */
  setStale(stale: boolean): void;
  fit(): void;
  zoomIn(): void;
  zoomOut(): void;
  /** Stop: remove the viewer's listeners and release the board image. For hosts that remove the viewer (a React component unmounting). */
  destroy(): void;
  /**
   * The board's measureElements entries, for clicks, hovers and zoomTo; null (or none) turns
   * element clicks off. Set them after each show() of a new board: they describe one board.
   */
  setElements(elements: Measured[] | null): void;
  /**
   * Outlines entries on the board, inside the zoomed canvas: a box per element, the line and label
   * of a flow. Each kind replaces its own earlier ones ([] clears it); "selected" (the default) is
   * solid, "hover" lighter. The color is the CSS variable --tsquare-highlight (default #3B99FB).
   */
  highlight(entries: Measured[], opts?: { kind?: "selected" | "hover" }): void;
  /** Zooms to an entry's box (a flow: its line and label) or any box in board pixels, and stays on it as the stage resizes. */
  zoomTo(target: Measured | MeasuredBox, opts?: { animate?: boolean }): void;
  /** A point on the page (a pointer event's clientX/clientY) in board pixels, where measureElements' boxes are. */
  toBoard(clientX: number, clientY: number): { x: number; y: number };
  /**
   * An element over the board for the host's own marks (comment pins, a text field), positioned in
   * board pixels: it pans and zooms with the board. It ignores the pointer; give children that
   * should be clickable pointer-events: auto.
   */
  readonly layer: HTMLElement;
}

/**
 * What the fit and zoom math and the gestures depend on, set on the elements
 * so a host can't leave them out: the canvas is placed at the stage's top-left
 * and scales from its own top-left; the stage clips it and takes touch gestures
 * itself (pinch zooms the board, not the page).
 */
function structuralStyles(stage: HTMLElement, canvas: HTMLElement) {
  if (getComputedStyle(stage).position === "static") stage.style.position = "relative"; // keep a host's absolute/fixed
  stage.style.overflow = "hidden";
  stage.style.touchAction = "none";
  Object.assign(canvas.style, { position: "absolute", left: "0px", top: "0px", transformOrigin: "0 0" });
}

export function createViewer(el: ViewerElements, opts: ViewerOptions = {}): Viewer {
  const { stage, canvas } = el;
  structuralStyles(stage, canvas);
  const stop = new AbortController(); // every listener below is removed by destroy()
  const signal = stop.signal;
  let img: HTMLImageElement | null = null;
  let size = { width: 0, height: 0 };
  let items: BoardItem[] = [];
  let scale = 1, x = 0, y = 0;
  let mode: "fit" | "manual" | number | MeasuredBox = "fit"; // number = zoomed to that screen; a box: zoomTo
  const PAD = 16;
  let elements: Measured[] = [];
  // Over the image, in board pixels: the highlights, then the host's layer
  const overlay = () => {
    const d = document.createElement("div");
    Object.assign(d.style, { position: "absolute", left: "0px", top: "0px", width: "0px", height: "0px", pointerEvents: "none" });
    return d;
  };
  const marks = overlay(), layer = overlay();
  marks.className = "tsquare-highlights";
  layer.className = "tsquare-layer";
  const highlights: Record<"selected" | "hover", HTMLElement[]> = { selected: [], hover: [] };

  const label = () => {
    if (el.zoomFit) el.zoomFit.textContent = `${Math.round(scale * 100)}%`;
    opts.onZoom?.(scale);
  };
  const apply = (animate = false) => {
    stage.classList.toggle("animate", animate);
    canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    canvas.style.setProperty("--tsquare-viewer-scale", String(scale)); // highlights stay ~2px wide on screen
    label();
  };
  const fitRect = (r: { x: number; y: number; width: number; height: number }, animate: boolean) => {
    const w = stage.clientWidth - PAD * 2, h = stage.clientHeight - PAD * 2;
    if (w <= 0 || h <= 0 || !r.width) return;
    scale = Math.min(w / r.width, h / r.height, 4);
    x = PAD + (w - r.width * scale) / 2 - r.x * scale;
    y = PAD + (h - r.height * scale) / 2 - r.y * scale;
    apply(animate);
  };
  const markScreens = () => el.screens.querySelectorAll("button").forEach((b, i) =>
    b.setAttribute("aria-pressed", String(i === 0 ? mode === "fit" : mode === i - 1)));

  function refresh(animate = false) {
    if (!size.width) return;
    if (mode === "fit") fitRect({ x: 0, y: 0, ...size }, animate);
    else if (typeof mode === "number" && items[mode]) fitRect(items[mode], animate);
    else if (typeof mode === "object") fitRect(mode, animate);
    else apply();
    markScreens();
  }
  function zoomAt(factor: number, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2) {
    const next = Math.min(8, Math.max(0.05, scale * factor));
    x = cx - (cx - x) * (next / scale);
    y = cy - (cy - y) * (next / scale);
    scale = next;
    mode = "manual";
    apply();
    markScreens();
  }
  const fit = () => { mode = "fit"; refresh(true); };

  function show(svg: string, width: number, height: number, list: BoardItem[]) {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    if (!img) {
      img = document.createElement("img");
      img.alt = "Rendered wireframe";
      img.draggable = false;
      canvas.replaceChildren(img, marks, layer);
      el.empty?.remove();
    }
    const old = img.src;
    img.src = url;
    if (old.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(old), 1000);
    const resized = width !== size.width || height !== size.height;
    size = { width, height };
    img.width = width;
    img.height = height;
    // The board is drawn at its own size and scaled by the canvas transform. Common resets
    // (VS Code's webview styles, Tailwind's base) cap images at max-width: 100%, which squeezes
    // the board into the stage's width while it keeps its height.
    Object.assign(img.style, { width: `${width}px`, height: `${height}px`, maxWidth: "none", maxHeight: "none" });
    for (const o of [marks, layer]) Object.assign(o.style, { width: `${width}px`, height: `${height}px` });
    const screens = list.filter((i) => i.type === "Screen");
    if (screens.map((s) => s.name).join("\n") !== items.filter((i) => i.type === "Screen").map((s) => s.name).join("\n")) {
      if (typeof mode === "number") mode = "fit";
      buildScreenChips(screens);
    }
    items = screens;
    if (resized && (mode === "manual" || typeof mode === "object")) mode = "fit";
    refresh();
  }

  function buildScreenChips(screens: BoardItem[]) {
    const bar = el.screens;
    bar.replaceChildren();
    if (screens.length < 2) return; // one screen: "fit" already shows it
    const chip = (text: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.addEventListener("click", onClick, { signal });
      bar.appendChild(b);
    };
    chip("All", fit);
    screens.forEach((s, i) => chip(s.name || `Screen ${i + 1}`, () => { mode = i; refresh(true); opts.onScreenZoom?.(); }));
  }

  // Wheel: pinch (ctrl/⌘ + wheel) zooms around the pointer; plain scroll pans.
  // The host's own controls in the layer (a pin's button, a text field, a scrolling popover) handle
  // their own presses and scrolling: capturing the pointer on the stage would take their click, and
  // dragging or scrolling in them would move the board
  const inLayer = (e: Event) => e.target !== layer && layer.contains(e.target as Node | null);

  stage.addEventListener("wheel", (e) => {
    if (!size.width || inLayer(e)) return;
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    else { x -= e.deltaX; y -= e.deltaY; mode = "manual"; apply(); markScreens(); }
  }, { passive: false, signal });

  // Drag to pan; two fingers pinch and pan. Touch screens send one pointermove per
  // finger, so each move pans by how far the fingers' midpoint moved, then zooms
  // by the change in their distance around the new midpoint: the board point
  // between the fingers stays under them.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { mid: { x: number; y: number }; dist: number } | null = null;
  const twoFingers = () => {
    const [a, b] = [...pointers.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  // A click: one pointer down and up again within a few px (more pans). Hit-tested in board pixels,
  // with a tolerance of a few screen px for flow lines however far the board is zoomed out.
  let press: { id: number; x: number; y: number; moved: boolean } | null = null;
  const hitsAt = (clientX: number, clientY: number) => {
    const p = toBoard(clientX, clientY);
    return elementsAt(elements, p.x, p.y, { tolerance: 8 / scale });
  };
  let hovered: Measured | null = null;
  const hover = (hit: Measured | null, hits: Measured[]) => {
    if (hit === hovered) return;
    hovered = hit;
    opts.onElementHover?.(hit, hits);
  };
  stage.addEventListener("pointerdown", (e) => {
    if (inLayer(e)) return;
    stage.setPointerCapture(e.pointerId);
    press = pointers.size ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.classList.add("panning");
    pinch = pointers.size === 2 ? twoFingers() : null;
  }, { signal });
  stage.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (opts.onElementHover && elements.length && e.pointerType !== "touch") {
        const hits = hitsAt(e.clientX, e.clientY);
        hover(hits[0] ?? null, hits);
      }
      return;
    }
    if (press && (press.id !== e.pointerId || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 4)) press.moved = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const now = twoFingers();
      const r = stage.getBoundingClientRect();
      x += now.mid.x - pinch.mid.x;
      y += now.mid.y - pinch.mid.y;
      if (pinch.dist && now.dist) zoomAt(now.dist / pinch.dist, now.mid.x - r.left, now.mid.y - r.top);
      else { mode = "manual"; apply(); markScreens(); } // fingers on the same spot: pan only
      pinch = now;
    } else {
      x += e.clientX - prev.x;
      y += e.clientY - prev.y;
      mode = "manual";
      apply();
      markScreens();
    }
  }, { signal });
  const release = (e: PointerEvent) => {
    if (e.type === "pointerup" && press && press.id === e.pointerId && !press.moved && pointers.size === 1 && opts.onElementClick && elements.length) {
      const hits = hitsAt(e.clientX, e.clientY);
      opts.onElementClick(hits[0] ?? null, hits, e);
    }
    if (press?.id === e.pointerId) press = null;
    pointers.delete(e.pointerId);
    pinch = pointers.size === 2 ? twoFingers() : null;
    if (!pointers.size) stage.classList.remove("panning");
  };
  stage.addEventListener("pointerup", release, { signal });
  stage.addEventListener("pointercancel", release, { signal });
  stage.addEventListener("pointerleave", () => { if (!pointers.size) hover(null, []); }, { signal });
  stage.addEventListener("dblclick", (e) => { if (!inLayer(e)) fit(); }, { signal });
  const resize = new ResizeObserver(() => refresh());
  resize.observe(stage);

  el.zoomIn?.addEventListener("click", () => zoomAt(1.25), { signal });
  el.zoomOut?.addEventListener("click", () => zoomAt(0.8), { signal });
  el.zoomFit?.addEventListener("click", fit, { signal });

  function toBoard(clientX: number, clientY: number) {
    // the canvas sits inside the stage's border (clientLeft/Top), not at its outer edge
    const r = stage.getBoundingClientRect();
    return { x: (clientX - r.left - stage.clientLeft - x) / scale, y: (clientY - r.top - stage.clientTop - y) / scale };
  }

  /** The box an entry is drawn in (a flow: around its line and label). */
  function boxOf(e: Measured | MeasuredBox): MeasuredBox {
    if (!("type" in e)) return e;
    if (!isFlow(e)) return e.box;
    const xs = e.path.map((p) => p[0]), ys = e.path.map((p) => p[1]);
    if (e.labelBox) xs.push(e.labelBox.x, e.labelBox.x + e.labelBox.width), ys.push(e.labelBox.y, e.labelBox.y + e.labelBox.height);
    const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
    return { x: x0, y: y0, width: Math.max(...xs) - x0, height: Math.max(...ys) - y0 };
  }

  const SVG = "http://www.w3.org/2000/svg";
  function mark(e: Measured, kind: "selected" | "hover"): HTMLElement | SVGElement {
    const color = "var(--tsquare-highlight, #3B99FB)";
    const width = "calc(2px / var(--tsquare-viewer-scale, 1))";
    if (isFlow(e)) {
      const svg = document.createElementNS(SVG, "svg");
      svg.setAttribute("width", String(size.width));
      svg.setAttribute("height", String(size.height));
      Object.assign(svg.style, { position: "absolute", left: "0px", top: "0px", overflow: "visible" });
      const line = document.createElementNS(SVG, "polyline");
      line.setAttribute("points", e.path.map((p) => p.join(",")).join(" "));
      line.setAttribute("fill", "none");
      Object.assign(line.style, { stroke: color, strokeWidth: `calc(6px / var(--tsquare-viewer-scale, 1))`, strokeLinejoin: "round", strokeLinecap: "round", opacity: kind === "hover" ? "0.35" : "0.5" });
      svg.append(line);
      if (e.labelBox) {
        const r = document.createElementNS(SVG, "rect");
        for (const [k, v] of Object.entries({ x: e.labelBox.x, y: e.labelBox.y, width: e.labelBox.width, height: e.labelBox.height, rx: 12 })) r.setAttribute(k, String(v));
        Object.assign(r.style, { fill: "none", stroke: color, strokeWidth: width, opacity: kind === "hover" ? "0.6" : "1" });
        svg.append(r);
      }
      svg.setAttribute("class", `tsquare-highlight tsquare-highlight-${kind}`);
      return svg;
    }
    const b = e.box;
    const d = document.createElement("div");
    d.className = `tsquare-highlight tsquare-highlight-${kind}`;
    Object.assign(d.style, {
      position: "absolute", left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px`, boxSizing: "border-box",
      outline: `${width} ${kind === "hover" ? "dashed" : "solid"} ${color}`, outlineOffset: "1px", borderRadius: "3px",
      background: kind === "selected" ? "color-mix(in srgb, var(--tsquare-highlight, #3B99FB) 8%, transparent)" : "transparent",
    });
    return d;
  }

  return {
    show,
    refresh,
    setStale: (stale) => { stage.classList.toggle("stale", stale); },
    fit,
    zoomIn: () => zoomAt(1.25),
    zoomOut: () => zoomAt(0.8),
    setElements(list) {
      elements = list ?? [];
      // the hovered element is gone: say so, so a host's hover outline doesn't stay behind
      if (hovered && !elements.includes(hovered)) hover(null, []);
    },
    highlight(entries, o = {}) {
      const kind = o.kind ?? "selected";
      for (const m of highlights[kind]) m.remove();
      highlights[kind] = entries.filter((e) => isFlow(e) || (e.box.width > 0 && e.box.height > 0)).map((e) => mark(e, kind) as HTMLElement);
      // hover marks under the selected ones
      if (kind === "hover") marks.prepend(...highlights.hover);
      else marks.append(...highlights.selected);
    },
    zoomTo(target, o = {}) {
      const b = boxOf(target), m = 24;
      mode = { x: b.x - m, y: b.y - m, width: b.width + 2 * m, height: b.height + 2 * m };
      refresh(o.animate ?? true);
    },
    toBoard,
    layer,
    destroy() {
      stop.abort();
      resize.disconnect();
      if (img?.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    },
  };
}
