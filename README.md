# tsquare

Wireframes in plain text: easy for LLMs to write, fast to render as SVG or PNG. A small text language for low-fidelity screens (several devices side by side, with notes), rendered to clean SVG or PNG. Built for LLMs to write: the prompt comes from the component catalog, and errors come back with line numbers so a model can fix its own output.

```tsquare
board "Login"
  screen phone "Sign in"
    heading "Welcome back"
    input "Email" placeholder="you@example.com"
    input password "Password"
    checkbox "Remember me" checked
    button primary "Sign in" fullWidth
```

Save that as `login.tsq`, then:

```bash
npx tsquare render login.tsq -o login.png --scale 2
```

Requires Node 20 or newer. To work on tsquare itself, clone the repo, run `npm install`, and use `npm run render -- examples/notes-mobile.tsq -o notes.png --scale 2`.

## Playground

```bash
npm run playground   # http://localhost:4321
```

- **Editor:** live render as you type, problems listed by line (click one to jump there), and SVG/PNG export. Paste a whole model reply and it keeps just the code block.
- **Components:** every component with its props and a rendered example you can open in the editor. It's generated from the catalog, so it can't drift from what the renderer accepts.
- **Prompt:** the system prompt for models, with a copy button.

It renders on a local Node server using the same code as the CLI.

## The language

One element per line; children are indented two spaces under their parent. The first line is the board.

| You write | It means |
|---|---|
| `button "Sign in"` | a quoted string sets the main text (label, title, text…) |
| `button primary lg` | bare words set options: `phone`, `desktop`, `primary`, `ghost`, `row`, `sm`, `left`, `bottom`, `password`… |
| `checkbox checked`, `toggle off` | a prop name turns a boolean on; `off` / `unchecked` / `no-<prop>` turn it off |
| `stack width=240 gap=8` | `key=value` sets any prop |
| `tabs items=[All notes, Pinned]` | lists in `[ ]`, items separated by commas; an item can contain spaces |
| `data=[["$1,200", "Smith, J"]]` | quote an item that contains a comma (`\"` for a quote inside quotes) |
| `tabbar items=[{label=Home icon=home}]` | objects in `{ }` |
| `# note to self` | comment |

If a bare word could mean two props (for example `start`, which is both an `align` and a `justify` value), write it as `key=value`. Code fences (```` ``` ````) are ignored, so a model's reply can be rendered as-is.

**Structure**

- The top element is a **board**. Its children are **screens**, plus optional **notes** beside them.
- A screen stacks its children vertically. A **navbar** is pinned to the top and a **tabbar** to the bottom.
- **modal** and **drawer** are overlays and must be direct children of a screen.

## Colors

Wireframes are grayscale. There are three deliberate exceptions:

| You write | It colors |
|---|---|
| `board "App" accent=blue` | primary buttons, solid badges, checked checkboxes and radios, toggles that are on, the active tab and tab-bar item, ghost button text |
| `badge "Failed" tone=danger` | one badge: `success`, `warning` or `danger` |
| `input "Email" error helper="Required"` | the field's border and helper text, in red |

`accent` takes `blue`, `indigo`, `violet`, `pink`, `red`, `orange`, `green` or `teal`, or a hex color like `#1a73e8`. With a light hex color, text on it switches to dark and accent-colored text is darkened so it stays readable. There are no other color props, on purpose.

## Components

| Group | Components |
|---|---|
| Canvas | board, screen (`phone` 390×844, `tablet` 820×1180, `desktop` 1280×800, `custom`), note |
| Layout | stack, grid, card, divider, spacer |
| Content | heading, text (`lines=3` draws placeholder lines), image (X-box placeholder), icon (any [Lucide](https://lucide.dev/icons) name), avatar, badge |
| Controls | button, input (`multiline=4` for a textarea), checkbox, radio, toggle, select |
| Navigation & data | navbar, tabbar, tabs, list, listitem, table |
| Overlays | modal, drawer (`left`, `right`, `bottom` sheet) |

`npm run prompt` prints every component with its props. The source of truth is `src/catalog.ts`.

## CLI

```bash
tsquare render <file.tsq|-> [-o out.svg|out.png] [--scale 2]
tsquare check  <file.tsq|->        # problems by line number
tsquare fmt    <file.tsq|-> [-w]   # canonical formatting (drops comments)
tsquare prompt                     # system prompt for models
```

Use `-` to read from stdin. In this repo, run them through npm: `npm run check -- file.tsq`. Files use the `.tsq` extension; the CLI reads any text file..

## Using it with Claude (skill)

\`skill/tsquare/\` is a Claude skill: the syntax, the component reference, and a workflow of write → \`tsquare check\` → \`tsquare render\` → look at the PNG and fix. Copy it to \`~/.claude/skills/tsquare\` (all projects) or \`<project>/.claude/skills/tsquare\`, and make the \`tsquare\` command available (\`npm link\` in this repo). Rebuild it after catalog changes with \`npm run skill\`.

## Using it with a model

The library API is TypeScript and isn't built for importing from npm yet, so for now use it from a checkout of the repo (as below) or through the CLI.

```ts
import { wireframePrompt, repairPrompt, compileWireframe, formatIssues, renderWireframe } from "./src";

const system = wireframePrompt();
let reply = await callModel(system, [{ role: "user", content: "A settings screen with toggles" }]);

// Optional repair loop: send the model its own errors, by line
const { issues } = compileWireframe(reply);
if (issues.length) reply = await callModel(system, [...history, { role: "user", content: repairPrompt(formatIssues(issues)) }]);

const svg = await renderWireframe(reply);                 // SVG string
const png = await renderWireframe(reply, { format: "png", scale: 2 });
```

Errors read like this:

```
line 2: Screen: don't know what "watch" is (bare words it accepts: phone, tablet, desktop, custom, chrome); quote text like "watch"
line 3: Card has no prop "colour" (its props: title, padding, gap, variant, grow, width)
line 5: Drawer must be a direct child of a Screen (found in the Stack on line 4)
line 7: Icon: unknown icon "serach" (did you mean search?)
```

## How it works

Text is parsed into a [json-render](https://github.com/vercel-labs/json-render) spec and validated against Zod schemas. It's then laid out and drawn by [Satori](https://github.com/vercel/satori) into SVG; PNG output goes through resvg.

| File | Contents |
|---|---|
| `src/text.ts` | parser |
| `src/print.ts` | formatter (spec → text) |
| `src/compile.ts` | parse + validate with line numbers, `renderWireframe` |
| `src/prompt.ts` | model prompt, generated from the catalog |
| `src/catalog.ts` | components and their props |
| `src/components.tsx` | Satori renderers |
| `src/render.ts` | validation, board sizing, SVG/PNG |
| `src/layout.ts` | colors, device sizes, spacing |

## Why text

`eval/` compares three formats a model could write: flat JSON, nested JSON and this text syntax. It uses 20 wireframe requests, Sonnet and Haiku, and identical prompts apart from the format section. Text used about 4× fewer tokens and scored the same on content checks and render quality. On validity: Sonnet 100% in every format, Haiku 85% for text vs 90% for JSON, under the current, stricter checks. Unknown icon names (`call`, `person`) failed in every format. The eval also led to list items being separated by commas only: Sonnet wrote table cells like `[Ana Torres, Admin]`, which used to split on the space. With 20 tasks per format, one task is within noise.

The eval also drove these fixes: `off`/`unchecked` keywords, `width` on card/input/select, `padding` on grid, `grow` on list/input, sidebars stretching in rows, and bottom sheets growing to fit their content.

```bash
npm run eval:prompts   # rebuild prompts (the committed ones are what was tested)
npm run eval:score     # parse, validate, check, count tokens, render
```

Specs are in `eval/out/`, scores in `eval/results.json`, and renders in `eval/renders/`. Caveats: generation used subagents rather than bare API calls, token counts use an OpenAI tokenizer as a stand-in, and there are 20 tasks per format.

## Not yet

- **Flow** arrows between screens. These need a second pass that reads element positions after layout.
- Selectable text in SVG. Satori draws text as outlines, which is portable but not searchable in PDFs.
- `fmt` doesn't keep comments.

## License

MIT. The Inter font comes from the `@fontsource/inter` dependency, under the SIL Open Font License 1.1.
