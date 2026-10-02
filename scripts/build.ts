/**
 * Builds the published package into dist/:
 *   dist/index.js             the library (import { renderWireframe } from "tsquare")
 *   dist/cli.js               the CLI (bin/tsquare.js runs it)
 *   dist/playground/index.js  the playground handler (import … from "tsquare/playground")
 *   dist/playground/index.html
 *   dist/playground/playground.js   the page's script (browser bundle)
 *   dist/**\/*.d.ts           type declarations
 *
 *   npm run build
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { build } from "esbuild";
import { componentDefinitions } from "../src/catalog";
import { PLAYGROUND_BUNDLE, checkReferenceExamples } from "../src/playground/index";
import { bareWords } from "../src/text";
import { PLAIN_WORD_MAIN_TEXT } from "../src/upgrade";

const problems = checkReferenceExamples();
// upgrade.ts keeps its own copy of which components take their main text as a plain word
// (so the browser bundle stays small); it must match the parser, and they must have no option words.
const plainWord = Object.keys(componentDefinitions).filter((c) => bareWords(c).wordPrimary);
if (plainWord.map((c) => c.toLowerCase()).sort().join() !== [...PLAIN_WORD_MAIN_TEXT].sort().join()) {
  problems.push(`PLAIN_WORD_MAIN_TEXT in src/upgrade.ts is ${PLAIN_WORD_MAIN_TEXT.join(", ")}, but the parser's are ${plainWord.join(", ")}`);
}
for (const c of plainWord) {
  const w = bareWords(c);
  if (w.options.length || w.booleans.length) problems.push(`${c} now has option words; fillsMainText in src/upgrade.ts assumes it has none`);
}
if (problems.length) {
  console.error(`Build checks failed:\n\n${problems.join("\n")}`);
  process.exit(1);
}

rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/index.ts", "src/cli.ts", "src/playground/index.ts"],
  outdir: "dist",
  outbase: "src",
  bundle: true,
  splitting: true, // the three entry points share one copy of the renderer
  format: "esm",
  platform: "node",
  target: "node20",
  packages: "external", // dependencies are installed alongside, not bundled
  jsx: "automatic",
  chunkNames: "chunks/[name]-[hash]",
  logLevel: "warning",
});

mkdirSync("dist/playground", { recursive: true });
copyFileSync("src/playground/index.html", "dist/playground/index.html");
// The playground page's script: CodeMirror and the UI, for the browser
await build({ ...PLAYGROUND_BUNDLE, entryPoints: ["src/playground/app.ts"], outfile: "dist/playground/playground.js", logLevel: "warning" });

execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
console.log("built dist/");
