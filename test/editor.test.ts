/**
 * tsquare/editor (src/editor.ts, around the playground's editor) in jsdom: text in and out,
 * onChange, problems underlined, options, destroy, and the built file's shape (CodeMirror bundled,
 * no imports, types without CodeMirror). CodeMirror only needs a document here; layout isn't
 * measured.
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
before(() => {
  const w = dom.window as any;
  for (const k of ["window", "document", "navigator", "MutationObserver", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle", "Node", "HTMLElement", "Element", "KeyboardEvent", "MouseEvent", "Event", "CustomEvent", "DOMParser", "getSelection"]) {
    if (k === "navigator" && typeof navigator !== "undefined") continue; // Node 21+ has its own (read-only)
    (globalThis as any)[k] = typeof w[k] === "function" && /^[a-z]/.test(k) ? w[k].bind(w) : w[k];
  }
  w.document.createRange = () => ({ setStart() {}, setEnd() {}, getClientRects: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 }) });
});

const load = async () => (await import("../src/editor.js")).createEditor;
const host = () => { const el = document.createElement("div"); document.body.append(el); return el; };

test("createEditor: the text in and out, inside the element given, with an accessible name", async () => {
  const createEditor = await load();
  const el = host();
  const editor = createEditor(el, { doc: 'board\n  screen phone\n    button "Go"' });
  assert.equal(editor.getText(), 'board\n  screen phone\n    button "Go"');
  assert.equal(editor.dom.parentElement, el);
  assert.ok(editor.dom.classList.contains("cm-editor"));
  assert.equal(el.querySelector(".cm-content")!.getAttribute("aria-label"), "Wireframe text");
  assert.ok(el.querySelector(".cm-lineNumbers"), "line numbers by default");
  editor.destroy();

  const named = createEditor(host(), { ariaLabel: "Sign-in screen", lineNumbers: false });
  assert.equal(named.dom.querySelector(".cm-content")!.getAttribute("aria-label"), "Sign-in screen");
  assert.equal(named.dom.querySelector(".cm-lineNumbers"), null, "lineNumbers: false");
  assert.equal(named.getText(), "", "no doc: empty");
  named.destroy();
});

test("setText replaces everything and calls onChange with the whole text", async () => {
  const createEditor = await load();
  const changes: string[] = [];
  const editor = createEditor(host(), { doc: "board", onChange: (t) => changes.push(t) });
  editor.setText("board\n  screen tablet");
  assert.equal(editor.getText(), "board\n  screen tablet");
  assert.deepEqual(changes, ["board\n  screen tablet"]);
  editor.destroy();
});

test("setIssues underlines the problem lines and lists them in the gutter; [] clears them", async () => {
  const createEditor = await load();
  const editor = createEditor(host(), { doc: 'board\n  screen phone\n    buton "Oops"' });
  editor.setIssues([{ line: 3, message: 'unknown component "buton" (did you mean button?)' }, { line: 99, message: "past the end: ignored" }]);
  const underlined = [...editor.dom.querySelectorAll(".cm-lintRange-error")].map((e) => e.textContent).join("");
  assert.equal(underlined, 'buton "Oops"', "the line, without its indentation");
  assert.equal(editor.dom.querySelectorAll(".cm-lint-marker-error").length, 1, "one marker in the gutter");
  editor.setIssues([]);
  assert.equal(editor.dom.querySelectorAll(".cm-lintRange-error").length, 0);
  editor.destroy();
});

test("lineWrapping wraps long lines, continuation rows indented 4 past their line's indentation; off by default", async () => {
  const createEditor = await load();
  const plain = createEditor(host(), { doc: "board" });
  assert.ok(!plain.dom.querySelector(".cm-content")!.classList.contains("cm-lineWrapping"), "off by default (the playground)");
  plain.destroy();

  const editor = createEditor(host(), { doc: 'board\n  screen phone\n    button "Go"', lineWrapping: true });
  assert.ok(editor.dom.querySelector(".cm-content")!.classList.contains("cm-lineWrapping"));
  const indents = () => [...editor.dom.querySelectorAll<HTMLElement>(".cm-line")].map((l) => l.style.textIndent);
  assert.deepEqual(indents(), ["-4ch", "-6ch", "-8ch"], "indentation + 4");
  assert.match(editor.dom.querySelector<HTMLElement>(".cm-line")!.style.paddingLeft, /4ch/);
  editor.setText("board\n      deep");
  assert.deepEqual(indents(), ["-4ch", "-10ch"], "follows edits");
  editor.destroy();
});

test("onCursorLine reports the caret's line when it moves to another line", async () => {
  const createEditor = await load();
  const lines: number[] = [];
  const editor = createEditor(host(), { doc: 'board\n  screen phone\n    button "Go"', onCursorLine: (l) => lines.push(l) });
  editor.goToLine(3);
  editor.goToLine(3); // the same line again: no report
  editor.goToLine(2);
  editor.setText("board\n  screen phone"); // the caret goes to the start
  assert.deepEqual(lines, [3, 2, 1]);
  editor.destroy();
});

test("destroy removes the editor from the page", async () => {
  const createEditor = await load();
  const el = host();
  const editor = createEditor(el, { doc: "board" });
  editor.destroy();
  assert.equal(el.querySelector(".cm-editor"), null);
});

test("the built tsquare/editor (needs npm run build): imports nothing, its types don't reference CodeMirror, every color variable is documented", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.deepEqual(pkg.exports["./editor"], { types: "./dist/editor.d.ts", import: "./dist/editor.js", default: "./dist/editor.js" });
  const js = readFileSync("dist/editor.js", "utf8");
  assert.deepEqual(js.match(/^import .*$/gm) ?? [], [], "CodeMirror is bundled in");
  for (const f of ["dist/editor.d.ts", "dist/playground/editor-options.d.ts"]) assert.doesNotMatch(readFileSync(f, "utf8"), /from ["'][^"']*(codemirror|lezer)/, f);
  const source = readFileSync("src/playground/editor.ts", "utf8");
  const vars = new Set([...source.matchAll(/v\("([a-z-]+)"/g)].map((m) => `--tsquare-${m[1]}`).concat([...source.matchAll(/var\((--tsquare-[a-z-]+)/g)].map((m) => m[1])));
  assert.ok(vars.size >= 18, `${vars.size} variables`);
  const readme = readFileSync("README.md", "utf8");
  for (const v of vars) assert.ok(readme.includes(v), `${v} is in the README`);
});
