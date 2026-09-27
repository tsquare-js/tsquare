/**
 * Local playground: an editor with live rendering, the component reference and
 * the model prompt. Renders on the server with the same code as the CLI.
 *
 *   npm run playground            → http://localhost:4321
 *   PORT=5000 npm run playground
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileWireframe, formatIssues, renderWireframeSvg, renderWireframePng } from "../src";
import { componentDocs, wireframePrompt } from "../src/prompt";
import { EXAMPLES, GROUPS } from "./reference";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const PORT = Number(process.env.PORT ?? 4321);
const MAX_BODY = 256 * 1024;

// The reference examples are part of the docs, so a broken one should stop the server, not ship.
const docs = componentDocs();
const problems: string[] = [];
for (const c of docs) {
  if (!EXAMPLES[c.name]) problems.push(`${c.name}: no example in playground/reference.ts`);
  if (!GROUPS.some((g) => g.components.includes(c.name))) problems.push(`${c.name}: not in any group in playground/reference.ts`);
}
for (const [name, src] of Object.entries(EXAMPLES)) {
  const { issues } = compileWireframe(src);
  if (issues.length) problems.push(`${name} example:\n${formatIssues(issues)}`);
}
if (problems.length) {
  console.error(`Reference examples need fixing:\n\n${problems.join("\n")}`);
  process.exit(1);
}

let referenceCache: Promise<unknown> | null = null;
function reference() {
  referenceCache ??= Promise.all(
    docs.map(async (c) => {
      const { spec } = compileWireframe(EXAMPLES[c.name]);
      return { ...c, example: EXAMPLES[c.name], svg: await renderWireframeSvg(spec!, { skipValidation: true }) };
    }),
  ).then((components) => ({ groups: GROUPS, components }));
  return referenceCache;
}

async function examples() {
  const dir = path.join(root, "examples");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".wf")).sort();
  return Promise.all(files.map(async (f) => ({ name: f.replace(/\.wf$/, ""), source: await readFile(path.join(dir, f), "utf8") })));
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) reject(new Error("body too large"));
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(await readFile(path.join(here, "index.html")));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/reference") return json(res, 200, await reference());
  if (req.method === "GET" && url.pathname === "/api/examples") return json(res, 200, await examples());
  if (req.method === "GET" && url.pathname === "/api/prompt") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(wireframePrompt());
    return;
  }

  // POST the wireframe text. /api/render → { issues, svg? }; /api/png?scale=2 → image/png
  if (req.method === "POST" && (url.pathname === "/api/render" || url.pathname === "/api/png")) {
    const { spec, issues } = compileWireframe(await readBody(req));
    if (url.pathname === "/api/render") {
      if (!spec || issues.length) return json(res, 200, { issues });
      return json(res, 200, { issues, svg: await renderWireframeSvg(spec, { skipValidation: true }) });
    }
    if (!spec || issues.length) return json(res, 400, { issues });
    const scale = Math.min(4, Math.max(1, Number(url.searchParams.get("scale") ?? 2)));
    res.writeHead(200, { "content-type": "image/png" });
    res.end(await renderWireframePng(spec, { skipValidation: true, scale }));
    return;
  }

  json(res, 404, { error: "not found" });
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: String(err?.message ?? err) });
    else res.end();
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Wireframe playground → http://localhost:${PORT}`);
});
