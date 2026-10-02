import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { Spec } from "@json-render/core";
import { renderToSvg } from "@json-render/image/render";
import { catalog, componentDefinitions, listItemEnds } from "./catalog.js";
import { withPalette } from "./components.js";
import { paletteFor } from "./colors.js";
import { unknownComponentMessage } from "./suggest.js";
import { belongsElsewhere } from "./text.js";
import { upgradeSpec } from "./upgrade.js";
import {
  BOARD_GAP,
  BOARD_PADDING,
  LABEL_H,
  NOTE_WIDTH,
  TITLE_H,
  estimateNoteHeight,
  screenSize,
} from "./layout.js";

// Inter from @fontsource/inter, pinned to an exact version: a font change shifts
// text metrics and line wraps, so treat a bump like a renderer change.
const fontFile = (name: string) =>
  createRequire(import.meta.url).resolve(`@fontsource/inter/files/${name}`);

let fontCache: Promise<any[]> | null = null;
function loadFonts() {
  fontCache ??= Promise.all([
    readFile(fontFile("inter-latin-400-normal.woff")),
    readFile(fontFile("inter-latin-600-normal.woff")),
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
  upgradeSpec(spec as any); // older JSON is fine (icon → leadingIcon); see upgrade.ts
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
      issues.push(`${id}: ${unknownComponentMessage(el.type, Object.keys(componentDefinitions))}`);
    } else {
      const parsed = def.props.safeParse(el.props ?? {});
      if (!parsed.success) {
        for (const i of parsed.error.issues) {
          issues.push(`${id}.props${i.path.length ? "." + i.path.join(".") : ""}: ${i.message}`);
        }
      }
      // Zod drops unknown keys silently; report them so the author (or model) hears about it.
      for (const key of Object.keys(el.props ?? {})) {
        if (!(key in def.props.shape)) {
          const elsewhere = belongsElsewhere(el.type, key, true);
          issues.push(`${id}.props: ${el.type} has no prop "${key}"${elsewhere ? `: ${elsewhere}` : ""}`);
        }
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
    // A ListItem value that its leading/trailing kind wouldn't show (icon=star with leading=avatar).
    if (el.type === "ListItem") {
      const p = (el.props ?? {}) as Record<string, string | undefined>;
      const { leading, trailing } = listItemEnds(p);
      const conflict = (prop: string, needs: string, kind: string, has: string) =>
        issues.push(`${id}: ${prop} only shows with ${needs} (this item has ${kind}=${has}); remove one of them`);
      if (p.leadingIcon && leading !== "icon") conflict("leadingIcon", "leading=icon", "leading", leading!);
      if (p.trailingIcon && trailing !== "icon") conflict("trailingIcon", "trailing=icon", "trailing", trailing!);
      if (p.trailingText && trailing !== "text" && trailing !== "badge") conflict("trailingText", "trailing=text or badge", "trailing", trailing!);
    }
    // The renderer would silently drop extra cells. Usually the cause is an unquoted
    // cell with a space, which the text syntax splits into two.
    if (el.type === "Table") {
      const { columns, data } = (el.props ?? {}) as { columns?: unknown; data?: unknown };
      if (Array.isArray(columns) && Array.isArray(data)) {
        const bad = data
          .map((row, i) => ({ row: i + 1, cells: Array.isArray(row) ? row.length : 1 }))
          .filter((r) => r.cells !== columns.length);
        if (bad.length) {
          const cells = (n: number) => `${n} cell${n === 1 ? "" : "s"}`;
          const rows = bad.length === 1
            ? `data row ${bad[0].row} has ${cells(bad[0].cells)}`
            : `data rows ${bad.map((r) => `${r.row} (${cells(r.cells)})`).join(", ")} don't match`;
          const hints = [
            bad.some((r) => r.cells > columns.length) && `quote cells that contain a comma, e.g. ["$1,200", Paid]`,
            bad.some((r) => r.cells < columns.length) && `use "" for an empty cell`,
          ].filter(Boolean);
          issues.push(`${id}: Table has ${columns.length} columns, but ${rows} (${hints.join("; ")})`);
        }
      }
    }
  }
  return issues;
}

export interface BoardItem {
  type: "Screen" | "Note";
  /** Screen name or note text, for labels in tools like the playground. */
  name: string;
  /** Box on the board in px, including the screen's name label above its frame. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where everything sits on the board: the canvas size (Satori needs it up
 * front) and each screen's and note's box, laid out in rows exactly as the
 * Board component does.
 */
export function boardLayout(spec: Spec): { width: number; height: number; items: BoardItem[] } {
  const board = spec.elements[spec.root];
  const p = (board.props ?? {}) as Record<string, any>;
  const gap = p.gap ?? BOARD_GAP;
  const pad = p.padding ?? BOARD_PADDING;
  const kids = (board.children ?? []).map((id) => spec.elements[id]).filter(Boolean);

  const boxes = kids.map((el) => {
    const props = (el.props ?? {}) as Record<string, any>;
    if (el.type === "Screen") {
      const s = screenSize(props);
      return { type: "Screen" as const, name: String(props.name ?? ""), w: s.width, h: s.height + LABEL_H };
    }
    if (el.type === "Note") {
      const w = props.width ?? NOTE_WIDTH;
      return { type: "Note" as const, name: String(props.text ?? ""), w, h: LABEL_H + estimateNoteHeight(props.text ?? "", w) };
    }
    return null;
  });

  const perRow = p.layout === "grid" ? Math.max(1, p.columns ?? 3) : Math.max(1, boxes.length);
  const items: BoardItem[] = [];
  let width = 0;
  let y = pad + (p.title ? TITLE_H : 0);
  for (let i = 0; i < boxes.length; i += perRow) {
    const row = boxes.slice(i, i + perRow);
    if (i > 0) y += gap;
    let x = pad;
    for (const b of row) {
      if (b) items.push({ type: b.type, name: b.name, x, y, width: b.w, height: b.h });
      x += (b?.w ?? 0) + gap;
    }
    width = Math.max(width, row.reduce((sum, b) => sum + (b?.w ?? 0), 0) + gap * (row.length - 1));
    y += Math.max(...row.map((b) => b?.h ?? 0));
  }
  return { width: Math.ceil(width + pad * 2), height: Math.ceil(y + pad), items };
}

/** The canvas size for a board. */
export function boardSize(spec: Spec) {
  const { width, height } = boardLayout(spec);
  return { width, height };
}

export interface RenderWireframeOptions {
  /** Skip validation (e.g. while a spec is still streaming in). */
  skipValidation?: boolean;
}

export async function renderWireframeSvg(spec: Spec, opts: RenderWireframeOptions = {}) {
  upgradeSpec(spec as any);
  if (!opts.skipValidation) {
    const issues = checkSpec(spec);
    if (issues.length) throw new SpecError(issues);
  }
  const { width, height } = boardSize(spec);
  return renderToSvg(spec, {
    registry: withPalette(paletteFor((spec.elements[spec.root]?.props as any)?.accent)) as any,
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
