# Colors

Wireframes are grayscale, so they read as structure rather than design. There are three deliberate exceptions in the UI, and no other UI color props. Sticky [notes](#notes) have their own colors, because they annotate the wireframe rather than being part of it.

## Accent

Set one accent color on the board:

```tsquare
board "Checkout" accent=blue
```

It fills primary buttons, solid badges, checked checkboxes and radios, and toggles that are on. It also colors the active tab, the active tab-bar item and ghost button text. Everything else stays gray.

| Name | Color |
|---|---|
| `blue` | `#2563eb` |
| `indigo` | `#4f46e5` |
| `violet` | `#7c3aed` |
| `pink` | `#db2777` |
| `red` | `#dc2626` |
| `orange` | `#c2410c` |
| `green` | `#15803d` |
| `teal` | `#0f766e` |

Each named accent keeps white text readable on it (contrast of at least 4.5:1).

A hex color also works, for matching a brand: `accent=#1a73e8`. With a light color such as `#facc15`, text on the accent turns dark, and accent-colored text on white is darkened so it stays readable.

## Badge tones

For status badges, set a `tone`: `success`, `warning` or `danger`. Tones don't change with the accent.

```tsquare
    badge "Paid" tone=success
    badge "Pending" tone=warning
    badge "Failed" tone=danger
    badge outline "Failed" tone=danger
```

## Input errors

`error` gives an input a red border and red helper text, for validation states:

```tsquare
    input "Email" value="dana@" error helper="Enter a valid email"
```

## Notes

Sticky notes have their own colors: `yellow` (the default), `blue`, `pink` and `green`. They're for annotating the wireframe (open questions, TBDs, comments for reviewers), so they don't follow the accent. See [note](components/note.md).

```tsquare
  note "Copy TBD" color=pink
```
