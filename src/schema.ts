import { defineSchema } from "@json-render/core";

/**
 * Wireframe spec schema. Same flat element shape as the other json-render
 * renderers (root + elements map), with wireframe-specific rules for the
 * generated LLM prompt.
 */
export const wireframeSchema = defineSchema(
  (s) => ({
    spec: s.object({
      root: s.string(),
      elements: s.record(
        s.object({
          type: s.ref("catalog.components"),
          props: s.propsOf("catalog.components"),
          children: s.array(s.string()),
          visible: { ...s.any(), ...s.optional() },
          repeat: { ...s.any(), ...s.optional() },
        }),
      ),
    }),
    catalog: s.object({
      components: s.map({
        props: s.zod(),
        slots: s.array(s.string()),
        description: s.string(),
        example: s.any(),
      }),
    }),
  }),
  {
    defaultRules: [
      "The root element MUST be a Board. A Board's children are Screens (and optional Notes placed beside them).",
      "Every Screen MUST be a direct child of the Board. Each Screen is one view of the product; use several Screens to show several views or states.",
      "Screens lay out their children top to bottom. Use Stack (direction row/column) and Grid inside a Screen to arrange content.",
      "Modal, Drawer and Toast are overlays. They MUST be direct children of a Screen, and SHOULD be listed last in the Screen's children so they draw on top.",
      "NavBar goes first in a Screen's children and TabBar goes last (before any overlay).",
      "Any element except Board and Screen can take a tooltip prop (text) to show a tooltip next to it. Select (with options), Input with type date, and Button (with menu) take open to show their list, calendar or menu over the screen.",
      "This is a low-fidelity wireframe: prefer placeholders (Image boxes, Text with lines) over invented copy, unless the copy matters to the design.",
      "Every element MUST include a \"children\" array. Leaf elements use an empty array: \"children\": [].",
      "Every id listed in a children array MUST exist as its own element.",
    ],
  },
);
