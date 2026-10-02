# Changelog

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
