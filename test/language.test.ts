/**
 * The language: parse → print → parse keeps every structure, and every wireframe we
 * ship or document compiles (examples, playground reference examples, docs snippets).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWireframeText } from "../src/text.js";
import { printWireframeText } from "../src/print.js";
import { EXAMPLES } from "../src/playground/reference.js";
import { list, problems, read } from "./helpers.js";

const sortKeys = (v: any): any =>
  Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
  : v;
/** An element tree without ids, for comparing two parses. */
const shape = (spec: any, id = spec.root): any => ({
  type: spec.elements[id].type,
  props: sortKeys(spec.elements[id].props),
  children: (spec.elements[id].children ?? []).map((c: string) => shape(spec, c)),
});

const examples = list("examples", ".tsq").map((f) => [f, read(f)] as const);
const reference = Object.entries(EXAMPLES).map(([name, text]) => [`reference: ${name}`, text] as const);

test("examples and reference examples compile without problems", () => {
  for (const [name, text] of [...examples, ...reference]) assert.deepEqual(problems(text), [], name);
});

test("print then parse gives back the same structure", () => {
  const sources = [
    ...examples,
    ...reference,
    ...list("eval/out/sonnet/text-v4", ".tsq").map((f) => [f, read(f)] as const),
    ["commas and quotes", 'board\n  screen phone\n    table columns=[Name, Total] data=[[Ana Torres, "$1,200"], ["Smith, J", "Don\'t"]]\n    tabs items=[All notes, "a \\"q\\""]'],
    ["hash as text", 'board accent=#1a73e8\n  screen phone\n    table columns=[Order] data=[[#1001], [#1002]]\n    avatar #JD'],
  ];
  for (const [name, text] of sources) {
    const first = parseWireframeText(text);
    if (!first.spec) continue;
    const again = parseWireframeText(printWireframeText(first.spec));
    assert.deepEqual(shape(again.spec), shape(first.spec), name);
  }
});

test("every tsquare snippet in the docs and README compiles", () => {
  const files = [...list("docs", ".md"), "README.md"];
  let count = 0;
  for (const file of files) {
    for (const [, snippet] of read(file).matchAll(/```tsquare\n([\s\S]*?)```/g)) {
      // Fragments are indented as they'd sit in a board: 2 spaces for a screen's
      // siblings (screens, notes), 4 for a screen's content.
      const indent = snippet.match(/^ */)![0].length;
      const text = indent === 0 ? snippet : indent === 2 ? `board\n${snippet}` : `board\n  screen phone\n${snippet}`;
      assert.deepEqual(problems(text), [], `${file}:\n${snippet}`);
      count++;
    }
  }
  assert.ok(count >= 10, `found only ${count} snippets`);
});
