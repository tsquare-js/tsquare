# Components

Every component, grouped as in the playground. Each page has a rendered example, its source, how to write it, and its props. These pages are generated from the catalog by `npm run docs`.

Any element inside a screen can also take `tooltip="…"`; see [Tooltips and open states](../language.md#tooltips-and-open-states).

## Canvas

| Component | What it's for |
|---|---|
| [board](board.md) | Root canvas (artboard). Holds Screens side by side, plus optional Notes and Flow lines. Must be the root element. |
| [screen](screen.md) | One view of the product in a device frame. Children stack vertically. |
| [note](note.md) | Sticky-note annotation. Put it on the Board beside screens, or inside a Screen next to what it explains. |
| [flow](flow.md) | An arrow between two elements or screens, named with #id. Write each flow on its own line after the screens, indented like a screen (not inside one): flow signin -> home "Tap Sign in". |

## Layout

| Component | What it's for |
|---|---|
| [stack](stack.md) | Flex container. The main layout primitive (rows, columns, sidebars, toolbars). |
| [grid](grid.md) | Equal-width columns that wrap. Good for card grids and galleries. |
| [card](card.md) | Bordered container with optional title. Children stack vertically. |
| [accordion](accordion.md) | Collapsible section: a title row with a chevron, children below when open. Stack several for an FAQ. |
| [divider](divider.md) | Thin separator line. |
| [spacer](spacer.md) | Empty space. Without a size it grows to push siblings apart. |

## Content

| Component | What it's for |
|---|---|
| [heading](heading.md) | Heading text, level 1 (largest) to 3. |
| [text](text.md) | Body text, or placeholder lines when `lines` is set and `text` is not. |
| [bullets](bullets.md) | Bulleted, numbered or icon list of short lines. |
| [image](image.md) | Image placeholder: a box with an X through it, or a map. |
| [chart](chart.md) | Chart placeholder: a generic line, bar, area, pie or donut shape, no data. |
| [icon](icon.md) | Line icon from Lucide, or a brand logo (brand-google, brand-apple, …). |
| [avatar](avatar.md) | Round avatar with initials or a person silhouette. |
| [badge](badge.md) | Small pill label for counts or statuses. |

## Controls

| Component | What it's for |
|---|---|
| [button](button.md) | Button. Primary is filled, secondary is outlined, ghost is text only. With menu and open, a dropdown menu. |
| [input](input.md) | Text field with optional label. Set multiline for a textarea. |
| [checkbox](checkbox.md) | Checkbox with label. |
| [radio](radio.md) | Radio button with label. |
| [toggle](toggle.md) | On/off switch with label on the left. |
| [select](select.md) | Dropdown field. With options and open, the list shows below it. |
| [slider](slider.md) | Slider with one handle, or two with `range`. |
| [progress](progress.md) | Progress bar, ring (circle), or stepper (steps). |
| [calendar](calendar.md) | Month calendar. |

## Navigation & data

| Component | What it's for |
|---|---|
| [navbar](navbar.md) | Top app bar. Place first in a Screen. |
| [tabbar](tabbar.md) | Bottom tab bar for mobile. Place last in a Screen (before overlays). |
| [tabs](tabs.md) | In-page tabs with an underline on the active one. |
| [pagination](pagination.md) | Page numbers with previous and next. |
| [list](list.md) | Vertical list of ListItems. |
| [listitem](listitem.md) | Row in a List. Omit title for a placeholder bar. |
| [table](table.md) | Table with headers. Rows are placeholder bars unless `data` is given. |

## Overlays

| Component | What it's for |
|---|---|
| [modal](modal.md) | Centered dialog over the screen. Must be a direct child of a Screen, listed last. |
| [drawer](drawer.md) | Panel sliding in from an edge: side nav (left), filters/details (right), or bottom sheet. Must be a direct child of a Screen, listed last. |
| [toast](toast.md) | Short message over the screen, e.g. after saving. Must be a direct child of a Screen, listed last. |
