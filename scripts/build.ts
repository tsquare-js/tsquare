/**
 * Builds the published package into dist/:
 *   dist/index.js             the library (import { renderWireframe } from "tsquare")
 *   dist/browser/index.js     the library for browsers (SVG only; the package's "browser" condition)
 *   dist/browser/THIRD_PARTY_LICENSES.txt   notices for what that build bundles
 *   dist/tsquare.min.js       the standalone script for a <script> tag: window.tsquare, renders the page's blocks
 *   dist/cli.js               the CLI (bin/tsquare.js runs it)
 *   dist/playground/index.js  the playground handler (import … from "tsquare/playground")
 *   dist/playground/index.html
 *   dist/playground/playground.js   the page's script (browser bundle)
 *   dist/playground/viewer.js  the zoomable board, for the browser (import … from "tsquare/viewer")
 *   dist/editor.js            the code editor, for the browser, CodeMirror bundled (import … from "tsquare/editor")
 *   dist/**\/*.d.ts           type declarations
 *
 *   npm run build
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, type BuildOptions, type Metafile, type Plugin } from "esbuild";
import { componentDefinitions } from "../src/catalog";
import { PLAYGROUND_BUNDLE, checkReferenceExamples } from "../src/playground/index";
import { bareWords } from "../src/text";
import { PLAIN_WORD_MAIN_TEXT } from "../src/upgrade";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
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

// The library for browsers (the package's "browser" condition: Obsidian, web pages). Same API, SVG only:
// a file X.browser.ts replaces X.ts (fonts embedded as bytes; share links and PNG throw "needs Node").
// Bundled: @json-render/image, so its PNG path's import of the native @resvg/resvg-js can be stubbed,
// and satori, which reads process.env (set here to its defaults: the yoga build embedded as wasm;
// import.meta.url only locates a separate wasm file, so it's dropped: CommonJS bundles warn about it).
// The other dependencies stay external, as in the Node build.
const browserVariants: Plugin = {
  name: "browser-variants",
  setup(b) {
    b.onResolve({ filter: /^\.\/.*\.js$/ }, (args) => {
      const variant = join(args.resolveDir, args.path.replace(/\.js$/, ".browser.ts"));
      return args.resolveDir.startsWith(resolve("src")) && existsSync(variant) ? { path: variant } : undefined;
    });
  },
};
const bundledForBrowser = ["@fontsource/inter", "@json-render/image", "@resvg/resvg-js", "satori", "@types/node", "@types/react"];
const forBrowsers = {
  bundle: true,
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  alias: { "@resvg/resvg-js": "./src/resvg.browser.ts" },
  define: { "process.env.SATORI_STANDALONE": '"0"', "process.env.JEST_WORKER_ID": "undefined", "import.meta.url": "undefined" },
  loader: { ".woff": "binary" },
  plugins: [browserVariants],
  metafile: true,
  logLevel: "warning",
} satisfies BuildOptions;
const browserBuild = await build({
  ...forBrowsers,
  entryPoints: ["src/index.ts"],
  outfile: "dist/browser/index.js",
  banner: { js: "// tsquare for browsers. Bundles third-party code: see THIRD_PARTY_LICENSES.txt next to this file." },
  format: "esm",
  external: Object.keys(pkg.dependencies).filter((d) => !bundledForBrowser.includes(d)),
});
writeFileSync("dist/browser/THIRD_PARTY_LICENSES.txt", thirdPartyLicenses(browserBuild.metafile!, "dist/browser/index.js (tsquare's browser build) bundles the packages below. The rest of tsquare's dependencies are imported, not bundled."));

// The standalone script for a <script> tag (CDN or self-hosted): the browser build with every
// dependency bundled and minified, `window.tsquare`, and renderAll() on load (src/standalone.ts).
// A CDN serves just this file, so the bundled packages' notices go at its end.
const standalone = await build({
  ...forBrowsers,
  entryPoints: ["src/standalone.ts"],
  outfile: "dist/tsquare.min.js",
  format: "iife",
  globalName: "tsquare",
  minify: true,
  define: { ...forBrowsers.define, "process.env.NODE_ENV": '"production"' },
  banner: { js: `/*! tsquare ${pkg.version} | MIT | https://tsquare.dev | bundled packages' licenses are at the end of this file */` },
});
appendFileSync("dist/tsquare.min.js", `\n/*\n${thirdPartyLicenses(standalone.metafile!, "tsquare.min.js bundles the packages below.").replaceAll("*/", "* /")}*/\n`);

/**
 * The license of every package bundled into a browser bundle, for the notices their licenses ask
 * to ship with copies (satori's MPL-2.0 also asks to say where its source is; Apache-2.0 packages'
 * NOTICE files go too). One section per installed copy. A package that ships no license file needs
 * a vendored notice in licenses/<name>.txt, with where it comes from; otherwise the build stops.
 * The same approach as the VS Code extension's build.
 */
function thirdPartyLicenses(meta: Metafile, heading: string) {
  const packages = new Map<string, string>(); // directory → name
  for (const input of Object.keys(meta.inputs)) {
    const m = input.match(/^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//);
    if (m) packages.set(m[1], m[2]);
  }
  const sections = [...packages].map(([dir, name]) => {
    const p = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.[\w-]+)?$/i.test(f));
    const vendored = `licenses/${name.replace("/", "__")}.txt`;
    if (!file && !existsSync(vendored)) throw new Error(`${name} ${p.version} ships no license file: add its notice to ${vendored} (with where it comes from) after checking upstream`);
    const text = readFileSync(file ? join(dir, file) : vendored, "utf8").trim();
    const noticeFile = readdirSync(dir).find((f) => /^notices?(\.[\w-]+)?$/i.test(f));
    const notice = noticeFile ? `\n\nNOTICE\n\n${readFileSync(join(dir, noticeFile), "utf8").trim()}` : "";
    const repo = (typeof p.repository === "string" ? p.repository : p.repository?.url)?.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
    const source = `Source: ${repo ?? p.homepage ?? `https://www.npmjs.com/package/${name}/v/${p.version}`} (npm: ${name}@${p.version})`;
    return { name, version: p.version as string, text: `${name} ${p.version} (${p.license})\n${source}\n${"-".repeat(72)}\n${text}${notice}\n` };
  });
  sections.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true }));
  return `${heading}\n\n${sections.map((s) => s.text).join("\n\n")}`;
}

mkdirSync("dist/playground", { recursive: true });
copyFileSync("src/playground/index.html", "dist/playground/index.html");
// The playground page's script: CodeMirror and the UI, for the browser
await build({ ...PLAYGROUND_BUNDLE, entryPoints: ["src/playground/app.ts"], outfile: "dist/playground/playground.js", logLevel: "warning" });
// The viewer on its own, for other hosts (the VS Code extension's preview); it has no dependencies
await build({ entryPoints: ["src/playground/viewer.ts"], outfile: "dist/playground/viewer.js", bundle: true, format: "esm", platform: "browser", target: "es2022", logLevel: "warning" });
// The editor on its own (tsquare/editor): CodeMirror bundled in, so it imports nothing and can't
// clash with a CodeMirror the page has. Its notices go next to it, like the browser build's.
const editorBuild = await build({
  entryPoints: ["src/editor.ts"],
  outfile: "dist/editor.js",
  banner: { js: "// tsquare/editor. Bundles CodeMirror: see editor.THIRD_PARTY_LICENSES.txt next to this file." },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  metafile: true,
  logLevel: "warning",
});
writeFileSync("dist/editor.THIRD_PARTY_LICENSES.txt", thirdPartyLicenses(editorBuild.metafile!, "dist/editor.js (tsquare/editor) bundles the packages below."));

execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
console.log("built dist/");
