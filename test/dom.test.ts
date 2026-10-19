/**
 * renderAll() (src/dom.ts) in jsdom: the HTML markdown renderers make of a ```tsquare fence becomes
 * a board, problems are listed in place, and a second run changes nothing. Then the standalone
 * script (dist/tsquare.min.js, needs npm run build) in a page, from a <script> tag. jsdom has no
 * URL.createObjectURL, so it's stubbed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { renderAll } from "../src/dom.js";
import { read } from "./helpers.js";

const BOARD = read("examples/sign-in.tsq");
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function page(body: string, opts: ConstructorParameters<typeof JSDOM>[1] = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, opts);
  let n = 0;
  dom.window.URL.createObjectURL = () => `blob:test/${++n}`;
  return dom;
}

test("renderAll draws the HTML that markdown renderers make of a ```tsquare fence", async () => {
  const dom = page(`
    <p>before</p>
    <pre><code class="language-tsquare">${escape(BOARD)}</code></pre>
    <div class="language-tsquare highlighter-rouge"><div class="highlight"><pre class="highlight"><code>${escape(BOARD)}</code></pre></div></div>
    <div class="highlight"><pre tabindex="0"><code class="language-tsquare" data-lang="tsquare">${escape(BOARD)}</code></pre></div>
    <pre class="tsquare">${escape(BOARD)}</pre>
    <div class="tsquare">${escape(BOARD)}</div>
    <pre><code class="language-js">const notAWireframe = 1;</code></pre>
    <p>after</p>`);
  const doc = dom.window.document;
  assert.deepEqual(await renderAll({ root: doc }), { rendered: 5, invalid: 0 });

  const boards = [...doc.querySelectorAll("figure.tsquare-board")];
  assert.equal(boards.length, 5);
  for (const figure of boards) {
    const img = figure.querySelector("img")!;
    assert.match(img.src, /^blob:test\//);
    assert.ok(img.width > 0 && img.height > 0, "the board's size, so the page doesn't jump when it loads");
    assert.match(img.alt, /^Wireframe/);
  }
  assert.equal(doc.querySelectorAll("pre code.language-tsquare, .tsquare, .highlighter-rouge").length, 0, "the code blocks are gone");
  assert.ok(doc.querySelector("code.language-js"), "other code blocks stay");
  assert.equal(doc.querySelectorAll("#tsquare-styles").length, 1);
  assert.deepEqual([...doc.body.querySelectorAll("p")].map((p) => p.textContent), ["before", "after"]);

  assert.deepEqual(await renderAll({ root: doc }), { rendered: 0, invalid: 0 }, "a second run changes nothing");
  assert.equal(doc.querySelectorAll("#tsquare-styles").length, 1);
});

test("renderAll lists a block's problems by line in its place", async () => {
  const dom = page(`<pre><code class="language-tsquare">board\n  screen phone\n    buton "Oops"\n    input "Name" fullWidth</code></pre>`);
  const doc = dom.window.document;
  assert.deepEqual(await renderAll({ root: doc }), { rendered: 0, invalid: 1 });
  const box = doc.querySelector(".tsquare-problems")!;
  assert.equal(box.getAttribute("role"), "note");
  assert.equal(box.querySelector("strong")!.textContent, "2 problems in this wireframe");
  const items = [...box.querySelectorAll("li")].map((li) => li.textContent!);
  assert.match(items[0], /^line 3: unknown component "buton" \(did you mean button\?\)/);
  assert.match(items[1], /^line 4: /);
});

test("renderAll takes a root and a selector", async () => {
  const dom = page(`<section id="a"><pre class="tsquare">${escape(BOARD)}</pre></section><section id="b"><pre class="tsquare">${escape(BOARD)}</pre><pre class="wf">${escape(BOARD)}</pre></section>`);
  const doc = dom.window.document;
  assert.deepEqual(await renderAll({ root: doc.getElementById("b")!, selector: ".wf" }), { rendered: 1, invalid: 0 });
  assert.equal(doc.querySelectorAll("pre.tsquare").length, 2, "outside the selector: untouched");
  assert.deepEqual(await renderAll({ root: doc.getElementById("a")! }), { rendered: 1, invalid: 0 });
  assert.ok(doc.querySelector("#b pre.tsquare"), "outside the root: untouched");
});

test("the standalone script sets window.tsquare and draws the page's blocks on load; data-start=manual waits (needs npm run build)", async () => {
  const script = readFileSync("dist/tsquare.min.js", "utf8");
  const load = (attrs: string) =>
    new Promise<JSDOM>((done) => {
      const dom = page(`<pre><code class="language-tsquare">${escape(BOARD)}</code></pre><script ${attrs}>${script}</script>`, {
        runScripts: "dangerously",
        beforeParse: (window) => { window.URL.createObjectURL = () => "blob:test/standalone"; },
      });
      dom.window.addEventListener("load", () => done(dom));
    });
  const settled = async (dom: JSDOM) => {
    for (let i = 0; i < 100 && !dom.window.document.querySelector("[data-tsquare]"); i++) await new Promise((r) => setTimeout(r, 50));
  };

  const auto = await load("");
  await settled(auto);
  assert.equal(typeof (auto.window as any).tsquare.renderAll, "function");
  assert.equal(typeof (auto.window as any).tsquare.compileWireframe, "function");
  assert.ok(auto.window.document.querySelector("figure.tsquare-board img"), "drawn on load");

  const manual = await load(`data-start="manual"`);
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(manual.window.document.querySelector("code.language-tsquare"), "not drawn until asked");
  // copied: the result object belongs to the page's own JavaScript realm
  assert.deepEqual({ ...(await (manual.window as any).tsquare.renderAll()) }, { rendered: 1, invalid: 0 });
});
