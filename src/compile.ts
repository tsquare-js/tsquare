import type { Spec } from "@json-render/core";
import { checkSpec, renderWireframePng, renderWireframeSvg } from "./render.js";
import { parseWireframeText, type TextIssue } from "./text.js";

export interface CompileResult {
  /** The compiled spec, or null if the text couldn't be parsed at all. */
  spec: Spec | null;
  /** Every problem, tied to a source line. Empty means the wireframe is valid. */
  issues: TextIssue[];
}

/**
 * Parse wireframe text and validate it against the catalog, reporting every
 * problem by line number so it can be shown to a person or fed back to a model.
 */
export function compileWireframe(source: string): CompileResult {
  const parsed = parseWireframeText(source);
  const issues: TextIssue[] = [...parsed.issues];

  if (parsed.spec) {
    for (const msg of checkSpec(parsed.spec)) {
      // checkSpec reports "<element id>[.props…]: message"; map ids back to lines
      const m = msg.match(/^([\w-]+)(?:\.props[^:]*)?: (.*)$/);
      const line = m ? parsed.lines[m[1]] : undefined;
      const text = m && line ? (m[2].startsWith(`${parsed.spec.elements[m[1]].type} `) ? m[2] : `${parsed.spec.elements[m[1]].type}: ${m[2]}`) : msg;
      // "Stack "stack-4"" → "the Stack on line 4"
      const readable = text.replace(/(\w+) "([\w-]+)"/g, (all, type, id) =>
        parsed.lines[id] ? `the ${type} on line ${parsed.lines[id]}` : all,
      );
      issues.push({ line: line ?? 1, message: readable });
    }
  }

  // The parser and the validator can both flag the same unknown prop.
  const seen = new Set<string>();
  const unique = issues.filter((i) => {
    const key = `${i.line}|${i.message.replace(/^\w+: /, "").replace(/ \(.*$/, "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.line - b.line);
  return { spec: parsed.spec, issues: unique };
}

/** One issue per line, e.g. for an error message or a model repair prompt. */
export function formatIssues(issues: TextIssue[]) {
  return issues.map((i) => `line ${i.line}: ${i.message}`).join("\n");
}

export class WireframeError extends Error {
  constructor(public issues: TextIssue[]) {
    super(`Invalid wireframe:\n${formatIssues(issues)}`);
  }
}

/** Compile and render wireframe text. Throws WireframeError (with line-numbered issues) if it's invalid. */
export async function renderWireframe(source: string, opts: { format?: "svg" | "png"; scale?: number } = {}) {
  const { spec, issues } = compileWireframe(source);
  if (!spec || issues.length) throw new WireframeError(issues);
  return opts.format === "png"
    ? renderWireframePng(spec, { skipValidation: true, scale: opts.scale })
    : renderWireframeSvg(spec, { skipValidation: true });
}
