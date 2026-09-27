import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Spec } from "@json-render/core";
import { renderToSvg } from "@json-render/image/render";
import { catalog, componentDefinitions } from "./catalog";
import { registry } from "./components";
import {
  BOARD_GAP,
  BOARD_PADDING,
  LABEL_H,
  NOTE_WIDTH,
  TITLE_H,
  estimateNoteHeight,
  screenSize,
} from "./layout";

const here = path.dirname(fileURLToPath(import.meta.url));
const fontDir = path.resolve(here, "../fonts");

let fontCache: Promise<any[]> | null = null;
function loadFonts() {
  fontCache ??= Promise.all([
    readFile(path.join(fontDir, "inter-latin-400-normal.woff")),
    readFile(path.join(fontDir, "inter-latin-600-normal.woff")),
  ]).then(([regular, semibold]) => [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: semibold, weight: 600, style: "normal" },
  ]);
  return fontCache;
}

export class SpecError extends Error {
  constructor(public issues: string[]) {
    super(`Invalid wireframe spec:\n  - ${issues.join("\n  - ")}`);
  }
}

/** Catalog validation plus the structural rules the renderer depends on. */
export function checkSpec(spec: Spec): string[] {
  const issues: string[] = [];
  const result = catalog.validate(spec);
  if (!result.success) {
    const err: any = (result as any).error;
    const zodIssues = err?.issues ?? [];
    if (zodIssues.length) {
      for (const i of zodIssues) issues.push(`${(i.path ?? []).join(".")}: ${i.message}`);
    } else {
      issues.push(String(err ?? "catalog validation failed"));
    }
  }

  const root = spec.elements?.[spec.root];
  if (!root) {
    issues.push(`root "${spec.root}" is not in elements`);
    return issues;
  }
  if (root.type !== "Board") issues.push(`root must be a Board (got ${root.type})`);

  for (const [id, el] of Object.entries(spec.elements)) {
    // catalog.validate checks the spec's shape but not each element's props,
    // so validate props against the component's Zod schema here.
    const def = (componentDefinitions as Record<string, { props: any }>)[el.type];
    if (!def) {
      issues.push(`${id}: unknown component "${el.type}"`);
    } else {
      const parsed = def.props.safeParse(el.props ?? {});
      if (!parsed.success) {
        for (const i of parsed.error.issues) {
          issues.push(`${id}.props${i.path.length ? "." + i.path.join(".") : ""}: ${i.message}`);
        }
      }
      // Zod drops unknown keys silently; report them so the author (or model) hears about it.
      for (const key of Object.keys(el.props ?? {})) {
        if (!(key in def.props.shape)) issues.push(`${id}.props: ${el.type} has no prop "${key}"`);
      }
    }
    for (const child of el.children ?? []) {
      if (!spec.elements[child]) issues.push(`${id}: child "${child}" does not exist`);
    }
    if (el.type === "Screen" && !(root.children ?? []).includes(id)) {
      issues.push(`${id}: Screen must be a direct child of the Board`);
    }
    if (el.type === "Modal" || el.type === "Drawer") {
      const parent = Object.entries(spec.elements).find(([, p]) => p.children?.includes(id));
      if (parent && parent[1].type !== "Screen") {
        issues.push(`${id}: ${el.type} must be a direct child of a Screen (found in ${parent[1].type} "${parent[0]}")`);
      }
    }
  }
  return issues;
}

/** Work out the canvas size from the Board's screens (Satori needs it up front). */
export function boardSize(spec: Spec) {
  const board = spec.elements[spec.root];
  const p = (board.props ?? {}) as Record<string, any>;
  const gap = p.gap ?? BOARD_GAP;
  const pad = p.padding ?? BOARD_PADDING;
  const kids = (board.children ?? []).map((id) => spec.elements[id]).filter(Boolean);

  const boxes = kids.map((el) => {
    const props = (el.props ?? {}) as Record<string, any>;
    if (el.type === "Screen") {
      const s = screenSize(props);
      return { w: s.width, h: s.height + LABEL_H };
    }
    if (el.type === "Note") {
      const w = props.width ?? NOTE_WIDTH;
      return { w, h: LABEL_H + estimateNoteHeight(props.text ?? "", w) };
    }
    return { w: 0, h: 0 };
  });

  const perRow = p.layout === "grid" ? Math.max(1, p.columns ?? 3) : Math.max(1, boxes.length);
  let width = 0;
  let height = 0;
  for (let i = 0; i < boxes.length; i += perRow) {
    const row = boxes.slice(i, i + perRow);
    width = Math.max(width, row.reduce((sum, b) => sum + b.w, 0) + gap * (row.length - 1));
    height += Math.max(...row.map((b) => b.h)) + (i > 0 ? gap : 0);
  }
  return {
    width: Math.ceil(width + pad * 2),
    height: Math.ceil(height + pad * 2 + (p.title ? TITLE_H : 0)),
  };
}

export interface RenderWireframeOptions {
  /** Skip validation (e.g. while a spec is still streaming in). */
  skipValidation?: boolean;
}

export async function renderWireframeSvg(spec: Spec, opts: RenderWireframeOptions = {}) {
  if (!opts.skipValidation) {
    const issues = checkSpec(spec);
    if (issues.length) throw new SpecError(issues);
  }
  const { width, height } = boardSize(spec);
  return renderToSvg(spec, {
    registry: registry as any,
    includeStandard: false,
    fonts: await loadFonts(),
    width,
    height,
  });
}

export async function renderWireframePng(spec: Spec, opts: RenderWireframeOptions & { scale?: number } = {}) {
  const svg = await renderWireframeSvg(spec, opts);
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, { fitTo: { mode: "zoom", value: opts.scale ?? 1 } });
  return resvg.render().asPng();
}
