/**
 * What the playground editor needs to highlight and autocomplete tsquare,
 * derived from the catalog and the parser so it can't drift from the language.
 * Served at /api/language.
 */
import { UNIVERSAL_PROPS, componentDefinitions, takesUniversalProps } from "../catalog.js";
import { ACCENTS } from "../colors.js";
import { iconNames } from "../icons.js";
import { PRIMARY_PROP, bareWords } from "../text.js";

export interface PropInfo {
  name: string;
  kind: "string" | "number" | "boolean" | "enum" | "list" | "object";
  /** Allowed values for enums (and booleans: true/false). */
  values?: string[];
  /** The value is a Lucide icon name (or a list of them). */
  icon?: boolean;
  /** The value is an accent color. */
  accent?: boolean;
  description?: string;
}

export interface ComponentInfo {
  /** Lowercase, as written: "listitem". */
  name: string;
  description: string;
  /** The prop a quoted string fills, if any. */
  main?: string;
  children: boolean;
  props: PropInfo[];
  /** Bare words this component accepts: option values, switch names and their off forms. */
  words: string[];
}

export interface LanguageData {
  components: ComponentInfo[];
  icons: string[];
  accents: string[];
}

function unwrap(t: any): any {
  let cur = t;
  while (cur && ["optional", "nullable", "default"].includes(cur.def?.type)) cur = cur.def.innerType;
  return cur;
}

function describe(name: string, schema: any): PropInfo {
  const s = unwrap(schema);
  const description: string | undefined = schema.description ?? s?.description;
  const iconish = /Lucide icon|Icon names/i.test(description ?? "");
  switch (s?.def?.type) {
    case "enum": return { name, kind: "enum", values: s.options, description };
    case "boolean": return { name, kind: "boolean", values: ["true", "false"], description };
    case "number": return { name, kind: "number", description };
    case "array": {
      const el = unwrap(s.def.element);
      const objects = el?.def?.type === "union" ? el.def.options.map(unwrap) : [el];
      const hasIcon = objects.some((x: any) => x?.def?.type === "object" && "icon" in x.shape);
      return { name, kind: "list", icon: iconish || hasIcon, description };
    }
    case "object": return { name, kind: "object", description };
    default: return { name, kind: "string", icon: iconish || undefined, accent: name === "accent" || undefined, description };
  }
}

let cache: LanguageData | null = null;

export function languageData(): LanguageData {
  if (cache) return cache;
  const components = Object.entries(componentDefinitions).map(([type, def]): ComponentInfo => {
    const shape = (def.props as any).shape as Record<string, any>;
    const props = Object.entries(shape).map(([name, schema]) => describe(name, schema));
    if (takesUniversalProps(type)) for (const [name, schema] of Object.entries(UNIVERSAL_PROPS)) props.push(describe(name, schema));
    // Icon's main text is an icon name: `icon search`
    if (type === "Icon") props.find((p) => p.name === "name")!.icon = true;
    const words = bareWords(type);
    const off = words.booleans.flatMap((b) => (b === "on" ? ["off"] : b === "checked" ? ["unchecked"] : [`no-${b}`]));
    return {
      name: type.toLowerCase(),
      description: def.description,
      main: PRIMARY_PROP[type],
      children: (def as { slots: string[] }).slots.length > 0,
      props,
      words: [...words.options.map((o) => o.value), ...words.booleans, ...off],
    };
  });
  cache = { components, icons: [...new Set(iconNames)].sort(), accents: Object.keys(ACCENTS) };
  return cache;
}
