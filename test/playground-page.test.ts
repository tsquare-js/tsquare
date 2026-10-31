/**
 * The playground page itself (app.ts) in jsdom, against the real handler: clicking an element on the
 * board puts the editor's caret on its line, the caret's element is outlined, and the outline waits
 * for the render after an edit. jsdom runs no module scripts, so app.ts is bundled here as a classic
 * script with the page's own esbuild options; it has no layout, blob URLs or ResizeObserver, so those
 * are stubbed, and the stage gets a size before the board is fitted to it.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { EditorView } from "@codemirror/view";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { compileWireframe } from "../src/compile.js";
import { elementsAtLine, measureElements, type MeasuredElement } from "../src/measure.js";
import { createPlaygroundHandler, PLAYGROUND_BUNDLE } from "../src/playground/index.js";

let server: Server;
let base: string;
let html: string;
let script: string;

before(async () => {
  const handle = createPlaygroundHandler();
  server = createServer((req, res) => {
    handle(req, res).then((handled) => { if (!handled) { res.writeHead(404); res.end(); } });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  html = (await (await fetch(base + "/")).text()).replace('<script type="module" src="/playground.js"></script>', "");
  script = (await build({ ...PLAYGROUND_BUNDLE, format: "iife", entryPoints: ["src/playground/app.ts"], write: false })).outputFiles[0].text;
});
after(() => server.close());

const SIGN_IN = readFileSync("examples/sign-in.tsq", "utf8");
const STAGE = { width: 800, height: 600 };

/** The page with `text` in the editor (as if saved from a visit before), once its board is shown. */
async function openPage(text: string) {
  // render responses can be held, to land one while the text has changed since (the next render not started yet)
  let holding = false;
  const held: (() => void)[] = [];
  const dom = new JSDOM(html, {
    url: base + "/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w: any) {
      w.fetch = async (url: string, init: RequestInit) => {
        const response = await fetch(new URL(url, base), init);
        if (!holding || !url.startsWith("/api/render")) return response;
        // queued once the whole body is in, so `held` counts responses that are ready, however slow the render
        const body = await response.arrayBuffer();
        return new Promise((resolve) => held.push(() => resolve(new Response(body, response))));
      };
      w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.HTMLElement.prototype.setPointerCapture = () => {};
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.document.createRange = () => ({ setStart() {}, setEnd() {}, getClientRects: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 }) });
      let blobs = 0;
      w.URL.createObjectURL = () => `blob:test/${++blobs}`;
      w.URL.revokeObjectURL = () => {};
      w.localStorage.setItem("wf.source", text);
    },
  });
  const w = dom.window as any;
  const $ = (sel: string) => w.document.querySelector(sel) as HTMLElement | null;
  const stage = $("#stage")!, canvas = $("#canvas")!;
  Object.defineProperty(stage, "clientWidth", { value: STAGE.width });
  Object.defineProperty(stage, "clientHeight", { value: STAGE.height });
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, ...STAGE }) as DOMRect;
  w.eval(script);
  await until(() => $("#status")?.textContent === "Valid", "the first render");
  stage.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true })); // fit the board to the stage's size
  const editor = EditorView.findFromDOM($(".cm-editor")!)!;
  return {
    w, stage, canvas, editor,
    close: () => w.close(),
    hold: (on: boolean) => { holding = on; },
    held,
    image: () => ($("#canvas img") as HTMLImageElement | null)?.src,
    caretLine: () => editor.state.doc.lineAt(editor.state.selection.main.head).number,
    outlined: () => [...w.document.querySelectorAll(".tsquare-highlight-selected")].map((d: HTMLElement) => styleKey(d.style)),
    /** Board pixels → the stage's client pixels, from the canvas' transform. */
    at(bx: number, by: number) {
      const [x, y, scale] = canvas.style.transform.match(/-?[\d.]+/g)!.map(Number);
      return { clientX: x + bx * scale, clientY: y + by * scale };
    },
    press(point: { clientX: number; clientY: number }) {
      for (const type of ["pointerdown", "pointerup"]) stage.dispatchEvent(new w.PointerEvent(type, { pointerId: 1, pointerType: "mouse", bubbles: true, ...point }));
    },
  };
}

async function until(check: () => boolean, what: string) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.fail(`timed out waiting for ${what}`);
}

/** A box as text, to compare drawn outlines (their style, in board pixels) with measured boxes. */
const boxKey = (b: { x: number; y: number; width: number; height: number }) => `${b.x},${b.y} ${b.width}x${b.height}`;
const styleKey = (s: CSSStyleDeclaration) => boxKey({ x: parseFloat(s.left), y: parseFloat(s.top), width: parseFloat(s.width), height: parseFloat(s.height) });
/** The element on a line of `text`, as the server measures it. */
async function elementOn(text: string, line: number) {
  const { spec, lines } = compileWireframe(text);
  const [inner] = elementsAtLine(await measureElements(spec!, lines), line);
  return inner as MeasuredElement;
}

test("clicking an element puts the caret on its line, and the caret's element is outlined", async () => {
  const page = await openPage(SIGN_IN);
  assert.deepEqual(page.outlined(), [], "the caret starts on the board's line: nothing outlined");

  const button = await elementOn(SIGN_IN, 11); // button primary lg "Sign in"
  page.press(page.at(button.box.x + button.box.width / 2, button.box.y + button.box.height / 2));
  assert.equal(page.caretLine(), 11);
  assert.deepEqual(page.outlined(), [boxKey(button.box)]);

  page.editor.dispatch({ selection: { anchor: page.editor.state.doc.line(6).from } });
  assert.deepEqual(page.outlined(), [boxKey((await elementOn(SIGN_IN, 6)).box)], "moving the caret outlines the input on line 6");
  page.close();
});

test("after Enter, the outline waits for the render instead of matching the new line against the old board", async () => {
  const page = await openPage(SIGN_IN);
  const forgot = page.editor.state.doc.line(10); // button ghost sm "Forgot?"
  page.editor.dispatch({ selection: { anchor: forgot.to } });
  assert.deepEqual(page.outlined(), [boxKey((await elementOn(SIGN_IN, 10)).box)]);

  // every outline drawn from here on
  const seen: string[] = [];
  const watch = new page.w.MutationObserver(() => seen.push(...page.outlined()));
  watch.observe(page.canvas, { childList: true, subtree: true });
  page.editor.dispatch({ changes: { from: forgot.to, insert: "\n      " }, selection: { anchor: forgot.to + 7 }, userEvent: "input" });
  assert.equal(page.caretLine(), 11);

  const after = page.editor.state.doc.toString();
  const expected = boxKey((await elementOn(after, 11)).box);
  await until(() => page.outlined()[0] === expected, "the outline for line 11 of the new text, once it's rendered");
  watch.disconnect();
  const stale = boxKey((await elementOn(SIGN_IN, 11)).box); // line 11 of the board still on show: the Sign in button
  assert.notEqual(expected, stale);
  assert.ok(!seen.includes(stale), `never the old board's line 11: saw ${JSON.stringify(seen)}`);
  page.close();
});

test("a render that lands after another edit clears the outline instead of leaving the last board's over it", async () => {
  const page = await openPage(SIGN_IN);
  const doc = () => page.editor.state.doc;
  page.editor.dispatch({ selection: { anchor: doc().line(10).to } }); // button ghost sm "Forgot?"
  const before = boxKey((await elementOn(SIGN_IN, 10)).box);
  assert.deepEqual(page.outlined(), [before]);

  // edit 1 moves everything down; its render starts and is held
  page.hold(true);
  page.editor.dispatch({ changes: { from: doc().line(3).from, insert: '    text "Hi"\n' } });
  assert.equal(page.caretLine(), 11, "the caret moved down with its line");
  await until(() => page.held.length === 1, "edit 1's board, ready and held");
  const edit1 = doc().toString();
  // edit 2 before that render lands: its own render waits 250 ms, and is held too
  page.editor.dispatch({ changes: { from: doc().length, insert: "\n" } });

  const shown = page.image();
  page.held[0]();
  await until(() => page.image() !== shown, "edit 1's board, shown while the text is edit 2's");
  assert.notEqual(boxKey((await elementOn(edit1, 11)).box), before, "the button moved on the new board");
  assert.deepEqual(page.outlined(), [], "no outline from the board before over this one");

  await until(() => page.held.length === 2, "the render for edit 2");
  page.hold(false);
  page.held[1]();
  const final = boxKey((await elementOn(doc().toString(), 11)).box);
  await until(() => page.outlined()[0] === final, "the button outlined again once the board matches the text");
  page.close();
});
