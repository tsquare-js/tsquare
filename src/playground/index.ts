/**
 * The playground: an editor with live rendering, the component reference and
 * the model prompt. Ships in the package so it runs locally (`tsquare
 * playground`) and on the website from the same code.
 *
 * The page (index.html) talks to a small set of endpoints, all answered by
 * `createPlaygroundHandler`:
 *
 *   GET  /                   the page
 *   GET  /mark.png           the logo mark (tab icon, header)
 *   GET  /api/reference      components, props and rendered examples
 *   GET  /api/examples       the example wireframes
 *   GET  /api/prompt         the model prompt
 *   POST /api/render         wireframe text → { issues, svg? }
 *   POST /api/png?scale=2    wireframe text → image/png
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileWireframe, formatIssues } from "../compile.js";
import { componentDocs, wireframePrompt } from "../prompt.js";
import { renderWireframePng, renderWireframeSvg } from "../render.js";
import { EXAMPLES, GROUPS } from "./reference.js";

// Same layout in src/ (development) and dist/ (published): the page sits next
// to this module, and the package root is two levels up.
const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..", "..");
const MAX_BODY = 256 * 1024;

/** Problems with the reference examples: a component without an example or group, or an example that doesn't compile. */
export function checkReferenceExamples(): string[] {
  const problems: string[] = [];
  for (const c of componentDocs()) {
    if (!EXAMPLES[c.name]) problems.push(`${c.name}: no example in src/playground/reference.ts`);
    if (!GROUPS.some((g) => g.components.includes(c.name))) problems.push(`${c.name}: not in any group in src/playground/reference.ts`);
  }
  for (const [name, src] of Object.entries(EXAMPLES)) {
    const { issues } = compileWireframe(src);
    if (issues.length) problems.push(`${name} example:\n${formatIssues(issues)}`);
  }
  return problems;
}

let referenceCache: Promise<unknown> | null = null;
function reference() {
  referenceCache ??= Promise.all(
    componentDocs().map(async (c) => {
      const { spec } = compileWireframe(EXAMPLES[c.name]);
      return { ...c, example: EXAMPLES[c.name], svg: await renderWireframeSvg(spec!, { skipValidation: true }) };
    }),
  ).then((components) => ({ groups: GROUPS, components }));
  return referenceCache;
}

async function examples() {
  const dir = path.join(packageRoot, "examples");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".tsq")).sort();
  return Promise.all(files.map(async (f) => ({ name: f.replace(/\.tsq$/, ""), source: await readFile(path.join(dir, f), "utf8") })));
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

/** Sends JSON; returns true so handlers can `return json(...)` for "handled". */
const json = (res: ServerResponse, status: number, body: unknown): true => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
  return true;
};

/**
 * Handles a playground request. Resolves to false when the path isn't a
 * playground route, so a host server can serve its own routes around it.
 */
export function createPlaygroundHandler() {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(await readFile(path.join(here, "index.html")));
      return true;
    }
    if (req.method === "GET" && url.pathname === "/mark.png") {
      res.writeHead(200, { "content-type": "image/png", "cache-control": "max-age=3600" });
      res.end(await readFile(path.join(packageRoot, "assets", "mark.png")));
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/reference") return json(res, 200, await reference());
    if (req.method === "GET" && url.pathname === "/api/examples") return json(res, 200, await examples());
    if (req.method === "GET" && url.pathname === "/api/prompt") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(wireframePrompt());
      return true;
    }
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
      return true;
    }
    return false;
  };
}

/** Runs the playground on localhost. */
export function startPlayground(port = 4321) {
  const handle = createPlaygroundHandler();
  const server = createServer((req, res) => {
    handle(req, res)
      .then((handled) => { if (!handled) json(res, 404, { error: "not found" }); })
      .catch((err) => {
        console.error(err);
        if (!res.headersSent) json(res, 500, { error: String(err?.message ?? err) });
        else res.end();
      });
  });
  server.listen(port, "127.0.0.1", () => console.log(`tsquare playground → http://localhost:${port}`));
  return server;
}
