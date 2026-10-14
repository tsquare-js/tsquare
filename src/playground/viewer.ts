/**
 * The zoomable board: zoom, pan, pinch, and zoom to a screen. Browser code,
 * published as `tsquare/viewer`: the playground page uses it, and so does the
 * VS Code extension's preview. Each brings its own markup and controls and
 * passes the elements in; the board comes from renderWireframeSvg + boardLayout.
 *
 * The viewer sets the styles its math depends on (see structuralStyles), so
 * the host styles only looks: size the stage, and optionally style the
 * "panning", "animate" and "stale" classes it toggles on the stage.
 */
import type { BoardItem } from "../render.js";

export type { BoardItem };

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

export function createViewer(el: ViewerElements, opts: { onScreenZoom?: () => void; onZoom?: (scale: number) => void } = {}): Viewer {
  const { stage, canvas } = el;
  structuralStyles(stage, canvas);
  let img: HTMLImageElement | null = null;
  let size = { width: 0, height: 0 };
  let items: BoardItem[] = [];
  let scale = 1, x = 0, y = 0;
  let mode: "fit" | "manual" | number = "fit"; // number = zoomed to that screen
  const PAD = 16;

  const label = () => {
    if (el.zoomFit) el.zoomFit.textContent = `${Math.round(scale * 100)}%`;
    opts.onZoom?.(scale);
  };
  const apply = (animate = false) => {
    stage.classList.toggle("animate", animate);
    canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
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
      canvas.replaceChildren(img);
      el.empty?.remove();
    }
    const old = img.src;
    img.src = url;
    if (old.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(old), 1000);
    const resized = width !== size.width || height !== size.height;
    size = { width, height };
    img.width = width;
    img.height = height;
    const screens = list.filter((i) => i.type === "Screen");
    if (screens.map((s) => s.name).join("\n") !== items.filter((i) => i.type === "Screen").map((s) => s.name).join("\n")) {
      if (typeof mode === "number") mode = "fit";
      buildScreenChips(screens);
    }
    items = screens;
    if (resized && mode === "manual") mode = "fit";
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
      b.addEventListener("click", onClick);
      bar.appendChild(b);
    };
    chip("All", fit);
    screens.forEach((s, i) => chip(s.name || `Screen ${i + 1}`, () => { mode = i; refresh(true); opts.onScreenZoom?.(); }));
  }

  // Wheel: pinch (ctrl/⌘ + wheel) zooms around the pointer; plain scroll pans.
  stage.addEventListener("wheel", (e) => {
    if (!size.width) return;
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    else { x -= e.deltaX; y -= e.deltaY; mode = "manual"; apply(); markScreens(); }
  }, { passive: false });

  // Drag to pan; two fingers pinch.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;
  stage.addEventListener("pointerdown", (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.classList.add("panning");
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  stage.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const r = stage.getBoundingClientRect();
      if (pinchDist) zoomAt(dist / pinchDist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinchDist = dist;
    } else {
      x += e.clientX - prev.x;
      y += e.clientY - prev.y;
      mode = "manual";
      apply();
      markScreens();
    }
  });
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinchDist = 0;
    if (!pointers.size) stage.classList.remove("panning");
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("dblclick", fit);
  new ResizeObserver(() => refresh()).observe(stage);

  el.zoomIn?.addEventListener("click", () => zoomAt(1.25));
  el.zoomOut?.addEventListener("click", () => zoomAt(0.8));
  el.zoomFit?.addEventListener("click", fit);

  return {
    show,
    refresh,
    setStale: (stale) => { stage.classList.toggle("stale", stale); },
    fit,
    zoomIn: () => zoomAt(1.25),
    zoomOut: () => zoomAt(0.8),
  };
}
