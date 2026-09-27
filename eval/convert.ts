import type { Spec } from "@json-render/core";

type Nested = { type: string; props: Record<string, unknown>; children: Nested[] };

export function flatToNested(spec: Spec): Nested {
  const walk = (id: string): Nested => {
    const e = spec.elements[id];
    return { type: e.type, props: (e.props ?? {}) as Record<string, unknown>, children: (e.children ?? []).map(walk) };
  };
  return walk(spec.root);
}
