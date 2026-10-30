/**
 * The playground's server side: every endpoint the page calls, through a real
 * HTTP server with the handler mounted the way `tsquare playground` and
 * tsquare.dev mount it. Plus the page's markup against the script and the site.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createPlaygroundHandler } from "../src/playground/index.js";
import { languageData } from "../src/playground/language-data.js";
import { wireframePrompt } from "../src/prompt.js";

let server: Server;
let base: string;

before(async () => {
  const handle = createPlaygroundHandler();
  server = createServer((req, res) => {
    handle(req, res)
      .then((handled) => { if (!handled) { res.writeHead(404); res.end(); } })
      .catch(() => { res.writeHead(500); res.end(); });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const post = (path: string, body: string) => fetch(base + path, { method: "POST", body });
const example = (name: string) => readFileSync(`examples/${name}.tsq`, "utf8");

test("POST /api/render: a valid board comes back as an SVG with its size and where each screen sits", async () => {
  const res = await post("/api/render", example("sign-up-flow"));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.issues, []);
  assert.match(data.svg, /^<svg/);
  assert.ok(data.width > 0 && data.height > 0);
  const screens = data.items.filter((i: any) => i.type === "Screen");
  assert.equal(screens.length, (example("sign-up-flow").match(/^\s*screen\b/gm) ?? []).length);
  for (const s of screens) assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.width <= data.width && s.y + s.height <= data.height, `${s.name} inside the board`);
});

test("POST /api/render: problems come back by line, with no SVG", async () => {
  const res = await post("/api/render", 'board "X"\n  screen phone\n    buton "Hi"\n');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.svg, undefined);
  assert.equal(data.issues[0].line, 3);
  assert.match(data.issues[0].message, /button/);
});

test("POST /api/render?elements=1 adds measureElements' entries; without it, none", async () => {
  const text = example("sign-up-flow");
  const plain = await (await post("/api/render", text)).json();
  assert.equal(plain.elements, undefined);
  const data = await (await post("/api/render?elements=1", text)).json();
  assert.equal(data.elements[0].type, "Board");
  const button = data.elements.find((e: { type: string; label?: string }) => e.type === "Button" && e.label === "Continue");
  assert.match(text.split("\n")[button.line - 1], /^\s*button .*"Continue"/, "its line is the button's line");
  assert.ok(data.elements.some((e: { type: string }) => e.type === "Flow"));
  assert.deepEqual(data.svg, plain.svg);
});

test("POST /api/render?flows=0 leaves the flow arrows out", async () => {
  const text = 'board "F"\n  screen phone "A" #a\n    button "Go" #go\n  screen phone "B" #b\n  flow go -> b "Tap"\n';
  const on = await (await post("/api/render", text)).json();
  const off = await (await post("/api/render?flows=0", text)).json();
  assert.deepEqual([on.issues, off.issues], [[], []]);
  assert.notEqual(on.svg, off.svg, "only one has the arrow");
  const noFlowLine = await (await post("/api/render", text.replace(/^\s*flow.*\n/m, ""))).json();
  assert.equal(off.svg, noFlowLine.svg, "flows off looks exactly like a board without flow lines");
});

test("POST /api/png: a PNG for a valid board; 400 with the problems otherwise", async () => {
  const ok = await post("/api/png?scale=1", example("sign-in"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/png");
  assert.deepEqual([...new Uint8Array(await ok.arrayBuffer()).slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  const bad = await post("/api/png", 'board "X"\n  screen phone\n    buton\n');
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).issues[0].line, 3);
});

test("GET /api/language, /api/prompt, /api/examples serve the library's data", async () => {
  assert.deepEqual(await (await fetch(base + "/api/language")).json(), JSON.parse(JSON.stringify(languageData())));
  assert.equal(await (await fetch(base + "/api/prompt")).text(), wireframePrompt());
  const examples = await (await fetch(base + "/api/examples")).json();
  assert.equal(examples[0].name, "sign-in", "the first example is what a first-time visitor sees");
  assert.equal(examples.find((e: any) => e.name === "dashboard").source, example("dashboard"));
});

test("GET /api/reference: every component with its example rendered", async () => {
  const ref = await (await fetch(base + "/api/reference")).json();
  assert.ok(ref.groups.length > 0);
  for (const c of ref.components) assert.match(c.svg, /^<svg/, c.name);
});

test("GET /, /playground.js and /mark.png serve the page; other paths fall through to the host", async () => {
  const page = await fetch(base + "/");
  assert.match(page.headers.get("content-type")!, /text\/html/);
  assert.match(await page.text(), /<script[^>]+playground\.js/);
  const script = await fetch(base + "/playground.js");
  assert.match(script.headers.get("content-type")!, /javascript/);
  assert.ok((await script.text()).length > 10_000);
  assert.equal((await fetch(base + "/mark.png")).headers.get("content-type"), "image/png");
  assert.equal((await fetch(base + "/nope")).status, 404, "the handler said it wasn't its route");
});

test("the page has every element the script looks up", () => {
  const html = readFileSync("src/playground/index.html", "utf8");
  const app = readFileSync("src/playground/app.ts", "utf8");
  const ids = new Set([...app.matchAll(/\$(?:<[^>]+>)?\("([\w-]+)"\)|getElementById\("([\w-]+)"\)/g)].map((m) => m[1] ?? m[2]));
  assert.ok(ids.size > 20, `found ${ids.size} ids`);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `#${id} is in index.html`);
});

test("the page keeps the markers tsquare.dev's build rewrites", () => {
  // ../tsquare.dev/src/build.ts injects TSQUARE_BASE, the Privacy link and console.js by exact string match, and throws if one is missing
  const html = readFileSync("src/playground/index.html", "utf8");
  for (const marker of ["</head>", '<button class="btn quiet icon-only" id="theme"', "</body>"]) assert.ok(html.includes(marker), marker);
});
