/**
 * Builds the three system prompts for the format eval. Everything except the
 * "Output format" section and the example's encoding is shared with the
 * library prompt (src/prompt.ts).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flatToNested } from "./convert";
import { printWireframeText } from "../src/print";
import { exampleSpec } from "../src/prompt-example";
import { EXAMPLE_REQUEST, RULES, TEXT_FORMAT, componentReference } from "../src/prompt";

const here = path.dirname(fileURLToPath(import.meta.url));

const FORMATS = {
  flat: {
    section: `## Output format: flat JSON
Output a single JSON object with two keys:
- "root": the id of the Board element
- "elements": an object mapping each element id to { "type", "props", "children" }
"children" is an array of element ids, in order. Every element must have a "children" array (use [] for leaves), and every id listed in a "children" array must be defined in "elements". Ids are any unique strings you choose.`,
    fence: "json",
    encode: (spec: any) => JSON.stringify(spec, null, 2),
  },
  nested: {
    section: `## Output format: nested JSON
Output a single JSON object for the Board. Every element is { "type", "props", "children" }, where "children" is an array of child element objects, in order. Use [] for leaves.`,
    fence: "json",
    encode: (spec: any) => JSON.stringify(flatToNested(spec), null, 2),
  },
  text: {
    section: TEXT_FORMAT,
    fence: "wireframe",
    encode: (spec: any) => printWireframeText(spec).trimEnd(),
  },
} as const;

export type Format = keyof typeof FORMATS;

export function buildPrompt(format: Format) {
  const f = FORMATS[format];
  return [
    "You write low-fidelity UI wireframes as specs that a renderer turns into images.",
    "Reply with only the spec in a single code block, with no explanation.",
    "",
    f.section,
    "",
    RULES,
    "",
    "## Example",
    `Request: ${EXAMPLE_REQUEST}`,
    "",
    "```" + f.fence,
    f.encode(exampleSpec),
    "```",
    "",
    "## Components",
    "",
    componentReference(),
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.join(here, "prompts");
  mkdirSync(dir, { recursive: true });
  for (const format of Object.keys(FORMATS) as Format[]) {
    writeFileSync(path.join(dir, `${format}.md`), buildPrompt(format));
  }
  console.log("wrote prompts to", dir);
}
