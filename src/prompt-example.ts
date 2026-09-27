import type { Spec } from "@json-render/core";

/** The worked example in the model prompt (also used by the format eval). */
export const exampleSpec: Spec = {
  root: "board",
  elements: {
    board: { type: "Board", props: { title: "Recipe app" }, children: ["browse", "detail", "note"] },

    browse: { type: "Screen", props: { name: "Browse", device: "phone" }, children: ["b-nav", "b-search", "b-tabs", "b-grid", "b-tabbar"] },
    "b-nav": { type: "NavBar", props: { title: "Recipes", leading: "menu", actions: ["bell"] }, children: [] },
    "b-search": { type: "Input", props: { type: "search", placeholder: "Search recipes" }, children: [] },
    "b-tabs": { type: "Tabs", props: { items: ["All", "Quick", "Vegetarian"], active: 0 }, children: [] },
    "b-grid": { type: "Grid", props: { columns: 2, gap: 12 }, children: ["card-1", "card-2"] },
    "card-1": { type: "Card", props: { padding: 10 }, children: ["c1-img", "c1-title", "c1-meta"] },
    "c1-img": { type: "Image", props: { height: 110 }, children: [] },
    "c1-title": { type: "Text", props: { text: "Tomato soup", bold: true }, children: [] },
    "c1-meta": { type: "Text", props: { text: "25 min", size: "sm", muted: true }, children: [] },
    "card-2": { type: "Card", props: { padding: 10 }, children: ["c2-img", "c2-title"] },
    "c2-img": { type: "Image", props: { height: 110 }, children: [] },
    "c2-title": { type: "Text", props: { lines: 2 }, children: [] },
    "b-tabbar": {
      type: "TabBar",
      props: { items: [{ label: "Browse", icon: "book-open" }, { label: "Saved", icon: "heart" }, { label: "Profile", icon: "user" }], active: 0 },
      children: [],
    },

    detail: { type: "Screen", props: { name: "Recipe", device: "phone" }, children: ["d-nav", "d-img", "d-title", "d-tags", "d-body", "d-cook", "d-sheet"] },
    "d-nav": { type: "NavBar", props: { leading: "back", actions: ["share", "more-horizontal"] }, children: [] },
    "d-img": { type: "Image", props: { height: 200, label: "Photo" }, children: [] },
    "d-title": { type: "Heading", props: { text: "Tomato soup", level: 1 }, children: [] },
    "d-tags": { type: "Stack", props: { direction: "row", gap: 8 }, children: ["tag-1", "tag-2"] },
    "tag-1": { type: "Badge", props: { label: "25 min", variant: "outline" }, children: [] },
    "tag-2": { type: "Badge", props: { label: "Vegan", variant: "outline" }, children: [] },
    "d-body": { type: "Text", props: { lines: 4 }, children: [] },
    "d-cook": { type: "Button", props: { label: "Start cooking", variant: "primary", fullWidth: true }, children: [] },
    "d-sheet": { type: "Drawer", props: { side: "bottom", title: "Options", size: 260 }, children: ["opt-1", "opt-2", "opt-3"] },
    "opt-1": { type: "Toggle", props: { label: "Metric units", on: true }, children: [] },
    "opt-2": { type: "Select", props: { label: "Servings", value: "4" }, children: [] },
    "opt-3": { type: "Checkbox", props: { label: "Add to shopping list" }, children: [] },

    note: { type: "Note", props: { text: "Detail screen shown with the options sheet open." }, children: [] },
  },
};
