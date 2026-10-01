/**
 * Builds the published package into dist/:
 *   dist/index.js             the library (import { renderWireframe } from "tsquare")
 *   dist/cli.js               the CLI (bin/tsquare.js runs it)
 *   dist/playground/index.js  the playground handler (import … from "tsquare/playground")
 *   dist/playground/index.html
 *   dist/**\/*.d.ts           type declarations
 *
 *   npm run build
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { build } from "esbuild";
import { checkReferenceExamples } from "../src/playground/index";

const problems = checkReferenceExamples();
if (problems.length) {
  console.error(`Reference examples need fixing:\n\n${problems.join("\n")}`);
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

execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
console.log("built dist/");
