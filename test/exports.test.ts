import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as tsquare from "../src/index.js";

test("languageData is exported, for editors", () => {
  const data = tsquare.languageData();
  assert.ok(data.components.some((c) => c.name === "button"));
  assert.ok(data.icons.includes("home"));
  assert.ok(data.accents.includes("blue"));
});

test("tsquare/viewer points at the viewer and has no imports (it runs in a browser)", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.deepEqual(pkg.exports["./viewer"], { types: "./dist/playground/viewer.d.ts", import: "./dist/playground/viewer.js", default: "./dist/playground/viewer.js" });
  const source = readFileSync("src/playground/viewer.ts", "utf8");
  assert.deepEqual(source.match(/^import (?!type ).*$/gm) ?? [], [], "only type imports, which are erased");
});

test("every export has a default condition, so require() works too (Node's require of ESM; the VS Code extension is CommonJS)", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const [key, value] of Object.entries<any>(pkg.exports)) {
    if (typeof value === "string") continue;
    assert.equal(value.default, value.import, `${key}`);
  }
});
