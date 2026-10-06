import { defineCatalog } from "@json-render/core";
import { z } from "zod";
import { ACCENTS, accentMessage, isAccent } from "./colors.js";
import { isIcon, unknownIconMessage } from "./icons.js";
import { wireframeSchema } from "./schema.js";

// Every prop is optional so hand-written specs stay short.
const o = <T extends z.ZodType>(t: T) => t.nullish();

const align = z.enum(["start", "center", "end", "stretch"]);
const justify = z.enum(["start", "center", "end", "between", "around"]);
const iconName = z
  .string()
  .refine(isIcon, { error: (iss) => unknownIconMessage(String(iss.input)) })
  .describe("Lucide icon name in kebab-case, e.g. menu, search, arrow-left, settings, bell, user");

const day = z.number().int().min(1).max(31);
const percent = z.number().min(0).max(100);
const flowEnd = z.enum(["none", "arrow", "dot", "circle", "bar"]);

/** A menu item: text, or {label icon}. */
const menuItem = z.union([z.string(), z.strictObject({ label: z.string(), icon: o(iconName) })]);

/**
 * Props every element except Board and Screen accepts, on top of its own. Kept out of each
 * component's schema so the prompt describes them once.
 */
export const UNIVERSAL_PROPS = {
  tooltip: z.string().describe("Show a tooltip with this text next to the element"),
} as const;
/**
 * An element's id, written `#name` after it in text: what flow arrows point at. Any element can
 * have one except the Board, Notes and Flows themselves; Screens can.
 */
export const ID_PATTERN = /^[A-Za-z][\w-]*$/;
export const takesId = (type: string) => type !== "Board" && type !== "Note" && type !== "Flow";

/** Not the canvas (Board, Screen) or its annotations (Note): a tooltip there would be meaningless. */
export const takesUniversalProps = (type: string) => type !== "Board" && type !== "Screen" && type !== "Note" && type !== "Flow";

/** Why a universal prop isn't allowed here, and what to do instead. */
export function universalPropMessage(type: string, key: string) {
  const base = `${key}s go on elements inside a screen`;
  return type === "Note" ? `${base}; a note is already an annotation, so put the text in the note` : `${base}, not on the ${type.toLowerCase()} itself`;
}

/** A bullet: plain text, or {label icon muted} to override the list's icon for one line. */
const bulletItem = z.union([
  z.string(),
  // strict: a misspelled key is an error, not silently dropped
  z.strictObject({ label: z.string(), icon: o(iconName), muted: o(z.boolean()) }),
]);

export const componentDefinitions = {
  // ── Canvas ────────────────────────────────────────────────────────────
  Board: {
    props: z.object({
      title: o(z.string()),
      layout: o(z.enum(["row", "grid"])).describe("row = all screens side by side; grid = wrap every `columns` screens"),
      columns: o(z.number().int().min(1)),
      gap: o(z.number()),
      padding: o(z.number()),
      accent: o(z.string().refine(isAccent, { error: (iss) => accentMessage(String(iss.input)) })).describe(
        `The one UI color: primary buttons, solid badges, checked controls, toggles, sliders, progress, selected days and pages, active tabs, ghost buttons. ${Object.keys(ACCENTS).join(", ")}, or a hex color like #1a73e8. Omit for grayscale.`,
      ),
    }),
    slots: ["default"],
    description: "Root canvas (artboard). Holds Screens side by side, plus optional Notes and Flow lines. Must be the root element.",
    example: { title: "Checkout flow", layout: "row", gap: 64 },
  },
  Screen: {
    props: z.object({
      name: o(z.string()).describe("Label shown above the screen"),
      device: o(z.enum(["phone", "tablet", "desktop", "custom"])),
      width: o(z.number()).describe("Overrides the device width"),
      height: o(z.number()).describe("Overrides the device height, e.g. height=1400 for a long scrolling page"),
      chrome: o(z.boolean()).describe("Phone status bar / desktop browser bar. Default true for phone and desktop."),
      padding: o(z.number()),
      gap: o(z.number()),
    }),
    slots: ["default"],
    description: "One view of the product in a device frame. Children stack vertically.",
    example: { name: "Home", device: "phone" },
  },
  Note: {
    props: z.object({
      text: z.string(),
      color: o(z.enum(["yellow", "blue", "pink", "green"])),
      width: o(z.number()),
    }),
    slots: [],
    description: "Sticky-note annotation. Put it on the Board beside screens, or inside a Screen next to what it explains.",
    example: { text: "Empty state TBD", color: "yellow" },
  },
  Flow: {
    props: z.object({
      from: z.string().describe("The id where the arrow starts (written before ->)"),
      to: z.string().describe("The id it points at (written after ->)"),
      label: o(z.string()),
      start: o(flowEnd).describe("Default none"),
      end: o(flowEnd).describe("Default arrow"),
      line: o(z.enum(["rounded", "hard", "curved", "straight"])).describe("Default rounded: right angles with rounded corners"),
      dashed: o(z.boolean()),
      color: o(z.string().refine((v) => v === "accent" || isAccent(v), { error: (iss) => `${accentMessage(String(iss.input))}, or accent for the board's` })).describe(
        `Default gray. ${Object.keys(ACCENTS).join(", ")}, a hex color, or accent for the board's`,
      ),
    }),
    slots: [],
    description:
      'An arrow between two elements or screens, named with #id. Write each flow on its own line after the screens, indented like a screen (not inside one): flow signin -> home "Tap Sign in".',
    example: { from: "signin", to: "home", label: "Tap Sign in" },
  },

  // ── Layout ────────────────────────────────────────────────────────────
  Stack: {
    props: z.object({
      direction: o(z.enum(["row", "column"])),
      gap: o(z.number()),
      padding: o(z.number()),
      align: o(align),
      justify: o(justify),
      wrap: o(z.boolean()),
      grow: o(z.boolean()).describe("Fill remaining space in the parent"),
      width: o(z.union([z.number(), z.string()])).describe("Fixed width, e.g. 240 for a sidebar"),
      border: o(z.enum(["none", "right", "left", "top", "bottom", "all"])),
      fill: o(z.boolean()).describe("Light gray background"),
    }),
    slots: ["default"],
    description: "Flex container. The main layout primitive (rows, columns, sidebars, toolbars).",
    example: { direction: "row", gap: 12, align: "center" },
  },
  Grid: {
    props: z.object({
      columns: z.number().int().min(1),
      gap: o(z.number()),
      padding: o(z.number()),
    }),
    slots: ["default"],
    description: "Equal-width columns that wrap. Good for card grids and galleries.",
    example: { columns: 3, gap: 16 },
  },
  Card: {
    props: z.object({
      title: o(z.string()),
      padding: o(z.number()),
      gap: o(z.number()),
      variant: o(z.enum(["outline", "filled"])),
      grow: o(z.boolean()),
      width: o(z.union([z.number(), z.string()])).describe("Fixed width, e.g. 320. Default fills the space."),
    }),
    slots: ["default"],
    description: "Bordered container with optional title. Children stack vertically.",
    example: { title: "Revenue", variant: "outline" },
  },
  Accordion: {
    props: z.object({
      title: o(z.string()),
      open: o(z.boolean()).describe("Show the children. Default closed: only the title row"),
    }),
    slots: ["default"],
    description: "Collapsible section: a title row with a chevron, children below when open. Stack several for an FAQ.",
    example: { title: "Shipping", open: true },
  },
  Divider: {
    props: z.object({ vertical: o(z.boolean()) }),
    slots: [],
    description: "Thin separator line.",
    example: {},
  },
  Spacer: {
    props: z.object({
      size: o(z.number()).describe("Fixed size in px. Omit to fill remaining space."),
    }),
    slots: [],
    description: "Empty space. Without a size it grows to push siblings apart.",
    example: { size: 16 },
  },

  // ── Content ───────────────────────────────────────────────────────────
  Heading: {
    props: z.object({
      text: z.string(),
      level: o(z.union([z.literal(1), z.literal(2), z.literal(3)])),
      align: o(z.enum(["left", "center", "right"])),
    }),
    slots: [],
    description: "Heading text, level 1 (largest) to 3.",
    example: { text: "Welcome back", level: 1 },
  },
  Text: {
    props: z.object({
      text: o(z.string()),
      lines: o(z.number().int().min(1)).describe("Draw N placeholder lines instead of real text"),
      size: o(z.enum(["sm", "md", "lg"])),
      muted: o(z.boolean()),
      bold: o(z.boolean()),
      align: o(z.enum(["left", "center", "right"])),
    }),
    slots: [],
    description: "Body text, or placeholder lines when `lines` is set and `text` is not.",
    example: { lines: 3 },
  },
  Bullets: {
    props: z.object({
      items: z.array(bulletItem).describe("Text, or {label icon muted} to change one line, e.g. {label=SSO icon=x muted}"),
      numbered: o(z.boolean()).describe("1. 2. 3. instead of dots"),
      icon: o(iconName).describe("A Lucide icon instead of dots, e.g. check for a feature list"),
    }),
    slots: [],
    description: "Bulleted, numbered or icon list of short lines.",
    example: { items: ["Fast setup", "No credit card"] },
  },
  Image: {
    props: z.object({
      height: o(z.number()),
      width: o(z.union([z.number(), z.string()])).describe("Default fills the container width"),
      label: o(z.string()),
      rounded: o(z.boolean()),
      kind: o(z.enum(["photo", "map"])).describe("map draws roads and a pin instead of the X"),
    }),
    slots: [],
    description: "Image placeholder: a box with an X through it, or a map.",
    example: { height: 180, label: "Hero photo" },
  },
  Chart: {
    props: z.object({
      kind: o(z.enum(["line", "bar", "area", "pie", "donut"])).describe("Default line"),
      title: o(z.string()),
      height: o(z.number()).describe("Default 180"),
      width: o(z.union([z.number(), z.string()])).describe("Default fills the container width"),
    }),
    slots: [],
    description: "Chart placeholder: a generic line, bar, area, pie or donut shape, no data.",
    example: { kind: "bar", title: "Signups" },
  },
  Icon: {
    props: z.object({
      name: o(iconName),
      size: o(z.number()),
    }),
    slots: [],
    description: "Line icon from Lucide, or a brand logo (brand-google, brand-apple, …).",
    example: { name: "search", size: 20 },
  },
  Avatar: {
    props: z.object({
      initials: o(z.string()),
      size: o(z.number()),
    }),
    slots: [],
    description: "Round avatar with initials or a person silhouette.",
    example: { initials: "JD", size: 40 },
  },
  Badge: {
    props: z.object({
      label: z.string(),
      variant: o(z.enum(["solid", "outline"])),
      tone: o(z.enum(["neutral", "success", "warning", "danger"])).describe("Status color. Default neutral (the accent for solid badges)"),
    }),
    slots: [],
    description: "Small pill label for counts or statuses.",
    example: { label: "New", variant: "solid" },
  },

  // ── Controls ──────────────────────────────────────────────────────────
  Button: {
    props: z.object({
      label: o(z.string()),
      variant: o(z.enum(["primary", "secondary", "ghost"])),
      size: o(z.enum(["sm", "md", "lg"])),
      leadingIcon: o(iconName).describe("Lucide icon before the label, e.g. chevron-left for Back"),
      trailingIcon: o(iconName).describe("Lucide icon after the label, e.g. chevron-right for Next"),
      fullWidth: o(z.boolean()),
      menu: o(z.array(menuItem)).describe("Dropdown menu items, shown below the button when open"),
      open: o(z.boolean()).describe("Show the menu"),
    }),
    slots: [],
    description: "Button. Primary is filled, secondary is outlined, ghost is text only. With menu and open, a dropdown menu.",
    example: { label: "Continue", variant: "primary", fullWidth: true },
  },
  Input: {
    props: z.object({
      label: o(z.string()),
      placeholder: o(z.string()),
      value: o(z.string()),
      type: o(z.enum(["text", "password", "search", "email", "date", "code"])).describe("date shows a calendar icon; code draws one box per digit"),
      digits: o(z.number().int().min(2).max(10)).describe("Boxes for type=code, default 6"),
      open: o(z.boolean()).describe("type=date: show the calendar below the field"),
      multiline: o(z.number().int().min(1)).describe("Number of rows; 2 or more makes a textarea"),
      helper: o(z.string()),
      error: o(z.boolean()).describe("Validation error: red border and red helper text"),
      grow: o(z.boolean()).describe("Fill the remaining space in a row"),
      width: o(z.union([z.number(), z.string()])).describe("Fixed width, e.g. 320. Default fills the space."),
    }),
    slots: [],
    description: "Text field with optional label. Set multiline for a textarea.",
    example: { label: "Email", placeholder: "you@example.com" },
  },
  Checkbox: {
    props: z.object({ label: o(z.string()), checked: o(z.boolean()) }),
    slots: [],
    description: "Checkbox with label.",
    example: { label: "Remember me", checked: true },
  },
  Radio: {
    props: z.object({ label: o(z.string()), checked: o(z.boolean()) }),
    slots: [],
    description: "Radio button with label.",
    example: { label: "Monthly", checked: true },
  },
  Toggle: {
    props: z.object({ label: o(z.string()), on: o(z.boolean()) }),
    slots: [],
    description: "On/off switch with label on the left.",
    example: { label: "Notifications", on: true },
  },
  Select: {
    props: z.object({
      label: o(z.string()),
      value: o(z.string()),
      placeholder: o(z.string()),
      options: o(z.array(z.string())).describe("The choices, shown below the field when open"),
      open: o(z.boolean()).describe("Show the options list"),
      grow: o(z.boolean()).describe("Fill the remaining space in a row"),
      width: o(z.union([z.number(), z.string()])).describe("Fixed width, e.g. 320. Default fills the space."),
    }),
    slots: [],
    description: "Dropdown field. With options and open, the list shows below it.",
    example: { label: "Country", value: "United States" },
  },
  Slider: {
    props: z.object({
      label: o(z.string()),
      value: o(z.number().min(0)).describe("Handle position: 0 to 100, or any amount (the track scales to fit)"),
      range: o(z.tuple([z.number().min(0), z.number().min(0)])).describe("Two handles instead, e.g. [20, 80] or [50, 400]"),
    }),
    slots: [],
    description: "Slider with one handle, or two with `range`.",
    example: { label: "Volume", value: 30 },
  },
  Progress: {
    props: z.object({
      label: o(z.string()),
      value: o(percent).describe("Percent done"),
      shape: o(z.enum(["bar", "circle"])).describe("Default bar; circle is a ring with the percent inside"),
      steps: o(z.number().int().min(2).max(10)).describe("Draw a stepper with this many steps instead"),
      step: o(z.number().int().min(1)).describe("The current step, with steps"),
    }),
    slots: [],
    description: "Progress bar, ring (circle), or stepper (steps).",
    example: { label: "Uploading", value: 40 },
  },
  Calendar: {
    props: z.object({
      month: o(z.string()).describe('Month and year, e.g. "October 2026"; the days match that month'),
      selected: o(day),
      range: o(z.tuple([day, day])).describe("Selected days, e.g. [12, 18]"),
      marked: o(z.array(day)).describe("Days with a dot, e.g. events"),
    }),
    slots: [],
    description: "Month calendar.",
    example: { month: "October 2026", selected: 14 },
  },

  // ── Navigation & data ─────────────────────────────────────────────────
  NavBar: {
    props: z.object({
      title: o(z.string()),
      leading: o(z.enum(["none", "menu", "back", "close", "logo"])),
      actions: o(z.array(iconName)).describe("Icon names shown on the right"),
      align: o(z.enum(["left", "center"])),
      menu: o(z.array(menuItem)).describe("A menu under the last action (adds ⋮ if needed), shown when open"),
      open: o(z.boolean()).describe("Show the menu"),
    }),
    slots: [],
    description: "Top app bar. Place first in a Screen.",
    example: { title: "Inbox", leading: "menu", actions: ["search", "more-vertical"] },
  },
  TabBar: {
    props: z.object({
      items: z.array(z.object({ label: z.string(), icon: o(iconName) })),
      active: o(z.number().int()),
    }),
    slots: [],
    description: "Bottom tab bar for mobile. Place last in a Screen (before overlays).",
    example: { items: [{ label: "Home", icon: "home" }, { label: "Profile", icon: "user" }], active: 0 },
  },
  Tabs: {
    props: z.object({
      items: z.array(z.string()),
      active: o(z.number().int()),
    }),
    slots: [],
    description: "In-page tabs with an underline on the active one.",
    example: { items: ["Overview", "Activity", "Settings"], active: 0 },
  },
  Pagination: {
    props: z.object({
      pages: z.number().int().min(1),
      current: o(z.number().int().min(1)).describe("Default 1"),
    }),
    slots: [],
    description: "Page numbers with previous and next.",
    example: { pages: 12, current: 3 },
  },
  List: {
    props: z.object({ dividers: o(z.boolean()), grow: o(z.boolean()) }),
    slots: ["default"],
    description: "Vertical list of ListItems.",
    example: { dividers: true },
  },
  ListItem: {
    props: z.object({
      title: o(z.string()),
      subtitle: o(z.string()),
      leading: o(z.enum(["none", "icon", "avatar", "image", "checkbox"])),
      leadingIcon: o(iconName).describe("Lucide icon on the left; setting it implies leading=icon"),
      trailing: o(z.enum(["none", "chevron", "toggle", "text", "badge", "icon"])),
      trailingText: o(z.string()).describe("Text for trailing=text or badge; setting it implies trailing=text"),
      trailingIcon: o(iconName).describe("Lucide icon on the right; setting it implies trailing=icon"),
      menu: o(z.array(menuItem)).describe("A menu for the row (shows … on the right if nothing else is there), shown when open"),
      open: o(z.boolean()).describe("Show the menu"),
    }),
    slots: [],
    description: "Row in a List. Omit title for a placeholder bar.",
    example: { title: "Account", subtitle: "Email, password", leadingIcon: "user", trailing: "chevron" },
  },
  Table: {
    props: z.object({
      columns: z.array(z.string()),
      rows: o(z.number().int()).describe("Placeholder rows when `data` is not given"),
      data: o(z.array(z.array(z.string()))),
    }),
    slots: [],
    description: "Table with headers. Rows are placeholder bars unless `data` is given.",
    example: { columns: ["Name", "Status", "Date"], rows: 5 },
  },

  // ── Overlays ──────────────────────────────────────────────────────────
  Modal: {
    props: z.object({
      title: o(z.string()),
      width: o(z.number()),
      scrim: o(z.boolean()).describe("Dim the screen behind. Default true."),
    }),
    slots: ["default"],
    description: "Centered dialog over the screen. Must be a direct child of a Screen, listed last.",
    example: { title: "Delete note?", width: 320 },
  },
  Drawer: {
    props: z.object({
      side: o(z.enum(["left", "right", "bottom"])),
      title: o(z.string()),
      size: o(z.number()).describe("Width for left/right, height for bottom"),
      scrim: o(z.boolean()).describe("Dim the screen behind. Default true."),
      handle: o(z.boolean()).describe("Grab handle on bottom sheets. Default true for bottom."),
    }),
    slots: ["default"],
    description:
      "Panel sliding in from an edge: side nav (left), filters/details (right), or bottom sheet. Must be a direct child of a Screen, listed last.",
    example: { side: "left", title: "Menu", size: 300 },
  },
  Toast: {
    props: z.object({
      text: o(z.string()),
      action: o(z.string()).describe('A text button, e.g. "Undo"'),
      icon: o(iconName),
      position: o(z.enum(["bottom", "top", "topLeft", "topRight", "bottomLeft", "bottomRight"])).describe("Default bottom (centered), above a TabBar"),
    }),
    slots: [],
    description: "Short message over the screen, e.g. after saving. Must be a direct child of a Screen, listed last.",
    example: { text: "Message sent", action: "Undo" },
  },
};

export const catalog = defineCatalog(wireframeSchema, {
  components: componentDefinitions,
});

export type ComponentName = keyof typeof componentDefinitions;

/**
 * A ListItem's effective leading and trailing kinds. Setting the value implies
 * the kind (leadingIcon → leading=icon, trailingIcon → trailing=icon,
 * trailingText → trailing=text), so writing only the value still shows it.
 * The renderer and checkSpec both use this, so they can't disagree.
 */
export function listItemEnds(p: { leading?: string | null; leadingIcon?: string | null; trailing?: string | null; trailingIcon?: string | null; trailingText?: string | null }) {
  return {
    leading: p.leading ?? (p.leadingIcon ? "icon" : undefined),
    trailing: p.trailing ?? (p.trailingIcon ? "icon" : p.trailingText ? "text" : undefined),
  };
}
