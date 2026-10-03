# Changelog

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
