# tsquare components

Every component and its props, generated from the catalog. All props are optional unless marked required. "main text" is the prop a quoted string fills.

### Board
Root canvas (artboard). Holds Screens side by side, plus optional Notes. Must be the root element.
- title: string (main text)
- layout: "row" | "grid" — row = all screens side by side; grid = wrap every `columns` screens
- columns: number
- gap: number
- padding: number
- accent: string — The one UI color: primary buttons, solid badges, checked controls, toggles, active tabs, ghost buttons. blue, indigo, violet, pink, red, orange, green, teal, or a hex color like #1a73e8. Omit for grayscale.

### Screen
One view of the product in a device frame. Children stack vertically.
- name: string (main text) — Label shown above the screen
- device: "phone" | "tablet" | "desktop" | "custom"
- width: number — Only for device=custom
- height: number — Only for device=custom
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

### Image
Image placeholder: a box with an X through it.
- height: number
- width: number | string — Default fills the container width
- label: string (main text)
- rounded: boolean

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
- icon: string — Lucide icon name in kebab-case, e.g. menu, search, arrow-left, settings, bell, user
- fullWidth: boolean

### Input
Text field with optional label. Set multiline for a textarea.
- label: string (main text)
- placeholder: string
- value: string
- type: "text" | "password" | "search" | "email"
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
- width: number | string — Fixed width, e.g. 320. Default fills the space.

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

### List
Vertical list of ListItems.
- dividers: boolean
- grow: boolean

### ListItem
Row in a List. Omit title for a placeholder bar.
- title: string (main text)
- subtitle: string
- leading: "none" | "icon" | "avatar" | "image" | "checkbox"
- icon: string — Lucide icon name in kebab-case, e.g. menu, search, arrow-left, settings, bell, user
- trailing: "none" | "chevron" | "toggle" | "text" | "badge" | "icon"
- trailingText: string
- trailingIcon: string — Lucide icon name in kebab-case, e.g. menu, search, arrow-left, settings, bell, user

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
