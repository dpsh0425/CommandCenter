export type DiffPart = { type: "same" | "add" | "del"; text: string };

const MAX_CELLS = 4_000_000;

const tokens = (s: string) => s.split(/\s+/).filter(Boolean);

function push(parts: DiffPart[], type: DiffPart["type"], word: string) {
  const last = parts[parts.length - 1];
  if (last && last.type === type) last.text += ` ${word}`;
  else parts.push({ type, text: word });
}

// A word-level difference (longest common subsequence). Very long inputs are shown as one removal and one addition.
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length === 0 && b.length === 0) return [];
  if ((a.length + 1) * (b.length + 1) > MAX_CELLS) {
    const parts: DiffPart[] = [];
    if (a.length) parts.push({ type: "del", text: a.join(" ") });
    if (b.length) parts.push({ type: "add", text: b.join(" ") });
    return parts;
  }
  const w = b.length + 1;
  const table = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * w + j] = a[i] === b[j] ? table[(i + 1) * w + j + 1] + 1 : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push(parts, "same", a[i]); i++; j++; }
    else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) { push(parts, "del", a[i]); i++; }
    else { push(parts, "add", b[j]); j++; }
  }
  while (i < a.length) push(parts, "del", a[i++]);
  while (j < b.length) push(parts, "add", b[j++]);
  return parts;
}
