/**
 * Text syntax for wireframes. Compiles to the same flat json-render spec.
 *
 *   board "Notes app"
 *     screen phone "Sign in" padding=28
 *       heading "Welcome back"
 *       input "Email" placeholder="you@example.com"
 *       stack row justify=between
 *         checkbox "Remember me" checked
 *         button "Forgot?" ghost sm
 *       button "Sign in" primary lg fullWidth
 *
 * Line = component name, then arguments, children indented below.
 * Arguments:
 *   "quoted"      → the component's main text prop (label, title, text…)
 *   bare word     → an enum value (phone, primary, row, sm…) or a boolean prop set to true (checked)
 *   key=value     → any prop; value is "string", number, true/false, word, [list] or {key=value …}
 *                   list items are separated by commas only, so [Ana Torres, Admin] is two items;
 *                   quote an item that contains a comma: ["$1,200", "Smith, J"]
 *   # comment
 */
import type { Spec } from "@json-render/core";
import { z } from "zod";
import { componentDefinitions } from "./catalog";
import { unknownComponentMessage } from "./suggest";

/** Which prop a quoted string fills, per component. */
export const PRIMARY_PROP: Record<string, string> = {
  Board: "title",
  Screen: "name",
  Note: "text",
  Card: "title",
  Heading: "text",
  Text: "text",
  Image: "label",
  Icon: "name",
  Avatar: "initials",
  Badge: "label",
  Button: "label",
  Input: "label",
  Checkbox: "label",
  Radio: "label",
  Toggle: "label",
  Select: "label",
  NavBar: "title",
  ListItem: "title",
  Modal: "title",
  Drawer: "title",
};

// ── Introspect the Zod schemas so the syntax follows the catalog ────────

function unwrap(t: any): any {
  let cur = t;
  while (cur && ["optional", "nullable", "default"].includes(cur.def?.type)) cur = cur.def.innerType;
  return cur;
}

interface ComponentInfo {
  name: string;
  props: Record<string, any>;
  enumValues: Map<string, string>; // value → prop
  booleans: Set<string>;
}

const COMPONENTS = new Map<string, ComponentInfo>();
for (const [name, def] of Object.entries(componentDefinitions)) {
  const shape = (def.props as z.ZodObject<any>).shape;
  const enumValues = new Map<string, string>();
  const ambiguous = new Set<string>();
  const booleans = new Set<string>();
  for (const [prop, schema] of Object.entries(shape)) {
    const inner = unwrap(schema);
    const type = inner?.def?.type;
    if (type === "enum") {
      for (const v of inner.options as string[]) {
        if (enumValues.has(v)) ambiguous.add(v);
        else enumValues.set(v, prop);
      }
    } else if (type === "boolean") {
      booleans.add(prop);
    }
  }
  for (const v of ambiguous) enumValues.delete(v); // must be written key=value
  COMPONENTS.set(name.toLowerCase(), { name, props: shape, enumValues, booleans });
}

const normalizeType = (s: string) => s.toLowerCase().replace(/[-_]/g, "");

/** Components whose main text is usually a single word, so it may be written unquoted. */
const WORD_PRIMARY = new Set(["Icon", "Avatar"]);

/** Words that switch a boolean prop off. */
const ANTONYMS: Record<string, string> = { off: "on", unchecked: "checked" };

// ── Tokenizer for one line's arguments ──────────────────────────────────

// start/end are offsets in the line, so an unquoted list item can keep its exact text.
type Tok = { kind: "str" | "word" | "num" | "sym"; value: string; start: number; end: number };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "#") break; // comment
    if (c === '"' || c === "'") {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\" && j + 1 < src.length) { s += src[j + 1]; j += 2; continue; }
        s += src[j++];
      }
      if (j >= src.length) throw new Error("unterminated string");
      out.push({ kind: "str", value: s, start: i, end: j + 1 });
      i = j + 1;
      continue;
    }
    if ("=[]{}:,".includes(c)) { out.push({ kind: "sym", value: c, start: i, end: i + 1 }); i++; continue; }
    let j = i;
    // an apostrophe inside a word is part of it (Don't); only a leading ' opens a string
    while (j < src.length && !` \t,=[]{}#":`.includes(src[j])) j++;
    const w = src.slice(i, j);
    out.push({ kind: /^-?\d+(\.\d+)?$/.test(w) ? "num" : "word", value: w, start: i, end: j });
    i = j;
  }
  return out;
}

class Cursor {
  i = 0;
  constructor(public toks: Tok[], public src: string) {}
  peek(o = 0) { return this.toks[this.i + o]; }
  next() { return this.toks[this.i++]; }
  done() { return this.i >= this.toks.length; }
  isSym(v: string, o = 0) { const t = this.peek(o); return t?.kind === "sym" && t.value === v; }
  /** Commas only separate list items; elsewhere (between arguments, between {…} fields) they're ignored. */
  skipCommas() { while (this.isSym(",")) this.i++; }
}

const scalar = (t: Tok) =>
  t.kind === "num" ? Number(t.value)
  : t.kind === "word" && t.value === "true" ? true
  : t.kind === "word" && t.value === "false" ? false
  : t.kind === "word" && t.value === "null" ? null
  : t.value;

/**
 * One list item. Items are separated by commas, not spaces, so an unquoted item
 * runs to the next comma or ] and keeps its spaces: [Ana Torres, Admin].
 */
function parseListItem(c: Cursor): unknown {
  const first = c.peek();
  if (!first) throw new Error("unclosed [");
  if (first.kind === "str" || c.isSym("[") || c.isSym("{")) {
    const v = parseValue(c);
    if (!c.done() && !c.isSym(",") && !c.isSym("]")) {
      throw new Error(`expected , or ] after ${JSON.stringify(v)} in a list (quote the whole item, or separate items with commas)`);
    }
    return v;
  }
  const toks: Tok[] = [];
  while (!c.done() && !c.isSym(",") && !c.isSym("]")) {
    const t = c.peek();
    if (t.kind === "sym" && "[]{}".includes(t.value)) throw new Error(`unexpected "${t.value}" in a list item; quote the item`);
    if (t.kind === "str") throw new Error(`unexpected quote in a list item; quote the whole item`);
    toks.push(c.next());
  }
  if (!toks.length) throw new Error("empty item in a list (two commas in a row?)");
  if (toks.length === 1) return scalar(toks[0]);
  return c.src.slice(toks[0].start, toks[toks.length - 1].end);
}

function parseValue(c: Cursor): unknown {
  const t = c.next();
  if (!t) throw new Error("missing value");
  if (t.kind === "str") return t.value;
  if (t.kind === "num") return Number(t.value);
  if (t.kind === "word") return scalar(t);
  if (t.value === "[") {
    const arr: unknown[] = [];
    while (!c.isSym("]")) {
      if (c.done()) throw new Error("unclosed [");
      arr.push(parseListItem(c));
      if (c.isSym(",")) c.next();
    }
    c.next();
    return arr;
  }
  if (t.value === "{") {
    const obj: Record<string, unknown> = {};
    while (!c.isSym("}")) {
      c.skipCommas();
      if (c.isSym("}")) break;
      if (c.done()) throw new Error("unclosed {");
      const k = c.next();
      if (!k || k.kind === "sym") throw new Error("expected key in {…}");
      if (!(c.isSym("=") || c.isSym(":"))) throw new Error(`expected = after ${k.value}`);
      c.next();
      obj[k.value] = parseValue(c);
    }
    c.next();
    return obj;
  }
  throw new Error(`unexpected "${t.value}"`);
}

// ── Parser ──────────────────────────────────────────────────────────────

export interface TextIssue { line: number; message: string }

export interface ParseResult {
  spec: Spec | null;
  issues: TextIssue[];
  /** element id → source line, for mapping validation errors back */
  lines: Record<string, number>;
}

export function parseWireframeText(source: string): ParseResult {
  const issues: TextIssue[] = [];
  const elements: Spec["elements"] = {};
  const lines: Record<string, number> = {};
  const stack: { indent: number; id: string }[] = [];
  let root: string | null = null;
  let n = 0;

  const srcLines = source.replace(/\r\n?/g, "\n").split("\n");
  srcLines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("```")) return;
    const indent = raw.length - raw.trimStart().length;

    const m = trimmed.match(/^([A-Za-z][\w-]*)(.*)$/);
    if (!m) { issues.push({ line: lineNo, message: `expected a component name, got "${trimmed}"` }); return; }
    const info = COMPONENTS.get(normalizeType(m[1]));
    if (!info) { issues.push({ line: lineNo, message: unknownComponentMessage(m[1], [...COMPONENTS.keys()]) }); return; }

    const props: Record<string, unknown> = {};
    try {
      const c = new Cursor(tokenize(m[2]), m[2]);
      while (!c.done()) {
        c.skipCommas();
        if (c.done()) break;
        const t = c.peek();
        if (t.kind !== "sym" && (c.isSym("=", 1) || c.isSym(":", 1))) {
          c.next(); c.next();
          const key = t.value;
          if (!(key in info.props)) {
            issues.push({ line: lineNo, message: `${info.name} has no prop "${key}" (its props: ${Object.keys(info.props).join(", ")})` });
          }
          props[key] = parseValue(c);
          continue;
        }
        c.next();
        if (t.kind === "str") {
          const p = PRIMARY_PROP[info.name];
          if (!p) issues.push({ line: lineNo, message: `${info.name} takes no text; use key="…"` });
          else if (p in props) issues.push({ line: lineNo, message: `more than one text for ${info.name}` });
          else props[p] = t.value;
        } else if (t.kind === "word" && info.enumValues.has(t.value)) {
          props[info.enumValues.get(t.value)!] = t.value;
        } else if (t.kind === "word" && info.booleans.has(t.value)) {
          props[t.value] = true;
        } else if (t.kind === "word" && t.value.startsWith("no-") && info.booleans.has(t.value.slice(3))) {
          props[t.value.slice(3)] = false;
        } else if (t.kind === "word" && ANTONYMS[t.value] && info.booleans.has(ANTONYMS[t.value])) {
          props[ANTONYMS[t.value]] = false; // `toggle off`, `checkbox unchecked`
        } else if (t.kind === "word" && WORD_PRIMARY.has(info.name) && !(PRIMARY_PROP[info.name] in props)) {
          props[PRIMARY_PROP[info.name]] = t.value; // `icon search`, `avatar JD`
        } else {
          const options = [...info.enumValues.keys(), ...info.booleans];
          issues.push({
            line: lineNo,
            message: `${info.name}: don't know what "${t.value}" is` +
              (options.length ? ` (bare words it accepts: ${options.join(", ")})` : "") +
              (PRIMARY_PROP[info.name] && !(PRIMARY_PROP[info.name] in props) ? `; quote text like "${t.value}"` : ""),
          });
        }
      }
    } catch (e) {
      issues.push({ line: lineNo, message: (e as Error).message });
      return;
    }

    const id = `${info.name.toLowerCase()}-${++n}`;
    elements[id] = { type: info.name, props, children: [] };
    lines[id] = lineNo;

    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) {
      elements[parent.id].children!.push(id);
    } else if (root === null) {
      root = id;
    } else {
      issues.push({ line: lineNo, message: "only one top-level element (the board) is allowed; indent this line" });
    }
    stack.push({ indent, id });
  });

  if (root === null && !issues.length) issues.push({ line: 1, message: "empty wireframe" });
  return { spec: root ? { root, elements } : null, issues, lines };
}
