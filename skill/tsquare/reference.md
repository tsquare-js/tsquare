# tsquare components

Every component and its props, generated from the catalog. All props are optional unless marked required. "main text" is the prop a quoted string fills.

### Board
Root canvas (artboard). Holds Screens side by side, plus optional Notes. Must be the root element.
- title: string (main text)
- layout: "row" | "grid" — row = all screens side by side; grid = wrap every `columns` screens
- columns: number
- gap: number
- padding: number
- accent: string — The one UI color: primary buttons, solid badges, checked controls, toggles, sliders, progress, selected days and pages, active tabs, ghost buttons. blue, indigo, violet, pink, red, orange, green, teal, or a hex color like #1a73e8. Omit for grayscale.

### Screen
One view of the product in a device frame. Children stack vertically.
- name: string (main text) — Label shown above the screen
- device: "phone" | "tablet" | "desktop" | "custom"
- width: number — Overrides the device width
- height: number — Overrides the device height, e.g. height=1400 for a long scrolling page
- chrome: boolean — Phone status bar / desktop browser bar. Default true for phone and desktop.
- padding: number
- gap: number

### Note
Sticky-note annotation. Put it on the Board beside screens, or inside a Screen next to what it explains.
- text (required): string (main text)
- color: "yellow" | "blue" | "pink" | "green"
- width: number

### Stack
Flex container. The main layout primitive (rows, columns, sidebars, toolbars).
- direction: "row" | "column"
- gap: number
- padding: number
- align: "start" | "center" | "end" | "stretch"
- justify: "start" | "center" | "end" | "between" | "around"
- wrap: boolean
- grow: boolean — Fill remaining space in the parent
- width: number | string — Fixed width, e.g. 240 for a sidebar
- border: "none" | "right" | "left" | "top" | "bottom" | "all"
- fill: boolean — Light gray background

### Grid
Equal-width columns that wrap. Good for card grids and galleries.
- columns (required): number
- gap: number
- padding: number

### Card
Bordered container with optional title. Children stack vertically.
- title: string (main text)
- padding: number
- gap: number
- variant: "outline" | "filled"
- grow: boolean
- width: number | string — Fixed width, e.g. 320. Default fills the space.

### Divider
Thin separator line.
- vertical: boolean

### Spacer
Empty space. Without a size it grows to push siblings apart.
- size: number — Fixed size in px. Omit to fill remaining space.

### Heading
Heading text, level 1 (largest) to 3.
- text (required): string (main text)
- level: 1 | 2 | 3
- align: "left" | "center" | "right"

### Text
Body text, or placeholder lines when `lines` is set and `text` is not.
- text: string (main text)
- lines: number — Draw N placeholder lines instead of real text
- size: "sm" | "md" | "lg"
- muted: boolean
- bold: boolean
- align: "left" | "center" | "right"

### Bullets
Bulleted, numbered or icon list of short lines.
- items (required): array of string | { label: string, icon: string, muted: boolean } — Text, or {label icon muted} to change one line, e.g. {label=SSO icon=x muted}
- numbered: boolean — 1. 2. 3. instead of dots
- icon: string — A Lucide icon instead of dots, e.g. check for a feature list

### Image
Image placeholder: a box with an X through it.
- height: number
- width: number | string — Default fills the container width
- label: string (main text)
- rounded: boolean

### Chart
Chart placeholder: a generic line, bar, area, pie or donut shape, no data.
- kind: "line" | "bar" | "area" | "pie" | "donut" — Default line
- title: string (main text)
- height: number — Default 180
- width: number | string — Default fills the container width

### Icon
Line icon from Lucide.
- name: string (main text) — Lucide icon name in kebab-case, e.g. menu, search, arrow-left, settings, bell, user
- size: number

### Avatar
Round avatar with initials or a person silhouette.
- initials: string (main text)
- size: number

### Badge
Small pill label for counts or statuses.
- label (required): string (main text)
- variant: "solid" | "outline"
- tone: "neutral" | "success" | "warning" | "danger" — Status color. Default neutral (the accent for solid badges)

### Button
Button. Primary is filled, secondary is outlined, ghost is text only.
- label: string (main text)
- variant: "primary" | "secondary" | "ghost"
- size: "sm" | "md" | "lg"
- leadingIcon: string — Lucide icon before the label, e.g. chevron-left for Back
- trailingIcon: string — Lucide icon after the label, e.g. chevron-right for Next
- fullWidth: boolean

### Input
Text field with optional label. Set multiline for a textarea.
- label: string (main text)
- placeholder: string
- value: string
- type: "text" | "password" | "search" | "email" | "date" | "code" — date shows a calendar icon; code draws one box per digit
- digits: number — Boxes for type=code, default 6
- multiline: number — Number of rows; 2 or more makes a textarea
- helper: string
- error: boolean — Validation error: red border and red helper text
- grow: boolean — Fill the remaining space in a row
- width: number | string — Fixed width, e.g. 320. Default fills the space.

### Checkbox
Checkbox with label.
- label: string (main text)
- checked: boolean

### Radio
Radio button with label.
- label: string (main text)
- checked: boolean

### Toggle
On/off switch with label on the left.
- label: string (main text)
- on: boolean

### Select
Dropdown field (closed state).
- label: string (main text)
- value: string
- placeholder: string
- grow: boolean — Fill the remaining space in a row
- width: number | string — Fixed width, e.g. 320. Default fills the space.

### Slider
Slider with one handle, or two with `range`.
- label: string (main text)
- value: number — Handle position: 0 to 100, or any amount (the track scales to fit)
- range: [number, number] — Two handles instead, e.g. [20, 80] or [50, 400]

### Progress
Progress bar, ring (circle), or stepper (steps).
- label: string (main text)
- value: number — Percent done
- shape: "bar" | "circle" — Default bar; circle is a ring with the percent inside
- steps: number — Draw a stepper with this many steps instead
- step: number — The current step, with steps

### Calendar
Month calendar.
- month: string (main text) — Month and year, e.g. "October 2026"; the days match that month
- selected: number
- range: [number, number] — Selected days, e.g. [12, 18]
- marked: array of number — Days with a dot, e.g. events

### NavBar
Top app bar. Place first in a Screen.
- title: string (main text)
- leading: "none" | "menu" | "back" | "close" | "logo"
- actions: array of string — Icon names shown on the right
- align: "left" | "center"

### TabBar
Bottom tab bar for mobile. Place last in a Screen (before overlays).
- items (required): array of { label: string, icon: string }
- active: number

### Tabs
In-page tabs with an underline on the active one.
- items (required): array of string
- active: number

### Pagination
Page numbers with previous and next.
- pages (required): number
- current: number — Default 1

### List
Vertical list of ListItems.
- dividers: boolean
- grow: boolean

### ListItem
Row in a List. Omit title for a placeholder bar.
- title: string (main text)
- subtitle: string
- leading: "none" | "icon" | "avatar" | "image" | "checkbox"
- leadingIcon: string — Lucide icon on the left; setting it implies leading=icon
- trailing: "none" | "chevron" | "toggle" | "text" | "badge" | "icon"
- trailingText: string — Text for trailing=text or badge; setting it implies trailing=text
- trailingIcon: string — Lucide icon on the right; setting it implies trailing=icon

### Table
Table with headers. Rows are placeholder bars unless `data` is given.
- columns (required): array of string
- rows: number — Placeholder rows when `data` is not given
- data: array of array of string

### Modal
Centered dialog over the screen. Must be a direct child of a Screen, listed last.
- title: string (main text)
- width: number
- scrim: boolean — Dim the screen behind. Default true.

### Drawer
Panel sliding in from an edge: side nav (left), filters/details (right), or bottom sheet. Must be a direct child of a Screen, listed last.
- side: "left" | "right" | "bottom"
- title: string (main text)
- size: number — Width for left/right, height for bottom
- scrim: boolean — Dim the screen behind. Default true.
- handle: boolean — Grab handle on bottom sheets. Default true for bottom.
