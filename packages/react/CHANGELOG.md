# Changelog

## 0.1.0

- `<Wireframe source>`: a board from wireframe text, drawn in the browser; problems listed by line.
- `tsquareComponents` / `TsquarePre` for react-markdown: ```` ```tsquare ```` blocks become boards.
- Streaming: `<WireframeStreaming value>` (or `streaming` on `<Wireframe>`) keeps the board current every 200 ms or so while a reply arrives, and holds problems back until it's complete.
