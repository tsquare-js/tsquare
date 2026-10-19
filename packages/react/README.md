# @tsquare-js/react

React components for [tsquare](https://tsquare.dev) wireframes: draw wireframe text, or the ```` ```tsquare ```` code blocks in a model's reply, including while the reply is still streaming in.

```bash
npm install @tsquare-js/react
```

## A wireframe from text

```tsx
import { Wireframe } from "@tsquare-js/react";

<Wireframe source={text} />
```

The board is drawn in the browser as an `<img>` of its SVG, inside `<figure class="tsquare-board">`, at its own size and never wider than its container. If the text has mistakes, it lists them by line (`<div class="tsquare-problems">`), under the last version that worked.

## In react-markdown

```tsx
import Markdown from "react-markdown";
import { tsquareComponents } from "@tsquare-js/react";

<Markdown components={tsquareComponents}>{reply}</Markdown>
```

Every ```` ```tsquare ```` block becomes its board; other code blocks stay as they were. To combine it with your own components, spread it: `components={{ ...tsquareComponents, a: MyLink }}`. If you already override `pre`, render `<TsquarePre {...props} />` for the blocks it recognizes.

## While a reply streams in

Wrap the reply in `<WireframeStreaming>` while text is still arriving (or pass `streaming` to `<Wireframe>`):

```tsx
import { WireframeStreaming, tsquareComponents } from "@tsquare-js/react";

<WireframeStreaming value={status === "streaming"}>
  <Markdown components={tsquareComponents}>{reply}</Markdown>
</WireframeStreaming>
```

While streaming, the board updates every 200 ms or so with the latest text that's valid so far, and problems are held back (half-written lines are always "wrong"). When it's done, problems show if the final text has any, under the last good board, dimmed.

## Notes

- **Frameworks:** the components run in the browser (the file starts with `"use client"`, for Next.js and other React Server Components setups). On the server they render an empty `<figure>`, filled in after the page loads.
- **Size:** tsquare's renderer adds about 1.7 MB minified (490 KB compressed) to your bundle. In a chat app, load it when it's first needed, e.g. `const Wireframe = lazy(() => import("@tsquare-js/react").then((m) => ({ default: m.Wireframe })))`.
- **Privacy:** boards are drawn on the reader's device; nothing is sent anywhere.
- **Styling:** `className` and `style` go on the `<figure>`. The image and problem list have small inline styles; `.tsquare-board img` and `.tsquare-problems` are there to target.

The language and every component: [tsquare.dev/docs](https://tsquare.dev/docs). MIT license.
