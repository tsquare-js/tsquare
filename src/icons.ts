import { icons } from "lucide";
import { siApple, siFacebook, siGithub, siGoogle, siNotion, siStripe, siX } from "simple-icons";
import { editDistance } from "./suggest.js";

/**
 * Brand logos, from Simple Icons (CC0; pinned exactly, like lucide). Filled shapes on a 24×24 grid,
 * named brand-… so they can't collide with Lucide: `apple` is Lucide's fruit and `x` its close icon.
 * Imported one by one so a browser bundle carries only these. Simple Icons has no Slack, LinkedIn or
 * Microsoft logo (removed); don't draw our own.
 */
export const BRAND_ICONS: Record<string, { title: string; path: string }> = Object.fromEntries(
  [siApple, siFacebook, siGithub, siGoogle, siNotion, siStripe, siX].map((i) => [`brand-${i.slug}`, { title: i.title, path: i.path }]),
);
export const brandIconNames = Object.keys(BRAND_ICONS).sort();

/** The SVG path of a brand-… logo, or undefined. */
export const brandPath = (name: string): string | undefined => BRAND_ICONS[name.toLowerCase()]?.path;

// Lucide exports icons in PascalCase (BarChart2); wireframes use kebab-case (bar-chart-2).
const pascal = (s: string) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
const kebab = (s: string) =>
  s
    .replace(/([a-z])([A-Z0-9])/g, "$1-$2")
    .replace(/([0-9])([A-Z])/g, "$1-$2") // Grid3X3 → grid-3-x-3, but Grid3x2 → grid-3x-2
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

const table = icons as Record<string, any>;

/** Kebab-case names for every Lucide icon (including Lucide's aliases, e.g. home and house), then the brand logos. */
export const iconNames: string[] = [...Object.keys(table).map(kebab), ...brandIconNames];

/** The Lucide icon node for a kebab-case name, or undefined if there's no such icon. */
export function iconNode(name: string): any {
  return table[pascal(name)];
}

export const isIcon = (name: string) => iconNode(name) !== undefined || brandPath(name) !== undefined;

/**
 * Names models guess that aren't Lucide names, with what they meant. Lucide ships no
 * synonyms, so spelling can't find these. Only add a name seen failing in practice
 * (the first four are from the eval outputs) or an obvious UI word.
 */
const GUESSES: Record<string, string[]> = {
  call: ["phone"],
  compose: ["square-pen", "pencil"],
  person: ["user"],
  bag: ["shopping-bag"],
  notification: ["bell"],
  notifications: ["bell"],
  profile: ["user", "circle-user"],
  envelope: ["mail"],
  close: ["x"],
  twitter: ["brand-x"],
};

/** Among equally close matches, the common directions first: chevron → chevron-right, not chevron-first. */
const DIRECTIONS = ["right", "left", "down", "up"];
const directionRank = (n: string) => {
  const i = DIRECTIONS.indexOf(n.split("-").pop()!);
  return i < 0 ? DIRECTIONS.length : i;
};

/**
 * Close matches for an unknown name: known guesses ("compose" → square-pen), near spellings
 * ("serach" → search) and names that share a word with it ("cart" → shopping-cart).
 */
export function suggestIcons(name: string, limit = 4): string[] {
  const q = name.toLowerCase().replace(/[_ ]/g, "-");
  // a brand name without the prefix (github → brand-github) comes first
  const guessed = [...(BRAND_ICONS[`brand-${q}`] ? [`brand-${q}`] : []), ...(GUESSES[q] ?? [])];
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
  const close = scored
    .sort((a, b) => a[1] - b[1] || directionRank(a[0]) - directionRank(b[0]) || a[0].localeCompare(b[0]))
    .map(([n]) => n);
  return [...new Set([...guessed, ...close])].slice(0, limit);
}

export function unknownIconMessage(name: string) {
  if (/^brand-/i.test(name)) return `unknown icon "${name}"; the brand logos are ${brandIconNames.join(", ")}`;
  const close = suggestIcons(name);
  return close.length
    ? `unknown icon "${name}" (did you mean ${close.join(", ")}?)`
    : `unknown icon "${name}" (use a Lucide name in kebab-case, e.g. search, user, settings)`;
}
