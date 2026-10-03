import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileWireframe } from "../src/compile.js";

// fileURLToPath, not import.meta.dirname: that needs Node 20.11, and the package supports all of 20.
export const root = fileURLToPath(new URL("..", import.meta.url));
export const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
export const list = (dir: string, ext: string) =>
  readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext)).map((f) => path.posix.join(dir, f));

/** "line N: message" for each problem, the way the CLI prints them. */
export const problems = (text: string) => compileWireframe(text).issues.map((i) => `line ${i.line}: ${i.message}`);

/** A one-screen board around some lines, for testing a single element. */
export const board = (...lines: string[]) => ["board", "  screen phone", ...lines.map((l) => "    " + l)].join("\n");
