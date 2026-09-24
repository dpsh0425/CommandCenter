import { countWords } from "@/lib/research";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";

export type Hint = { kind: "long_sentence" | "same_start" | "repeated_word"; message: string; example?: string };

const LONG_SENTENCE = 40;
const MAX_HINTS = 8;
const STOP = new Set([
  "about", "after", "again", "against", "before", "being", "between", "could", "every", "first", "great", "their", "there", "these",
  "those", "through", "under", "until", "where", "which", "while", "would", "other", "another", "because", "during", "should", "still",
]);

function sentencesOf(text: string): string[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}
const wordsOf = (s: string) => s.toLowerCase().match(/[a-z0-9'’-]+/g) ?? [];
const snippet = (s: string) => (s.length > 70 ? `${s.slice(0, 70).trimEnd()}…` : s);

// Suggestions only: nothing is changed and nothing leaves the browser.
export function writingHints(stored: string): Hint[] {
  const ss = sentencesOf(htmlToText(toEditorHtml(stored)));
  if (ss.length === 0) return [];
  const hints: Hint[] = [];

  for (const s of ss) {
    const n = countWords(s);
    if (n > LONG_SENTENCE) hints.push({ kind: "long_sentence", message: `A ${n}-word sentence. Consider splitting it.`, example: snippet(s) });
  }

  if (ss.length >= 4) {
    const starts = new Map<string, number>();
    for (const s of ss) {
      const first = wordsOf(s)[0];
      if (first) starts.set(first, (starts.get(first) ?? 0) + 1);
    }
    starts.forEach((count, word) => {
      if (count >= 3 && count / ss.length >= 0.25) {
        const shown = word === "i" ? "I" : word;
        hints.push({ kind: "same_start", message: `${count} of ${ss.length} sentences start with "${shown}".` });
      }
    });
  }

  const reported = new Set<string>();
  for (let i = 0; i < ss.length; i++) {
    const counts = new Map<string, number>();
    for (const w of wordsOf(`${ss[i]} ${ss[i + 1] ?? ""}`)) {
      if (w.length >= 5 && !STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    counts.forEach((count, word) => {
      if (count >= 3 && !reported.has(word)) {
        reported.add(word);
        hints.push({ kind: "repeated_word", message: `"${word}" is used ${count} times within two sentences.` });
      }
    });
  }

  return hints.slice(0, MAX_HINTS);
}
