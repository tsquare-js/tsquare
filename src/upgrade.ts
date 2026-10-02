/**
 * Everything tsquare does for wireframes written in an older version of the
 * language, kept in one place so the parser, catalog and renderer only know
 * the current language.
 *
 *   upgradeWireframe(text)                    always-safe rewrites (renamed props);
 *                                             compileWireframe runs it first
 *   upgradeWireframe(text, { fromLink: true }) also the rules for text that came
 *                                             from a link made by an older version;
 *                                             decodeWireframe runs it
 *   upgradeSpec(spec)                         the renames, for JSON specs
 *
 * Rewrites keep every line where it was (except moving a comment onto its own
 * line, which only happens for links), so problems still point at the right line.
 *
 * Adding an upgrade: a rename goes in RENAMED_PROPS. A change in meaning goes
 * here only if old text can be recognised without guessing; otherwise new links
 * get a new prefix letter in share.ts and the upgrade applies to the old letter.
 */

/** Props renamed in 0.3.0. The prompt, docs and autocomplete only teach the new names; `tsquare fmt` rewrites old ones. */
export const RENAMED_PROPS: Record<string, Record<string, string>> = {
  Button: { icon: "leadingIcon" },
  ListItem: { icon: "leadingIcon" },
};

const RENAMED_BY_WORD = new Map(Object.entries(RENAMED_PROPS).map(([type, renames]) => [type.toLowerCase(), renames]));

export interface UpgradeOptions {
  /** The text came from a link (share link or render URL), which may predate 0.3.0. */
  fromLink?: boolean;
}

/** Rewrites older syntax to the current language. Text that's already current comes back unchanged. */
export function upgradeWireframe(text: string, options: UpgradeOptions = {}): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const component = trimmed.match(/^([A-Za-z][\w-]*)/)?.[1];
    if (!component || trimmed.startsWith("```")) { out.push(line); continue; }
    const tokens = scanLine(line, component.length + (line.length - line.trimStart().length));
    let upgraded = line;

    // Before 0.3.0, `#` starting a word (outside quotes, not a value after = or :) began a comment.
    // Now comments are whole lines, so move it onto its own line above, at the same indent.
    let comment = "";
    if (options.fromLink) {
      const hash = tokens.find((t) => t.kind === "word" && t.depth === 0 && upgraded[t.start] === "#" && !t.afterEquals);
      if (hash) {
        comment = upgraded.slice(hash.start).trimEnd();
        upgraded = upgraded.slice(0, hash.start).trimEnd();
      }
    }

    // Renamed props, rightmost first so earlier offsets stay valid.
    const renames = RENAMED_BY_WORD.get(component.toLowerCase().replace(/[-_]/g, ""));
    if (renames) {
      for (const t of [...tokens].reverse()) {
        if (t.kind === "key" && t.depth === 0 && t.start < upgraded.length && renames[t.text]) {
          upgraded = upgraded.slice(0, t.start) + renames[t.text] + upgraded.slice(t.start + t.text.length);
        }
      }
    }

    if (comment) out.push(line.slice(0, line.length - line.trimStart().length) + comment);
    out.push(upgraded);
  }
  return out.join("\n");
}

/** The renames, for a JSON spec. In place; safe to call more than once. */
export function upgradeSpec<S extends { elements: Record<string, { type: string; props?: Record<string, unknown> }> }>(spec: S): S {
  for (const el of Object.values(spec.elements)) {
    const renames = RENAMED_PROPS[el.type];
    if (!renames || !el.props) continue;
    for (const [from, to] of Object.entries(renames)) {
      if (from in el.props) {
        if (!(to in el.props)) el.props[to] = el.props[from];
        delete el.props[from];
      }
    }
  }
  return spec;
}

interface Token { kind: "key" | "word" | "string"; text: string; start: number; depth: number; afterEquals: boolean }

/**
 * Just enough of the parser's tokenizer to find words and `key=` names on one line:
 * a quote opens a string only at the start of a word, and [ ] { } track depth.
 */
function scanLine(line: string, from: number): Token[] {
  const tokens: Token[] = [];
  let depth = 0;
  let afterEquals = false;
  let i = from;
  while (i < line.length) {
    const c = line[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== c) j += line[j] === "\\" ? 2 : 1;
      tokens.push({ kind: "string", text: line.slice(i, j + 1), start: i, depth, afterEquals });
      afterEquals = false;
      i = j + 1;
      continue;
    }
    if (c === "[" || c === "{") { depth++; afterEquals = false; i++; continue; }
    if (c === "]" || c === "}") { depth = Math.max(0, depth - 1); afterEquals = false; i++; continue; }
    if (c === ",") { afterEquals = false; i++; continue; }
    if (c === "=" || c === ":") { afterEquals = true; i++; continue; }
    let j = i;
    while (j < line.length && !` \t,=[]{}":`.includes(line[j])) j++;
    const text = line.slice(i, j);
    let k = j;
    while (line[k] === " " || line[k] === "\t") k++;
    const isKey = !afterEquals && (line[k] === "=" || line[k] === ":");
    tokens.push({ kind: isKey ? "key" : "word", text, start: i, depth, afterEquals });
    afterEquals = false;
    i = j;
  }
  return tokens;
}
