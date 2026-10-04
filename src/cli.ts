#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileWireframe, formatIssues, renderWireframe, WireframeError } from "./compile.js";
import { printWireframeText } from "./print.js";
import { wireframePrompt } from "./prompt.js";

const USAGE = `tsquare — render wireframe text to SVG or PNG

  tsquare render <file.tsq|-> [-o out.svg|out.png] [--scale 2] [--no-flows]
  tsquare check  <file.tsq|->      report problems by line number
  tsquare fmt    <file.tsq|-> [-w] print in canonical form (-w rewrites the file; drops comments)
  tsquare prompt                   print the system prompt for models
  tsquare playground [--port 4321] open the playground: live editor, component reference, prompt

Use - to read from stdin. Code fences (\`\`\`) in the input are ignored.
`;

async function readInput(file: string) {
  if (file !== "-") return readFile(file, "utf8");
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(argv: string[]) {
  const [cmd, ...rest] = argv;
  const flag = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const file = rest.find((a, i) => (a === "-" || !a.startsWith("-")) && !["-o", "--scale"].includes(rest[i - 1]));

  if (cmd === "playground") {
    const { startPlayground } = await import("./playground/index.js");
    startPlayground(Number(flag("--port") ?? 4321));
    return;
  }
  if (cmd === "prompt") {
    process.stdout.write(wireframePrompt() + "\n");
    return;
  }
  if (!["render", "check", "fmt"].includes(cmd) || !file) {
    process.stdout.write(USAGE);
    process.exitCode = cmd && cmd !== "help" ? 1 : 0;
    return;
  }

  const source = await readInput(file);

  if (cmd === "check") {
    const { issues } = compileWireframe(source);
    if (issues.length) {
      console.error(formatIssues(issues));
      process.exitCode = 1;
    } else {
      console.log(`✓ ${file === "-" ? "input" : file} is valid`);
    }
    return;
  }

  if (cmd === "fmt") {
    const { spec, issues } = compileWireframe(source);
    if (!spec || issues.length) throw new WireframeError(issues);
    const out = printWireframeText(spec);
    if (rest.includes("-w") && file !== "-") await writeFile(file, out);
    else process.stdout.write(out);
    return;
  }

  const out = flag("-o") ?? (file === "-" ? "wireframe.svg" : file.replace(/\.(tsq|wf)$/, "") + ".svg");
  const png = out.endsWith(".png");
  const data = await renderWireframe(source, { format: png ? "png" : "svg", scale: Number(flag("--scale") ?? 1), flows: !rest.includes("--no-flows") });
  await writeFile(out, data);
  console.log(`✓ wrote ${path.relative(process.cwd(), out)}`);
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof WireframeError ? err.message : err);
  process.exitCode = 1;
});
