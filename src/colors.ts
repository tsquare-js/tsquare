/**
 * The only colors a wireframe can set: a board-level accent and a few fixed
 * status tones. Everything else stays grayscale.
 */
import { theme } from "./layout.js";
import { closeMatches } from "./suggest.js";

/** Named accents. Each keeps white text above 4.5:1 contrast. */
export const ACCENTS = {
  blue: "#2563eb",
  indigo: "#4f46e5",
  violet: "#7c3aed",
  pink: "#db2777",
  red: "#dc2626",
  orange: "#c2410c",
  green: "#15803d",
  teal: "#0f766e",
} as const;

/** Status tones for badges and input errors. They don't change with the accent. */
export const TONES = {
  success: "#15803d",
  warning: "#b45309",
  danger: "#dc2626",
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export const isAccent = (v: string) => v in ACCENTS || HEX.test(v);

export function accentMessage(v: string) {
  const names = Object.keys(ACCENTS);
  const close = closeMatches(v, names);
  return `unknown accent "${v}"` + (close.length ? ` (did you mean ${close.join(", ")}?)` : "") +
    `; use one of ${names.join(", ")}, or a hex color like #1a73e8`;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix a color toward black until it reads on white (for text, underlines, icons). */
function readableOnWhite(hex: string) {
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let out = hex;
  for (let k = 0; k < 20 && contrast(out, "#ffffff") < 4.5; k++) {
    [r, g, b] = [r, g, b].map((v) => Math.round(v * 0.9));
    out = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  return out;
}

export interface Palette {
  /** Fills for primary buttons, solid badges, checked controls, toggles that are on. */
  accent: string;
  /** Text and icons drawn on the accent fill. */
  onAccent: string;
  /** Accent as text or a line on white: active tabs, the active tab-bar item, ghost buttons. Dark gray without an accent. */
  accentText: string;
}

/** Colors for one board. Without an accent this is exactly the grayscale theme. */
export function paletteFor(accent?: string | null): Palette {
  if (!accent || !isAccent(accent)) {
    return { accent: theme.primary, onAccent: theme.onPrimary, accentText: theme.ink };
  }
  const hex = (ACCENTS as Record<string, string>)[accent] ?? accent.toLowerCase();
  return {
    accent: hex,
    // hex accents can be light (a brand yellow): switch to dark text when white wouldn't read
    onAccent: contrast(hex, "#ffffff") >= 3 ? "#ffffff" : theme.ink,
    accentText: readableOnWhite(hex),
  };
}
