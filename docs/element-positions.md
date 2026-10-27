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

An array of every element and flow, in drawing order: what's drawn later sits on top. The board is drawn first, underneath everything, so `elements[0]` is always the board and `elements[0].box` is its size. (This is the order of the measured list. What a click hits comes back in a different order: see below.)

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
| `box` | Where it's drawn: `{ x, y, width, height }`, the part that shows. |
| `labelBox` | Screens only: the band above the frame with the screen's name. |
| `overlays` | Its open menu, option list or date picker, and its tooltip: one box each, in drawing order. |
| `scrim` | Modals and drawers only: whether the screen behind is dimmed. `true` unless the text says `no-scrim`. |

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
- **A box is the part that shows.** Content taller than its screen is cut off at the bottom, or at the top of a tab bar; a modal taller than its screen is cut off below the status or browser bar; and a drawer cuts off what doesn't fit its panel. Those elements get a box for the part that shows. Elements that don't show at all (entirely cut off, or inside a closed accordion) aren't in the array.
- **An element can have a box 0 tall or 0 wide.** A `spacer` in a row is 0 tall, and so is one in a screen with no room left. It's in the array (so `elementsAtLine` finds it), but `elementsAt` never returns it: there's nothing to click.
- **A modal's box is its card**, a drawer's is its panel, and a toast's is its pill, not the dimmed screen or the full-width row around them.
- **Spacers are clickable where they take up space.** A spacer stretches to fill empty space, so a click on blank space often hits one. Skip them with `hits.find((e) => e.type !== "Spacer")` if you don't want them.
- **Most overlay boxes are exact.** Open menus and option lists get the size they're drawn at. A tooltip is sized from its text and a date picker from its weeks, so their edges can be a few pixels off.

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

A modal, drawer or toast hides the screen's content under it: a click inside one never returns what's beneath. A modal or drawer that dims its screen (`scrim: true`, the default) hides all of it: a click on the dimmed part returns only the screen and the board. With `no-scrim`, what shows beside it is hit as usual.

The board comes last, after everything else under the point. It's first only when the click lands on empty board, outside every screen and arrow.

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

## In the viewer

`tsquare/viewer` (the playground's zoomable board) does the clicking for you: give it the board's entries, and it reports clicks and hovers, outlines elements and zooms to them. It never renders or measures itself, so it stays small: you measure where you render (a server, a VS Code extension, a worker) and hand the entries over, as plain JSON if need be. A viewer without entries works as before: clicks just pan.

```ts
import { createViewer } from "tsquare/viewer";

const viewer = createViewer({ stage, canvas, screens }, {
  onElementClick: (hit, hits) => { if (hit) select(hit); }, // hits: everything under the point, as elementsAt orders it
  onElementHover: (hit) => viewer.highlight(hit ? [hit] : [], { kind: "hover" }),
});
const [svg, layout, elements] = await Promise.all([renderWireframeSvg(spec), measureBoardLayout(spec), measureElements(spec, lines)]);
viewer.show(svg, layout.width, layout.height, layout.items);
viewer.setElements(elements); // after each new board: entries describe one board
```

- **A click** is a press that hardly moves (dragging pans). It works zoomed in or out: the viewer turns the pointer into board pixels, and a flow's line counts within 8 screen pixels however small the board is shown.
- **`highlight(entries, { kind })`** outlines entries inside the zoomed board: a box per element, the line and label of a flow. `"selected"` (the default) is solid, `"hover"` dashed; each kind replaces its own earlier outlines, and `[]` clears it. The color is the CSS variable `--tsquare-highlight` (default `#3B99FB`), and the outline stays about 2px on screen at any zoom.
- **`zoomTo(entry)`** fits an entry (or any `{ x, y, width, height }` in board pixels) with a margin, and stays on it as the viewer resizes.
- **`viewer.layer`** is an element over the board in board pixels, for your own marks (comment pins, an inline text field): it pans and zooms with the board. It ignores the pointer; give children that should be clickable `pointer-events: auto`. For marks that keep their size, place your own element over the stage with `toBoard(clientX, clientY)` and the viewer's `onZoom`.

The playground uses all of it: click an element and the editor goes to its line; move the caret and the element is outlined on the board.

## An element's lines

`line` and `endLine` are an element's whole block in the text. To hand a model exactly the part to change:

```ts
const block = text.split("\n").slice(hit.line - 1, hit.endLine).join("\n");
```

`elementsAtLine` goes the other way: the element on a line and every block around it, innermost first. It's for a code view that follows the caret. A comment or blank line between an element's children gives that element. A flow's line gives the flow, then the board.

```ts
import { elementsAtLine } from "tsquare";

const [atCaret] = elementsAtLine(elements, caretLine);
```

Lines shift when the text above them changes, so measure again after every edit. An element's `id` stays the same, which makes it the better key for anything that has to survive edits, such as a comment pinned to an element.
