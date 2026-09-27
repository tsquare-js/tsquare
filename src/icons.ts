import { icons } from "lucide";
import { editDistance } from "./suggest";

// Lucide exports icons in PascalCase (BarChart2); wireframes use kebab-case (bar-chart-2).
const pascal = (s: string) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
const kebab = (s: string) =>
  s
    .replace(/([a-z])([A-Z0-9])/g, "$1-$2")
    .replace(/([0-9])([A-Z])/g, "$1-$2") // Grid3X3 → grid-3-x-3, but Grid3x2 → grid-3x-2
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

const table = icons as Record<string, any>;

/** Kebab-case names for every Lucide icon (including Lucide's aliases, e.g. home and house). */
export const iconNames: string[] = Object.keys(table).map(kebab);

/** The Lucide icon node for a kebab-case name, or undefined if there's no such icon. */
export function iconNode(name: string): any {
  return table[pascal(name)];
}

export const isIcon = (name: string) => iconNode(name) !== undefined;

/**
 * Close matches for an unknown name: near spellings ("serach" → search) and names that
 * share a word with it ("cart" → shopping-cart, "call" → phone-call).
 * There are no synonyms: "notification" won't find bell.
 */
export function suggestIcons(name: string, limit = 3): string[] {
  const q = name.toLowerCase().replace(/[_ ]/g, "-");
  const words = q.split("-").filter((w) => w.length > 2);
  const maxEdits = Math.max(1, Math.floor(q.length / 3));
  const scored: [string, number][] = [];
  for (const n of iconNames) {
    const parts = n.split("-");
    const shared = words.filter((w) => parts.includes(w)).length;
    // Lower is closer. A shared word scores 0.6–1 (more shared words, fewer extra words rank
    // higher). A typo scores by edits relative to length, so one wrong letter in a long name
    // (chevron-rigth → 0.23) beats a shared word, but in a short one (cart → car, 0.75) it doesn't.
    const wordScore = shared ? 1 - 0.4 * (shared / words.length) + 0.05 * (parts.length - shared) : Infinity;
    const d = editDistance(q, n);
    const score = Math.min(wordScore, d <= maxEdits ? (3 * d) / q.length : Infinity);
    if (score < Infinity) scored.push([n, score]);
  }
  return scored.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([n]) => n);
}

export function unknownIconMessage(name: string) {
  const close = suggestIcons(name);
  return close.length
    ? `unknown icon "${name}" (did you mean ${close.join(", ")}?)`
    : `unknown icon "${name}" (use a Lucide name in kebab-case, e.g. search, user, settings)`;
}
