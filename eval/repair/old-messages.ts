/**
 * Prints, as JSON, the problems the parser reported before the clearer error
 * messages (commit cb30d71, the 0.3.0 branch before "Comments are whole
 * lines; errors name the component a prop belongs to"), for every output in
 * the repair set. Run from a checkout of that commit:
 *
 *   git worktree add /tmp/old cb30d71
 *   (cd /tmp/old && npx tsx <this repo>/eval/repair/old-messages.ts <this repo>) > eval/repair/old-messages.json
 *
 * The result is committed, so build.ts doesn't need the old checkout.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.argv[2];
const { compileWireframe } = await import(pathToFileURL(path.resolve("src/compile.ts")).href);
const set: { key: string; file: string }[] = JSON.parse(readFileSync(path.join(repo, "eval/repair/set.json"), "utf8"));
const out: Record<string, string[]> = {};
for (const { key, file } of set) {
  const raw = readFileSync(path.join(repo, file), "utf8");
  const body = raw.match(/```[\w-]*\n([\s\S]*?)```/)?.[1] ?? raw; // same as build.ts: the fenced block, else the whole file
  out[key] = compileWireframe(body.trim()).issues.map((i: { line: number; message: string }) => `line ${i.line}: ${i.message}`);
}
console.log(JSON.stringify(out, null, 2));
