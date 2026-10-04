/**
 * System prompt for models that write wireframe text. Built from the catalog,
 * so it always matches the components and props the renderer accepts.
 */
import { componentDefinitions } from "./catalog.js";
import { printWireframeText } from "./print.js";
import { exampleSpec } from "./prompt-example.js";
import { PRIMARY_PROP } from "./text.js";

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
    case "tuple": return `[${s.def.items.map(describeType).join(", ")}]`;
    case "object":
      return `{ ${Object.entries(s.shape).map(([k, v]) => `${k}: ${describeType(v)}`).join(", ")} }`;
    default: return "any";
  }
}

export interface PropDoc {
  name: string;
  type: string;
  required: boolean;
  /** This prop is filled by a quoted string, e.g. the label of `button "Save"`. */
  main: boolean;
  description?: string;
}

/** Every component with its description and props, straight from the catalog. */
export function componentDocs() {
  return Object.entries(componentDefinitions).map(([name, def]) => ({
    name,
    description: def.description,
    props: Object.entries((def.props as any).shape).map(([prop, schema]: [string, any]): PropDoc => ({
      name: prop,
      type: describeType(schema),
      required: !["optional", "nullable"].includes(schema.def?.type),
      main: PRIMARY_PROP[name] === prop,
      description: schema.description ?? unwrap(schema)?.description,
    })),
  }));
}

export function componentReference() {
  const lines: string[] = [];
  for (const c of componentDocs()) {
    lines.push(`### ${c.name}`, c.description);
    for (const p of c.props) {
      lines.push(`- ${p.name}${p.required ? " (required)" : ""}: ${p.type}${p.main ? " (main text)" : ""}${p.description ? ` — ${p.description}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export const RULES = `## Rules
1. The top element is a Board. The Board's children are Screens, plus optional Notes beside them and Flow lines after them (rule 10).
2. Each Screen is one view of the product. Use several Screens to show several views or states.
3. A Screen lays out its children top to bottom. Use Stack (direction row or column) and Grid to arrange content.
4. NavBar is pinned to the top of its Screen and TabBar to the bottom.
5. Modal, Drawer and Toast are overlays. They must be direct children of a Screen.
6. This is a low-fidelity wireframe. Prefer placeholders (Image boxes, Text with lines) over invented copy unless the copy matters.
7. Only use the components and props listed below. All props are optional unless marked required.
8. Wireframes are grayscale. The only UI colors: Board accent (one color for primary buttons, checked controls, toggles, active tabs and ghost buttons), Badge tone (success, warning, danger), Input error and Flow color. Only add an accent if the request asks for color or a brand.
9. Any element except Board, Screen, Note and Flow can take tooltip="text" to show a tooltip next to it. Select (with options), Input type=date, and Button, ListItem or NavBar (with menu) take open to show their list, calendar or menu over the screen.
10. To show how screens connect, name elements or screens by writing #name after them (button primary "Sign in" #signin, screen phone "Home" #home), then add board-level lines after the screens: flow signin -> home "Tap Sign in".`;

export const TEXT_FORMAT = `## Output format: wireframe text
One element per line. Indent children two spaces under their parent. The first line is the board.

A line is the component name in lowercase, followed by arguments separated by spaces:
- "a quoted string" sets the component's main text prop (marked "main text" below)
- a bare word that is one of the component's option values sets that option: phone, desktop, primary, ghost, row, sm, left, bottom, password, …
- a bare prop name sets that component's yes/no prop to true, only on components that have it (see each component's props below): checked (checkbox, radio), fullWidth (button), muted (text), grow (stack, card, input, list). \`off\` and \`unchecked\` set on/checked to false
- key=value sets any prop. Values: "string", number, true/false, bare word, [list, of, values], {key=value key=value}

Comments: a line that starts with # is a comment. A comment must be on its own line, never after an element on the same line. Anywhere else, # is ordinary text: [#1001, #1002], "Order #12345", accent=#1a73e8.

Lists: items are separated by commas, and an item can contain spaces without quotes: [All notes, Pinned, Shared]. To put a comma inside an item, quote the item: ["$1,200", "Smith, J"]. Inside quotes, write \\" for a quote character. Numbers in a list of text are fine: [2023, 2024].

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
    "```tsquare",
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
