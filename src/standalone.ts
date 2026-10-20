/**
 * The standalone script, dist/tsquare.min.js: the browser build with everything bundled, for a
 * <script> tag (from a CDN or your own server), no build step. It sets `window.tsquare` (the same
 * API as the package) and, once the page has loaded, draws its ```tsquare code blocks with
 * renderAll(). To call renderAll() yourself instead (say, after adding content), give the script
 * tag data-start="manual".
 */
import { renderAll } from "./dom.js";

export * from "./index.js";

const script = typeof document !== "undefined" ? (document.currentScript as HTMLScriptElement | null) : null;
if (script && script.dataset.start !== "manual") {
  const start = () => void renderAll();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
