<p align="center"><img src="https://raw.githubusercontent.com/tsquare-js/tsquare/main/assets/logo.png" alt="tsquare" width="160"></p>

# tsquare

Wireframes in plain text: easy for LLMs to write, fast to render as SVG or PNG. A small text language for low-fidelity screens, with several devices side by side and notes beside them. Built for LLMs to write: the prompt comes from the component catalog, and errors come back with line numbers so a model can fix its own output.

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

## Docs

[Getting started](docs/getting-started.md) · [The language](docs/language.md) · [Components](docs/components/README.md) · [Icons](docs/icons.md) · [Colors](docs/colors.md) · [Using it with AI](docs/ai.md)

## Playground

Online at [tsquare.dev/playground](https://tsquare.dev/playground), or locally:

```bash
npx tsquare playground   # http://localhost:4321
```

- **Editor:** syntax highlighting, autocomplete for components, options, props, icons and colors, and problems underlined by line. Paste a whole model reply and it keeps just the code block.
- **Preview:** renders as you type. Zoom and pan (⌘/Ctrl + scroll or pinch), jump to a single screen, or go full screen.
- **Links:** copy a share link that reopens the wireframe in the playground, or an image link (SVG, PNG, Markdown, HTML) to embed it anywhere.
- **Examples** with thumbnails, **light and dark** themes, a resizable split, and SVG/PNG export.
- **Components:** every component with its props and a rendered example. **Prompt:** the system prompt for models, with a copy button.

The local playground uses the same renderer as the CLI; its links point to tsquare.dev. In this repo, `npm run playground` runs it from source.

## Image links

A wireframe can be embedded anywhere an image works (Notion, GitHub, docs sites) with a link that contains the wireframe itself:

```markdown
![Login](https://tsquare.dev/svg/zNYwxDsIwEAT7vGJ…)
```

The playground's **Copy link** menu makes these; [Embedding](docs/embedding.md) has the steps for Notion, GitHub and your own site. The text is compressed into the URL, not encrypted, so anyone with the link can read it; see [privacy](https://tsquare.dev/privacy). `encodeWireframe` and `decodeWireframe` in the library produce and read the same links.

## Use it with

**With AI**

- **Claude:** the [tsquare skill](https://tsquare.dev/docs/ai#the-claude-skill) teaches Claude the language and how to check its own wireframes.
- **Any model:** the [system prompt](https://tsquare.dev/docs/ai#the-prompt), or the hosted [MCP server](https://tsquare.dev/docs/ai#connect-over-mcp) for Claude, ChatGPT, Cursor, VS Code and other tools that take a remote MCP URL.

**In your docs**

- **Docusaurus, Astro, MDX:** [`remark-tsquare`](https://tsquare.dev/docs/markdown-plugins#remark-tsquare) draws ```` ```tsquare ```` code blocks when the site is built.
- **VitePress, Eleventy:** [`markdown-it-tsquare`](https://tsquare.dev/docs/markdown-plugins#markdown-it-tsquare), the same for sites built on markdown-it.
- **Any web page:** [one script tag](https://tsquare.dev/docs/embedding#pages-written-in-markdown) draws the code blocks in the reader's browser, with no build step.
- **Notion, GitHub and anywhere an image works:** [image links](#image-links).

**In your app**

- **React:** [`@tsquare-js/react`](https://tsquare.dev/docs/react) shows boards, a zoomable viewer, an editor and a playground, including boards in a model's reply while it's still streaming in.
- **Node or the browser:** the [library](#library) itself.

**In your editor and notes**

- **VS Code** (and Cursor, VSCodium, Windsurf): the [tsquare extension](https://marketplace.visualstudio.com/items?itemName=tsquare-js.tsquare-vscode) gives `.tsq` files a live preview, problems as you type, highlighting and autocomplete. Also on [Open VSX](https://open-vsx.org/extension/tsquare-js/tsquare-vscode).
- **Obsidian:** the [tsquare plugin](https://community.obsidian.md/plugins/tsquare) draws ```` ```tsquare ```` code blocks in your notes, on desktop and mobile. See [the Obsidian page](https://tsquare.dev/docs/obsidian).

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
| `# note to self` | a comment, on its own line only; elsewhere `#` is text (`[#1001, #1002]`) |

If a bare word could mean two props (for example `start`, which is both an `align` and a `justify` value), write it as `key=value`. Code fences (```` ``` ````) are ignored, so a model's reply can be rendered as-is.

**Structure**

- The top element is a **board**. Its children are **screens**, plus optional **notes** beside them.
- A screen stacks its children vertically. A **navbar** is pinned to the top and a **tabbar** to the bottom.
- **modal** and **drawer** are overlays and must be direct children of a screen.

## Colors

Wireframes are grayscale. There are three deliberate exceptions in the UI itself:

| You write | It colors |
|---|---|
| `board "App" accent=blue` | primary buttons, solid badges, checked checkboxes and radios, toggles that are on, the active tab and tab-bar item, ghost button text |
| `badge "Failed" tone=danger` | one badge: `success`, `warning` or `danger` |
| `input "Email" error helper="Required"` | the field's border and helper text, in red |

`accent` takes `blue`, `indigo`, `violet`, `pink`, `red`, `orange`, `green` or `teal`, or a hex color like `#1a73e8`. With a light hex color, text on it switches to dark and accent-colored text is darkened so it stays readable. There are no other UI color props, on purpose.

Sticky notes beside the wireframe have their own colors, since they're annotations rather than part of the UI: `note "TBD" color=pink` (`yellow` is the default, plus `blue`, `pink` and `green`). See [Colors](docs/colors.md) for more.

## Components

| Group | Components |
|---|---|
| Canvas | board, screen (`phone` 390×844, `tablet` 820×1180, `desktop` 1280×800, `custom`), note |
| Layout | stack, grid, card, divider, spacer |
| Content | heading, text (`lines=3` draws placeholder lines), image (X-box placeholder), icon (any [Lucide](https://lucide.dev/icons) name or a brand logo such as `brand-google`, see [Icons](docs/icons.md)), avatar, badge |
| Controls | button, input (`multiline=4` for a textarea), checkbox, radio, toggle, select |
| Navigation & data | navbar, tabbar, tabs, list, listitem, table |
| Overlays | modal, drawer (`left`, `right`, `bottom` sheet) |

Each component has its own page with a rendered example and its props: see [Components](docs/components/README.md).

## CLI

```bash
tsquare render <file.tsq|-> [-o out.svg|out.png] [--scale 2]
tsquare check  <file.tsq|->        # problems by line number
tsquare fmt    <file.tsq|-> [-w]   # canonical formatting (drops comments)
tsquare prompt                     # system prompt for models
tsquare playground [--port 4321]   # live editor, component reference, prompt
```

Run them with `npx tsquare …` (nothing to install), or install the `tsquare` command with `npm install -g tsquare`. Use `-` to read from stdin. In this repo, run them through npm: `npm run check -- file.tsq`. Files use the `.tsq` extension; the CLI reads any text file.

## Library

```bash
npm install tsquare
```

```ts
import { renderWireframe, compileWireframe, formatIssues } from "tsquare";

const { issues } = compileWireframe(source);           // problems by line, empty when valid
const png = await renderWireframe(source, { format: "png", scale: 2 });
```

`tsquare/playground` exports the playground's request handler, for hosting it inside your own Node server. `tsquare/viewer` is the playground's zoomable board (zoom, pan, pinch, a chip per screen) for your own page: pass it the elements, then `show()` the SVG from `renderWireframeSvg` with the size and screens from `measureBoardLayout` (exact; `boardLayout` is a synchronous estimate that can be off by a line or more on boards with notes). It sets the styles its zoom math needs itself; give the stage a size, and optionally style the classes it toggles on the stage: `panning` (while dragging), `animate` (while fitting or zooming to a screen, e.g. `.animate > * { transition: transform .25s }`) and `stale` (from `setStale`, e.g. `.stale img { opacity: .35 }`). Call `destroy()` when you remove it. Give it the board's `measureElements` entries (`setElements`) and it reports clicks and hovers on elements, outlines them (`highlight`) and zooms to them (`zoomTo`): see [Element positions](docs/element-positions.md#in-the-viewer). `languageData()` lists every component, prop, option word, icon and accent, for editor highlighting and autocomplete. In a browser bundle (esbuild, Vite, webpack) the same imports render SVG with no setup; PNG and share links need Node. On a page without a build step, `<script src="https://cdn.jsdelivr.net/npm/tsquare@0.13/dist/tsquare.min.js"></script>` draws every ```` ```tsquare ```` code block on the page (see [Embedding](docs/embedding.md#pages-written-in-markdown)). See [Using it with AI](docs/ai.md) for the prompt and the repair loop. `measureElements` gives each element's box on the board and its line in the text, and `elementsAt` what's under a click, for making a board clickable (see [Element positions](docs/element-positions.md)).

### The editor: `tsquare/editor`

The playground's code editor for your own page: highlighting, autocomplete for components, props, option words, icons and accents, problems underlined on their lines, Enter keeping the indentation, and pasting a whole model reply keeps just its code block. CodeMirror is bundled inside (about 125 KB compressed once your bundler minifies it), so it imports nothing and can't clash with a CodeMirror your page already has.

```ts
import { createEditor } from "tsquare/editor";
import { compileWireframe, languageData } from "tsquare";

const editor = createEditor(document.getElementById("code")!, {
  doc: "board\n  screen phone",
  data: languageData(), // autocomplete; leave it out for none
  onChange: (text) => editor.setIssues(compileWireframe(text).issues),
});
```

Give the element a height; the editor fills it. Options: `doc`, `data`, `onChange`, `onCursorLine` (the caret's line, when it moves to another), `lineNumbers` (default `true`), `lineWrapping` (default `false`: wrap long lines instead of scrolling sideways, continuation rows indented 4 spaces past their line's indentation, so they don't look like a child element) and `ariaLabel` (default "Wireframe text"). The editor has `getText()`, `setText(text)` (one undoable step), `setIssues(issues)`, `goToLine(n)`, `focus()`, `dom` and `destroy()`.

Its colors are CSS variables, light or dark by the page's `color-scheme`, defaulting to the playground's:

| Variables | |
|---|---|
| `--tsquare-editor-bg`, `--tsquare-editor-fg`, `--tsquare-editor-gutter`, `--tsquare-editor-active-line`, `--tsquare-editor-selection`, `--tsquare-editor-error` | the editor |
| `--tsquare-editor-popup-bg`, `--tsquare-editor-popup-border`, `--tsquare-editor-popup-selected` | autocomplete and problem popups |
| `--tsquare-editor-font`, `--tsquare-editor-font-size`, `--tsquare-editor-ui-font` | code font and size (13px), popup text font |
| `--tsquare-syntax-component`, `--tsquare-syntax-string`, `--tsquare-syntax-prop`, `--tsquare-syntax-number`, `--tsquare-syntax-word`, `--tsquare-syntax-color`, `--tsquare-syntax-comment`, `--tsquare-syntax-punct` | highlighting |

## Using it with Claude (skill)

`skill/tsquare/` is a Claude skill: the syntax, the component reference, and a workflow of write → `tsquare check` → `tsquare render` → look at the PNG and fix. Copy it to `~/.claude/skills/tsquare` (all projects) or `<project>/.claude/skills/tsquare`, and make sure `npx tsquare` runs where Claude works. Rebuild it after catalog changes with `npm run skill`.

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

## Measured

How often models write valid tsquare on the first try, with no repair round:

| | Sonnet | Haiku |
|---|---|---|
| Valid on the first try (20 requests) | 100% | 80% |
| Median tokens per wireframe (JSON took about 4× as many) | 184 | 210 |
| Color checks passed (7 requests) | 11/11 | 11/11 |

How it was measured, the tasks, every model output, and the scripts: [`eval/`](eval/).

## License

MIT. The Inter font comes from the `@fontsource/inter` dependency, under the SIL Open Font License 1.1. Icons are from [Lucide](https://lucide.dev), under the ISC license. Brand logos are from [Simple Icons](https://simpleicons.org) (CC0); the logos themselves are trademarks of their owners. The browser build (`dist/browser/`) bundles some dependencies, Inter and satori (MPL-2.0) among them; their notices are in `dist/browser/THIRD_PARTY_LICENSES.txt`.
