import { countWords } from "@/lib/research";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";

export type TextMetrics = { words: number; characters: number; charactersNoSpaces: number; paragraphs: number; readingMinutes: number };

// Counts as a portal would: visible characters with spaces, each paragraph break as one character.
export function textMetrics(stored: string): TextMetrics {
  const text = htmlToText(toEditorHtml(stored));
  const words = countWords(text);
  return {
    words,
    characters: text.replace(/\n{2,}/g, "\n").length,
    charactersNoSpaces: text.replace(/\s/g, "").length,
    paragraphs: text.split(/\n{2,}/).filter((p) => p.trim()).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / 200)),
  };
}
