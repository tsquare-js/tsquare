/** Rendering and links: the shipped examples draw, and link encoding round-trips. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compileWireframe, renderWireframe } from "../src/compile.js";
import { boardLayout } from "../src/render.js";
import { MAX_SHARED_TEXT, decodeWireframe, encodeWireframe } from "../src/share.js";
import { list, read } from "./helpers.js";

test("every example renders to SVG and PNG", async () => {
  for (const f of list("examples", ".tsq")) {
    const svg = await renderWireframe(read(f), { format: "svg" });
    assert.match(String(svg), /^<svg /, f);
  }
  const png = await renderWireframe(read("examples/sign-in.tsq"), { format: "png", scale: 1 });
  assert.deepEqual([...(png as Uint8Array).subarray(1, 4)], [0x50, 0x4e, 0x47]); // "PNG"
});

test("invalid text throws with line-numbered problems", async () => {
  await assert.rejects(renderWireframe("board\n  screen phone\n    buton"), /line 3: unknown component "buton"/);
});

test("boardLayout places each screen inside the board", () => {
  const { spec } = compileWireframe(read("examples/notes-mobile.tsq"));
  const { width, height, items } = boardLayout(spec!);
  assert.ok(items.length > 1);
  for (const it of items) assert.ok(it.x >= 0 && it.y >= 0 && it.x + it.width <= width && it.y + it.height <= height);
});

test("link encoding round-trips text, including non-ASCII", () => {
  const text = 'board "Café ☕"\n  screen phone "Ünïcode — ok"\n    text "日本語"\n';
  const data = encodeWireframe(text);
  assert.match(data, /^y[A-Za-z0-9_-]+$/);
  assert.equal(decodeWireframe(data), text);
});

test("links reject an unknown prefix and oversized text", () => {
  assert.throws(() => decodeWireframe("xABC"), /unknown encoding/);
  assert.throws(() => decodeWireframe(encodeWireframe("x".repeat(MAX_SHARED_TEXT + 1))));
});
