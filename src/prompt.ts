/**
 * System prompt for models that write wireframe text. Built from the catalog,
 * so it always matches the components and props the renderer accepts.
 */
import { componentDefinitions } from "./catalog";
import { printWireframeText } from "./print";
import { exampleSpec } from "./prompt-example";
import { PRIMARY_PROP } from "./text";

function unwrap(t: any): any {
  let cur = t;
  while (cur && ["optional", "nullable", "default"].includes(cur.def?.type)) cur = cur.def.innerType;
  return cur;
}

function describeType(t: any): string {
  const s = unwrap(t);
  switch (s?.def?.type) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "enum": return (s.options as string[]).map((o) => `"${o}"`).join(" | ");
    case "literal": return s.def.values.map((v: unknown) => JSON.stringify(v)).join(" | ");
    case "union": return s.def.options.map(describeType).join(" | ");
    case "array": return `array of ${describeType(s.def.element)}`;
    case "object":
      return `{ ${Object.entries(s.shape).map(([k, v]) => `${k}: ${describeType(v)}`).join(", ")} }`;
    default: return "any";
  }
}

export function componentReference() {
  const lines: string[] = [];
  for (const [name, def] of Object.entries(componentDefinitions)) {
    lines.push(`### ${name}`, def.description);
    for (const [prop, schema] of Object.entries((def.props as any).shape)) {
      const required = !["optional", "nullable"].includes((schema as any).def?.type);
      const desc = (schema as any).description ?? unwrap(schema)?.description;
      const main = PRIMARY_PROP[name] === prop ? " (main text)" : "";
      lines.push(`- ${prop}${required ? " (required)" : ""}: ${describeType(schema)}${main}${desc ? ` — ${desc}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export const RULES = `## Rules
1. The top element is a Board. The Board's children are Screens, plus optional Notes beside them.
2. Each Screen is one view of the product. Use several Screens to show several views or states.
3. A Screen lays out its children top to bottom. Use Stack (direction row or column) and Grid to arrange content.
4. NavBar is pinned to the top of its Screen and TabBar to the bottom.
5. Modal and Drawer are overlays. They must be direct children of a Screen.
6. This is a low-fidelity wireframe. Prefer placeholders (Image boxes, Text with lines) over invented copy unless the copy matters.
7. Only use the components and props listed below. All props are optional unless marked required.`;

export const TEXT_FORMAT = `## Output format: wireframe text
One element per line. Indent children two spaces under their parent. The first line is the board.

A line is the component name in lowercase, followed by arguments separated by spaces:
- "a quoted string" sets the component's main text prop (marked "main text" below)
- a bare word that is one of the component's option values sets that option: phone, desktop, primary, ghost, row, sm, left, bottom, password, …
- a bare prop name sets a boolean prop to true: checked, fullWidth, grow, muted. \`off\` and \`unchecked\` set on/checked to false
- key=value sets any prop. Values: "string", number, true/false, bare word, [list, of, values], {key=value key=value}
- # starts a comment

If a bare word could mean more than one prop, write it as key=value.`;

export const EXAMPLE_REQUEST =
  "Two phone screens for a recipe app: a browse screen with search, category tabs, a grid of recipe cards and a tab bar; and a recipe detail screen with its options sheet open.";

/** The system prompt for writing wireframe text. */
export function wireframePrompt() {
  return [
    "You write low-fidelity UI wireframes as specs that a renderer turns into images.",
    "Reply with only the spec in a single code block, with no explanation.",
    "",
    TEXT_FORMAT,
    "",
    RULES,
    "",
    "## Example",
    `Request: ${EXAMPLE_REQUEST}`,
    "",
    "```wireframe",
    printWireframeText(exampleSpec).trimEnd(),
    "```",
    "",
    "## Components",
    "",
    componentReference(),
  ].join("\n");
}

/** Follow-up message asking a model to fix the problems in its last reply. */
export function repairPrompt(issues: string) {
  return `The wireframe has these problems:\n${issues}\n\nReply with the corrected wireframe in a single code block.`;
}
