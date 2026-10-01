"use client";
import { useMemo } from "react";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";
import { wordDiff } from "@/lib/word-diff";

export function VersionDiff({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => wordDiff(htmlToText(toEditorHtml(before)), htmlToText(toEditorHtml(after))), [before, after]);
  const count = (type: "add" | "del") => parts.filter((p) => p.type === type).reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
  const removed = count("del");
  const added = count("add");
  if (removed === 0 && added === 0) return <p className="mt-3 text-[13px] text-slate-500">This version matches your current text.</p>;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">{added.toLocaleString()} added</span>
        <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-800 line-through">{removed.toLocaleString()} removed</span>
        <span className="text-slate-500">From this version to your current text.</span>
      </div>
      <p className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-4 [font-family:Georgia,serif] text-[15px] leading-7 text-slate-800">
        {parts.map((p, i) =>
          <span key={i}>
            {i > 0 ? " " : ""}
            {p.type === "del" ? <del className="rounded-sm bg-red-50 text-red-800 line-through">{p.text}</del>
              : p.type === "add" ? <ins className="rounded-sm bg-emerald-50 text-emerald-800 no-underline">{p.text}</ins>
              : p.text}
          </span>,
        )}
      </p>
    </div>
  );
}
