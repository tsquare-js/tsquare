// The browser build's fonts.ts: the same Inter files, embedded in the bundle as bytes
// (esbuild's binary loader), since a browser has no node_modules to read them from.
import regular from "@fontsource/inter/files/inter-latin-400-normal.woff";
import semibold from "@fontsource/inter/files/inter-latin-600-normal.woff";

const fonts = Promise.resolve([
  { name: "Inter", data: regular, weight: 400, style: "normal" },
  { name: "Inter", data: semibold, weight: 600, style: "normal" },
]);
export const loadFonts = () => fonts;
