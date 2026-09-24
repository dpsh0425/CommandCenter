"use client";
import { useMemo } from "react";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";
import { wordDiff } from "@/lib/word-diff";

export function VersionDiff({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => wordDiff(htmlToText(toEditorHtml(before)), htmlToText(toEditorHtml(after))), [before, after]);
  const count = (type: "add" | "del") => parts.filter((p) => p.type === type).reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
  const removed = count("del");
  const added = count("add");
  if (removed === 0 && added === 0) return <p className="text-xs text-gray-500 mt-2">This version matches your current text.</p>;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-xs text-gray-400">From this version to your current text: struck-through words were removed, highlighted words were added.</p>
      <p className="font-mono text-xs text-gray-500">{removed.toLocaleString()} {removed === 1 ? "word" : "words"} removed, {added.toLocaleString()} added</p>
      <p className="max-h-72 overflow-auto text-sm leading-relaxed whitespace-pre-wrap border border-line rounded p-3">
        {parts.map((p, i) =>
          <span key={i}>
            {i > 0 ? " " : ""}
            {p.type === "del" ? <del className="text-red-600 line-through bg-red-600/10">{p.text}</del>
              : p.type === "add" ? <ins className="text-teal-600 no-underline bg-teal-600/10">{p.text}</ins>
              : p.text}
          </span>,
        )}
      </p>
    </div>
  );
}
