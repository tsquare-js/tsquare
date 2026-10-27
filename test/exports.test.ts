import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as tsquare from "../src/index.js";
import { list, read } from "./helpers.js";

test("languageData is exported, for editors", () => {
  const data = tsquare.languageData();
  assert.ok(data.components.some((c) => c.name === "button"));
  assert.ok(data.icons.includes("home"));
  assert.ok(data.accents.includes("blue"));
});

test("tsquare/viewer points at the viewer and has no imports (it runs in a browser)", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.deepEqual(pkg.exports["./viewer"], { types: "./dist/playground/viewer.d.ts", import: "./dist/playground/viewer.js", default: "./dist/playground/viewer.js" });
  // its source imports only the hit-testing module (bundled in), which itself imports only types
  const source = readFileSync("src/playground/viewer.ts", "utf8");
  assert.deepEqual(source.match(/^import (?!type ).*$/gm) ?? [], ['import { elementsAt, isFlow, type Measured, type MeasuredBox } from "../hit.js";']);
  assert.deepEqual(readFileSync("src/hit.ts", "utf8").match(/^import (?!type ).*$/gm) ?? [], [], "hit.ts: only type imports, which are erased");
});

test("the built viewer (needs npm run build) imports nothing and stays small", () => {
  const built = readFileSync("dist/playground/viewer.js", "utf8");
  assert.deepEqual(built.match(/^\s*import\b.*$/gm) ?? [], []);
  assert.ok(gzipSync(built).length < 8000, `${gzipSync(built).length} bytes compressed`);
});

test("every export has a default condition, so require() works too (Node's require of ESM; the VS Code extension is CommonJS)", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const [key, value] of Object.entries<any>(pkg.exports)) {
    if (typeof value === "string") continue;
    assert.equal(value.default, value.import, `${key}`);
  }
});

test("the browser build (the \"browser\" condition) imports nothing from Node and renders the same SVG (needs npm run build)", async () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.exports["."].browser, "./dist/browser/index.js");
  const source = readFileSync("dist/browser/index.js", "utf8");
  const packageName = (spec: string) => spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => packageName(m[1]));
  assert.deepEqual(imports.filter((i) => !(i in pkg.dependencies)), [], "only package dependencies");
  // Node built-ins, native PNG, satori (bundled, its process.env reads set) and import.meta (CommonJS consumers warn)
  assert.doesNotMatch(source, /from "node:|import\("node:|"@resvg\/resvg-js"|from "satori"|import\.meta|process\.env\.(SATORI|JEST)/);

  const browserBuild = "../dist/browser/index.js";
  const browser: typeof tsquare = await import(browserBuild);
  for (const file of list("examples", ".tsq")) {
    const text = read(file);
    assert.equal(await browser.renderWireframe(text), await tsquare.renderWireframe(text), file);
  }
  assert.throws(() => browser.encodeWireframe("board"), /need Node/);
  await assert.rejects(browser.renderWireframe("board\n  screen phone", { format: "png" }), /PNG rendering needs Node/);
});

test("the build loads through jiti 1, which Docusaurus uses for its config and the remark plugins in it (needs npm run build)", async () => {
  // jiti 1 rewrites ESM into CommonJS and drops zod's `export * as z`, so `import { z } from "zod"` came back undefined
  const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { interopDefault: true });
  const built: typeof tsquare = jiti("../dist/index.js");
  const text = read("examples/sign-in.tsq");
  assert.equal(await built.renderWireframe(text), await tsquare.renderWireframe(text));
});
