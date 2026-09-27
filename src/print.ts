import type { Spec } from "@json-render/core";
import { componentDefinitions } from "./catalog";
import { PRIMARY_PROP } from "./text";

const BARE_WORD = /^[A-Za-z][\w-]*$/;
/** Props whose values read naturally as bare words (phone, primary, row, sm, left…). */
const BARE_PROPS = new Set(["device", "variant", "direction", "size", "side", "type", "layout"]);

function unwrap(t: any): any {
  let cur = t;
  while (cur && ["optional", "nullable", "default"].includes(cur.def?.type)) cur = cur.def.innerType;
  return cur;
}

function fmt(v: unknown): string {
  if (typeof v === "string") return BARE_WORD.test(v) && !["true", "false", "null"].includes(v) ? v : JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean" || v === null) return String(v);
  if (Array.isArray(v)) return `[${v.map(fmt).join(", ")}]`;
  if (typeof v === "object") {
    return `{${Object.entries(v as object).map(([k, x]) => `${k}=${fmt(x)}`).join(" ")}}`;
  }
  return JSON.stringify(v);
}

/** Enum values that can be written bare for a component (unambiguous only). */
function bareEnums(type: string) {
  const shape = (componentDefinitions as any)[type].props.shape;
  const seen = new Map<string, string>();
  const dup = new Set<string>();
  for (const [prop, s] of Object.entries(shape)) {
    const inner = unwrap(s);
    if (inner?.def?.type === "enum") {
      for (const v of inner.options) (seen.has(v) ? dup.add(v) : seen.set(v, prop));
    }
  }
  for (const d of dup) seen.delete(d);
  return seen;
}

function booleans(type: string) {
  const shape = (componentDefinitions as any)[type].props.shape;
  return new Set(Object.entries(shape).filter(([, s]) => unwrap(s)?.def?.type === "boolean").map(([k]) => k));
}

export function printWireframeText(spec: Spec, indentUnit = "  "): string {
  const out: string[] = [];
  const walk = (id: string, depth: number) => {
    const el = spec.elements[id];
    const props = { ...(el.props ?? {}) } as Record<string, unknown>;
    const parts: string[] = [el.type.toLowerCase()];
    const enums = bareEnums(el.type);
    const bools = booleans(el.type);
    const primary = PRIMARY_PROP[el.type];

    // bare enum words first (device, variant, direction…), then the quoted text, then the rest
    for (const [k, v] of Object.entries(props)) {
      if (typeof v === "string" && BARE_PROPS.has(k) && enums.get(v) === k) { parts.push(v); delete props[k]; }
    }
    if (primary && typeof props[primary] === "string") {
      parts.push(JSON.stringify(props[primary]));
      delete props[primary];
    }
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null) continue;
      if (v === true && bools.has(k)) parts.push(k);
      else parts.push(`${k}=${fmt(v)}`);
    }
    out.push(indentUnit.repeat(depth) + parts.join(" "));
    for (const c of el.children ?? []) walk(c, depth + 1);
  };
  walk(spec.root, 0);
  return out.join("\n") + "\n";
}
