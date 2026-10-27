/**
 * Visual regression boards, in test/regressions/: each guards a rendering bug that the example and
 * eval boards don't cover (they rendered byte for byte the same while the bug was there). Every board
 * has a reference render, <name>.png; a board with a `# measured` line also has <name>.measured.png,
 * the render with measureElements' boxes drawn over it. test/regressions.test.ts compares pixels with
 * them; `npm run regressions` rewrites them on purpose (a font bump, an intended change), so a changed
 * reference shows up in the PR's diff.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { compileWireframe } from "../src/compile.js";
import { measureElements, type Measured, type MeasuredBox } from "../src/measure.js";
import { renderWireframeSvg } from "../src/render.js";
import { root } from "./helpers.js";

export const dir = path.join(root, "test/regressions");
export const boards = () => readdirSync(dir).filter((f) => f.endsWith(".tsq")).map((f) => f.slice(0, -4)).sort();

const png = (svg: string) => new Resvg(svg).render().asPng();

/** measureElements' boxes over the render: red boxes, blue name bands, green overlays, magenta flows. */
function withBoxes(svg: string, elements: Measured[]) {
  const rect = (b: MeasuredBox, color: string) => `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
  const marks = elements.map((e) => {
    if (e.type === "Flow") return `<polyline points="${e.path.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#e0f" stroke-width="3" opacity="0.6"/>${e.labelBox ? rect(e.labelBox, "#e0f") : ""}`;
    if (e.type === "Board") return "";
    return rect(e.box, "#f00") + (e.labelBox ? rect(e.labelBox, "#00f") : "") + (e.overlays ?? []).map((o) => rect(o, "#0a0")).join("");
  });
  return svg.replace(/<\/svg>\s*$/, marks.join("") + "</svg>");
}

/** The images a board should look like now: file name → PNG. */
export async function renders(name: string): Promise<Record<string, Uint8Array>> {
  const text = readFileSync(path.join(dir, `${name}.tsq`), "utf8");
  const { spec, lines, issues } = compileWireframe(text);
  if (!spec || issues.length) throw new Error(`${name}.tsq: ${issues.map((i) => `line ${i.line}: ${i.message}`).join("; ")}`);
  const svg = await renderWireframeSvg(structuredClone(spec));
  const out: Record<string, Uint8Array> = { [`${name}.png`]: png(svg) };
  if (/^# measured$/m.test(text)) out[`${name}.measured.png`] = png(withBoxes(svg, await measureElements(structuredClone(spec), lines)));
  return out;
}

/** A PNG's pixels, decoded by resvg (an image at its own size: exact, checked against the encoder). */
function pixels(file: Uint8Array) {
  const head = Buffer.from(file);
  const w = head.readUInt32BE(16), h = head.readUInt32BE(20);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image width="${w}" height="${h}" href="data:image/png;base64,${head.toString("base64")}"/></svg>`;
  return { w, h, data: new Resvg(svg).render().pixels };
}

/**
 * How two PNGs differ: the pixels where some channel differs by more than `tolerance` (antialiasing
 * can differ by a step or two between machines; a real regression moves whole shapes), and their
 * bounding box. Different sizes count as a difference by themselves.
 */
export function compare(expected: Uint8Array, actual: Uint8Array, tolerance = 8) {
  const a = pixels(expected), b = pixels(actual);
  if (a.w !== b.w || a.h !== b.h) return { size: `${a.w}×${a.h} → ${b.w}×${b.h}`, changed: Infinity, box: null };
  let changed = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]), Math.abs(a.data[i + 3] - b.data[i + 3])) <= tolerance) continue;
    const p = i / 4, x = p % a.w, y = Math.floor(p / a.w);
    changed++;
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
  return { size: null, changed, box: changed ? { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } : null };
}
