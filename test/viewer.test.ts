/**
 * tsquare/viewer (src/playground/viewer.ts) in jsdom: screen chips, fitting,
 * zooming, panning and the stale state. jsdom has no layout, so the stage's
 * size is set by hand, and the three browser APIs it lacks are stubbed:
 * URL.createObjectURL, ResizeObserver and setPointerCapture.
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createViewer, type BoardItem, type Viewer } from "../src/playground/viewer.js";

const STAGE = { width: 800, height: 600 };
const PAD = 16; // the viewer's margin around a fitted board
const BOARD = { width: 2000, height: 1000 };
const screen = (name: string, x: number): BoardItem => ({ type: "Screen", name, x, y: 100, width: 400, height: 800 });
const ITEMS: BoardItem[] = [screen("Sign in", 100), screen("Home", 700), { type: "Note", name: "a note", x: 1300, y: 100, width: 200, height: 100 }, screen("Profile", 1500)];

let dom: JSDOM;
let viewer: Viewer;
let screenZooms: number;
let revoked: string[];
let disconnected: number;
let zooms: number[];
const $ = (id: string) => dom.window.document.getElementById(id)!;
const chips = () => [...$("screens").querySelectorAll("button")];
const pressed = () => chips().filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent);
/** The canvas transform as numbers: [x, y, scale]. */
function transform() {
  const m = $("canvas").style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/);
  assert.ok(m, `transform: ${$("canvas").style.transform}`);
  return m.slice(1).map(Number);
}
/** Where fitting this rectangle into the stage should put it. */
function fitted(r: { x: number; y: number; width: number; height: number }) {
  const w = STAGE.width - PAD * 2, h = STAGE.height - PAD * 2;
  const scale = Math.min(w / r.width, h / r.height, 4);
  return [PAD + (w - r.width * scale) / 2 - r.x * scale, PAD + (h - r.height * scale) / 2 - r.y * scale, scale];
}
const close = (actual: number[], expected: number[]) =>
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 0.01, `${actual} ≈ ${expected}`));

beforeEach(() => {
  dom = new JSDOM(`<div id="screens"></div>
    <div id="stage"><div id="canvas"></div><div id="empty">Nothing rendered yet</div></div>
    <button id="zoom-in"></button><button id="zoom-out"></button><button id="zoom-fit">100%</button>`);
  const w = dom.window as any;
  let blobs = 0;
  w.URL.createObjectURL = () => `blob:test/${++blobs}`;
  revoked = [];
  disconnected = 0;
  w.URL.revokeObjectURL = (url: string) => { revoked.push(url); };
  w.ResizeObserver = class { observe() {} disconnect() { disconnected++; } };
  w.HTMLElement.prototype.setPointerCapture = () => {};
  Object.assign(globalThis, { document: w.document, URL: w.URL, Blob: w.Blob, ResizeObserver: w.ResizeObserver, AbortController: w.AbortController, getComputedStyle: w.getComputedStyle.bind(w) });
  const stage = $("stage");
  Object.defineProperty(stage, "clientWidth", { value: STAGE.width });
  Object.defineProperty(stage, "clientHeight", { value: STAGE.height });
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: STAGE.width, height: STAGE.height }) as DOMRect;
  screenZooms = 0;
  zooms = [];
  viewer = createViewer(
    { stage, canvas: $("canvas"), screens: $("screens"), empty: $("empty"), zoomIn: $("zoom-in"), zoomOut: $("zoom-out"), zoomFit: $("zoom-fit") },
    { onScreenZoom: () => screenZooms++, onZoom: (s) => zooms.push(s) },
  );
  viewer.show("<svg/>", BOARD.width, BOARD.height, ITEMS);
});

test("show() puts the board in, fitted to the stage, with a chip per screen (notes get none)", () => {
  assert.equal($("empty"), null, "the placeholder is gone");
  const img = $("canvas").querySelector("img")!;
  assert.equal(img.src, "blob:test/1");
  assert.deepEqual([img.width, img.height], [BOARD.width, BOARD.height]);
  assert.deepEqual(chips().map((b) => b.textContent), ["All", "Sign in", "Home", "Profile"]);
  assert.deepEqual(pressed(), ["All"]);
  close(transform(), fitted({ x: 0, y: 0, ...BOARD }));
  assert.equal($("zoom-fit").textContent, `${Math.round(fitted({ x: 0, y: 0, ...BOARD })[2] * 100)}%`);
  assert.equal(zooms.at(-1), fitted({ x: 0, y: 0, ...BOARD })[2], "onZoom reports the scale");
});

test("a screen chip zooms to that screen; All and double-click fit the board again", () => {
  chips()[2].click(); // Home
  close(transform(), fitted(ITEMS[1]));
  assert.deepEqual(pressed(), ["Home"]);
  assert.equal(screenZooms, 1);
  assert.ok($("stage").classList.contains("animate"), "zooming to a screen animates");

  chips()[0].click();
  close(transform(), fitted({ x: 0, y: 0, ...BOARD }));
  assert.deepEqual(pressed(), ["All"]);

  chips()[3].click();
  $("stage").dispatchEvent(new dom.window.MouseEvent("dblclick"));
  assert.deepEqual(pressed(), ["All"]);
});

test("zoom buttons zoom around the center; the fit button shows the level and fits", () => {
  const [, , fit] = transform();
  $("zoom-in").click();
  const [x, y, scale] = transform();
  assert.ok(Math.abs(scale - fit * 1.25) < 1e-9);
  assert.deepEqual(pressed(), [], "a manual zoom is neither All nor a screen");
  assert.equal($("zoom-fit").textContent, `${Math.round(scale * 100)}%`);
  // the point under the stage's center stays put
  const [fx, fy] = fitted({ x: 0, y: 0, ...BOARD });
  const cx = STAGE.width / 2, cy = STAGE.height / 2;
  assert.ok(Math.abs((cx - x) / scale - (cx - fx) / fit) < 1e-6 && Math.abs((cy - y) / scale - (cy - fy) / fit) < 1e-6);

  $("zoom-out").click();
  assert.ok(Math.abs(transform()[2] - fit) < 1e-9, "out undoes in");
  $("zoom-fit").click();
  assert.deepEqual(pressed(), ["All"]);
});

test("ctrl/⌘ + wheel zooms around the pointer; a plain wheel pans", () => {
  const [x0, y0, s0] = transform();
  $("stage").dispatchEvent(new dom.window.WheelEvent("wheel", { deltaY: -100, ctrlKey: true, clientX: 200, clientY: 150, cancelable: true }));
  const [x1, y1, s1] = transform();
  assert.ok(s1 > s0, "zoomed in");
  assert.ok(Math.abs((200 - x1) / s1 - (200 - x0) / s0) < 1e-6 && Math.abs((150 - y1) / s1 - (150 - y0) / s0) < 1e-6, "the point under the pointer stays put");

  $("stage").dispatchEvent(new dom.window.WheelEvent("wheel", { deltaX: 30, deltaY: 40, cancelable: true }));
  close(transform(), [x1 - 30, y1 - 40, s1]);
});

test("dragging pans", () => {
  const [x0, y0, s0] = transform();
  const pointer = (type: string, clientX: number, clientY: number) =>
    $("stage").dispatchEvent(new dom.window.PointerEvent(type, { pointerId: 1, clientX, clientY, bubbles: true }));
  pointer("pointerdown", 100, 100);
  assert.ok($("stage").classList.contains("panning"));
  pointer("pointermove", 160, 130);
  pointer("pointerup", 160, 130);
  assert.ok(!$("stage").classList.contains("panning"));
  close(transform(), [x0 + 60, y0 + 30, s0]);
});

test("setStale dims the board; a new board with the same screens keeps the zoomed screen", () => {
  viewer.setStale(true);
  assert.ok($("stage").classList.contains("stale"));
  viewer.setStale(false);
  assert.ok(!$("stage").classList.contains("stale"));

  chips()[3].click(); // Profile
  const before = chips();
  viewer.show("<svg/>", BOARD.width, BOARD.height, ITEMS);
  assert.equal($("canvas").querySelector("img")!.src, "blob:test/2", "the new board replaced the old one");
  assert.deepEqual(chips(), before, "same screens: the chips stay");
  assert.deepEqual(pressed(), ["Profile"]);
});

test("renamed screens rebuild the chips and fit the board; one screen gets no chips", () => {
  chips()[2].click();
  viewer.show("<svg/>", BOARD.width, BOARD.height, [screen("Sign in", 100), screen("Dashboard", 700)]);
  assert.deepEqual(chips().map((b) => b.textContent), ["All", "Sign in", "Dashboard"]);
  assert.deepEqual(pressed(), ["All"]);

  viewer.show("<svg/>", 400, 800, [screen("Only", 0)]);
  assert.deepEqual(chips(), []);
});

test("the viewer sets the styles its math needs, so a page with no CSS for it still works", () => {
  // the stage and canvas in beforeEach have no CSS at all
  const stage = $("stage").style, canvas = $("canvas").style;
  assert.deepEqual([stage.position, stage.overflow, stage.touchAction], ["relative", "hidden", "none"]);
  assert.deepEqual([canvas.position, canvas.left, canvas.top, canvas.transformOrigin], ["absolute", "0px", "0px", "0 0"]);

  // a host's own positioning of the stage is kept
  const host = dom.window.document.createElement("div");
  host.style.position = "fixed";
  createViewer({ stage: host, canvas: dom.window.document.createElement("div"), screens: dom.window.document.createElement("div") });
  assert.equal(host.style.position, "fixed");
});

// Two fingers. Touch screens send one pointermove per finger, one after the other,
// so these move one finger at a time, like a real pinch or two-finger pan.
const touch = (type: string, id: number, x: number, y = 300) =>
  $("stage").dispatchEvent(new dom.window.PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
/** The board point (in board pixels) under a point on the stage. */
function boardPointAt(px: number, py: number) {
  const [x, y, scale] = transform();
  return [(px - x) / scale, (py - y) / scale];
}
const fingers: Record<number, [number, number]> = {};
function move(id: number, x: number, y = 300) { fingers[id] = [x, y]; touch("pointermove", id, x, y); }
const midpoint = (): [number, number] => [(fingers[1][0] + fingers[2][0]) / 2, (fingers[1][1] + fingers[2][1]) / 2];

for (const first of [1, 2]) {
  test(`a pinch keeps the board point between the fingers under them (finger ${first} moves first)`, () => {
    const [, , s0] = transform();
    fingers[1] = [300, 300]; fingers[2] = [400, 300];
    touch("pointerdown", 1, 300); touch("pointerdown", 2, 400);
    const under = boardPointAt(...midpoint());
    // spread from 100px apart to 200px, symmetrically around x = 350
    for (let step = 1; step <= 5; step++) {
      for (const id of first === 1 ? [1, 2] : [2, 1]) {
        move(id, id === 1 ? 300 - step * 10 : 400 + step * 10);
        close(boardPointAt(...midpoint()), under);
      }
    }
    assert.ok(Math.abs(transform()[2] - s0 * 2) < 1e-9, "twice as close");
    touch("pointerup", 1, fingers[1][0]); touch("pointerup", 2, fingers[2][0]);
  });
}

test("two fingers moving together pan the board, without zooming", () => {
  const [x0, y0, s0] = transform();
  fingers[1] = [300, 300]; fingers[2] = [400, 300];
  touch("pointerdown", 1, 300); touch("pointerdown", 2, 400);
  const under = boardPointAt(...midpoint());
  for (let step = 1; step <= 10; step++) {
    move(1, 300 + step * 10, 300 + step * 5);
    close(boardPointAt(...midpoint()), under);
    move(2, 400 + step * 10, 300 + step * 5);
    close(boardPointAt(...midpoint()), under);
    assert.ok(Math.abs(transform()[2] - s0) < 1e-9, `the scale is back after both fingers moved (step ${step})`);
  }
  close(transform(), [x0 + 100, y0 + 50, s0]);
});

test("lifting one finger, the other drags from where it is", () => {
  fingers[1] = [300, 300]; fingers[2] = [400, 300];
  touch("pointerdown", 1, 300); touch("pointerdown", 2, 400);
  move(1, 280); move(2, 420);
  touch("pointerup", 2, 420);
  const [x, y, s] = transform();
  move(1, 310, 320);
  close(transform(), [x + 30, y + 20, s]);
});

test("fingers on the same spot pan without zooming (no divide by zero)", () => {
  const [x0, y0, s0] = transform();
  fingers[1] = [350, 300]; fingers[2] = [350, 300];
  touch("pointerdown", 1, 350); touch("pointerdown", 2, 350);
  move(1, 360); // the fingers part: from 0px apart to 10px, the midpoint moves 5px
  close(transform(), [x0 + 5, y0, s0]);
  move(2, 360); // and meet again: 10px apart to 0, the midpoint moves 5px more
  close(transform(), [x0 + 10, y0, s0]);
});

test("three fingers, then one lifted: the other two pinch from where they are", () => {
  fingers[1] = [300, 300]; fingers[2] = [400, 300];
  touch("pointerdown", 1, 300); touch("pointerdown", 2, 400); touch("pointerdown", 3, 600);
  touch("pointerup", 3, 600);
  const [, , s0] = transform();
  const under = boardPointAt(...midpoint());
  move(1, 250); move(2, 450);
  close(boardPointAt(...midpoint()), under);
  assert.ok(Math.abs(transform()[2] - s0 * 2) < 1e-9);
});

test("the board image keeps its size under a page's img rules (VS Code's webview styles, Tailwind's base)", () => {
  const style = dom.window.document.createElement("style");
  style.textContent = "img, video { max-width: 100%; max-height: 100%; height: auto; }";
  dom.window.document.head.appendChild(style);
  const img = $("canvas").querySelector("img")!;
  const sizeOf = () => { const c = dom.window.getComputedStyle(img); return [c.width, c.height, c.maxWidth, c.maxHeight]; };
  assert.deepEqual(sizeOf(), [`${BOARD.width}px`, `${BOARD.height}px`, "none", "none"]);
  viewer.show("<svg/>", 1200, 900, ITEMS); // a new board size updates it
  assert.deepEqual(sizeOf(), ["1200px", "900px", "none", "none"]);
});

test("destroy() stops the viewer: its listeners go, the resize watch stops, the board image is released", () => {
  const before = transform();
  const img = $("canvas").querySelector("img")!;
  viewer.destroy();
  assert.equal(disconnected, 1, "the ResizeObserver is disconnected");
  assert.deepEqual(revoked, [img.src], "the board's blob: URL is revoked");
  $("zoom-in").click();
  $("stage").dispatchEvent(new dom.window.WheelEvent("wheel", { deltaY: -100, ctrlKey: true, clientX: 200, clientY: 150, cancelable: true }));
  $("stage").dispatchEvent(new dom.window.MouseEvent("dblclick"));
  chips()[2].click();
  assert.deepEqual(transform(), before, "zoom buttons, wheel, double-click and chips no longer do anything");
});
