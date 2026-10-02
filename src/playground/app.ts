/**
 * The playground page's script. Bundled into playground.js by the build (with
 * CodeMirror), served by createPlaygroundHandler and by tsquare.dev.
 *
 * It talks to the endpoints listed in ./index.ts and never tracks anything
 * itself: notable actions are announced as `tsquare:event` DOM events, which
 * a host page (like tsquare.dev) may forward to its own analytics.
 */
import { undo } from "@codemirror/commands";
import { Code, Copy, Download, FileText, Image as ImageIcon, LayoutGrid, Link, Maximize, Minimize, Moon, Share2, Sun, X, ZoomIn, ZoomOut, createElement } from "lucide";
import { createEditor, type Editor } from "./editor.js";
import type { LanguageData } from "./language-data.js";

interface Issue { line: number; message: string }
interface BoardItem { type: "Screen" | "Note"; name: string; x: number; y: number; width: number; height: number }
interface RenderResult { issues: Issue[]; svg?: string; width?: number; height?: number; items?: BoardItem[] }

/** Where share and image links point. A host page can set window.TSQUARE_BASE (tsquare.dev sets its own origin). */
const BASE: string = (window as any).TSQUARE_BASE ?? "https://tsquare.dev";

// ── Small helpers ───────────────────────────────────────────────────────

// The logo goes to the site: home in the same tab when this is the hosted playground, a new tab when it runs locally.
{
  const brand = document.getElementById("brand") as HTMLAnchorElement;
  const hosted = new URL(BASE).origin === location.origin;
  brand.href = hosted ? "/" : BASE;
  if (!hosted) { brand.target = "_blank"; brand.rel = "noopener"; }
  brand.title = hosted ? "tsquare home" : "tsquare.dev (opens in a new tab)";
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

/** Announce something the user did, for a host page's analytics. Never includes wireframe text. */
function emit(name: string, detail: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent("tsquare:event", { detail: { name, ...detail } }));
}

const ICONS: Record<string, any> = {
  copy: Copy, download: Download, "file-text": FileText, image: ImageIcon, "layout-grid": LayoutGrid, link: Link,
  maximize: Maximize, minimize: Minimize, moon: Moon, "share-2": Share2, sun: Sun, x: X, "zoom-in": ZoomIn, "zoom-out": ZoomOut, code: Code,
};
function setIcon(el: Element, name: string) {
  el.replaceChildren(createElement(ICONS[name], { "aria-hidden": "true" }));
}
document.querySelectorAll("[data-icon]").forEach((el) => setIcon(el, (el as HTMLElement).dataset.icon!));

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string, action?: { label: string; run: () => void }) {
  $("toast-text").textContent = message;
  const btn = $<HTMLButtonElement>("toast-action");
  btn.textContent = action?.label ?? "";
  btn.onclick = action ? () => { action.run(); $("toast").classList.remove("show"); } : null;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), action ? 6000 : 1800);
}

async function copyText(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
    return true;
  } catch {
    toast("The browser blocked clipboard access");
    return false;
  }
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Link encoding: "z" + base64url(deflate-raw(text)), same as the library ─

async function encode(text: string) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "z" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function decode(data: string) {
  if (!data.startsWith("z")) throw new Error("unknown link format");
  const b64 = data.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

// ── Theme ───────────────────────────────────────────────────────────────

function applyThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  setIcon($("theme").firstElementChild!, dark ? "sun" : "moon");
  $("theme").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}
$("theme").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  store.set("wf.theme", next);
  applyThemeButton();
  emit("theme_changed", { theme: next });
});
applyThemeButton();

// ── Views ───────────────────────────────────────────────────────────────

function showView(name: string) {
  document.querySelectorAll<HTMLElement>("nav button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === name)));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `${name}-view`));
  store.set("wf.view", name);
  if (name === "components") loadReference();
  if (name === "prompt") loadPrompt();
  if (name === "editor") requestAnimationFrame(() => viewer.refresh());
}
document.querySelectorAll<HTMLElement>("nav button").forEach((b) =>
  b.addEventListener("click", () => { showView(b.dataset.view!); emit("view_opened", { view: b.dataset.view }); }),
);

// ── Preview: zoom, pan, zoom to a screen ────────────────────────────────

const viewer = (() => {
  const stage = $("stage");
  const canvas = $("canvas");
  let img: HTMLImageElement | null = null;
  let size = { width: 0, height: 0 };
  let items: BoardItem[] = [];
  let scale = 1, x = 0, y = 0;
  let mode: "fit" | "manual" | number = "fit"; // number = zoomed to that screen
  const PAD = 16;

  const label = () => ($("zoom-fit").textContent = `${Math.round(scale * 100)}%`);
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
  const markScreens = () => $("screens").querySelectorAll("button").forEach((b, i) =>
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

  function show(svg: string, width: number, height: number, list: BoardItem[]) {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    if (!img) {
      img = document.createElement("img");
      img.alt = "Rendered wireframe";
      img.draggable = false;
      canvas.replaceChildren(img);
      $("empty").remove();
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
    const bar = $("screens");
    bar.replaceChildren();
    if (screens.length < 2) return; // one screen: "fit" already shows it
    const chip = (text: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.addEventListener("click", onClick);
      bar.appendChild(b);
    };
    chip("All", () => { mode = "fit"; refresh(true); });
    screens.forEach((s, i) => chip(s.name || `Screen ${i + 1}`, () => { mode = i; refresh(true); emit("zoomed_to_screen"); }));
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
  stage.addEventListener("dblclick", () => { mode = "fit"; refresh(true); });
  new ResizeObserver(() => refresh()).observe(stage);

  $("zoom-in").addEventListener("click", () => zoomAt(1.25));
  $("zoom-out").addEventListener("click", () => zoomAt(0.8));
  $("zoom-fit").addEventListener("click", () => { mode = "fit"; refresh(true); });

  return { show, refresh, setStale: (stale: boolean) => stage.classList.toggle("stale", stale) };
})();

// Full screen preview
$("fullscreen").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else $("preview-pane").requestFullscreen?.().then(() => emit("fullscreen_opened")).catch(() => toast("Full screen isn't available here"));
});
document.addEventListener("fullscreenchange", () => {
  const on = !!document.fullscreenElement;
  setIcon($("fullscreen").firstElementChild!, on ? "minimize" : "maximize");
  $("fullscreen").setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
});

// Resizable split between editor and preview
(() => {
  const splitter = $("splitter");
  const view = $("editor-view");
  const set = (pct: number) => {
    const clamped = Math.min(75, Math.max(20, pct));
    view.style.setProperty("--split", `${clamped}%`);
    store.set("wf.split", String(clamped));
    viewer.refresh();
  };
  const saved = Number(store.get("wf.split"));
  if (saved) view.style.setProperty("--split", `${saved}%`);
  splitter.addEventListener("pointerdown", (e) => {
    splitter.setPointerCapture(e.pointerId);
    splitter.classList.add("dragging");
    const move = (ev: PointerEvent) => {
      const r = view.getBoundingClientRect();
      set(((ev.clientX - r.left) / r.width) * 100);
    };
    const up = () => { splitter.classList.remove("dragging"); splitter.removeEventListener("pointermove", move); };
    splitter.addEventListener("pointermove", move);
    splitter.addEventListener("pointerup", up, { once: true });
  });
  splitter.addEventListener("keydown", (e) => {
    const current = parseFloat(view.style.getPropertyValue("--split")) || 42;
    if (e.key === "ArrowLeft") set(current - 2);
    if (e.key === "ArrowRight") set(current + 2);
  });
})();

// ── Rendering ───────────────────────────────────────────────────────────

let editor: Editor;
let lastSvg: string | null = null;
let lastOk: boolean | null = null;
let seq = 0;

const boardTitle = (text: string) => text.match(/^\s*board\b[^"\n]*"([^"]*)"/m)?.[1] ?? "";
function fileName(ext: string) {
  const base = (boardTitle(editor.getText()) || "wireframe").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wireframe";
  return `${base}.${ext}`;
}

function setStatus(kind: "" | "ok" | "bad", text: string) {
  $("status").className = `status ${kind}`;
  $("status-text").textContent = text;
}

function showIssues(issues: Issue[]) {
  const box = $("issues");
  box.replaceChildren(...issues.map((i) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "issue";
    const ln = document.createElement("span");
    ln.className = "ln";
    ln.textContent = `line ${i.line}`;
    const msg = document.createElement("span");
    msg.textContent = i.message;
    row.append(ln, msg);
    row.addEventListener("click", () => editor.goToLine(i.line));
    return row;
  }));
  editor.setIssues(issues);
  requestAnimationFrame(() => editor.revealCursor()); // the issue list may have pushed the cursor out of view
}

async function render() {
  const mine = ++seq;
  const text = editor.getText();
  store.set("wf.source", text);
  $("doc-title").textContent = boardTitle(text) || "Untitled";
  if (!text.trim()) { showIssues([]); setStatus("", "Empty"); return; }
  setStatus("", "Rendering…");
  try {
    const res = await fetch("/api/render", { method: "POST", body: text });
    const data: RenderResult = await res.json();
    if (mine !== seq) return; // a newer edit is already rendering
    if (!res.ok) throw new Error((data as any).error || res.statusText);
    showIssues(data.issues);
    const ok = !!data.svg;
    if (data.svg) { lastSvg = data.svg; viewer.show(data.svg, data.width!, data.height!, data.items ?? []); }
    viewer.setStale(!ok && !!lastSvg);
    for (const id of ["copy-svg", "dl-svg", "dl-png", "share"]) $<HTMLButtonElement>(id).disabled = !ok;
    if (ok) setStatus("ok", "Valid");
    else setStatus("bad", `${data.issues.length} problem${data.issues.length === 1 ? "" : "s"}${lastSvg ? " · showing the last valid render" : ""}`);
    if (ok !== lastOk) emit("rendered", { ok, problems: data.issues.length });
    lastOk = ok;
  } catch (err) {
    if (mine !== seq) return;
    setStatus("bad", `Render failed: ${(err as Error).message}`);
  }
}

let renderTimer: ReturnType<typeof setTimeout> | undefined;
const scheduleRender = () => { clearTimeout(renderTimer); renderTimer = setTimeout(render, 250); };

/** Replace the document (one undoable step) and offer Undo, instead of asking first. */
function loadDoc(text: string, label: string) {
  const before = editor.getText();
  editor.setText(text.replace(/\s+$/, "") + "\n");
  showView("editor");
  if (before.trim() && before.trim() !== text.trim()) toast(`Opened ${label}`, { label: "Undo", run: () => undo(editor.view) });
}

// ── Exports and links ───────────────────────────────────────────────────

$("copy-svg").addEventListener("click", () => { if (lastSvg) copyText(lastSvg, "SVG copied").then((ok) => ok && emit("svg_copied")); });
$("dl-svg").addEventListener("click", () => {
  if (!lastSvg) return;
  download(new Blob([lastSvg], { type: "image/svg+xml" }), fileName("svg"));
  emit("downloaded", { format: "svg" });
});
$("dl-png").addEventListener("click", async () => {
  const res = await fetch("/api/png?scale=2", { method: "POST", body: editor.getText() });
  if (!res.ok) return toast("Fix the problems first");
  download(await res.blob(), fileName("png"));
  emit("downloaded", { format: "png" });
});

const menu = $("share-menu");
const closeMenu = () => { menu.classList.remove("open"); $("share").setAttribute("aria-expanded", "false"); };
$("share").addEventListener("click", (e) => {
  e.stopPropagation();
  const open = !menu.classList.contains("open");
  menu.classList.toggle("open", open);
  $("share").setAttribute("aria-expanded", String(open));
  if (open) menu.querySelector("button")?.focus();
});
document.addEventListener("click", (e) => { if (!menu.contains(e.target as Node)) closeMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
menu.querySelectorAll<HTMLButtonElement>("button[data-copy]").forEach((b) =>
  b.addEventListener("click", async () => {
    closeMenu();
    const data = await encode(editor.getText());
    const title = boardTitle(editor.getText()) || "Wireframe";
    const svgUrl = `${BASE}/svg/${data}`;
    const kind = b.dataset.copy!;
    const text = {
      share: `${BASE}/playground#${data}`,
      svg: svgUrl,
      png: `${BASE}/png/${data}`,
      markdown: `![${title.replace(/[[\]]/g, "")}](${svgUrl})`,
      html: `<img src="${svgUrl}" alt="${title.replace(/"/g, "&quot;")}">`,
    }[kind]!;
    const message = { share: "Share link copied", svg: "Image link copied", png: "PNG link copied", markdown: "Markdown copied", html: "HTML copied" }[kind]!;
    if (await copyText(text, message)) emit("link_copied", { kind });
  }),
);

// ── Examples gallery ────────────────────────────────────────────────────

let examples: { name: string; source: string }[] = [];
const BLANK = 'board "Untitled"\n  screen phone "Home"\n    heading "Hello"\n';
const thumbCache = new Map<string, string>();

async function thumbnail(source: string) {
  if (!thumbCache.has(source)) {
    const res = await fetch("/api/render", { method: "POST", body: source });
    const data: RenderResult = await res.json();
    thumbCache.set(source, data.svg ? URL.createObjectURL(new Blob([data.svg], { type: "image/svg+xml" })) : "");
  }
  return thumbCache.get(source)!;
}

function buildGallery() {
  const gallery = $("gallery");
  if (gallery.childElementCount) return;
  const card = (name: string, source: string | null) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "card";
    const thumb = document.createElement("div");
    thumb.className = "thumb" + (source ? "" : " blank");
    if (source) {
      const img = document.createElement("img");
      img.alt = "";
      thumbnail(source).then((src) => (img.src = src));
      thumb.appendChild(img);
    } else {
      thumb.textContent = "Start from scratch";
    }
    const label = document.createElement("div");
    label.className = "name";
    label.textContent = name;
    b.append(thumb, label);
    b.addEventListener("click", () => {
      ($("examples-dialog") as HTMLDialogElement).close();
      loadDoc(source ?? BLANK, source ? `“${name}”` : "a blank wireframe");
      emit("example_loaded", { example: source ? name : "blank" });
    });
    gallery.appendChild(b);
  };
  card("Blank", null);
  for (const e of examples) card(boardTitle(e.source) || e.name, e.source);
}

$("open-examples").addEventListener("click", () => {
  buildGallery();
  ($("examples-dialog") as HTMLDialogElement).showModal();
  emit("examples_opened");
});
$("close-examples").addEventListener("click", () => ($("examples-dialog") as HTMLDialogElement).close());
$("examples-dialog").addEventListener("click", (e) => { if (e.target === e.currentTarget) ($("examples-dialog") as HTMLDialogElement).close(); });

// ── Components view ─────────────────────────────────────────────────────

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

let referenceLoaded = false;
async function loadReference() {
  if (referenceLoaded) return;
  referenceLoaded = true;
  const { groups, components } = await (await fetch("/api/reference")).json();
  const byName = Object.fromEntries(components.map((c: any) => [c.name, c]));
  const body = $("docs-body");
  body.replaceChildren();
  const toc = $("toc");
  for (const g of groups) {
    toc.appendChild(el("h3", null, g.name));
    body.appendChild(el("div", "group-title", g.name));
    for (const name of g.components) {
      const a = el("a", null, name);
      a.href = `#c-${name}`;
      a.addEventListener("click", (e) => { e.preventDefault(); $(`c-${name}`).scrollIntoView({ behavior: "smooth" }); });
      toc.appendChild(a);
      body.appendChild(componentCard(byName[name]));
    }
  }
}

function componentCard(c: any) {
  const card = el("article", "comp");
  card.id = `c-${c.name}`;
  const head = el("div", "comp-head");
  const h = el("h2", null, c.name + " ");
  h.appendChild(el("code", null, c.name.toLowerCase()));
  const open = el("button", "btn", "Open in editor");
  open.type = "button";
  open.addEventListener("click", () => { loadDoc(c.example, `the ${c.name} example`); emit("example_loaded", { example: `component:${c.name}` }); });
  head.append(h, el("span", "grow"), open);
  card.append(head, el("p", null, c.description));
  const bodyEl = el("div", "comp-body");
  const shot = el("div", "shot");
  const img = el("img");
  img.alt = `${c.name} example`;
  img.loading = "lazy";
  img.src = URL.createObjectURL(new Blob([c.svg], { type: "image/svg+xml" }));
  shot.appendChild(img);
  const right = el("div");
  if (c.props.length) {
    const table = el("table", "props");
    table.innerHTML = "<thead><tr><th>Prop</th><th>Values</th></tr></thead>";
    const tb = el("tbody");
    for (const p of c.props) {
      const tr = el("tr");
      const name = el("td", null, p.name);
      if (p.main) name.appendChild(el("span", "tag", "main"));
      if (p.required) name.appendChild(el("span", "tag", "required"));
      const val = el("td");
      val.appendChild(el("div", "type", p.type));
      if (p.description) val.appendChild(el("div", "desc", p.description));
      tr.append(name, val);
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    right.appendChild(table);
  } else {
    right.appendChild(el("p", "desc", "No props."));
  }
  right.appendChild(el("pre", "src", c.example));
  bodyEl.append(shot, right);
  card.appendChild(bodyEl);
  return card;
}

// ── Prompt view ─────────────────────────────────────────────────────────

let promptText: string | null = null;
async function loadPrompt() {
  promptText ??= await (await fetch("/api/prompt")).text();
  $("prompt-text").textContent = promptText;
}
$("copy-prompt").addEventListener("click", async () => {
  await loadPrompt();
  if (await copyText(promptText!, "Prompt copied")) emit("prompt_copied");
});

// ── Start ───────────────────────────────────────────────────────────────

async function start() {
  const [data, list] = await Promise.all([
    fetch("/api/language").then((r) => r.json() as Promise<LanguageData>),
    fetch("/api/examples").then((r) => r.json()),
  ]);
  examples = list;

  // A share link (#z…) wins, then the last session, then the first example.
  let doc = store.get("wf.source") || examples[0]?.source || BLANK;
  let fromShare = false;
  if (location.hash.startsWith("#z")) {
    try {
      doc = await decode(location.hash.slice(1));
      fromShare = true;
    } catch {
      toast("That share link couldn't be read");
    }
    history.replaceState(null, "", location.pathname + location.search); // the link's job is done; don't keep a stale copy in the URL
  }

  editor = createEditor($("code"), { doc, data, onChange: scheduleRender });
  // A share link opened in a tab that already has the playground: only the hash changes, so no reload.
  addEventListener("hashchange", async () => {
    if (!location.hash.startsWith("#z")) return;
    try {
      loadDoc(await decode(location.hash.slice(1)), "the shared wireframe");
      emit("share_link_opened");
    } catch {
      toast("That share link couldn't be read");
    }
    history.replaceState(null, "", location.pathname + location.search);
  });
  editor.view.dom.addEventListener("tsquare-pasted-block", () => toast("Pasted the wireframe from the code block"));
  if (fromShare) emit("share_link_opened");
  render();
  showView(store.get("wf.view") || "editor");
}

start().catch((err) => setStatus("bad", `Couldn't start: ${(err as Error).message}`));
