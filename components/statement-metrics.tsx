"use client";
import { textMetrics } from "@/lib/text-metrics";
import { limitParts, type LimitState } from "@/lib/statements";

const TONE: Record<LimitState, string> = { none: "text-slate-600", ok: "text-slate-600", near: "text-blue-700", over: "font-medium text-red-700" };
const BAR: Record<LimitState, string> = { none: "bg-blue-600", ok: "bg-blue-600", near: "bg-blue-700", over: "bg-red-600" };

export function StatementMetrics({ text, wordLimit, charLimit }: { text: string; wordLimit: number | null; charLimit: number | null }) {
  const m = textMetrics(text);
  const parts = limitParts({ words: m.words, characters: m.characters }, { wordLimit, charLimit });
  return (
    <div className="flex flex-col gap-1 text-xs">
      {parts.length === 0 ? (
        <span className="tabular-nums text-slate-600">{m.words.toLocaleString()} words</span>
      ) : (
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          {parts.map((p) => (
            <span key={p.unit} className={`flex items-center gap-2 tabular-nums ${TONE[p.state]}`}>
              <span aria-hidden className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                <span className={`block h-full rounded-full ${BAR[p.state]}`} style={{ width: `${Math.min(100, Math.round((p.used / p.limit) * 100))}%` }} />
              </span>
              {p.used.toLocaleString()} of {p.limit.toLocaleString()} {p.unit}
              {p.state === "over" ? ` · ${p.over.toLocaleString()} over` : p.state === "near" ? " · close to the limit" : ""}
            </span>
          ))}
        </span>
      )}
      <span className="text-slate-500">
        {m.characters.toLocaleString()} characters · {m.charactersNoSpaces.toLocaleString()} without spaces · {m.paragraphs.toLocaleString()} {m.paragraphs === 1 ? "paragraph" : "paragraphs"}
        {m.words > 0 && m.readingMinutes > 0 ? ` · about ${m.readingMinutes} min read` : ""}
      </span>
    </div>
  );
}
