// Stands in for @resvg/resvg-js (a native Node module) in the browser build, where
// renderWireframePng and json-render's PNG path would otherwise pull it into the bundle.
export class Resvg {
  constructor() {
    throw new Error("PNG rendering needs Node (@resvg/resvg-js); the browser build of tsquare renders SVG only");
  }
}
