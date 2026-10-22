# Element positions

`measureElements` tells you where every element and flow arrow of a board is drawn, and which line of the wireframe text it came from. Use it to make a rendered board clickable: lay a hit box over each element, then comment on what was clicked, highlight it, or hand its lines to a model to change.

## Measure a board

```ts
import { compileWireframe, renderWireframeSvg, measureElements } from "tsquare";

const { spec, lines, issues } = compileWireframe(text);
if (!spec || issues.length) throw new Error("fix the wireframe first");

const svg = await renderWireframeSvg(spec);
const elements = await measureElements(spec, lines);
```

`lines` comes from `compileWireframe`: it maps each element of the spec to its line in the text. If you build or merge specs yourself, pass your own map.

Positions are in board pixels, the same coordinates as the SVG. If you show the board at another size, divide click coordinates by the scale before looking them up (see below).

`measureElements` takes the same `flows` option as `renderWireframeSvg` (on by default). Flow labels can widen the gaps between screens, so the boxes only match a board rendered with the same setting:

```ts
const svg = await renderWireframeSvg(spec, { flows: false });
const elements = await measureElements(spec, lines, { flows: false });
```

Measuring renders the board once more, so it takes about as long as a render. Measure once each time the text changes, then look things up as often as you like. The result is plain JSON: you can measure on a server and send it to the browser.

## What you get

An array in drawing order (what's drawn later sits on top). The first entry is always the board, so `elements[0].box` is the board's size.

Each element:

| Field | |
|---|---|
| `line` | The element's line in the text. |
| `endLine` | The last line of its block, children included. The same as `line` when it has no children. |
| `id` | Its `#id`, when the text gives one. |
| `type` | `"Button"`, `"Screen"`, … |
| `label` | Its main text: a button's label, a screen's name, a heading's text. |
| `screenLine` | The line of the screen it's on. `null` for the board, screens, and notes beside the screens. |
| `parentLine` | The line of the element that contains it. `null` for the board. |
| `box` | Where it's drawn: `{ x, y, width, height }`. |
| `labelBox` | Screens only: the band above the frame with the screen's name. |
| `overlay` | Its open menu, option list or date picker, or its tooltip. |

Each flow arrow:

| Field | |
|---|---|
| `line`, `endLine` | The flow's line (`endLine` is the same: a flow has no children). |
| `type` | `"Flow"` |
| `label` | Its label, if it has one. |
| `from`, `to` | The ids it connects, as written in the flow line. |
| `fromLine`, `toLine` | The lines of the elements or screens it connects. |
| `path` | The drawn line as `[x, y]` points, curves and corners included, from one end's marker to the other's. |
| `labelBox` | Its label pill. |

Some details:

- **`line` is `0` when your `lines` map doesn't have the element**, for example in a spec you merged from several texts. Real lines start at 1, so `if (entry.line)` tells you whether you have one. `parentLine` and `screenLine` are `null` only when there's no parent or screen, never because a line is missing.
- **Only what's drawn is measured.** Content entirely past the bottom of its screen, the children of a closed accordion, and elements squeezed to nothing aren't in the array. Content cut off by the screen's edge gets a box for the part that shows.
- **A modal's box is its card**, and a drawer's is its panel, not the dimmed screen behind them.
- **Overlay sizes are partly estimated.** Menus, option lists and tooltips are sized from their text, so the edge of an `overlay` box can be a few pixels off.

## What's under a point

`elementsAt` returns everything under a point, the most likely meant first:

```ts
import { elementsAt } from "tsquare";

const hits = elementsAt(elements, x, y);
const hit = hits[0];
```

The order:

1. An open menu, option list, date picker or tooltip. You get the element it belongs to, since the items are part of that element's line.
2. A flow arrow's label.
3. Elements that hold no others (buttons, inputs, text, images, …), topmost first.
4. A flow arrow's line, within `tolerance` pixels of it (6 by default).
5. Stacks, cards, modals and drawers, then the screen, then the board.

So a click on a button gets the button even where an arrow crosses it. A click on an arrow over empty space gets the arrow, and a click in the gap between screens gets the arrow before the board.

An open modal or drawer covers its screen. Inside it, nothing of the screen's content beneath comes back. Beside it, on the dimmed part of the screen, you get only the screen and the board.

On a page, convert the click to board pixels. Pass a tolerance in screen pixels divided by the scale, so arrows stay as easy to hit when the board is shown small:

```ts
img.addEventListener("click", (event) => {
  const rect = img.getBoundingClientRect();
  const scale = rect.width / elements[0].box.width;
  const x = (event.clientX - rect.left) / scale;
  const y = (event.clientY - rect.top) / scale;
  const [hit] = elementsAt(elements, x, y, { tolerance: 8 / scale });
  if (hit) select(hit);
});
```

To skip flows, or anything else, filter the result: `hits.find((e) => e.type !== "Flow")`.

To show where the hit sits, follow `parentLine` up to the board:

```ts
const byLine = new Map(elements.map((e) => [e.line, e]));
const trail = [hit];
let up = hit.type === "Flow" ? null : hit.parentLine;
while (up != null) {
  const parent = byLine.get(up)!;
  trail.unshift(parent);
  up = parent.type === "Flow" ? null : parent.parentLine;
}
// trail: Board › Screen › Stack › Button
```

## An element's lines

`line` and `endLine` are an element's whole block in the text. To hand a model exactly the part to change:

```ts
const block = text.split("\n").slice(hit.line - 1, hit.endLine).join("\n");
```

`elementsAtLine` goes the other way: the element on a line and every block around it, innermost first. It's for a code view that follows the caret. A comment or blank line inside a block gives that block. A flow's line gives the flow, then the board.

```ts
import { elementsAtLine } from "tsquare";

const [atCaret] = elementsAtLine(elements, caretLine);
```

Lines shift when the text above them changes, so measure again after every edit. An element's `id` stays the same, which makes it the better key for anything that has to survive edits, such as a comment pinned to an element.
