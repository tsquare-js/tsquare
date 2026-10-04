# Changelog

## Unreleased

### MCP tools

- **Hosted MCP server at `https://tsquare.dev/mcp`** (in the site repo), with three tools: `wireframe_guide` (the language plus a write → render → fix → share workflow), `render_wireframe` (a PNG for the model to look at, at most 1600px on its longest side, or line-numbered problems) and `share_wireframe` (SVG, PNG, playground and Markdown links). Setup for Claude, Claude Code, Cursor and VS Code is in [Using it with AI](docs/ai.md#connect-over-mcp).
- **The tools live in the library** as plain functions with no MCP SDK, so a local server can reuse them: `mcpTools` (names, descriptions, Zod input schemas, annotations), `MCP_INSTRUCTIONS`, `wireframeGuide()`, `renderWireframeTool()`, `shareWireframeTool()` and `callMcpTool(name, args)`. Results use the MCP tool-result shape; problems come back as `isError` results, not exceptions, so the model can read and fix them. Share links drop a surrounding code fence.
- `wireframePrompt()` is unchanged; its language part is now shared with the guide.

### Errors

- **A value under the wrong prop points at the right one:** `image type=map` now says "for an Image, write kind=map (or just map)"; likewise `input kind=date` → `type=date` and `chart type=pie` → `kind=pie`.
- Grammar: "a Input" → "an Input" in error messages.

## 0.6.1

- **Fix: the playground opens 0.6.0 share links.** 0.6.0 made share links with the new `y` prefix, but its playground only opened links starting with `z`. Opening a new share link left the editor on whatever it showed before. The prefixes now live in one place that both the library and the playground use, and a test guards it. Links themselves didn't change: every `y` link made by 0.6.0 opens correctly now.

## 0.6.0

### Flow arrows

```tsquare
board "Sign in flow"
  screen phone "Sign in" #signin
    button primary "Sign in" #submit
  screen phone "Home" #home
    heading "Welcome back"
    text lines=3
    button secondary "Sign out" #signout
  flow submit -> home "Sign in"
  flow signout -> signin dashed start=dot
```

- **Ids:** `#name` after an element or a screen names it (one word: letters, digits, `-` and `_`, starting with a letter). Ids must be unique on the board and ignore case (`#Home` matches `home`).
- **Flows:** `flow <from> -> <to> "label"` lines go at the board level, after the screens, and draw an arrow between the two named elements or screens. Lines stay off screens they don't connect: an arrow to a neighboring screen crosses the gap between them (each on its own track), and one that skips a screen runs through its own lane under the screens. An arrow into a screen meets it at the height of the other end, so a button beside it gets a straight line. Labels stay on their line, clear of other labels and line ends, and the gaps between screens widen to fit labels on arrows between neighbors (unless the board sets `gap=`; with flows off the gaps are unchanged).
- **Options:** `start=` and `end=` pick each end's marker (`none`, `arrow`, `dot`, `circle`, `bar`; default no marker at the start and an arrow at the end), `line=rounded|hard|curved|straight` (default `rounded`), `dashed`, and `color=` with the 8 accent names, a hex color, or `accent` for the board's accent (default gray).
- **Off switch:** flows are drawn by default. Turn them off at render time with the playground's **Flows** switch (shown when a board has flows; image links copied while it's off leave them out too), `--no-flows` on the CLI, or `{ flows: false }` in the library. The board is then exactly what it would be without its flow lines.
- **Errors** for an unknown id (with close matches), a duplicate id, a flow with the same id at both ends, a flow nested inside a screen, a flow pointing into a closed accordion (its contents aren't drawn), and an id on a note or the board.

- **New example:** `examples/sign-up-flow.tsq` (create an account, verify the email with a code, welcome), with a dashed arrow back for "Wrong email?". It's in the playground's examples.

### `#` after an element is now an id

Comments still go on their own line, as since 0.3.0. What changed is a `#word` after an element: it used to be an error ("comments go on their own line"), and now it's an id when it looks like one (`button "Go" #cta`). Anything else after `#` is still an error. `avatar #jd` keeps meaning the initials "#jd". Old links keep working: see the new link prefix below.

### New link prefix: `y`

Share links and image URLs made by 0.6.0 start with `y` instead of `z`. Before 0.3.0, `#cta` after an element was a comment, and a link can't say which version made it. So `z` links keep their old meaning: a trailing `#word` is a comment and moves onto its own line. `y` links read `#word` as an id. Both prefixes decode. A site that renders tsquare links needs 0.6.0 to read `y` links.

### Eval

Three new requests for multi-screen flows (sign in, a checkout with a dashed path back, onboarding with a curved skip arrow in green), two runs each for Sonnet and Haiku with the final 0.6.0 prompt: every flow was written correctly (24 of 24 checks), and 11 of 12 outputs were valid (the miss was unrelated to flows). See `eval/README.md`.

## 0.5.1

Docs only: tooltips are easier to find.
- **Language guide:** the "Tooltips and open states" section starts with a rendered picture of a tooltip, an open select, an open date picker and a row menu. It's generated by `npm run docs`, so it always matches the renderer. The section also now says notes can't take tooltips.
- **Button page and the playground's Components tab:** a rendered tooltip example.
- **Components index:** a note that any element inside a screen can take `tooltip="…"`.

## 0.5.0

### Open states and tooltips

```tsquare
select "Country" value="Mexico" open options=[Canada, Mexico, United States]
input "Check-in" type=date value="Oct 14, 2026" open
button ghost leadingIcon=more-horizontal open menu=[{label=Rename icon=pencil}, Duplicate, Delete]
button secondary "Draft" tooltip="Saves without publishing"
```

- **Open states:** a select's options list, a date input's calendar and a button's menu now draw over the screen, covering what's below, as they would in the app.
  - Each opens below its element, or above when there isn't room, and stays inside its screen.
  - The date picker opens on the value's month with that day selected.
- **Menus on list rows and the navbar too:** `listitem "Budget.xlsx" open menu=[Rename, Move, Delete]` opens right-aligned under the row; a row with nothing at its end shows … for it. The navbar's menu opens under a ⋮, added after its actions unless the last one already is a ⋯/⋮ icon.
- **Tooltips:** `tooltip="…"` works on any element except a board or screen. It sits above the element (below it near the top of the screen), with its arrow pointing at the element.
- **Errors** when an open state has nothing to show: `open` without `options` or `menu`, or `open` on an input that isn't `type=date`.
- **How it works:** a board with any of these renders twice. The first pass measures where elements landed, and the second draws the overlays on top. Boards without them render once, exactly as before.

## 0.4.2

- **Toast corners:** `position` also takes `topLeft`, `topRight`, `bottomLeft` and `bottomRight`, besides `top` and `bottom` (centered, the default). Desktop apps often show toasts in a corner.

## 0.4.1

```tsquare
image map height=200 "Pickup"               # a map placeholder: roads and a pin, instead of the X
accordion "How long does shipping take?" open
  text "Orders arrive in 3–5 business days."
accordion "Can I return an item?"           # closed: only the title row
toast "Message sent" action="Undo" icon=check   # pinned to the bottom (above a tab bar), or position=top
```

- **Toast** is an overlay like Modal and Drawer: a direct child of a Screen, listed last.
- **Measured:** three new requests (a ride map, an FAQ, a "saved" message), two runs per model. All 12 outputs were valid and used the new pieces, except one Haiku run that drew a plain image labeled "Map". The prompt grew by about 195 tokens.
- **Breadcrumbs** don't need a component: `text "Home / Settings / Profile" sm muted`. The Text docs page now shows this.

## 0.4.0

### New components

```tsquare
chart line "Revenue"                              # line | bar | area | pie | donut, a placeholder shape
calendar "October 2026" range=[12, 18] marked=[3, 9]
input "Check-in" type=date value="Oct 14, 2026"   # calendar icon
input "Verification code" type=code value="4821"  # one box per digit (digits=6)
slider "Price" range=[50, 400]                    # any amounts; the track scales
progress "Uploading" value=40                     # also: progress circle, progress steps=4 step=2
pagination pages=12 current=3
bullets items=[Fast setup, No credit card]        # also: numbered, icon=check
bullets icon=check items=[Boards, {label="SSO" icon=x muted}]
```

- **Charts are placeholders:** they show the kind of chart, not data.
- **The calendar draws the real month** from its title ("October 2026" starts on a Thursday).
- **Bullets** take any Lucide icon. One item can be an object that changes its icon or greys it out (`muted`).
- **Inside `{…}`:**
  - a bare word turns an option on (`{label="SSO" muted}`);
  - an unquoted value can contain spaces (`{label=Custom domain icon=x}`).
- **Clear errors for values that contradict each other:** a step past the last step, a page past the last page, a day that isn't in the month, a range written backwards.
- **The accent color** also fills sliders, progress, completed steps, and the selected day and page. Charts stay gray.
- **The prompt** grew by about 480 tokens (2,670 → 3,150).

### Measured

- **The new components:** 7 requests that describe a screen without naming components, two runs each.
  - Sonnet: valid 14 of 14, and picked the right components every time (32 of 32 checks).
  - Haiku: valid 12 of 14, 30 of 32 checks.
- **The original 20 requests, with the new prompt:** Sonnet 100%, Haiku 65%, within its usual range. None of Haiku's failures involve the new components.

## 0.3.2

- **`grow` on Select**, like Input: `select "State" grow` fills the rest of a row. Sonnet wrote it in 5 of 9 eval runs, its only remaining mistake; with it, every stored Sonnet text output is valid.
- **Docs:** a new [Embedding](docs/embedding.md) page for Notion, GitHub and your own site, and the Radio page shows radios side by side (`stack row` + `radio`).
- **Tests and CI:** a test suite (`npm test`), run on Node 20, 22 and 24 for every pull request, plus a check that eval scores, docs and the skill match what's committed.
- `CHANGELOG.md` is now included in the npm package.

## 0.3.1

### Older wireframes are upgraded in one step

- All support for older syntax now lives in one module (`upgradeWireframe`, `upgradeSpec`), run before parsing. The parser, catalog and renderer only know the current language.
- **Links made before 0.3.0 render again** when a comment follows an element on the same line (`screen phone "Home"   # main`): the comment moves onto its own line. Text you write or paste still gets the error, so new comments go on their own line.
- `decodeWireframe` returns the upgraded text, so a decoded link always means what it did when it was made.

### Better suggestions for unknown icons

- Common guesses that aren't Lucide names now suggest what was meant: `compose` → `square-pen`, `call` → `phone`, `person` → `user`, `bag` → `shopping-bag`, `notification` → `bell`, `close` → `x`.
- Among equally close matches, the usual directions come first: `chevron` suggests `chevron-right, chevron-left, chevron-down, chevron-up`.
- On a list item, `trailingIcon=chevron` (or `toggle`, `avatar`…) says to write `trailing=chevron`, since that's a kind, not an icon.

## 0.3.0

### Renamed: `icon` is now `leadingIcon` on Button and ListItem

Buttons and list items take an icon on either side, so the prop names now say which side:

| Before | Now |
|---|---|
| `button "Download" icon=download` | `button "Download" leadingIcon=download` |
| (not possible) | `button "Next" trailingIcon=chevron-right` |
| `listitem "Inbox" leading=icon icon=inbox` | `listitem "Inbox" leadingIcon=inbox` |
| `listitem "Delete" trailing=icon trailingIcon=trash-2` | `listitem "Delete" trailingIcon=trash-2` |

- **Nothing breaks.** The old `icon=` spelling still works on both components, so existing files and shared render links render the same. `tsquare fmt` rewrites it to `leadingIcon=`. The prompt, the skill and the docs only teach the new names.
- **Buttons can have a trailing icon**, for Next, external links or dropdowns. Both sides work together.
- `leading` and `trailing` on ListItem stay as before. They pick what fills each side (`avatar`, `image`, `checkbox`, `chevron`, `badge`, `toggle`, …). An icon or text value implies its kind, so `leading=icon` and `trailing=icon` are optional.
- `icon` stays as it is on TabBar items (`{label=Home icon=house}`) and on the Icon component.

### Changed: comments go on their own line

A line that starts with `#` is a comment. Anywhere else, `#` is ordinary text, so order numbers, tags and hex colors need no quotes:

```tsquare
# the orders page
screen desktop "Orders"
  table columns=[Order, Customer] data=[[#1001, Ana Torres], [#1002, Ben Lee]]
```

- **Why:** comments used to start at any `#` after a space. That cut off `[#1001, Ana Torres]` and broke the table, which happened to Sonnet in 3 of 4 eval runs. Across 160 eval outputs, models never wrote a comment.
- **Upgrading:** a comment after an element on the same line (`screen phone "Home"   # main`) is now an error that tells you to move it to its own line. Nothing is dropped silently.

### Clearer errors for props on the wrong component

When a word or prop belongs to a different component, the error now says which one:

```
Input: fullWidth is a Button prop, not an Input one; an Input already fills its width (width=… sets a fixed one), so remove it
Card has no prop "border": border is a Stack prop, not a Card one
```

A prop or list wrapped onto its own line says where it belongs, instead of "unknown component":

```
trailing=…: props go on the same line as their component; move it to the end of line 15
a list must stay on one line; join this to line 6
```

### Playground

- A CodeMirror editor: highlighting, autocomplete for components, options, props, Lucide icons and accent colors, and problems underlined on their line.
- Light and dark themes.
- Zoom and pan, zoom to a single screen, full screen and a resizable split.
- Copy link: share link, SVG/PNG image links, Markdown and HTML snippets.
- An examples gallery with thumbnails.

### Library

- `encodeWireframe` / `decodeWireframe` for share and render links.
- `boardLayout()` returns the board size and each screen's position.

### List items: a value implies its kind

- `trailingIcon=trash-2` without `trailing=icon` used to render nothing, silently. Now the value implies the kind.
- A value that contradicts an explicit kind is an error that names the fix, for example: `leadingIcon only shows with leading=icon (this item has leading=avatar); remove one of them`.

### Examples

- New: `sign-in`, `dashboard`, `checkout` and `states`.
