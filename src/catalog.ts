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
        `The one UI color: primary buttons, solid badges, checked controls, toggles, active tabs, ghost buttons. ${Object.keys(ACCENTS).join(", ")}, or a hex color like #1a73e8. Omit for grayscale.`,
      ),
    }),
    slots: ["default"],
    description: "Root canvas (artboard). Holds Screens side by side, plus optional Notes. Must be the root element.",
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
  Image: {
    props: z.object({
      height: o(z.number()),
      width: o(z.union([z.number(), z.string()])).describe("Default fills the container width"),
      label: o(z.string()),
      rounded: o(z.boolean()),
    }),
    slots: [],
    description: "Image placeholder: a box with an X through it.",
    example: { height: 180, label: "Hero photo" },
  },
  Icon: {
    props: z.object({
      name: o(iconName),
      size: o(z.number()),
    }),
    slots: [],
    description: "Line icon from Lucide.",
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
      icon: o(iconName),
      fullWidth: o(z.boolean()),
    }),
    slots: [],
    description: "Button. Primary is filled, secondary is outlined, ghost is text only.",
    example: { label: "Continue", variant: "primary", fullWidth: true },
  },
  Input: {
    props: z.object({
      label: o(z.string()),
      placeholder: o(z.string()),
      value: o(z.string()),
      type: o(z.enum(["text", "password", "search", "email"])),
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
      width: o(z.union([z.number(), z.string()])).describe("Fixed width, e.g. 320. Default fills the space."),
    }),
    slots: [],
    description: "Dropdown field (closed state).",
    example: { label: "Country", value: "United States" },
  },

  // ── Navigation & data ─────────────────────────────────────────────────
  NavBar: {
    props: z.object({
      title: o(z.string()),
      leading: o(z.enum(["none", "menu", "back", "close", "logo"])),
      actions: o(z.array(iconName)).describe("Icon names shown on the right"),
      align: o(z.enum(["left", "center"])),
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
      icon: o(iconName),
      trailing: o(z.enum(["none", "chevron", "toggle", "text", "badge", "icon"])),
      trailingText: o(z.string()),
      trailingIcon: o(iconName),
    }),
    slots: [],
    description: "Row in a List. Omit title for a placeholder bar.",
    example: { title: "Account", subtitle: "Email, password", leading: "icon", icon: "user", trailing: "chevron" },
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
};

export const catalog = defineCatalog(wireframeSchema, {
  components: componentDefinitions,
});

export type ComponentName = keyof typeof componentDefinitions;
