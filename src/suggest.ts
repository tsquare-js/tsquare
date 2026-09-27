// Close-match suggestions for error messages, so a model (or person) can fix a typo in one step.

/** Edit distance counting a swap of neighbouring letters as one edit ("serach" → search). */
export function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Up to `limit` candidates within a small edit distance of `word`, closest first. */
export function closeMatches(word: string, candidates: string[], limit = 3): string[] {
  const q = word.toLowerCase();
  const maxEdits = Math.max(1, Math.floor(q.length / 3));
  return candidates
    .map((c) => [c, editDistance(q, c.toLowerCase())] as const)
    .filter(([, d]) => d <= maxEdits)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([c]) => c);
}

export function unknownComponentMessage(name: string, components: string[]) {
  const close = closeMatches(name, components);
  return close.length
    ? `unknown component "${name}" (did you mean ${close.join(", ")}?)`
    : `unknown component "${name}" (components: ${components.join(", ")})`;
}
