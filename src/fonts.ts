import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// Inter from @fontsource/inter, pinned to an exact version: a font change shifts
// text metrics and line wraps, so treat a bump like a renderer change.
// fonts.browser.ts replaces this file in the browser build (dist/browser/).
const fontFile = (name: string) =>
  createRequire(import.meta.url).resolve(`@fontsource/inter/files/${name}`);

let fontCache: Promise<any[]> | null = null;
export function loadFonts() {
  fontCache ??= Promise.all([
    readFile(fontFile("inter-latin-400-normal.woff")),
    readFile(fontFile("inter-latin-600-normal.woff")),
  ]).then(([regular, semibold]) => [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: semibold, weight: 600, style: "normal" },
  ]);
  return fontCache;
}
