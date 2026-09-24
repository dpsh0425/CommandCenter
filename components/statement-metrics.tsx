"use client";
import { textMetrics } from "@/lib/text-metrics";
import { limitParts, type LimitState } from "@/lib/statements";

const TONE: Record<LimitState, string> = { none: "text-gray-400", ok: "text-gray-400", near: "text-brass", over: "text-red-600" };

export function StatementMetrics({ text, wordLimit, charLimit }: { text: string; wordLimit: number | null; charLimit: number | null }) {
  const m = textMetrics(text);
  const parts = limitParts({ words: m.words, characters: m.characters }, { wordLimit, charLimit });
  return (
    <div className="flex flex-col gap-0.5 font-mono text-xs">
      {parts.length === 0 ? (
        <span className="text-gray-400">{m.words.toLocaleString()} words</span>
      ) : (
        <span className="flex flex-wrap gap-x-4">
          {parts.map((p) => (
            <span key={p.unit} className={TONE[p.state]}>
              {p.used.toLocaleString()} of {p.limit.toLocaleString()} {p.unit}
              {p.state === "over" ? ` · ${p.over.toLocaleString()} over` : p.state === "near" ? " · close to the limit" : ""}
            </span>
          ))}
        </span>
      )}
      <span className="text-gray-500">
        {m.characters.toLocaleString()} characters · {m.charactersNoSpaces.toLocaleString()} without spaces · {m.paragraphs.toLocaleString()} {m.paragraphs === 1 ? "paragraph" : "paragraphs"}
        {m.words > 0 && m.readingMinutes > 0 ? ` · about ${m.readingMinutes} min read` : ""}
      </span>
    </div>
  );
}
