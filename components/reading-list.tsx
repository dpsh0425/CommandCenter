"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updatePaper } from "@/app/(app)/research/project-actions";
import { PAPER_STATUS } from "@/lib/research";
import { bibtex, citationKey } from "@/lib/citation";

export type ReadingPaper = {
  id: string; project_id: string; projectTitle: string; title: string; authors: string | null; year: number | null;
  url: string | null; status: string; takeaway: string | null;
};

const TONE: Record<string, string> = {
  to_read: "border-slate-300 bg-white text-slate-600",
  reading: "border-blue-200 bg-blue-50 text-blue-700",
  read: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cite: "border-violet-200 bg-violet-50 text-violet-700",
};
// Reading first, then what is waiting, then what you will cite, then what is done.
const ORDER = ["reading", "to_read", "cite", "read"];

function PaperItem({ p }: { p: ReadingPaper }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "bib" | "failed" | null>(null);
  const key = citationKey(p);

  const copy = async (what: "key" | "bib") => {
    try {
      await navigator.clipboard.writeText(what === "key" ? key : bibtex(p));
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch { setCopied("failed"); }
  };

  return (
    <li className={`flex flex-col gap-3 border-b border-slate-100 py-3.5 last:border-0 sm:flex-row sm:items-start ${pending ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {p.url ? (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-semibold text-slate-900 hover:text-blue-700">{p.title} <span aria-hidden className="text-xs text-slate-400">↗</span></a>
        ) : (
          <span className="break-words text-sm font-semibold text-slate-900">{p.title}</span>
        )}
        {(p.authors || p.year) && <span className="text-xs text-slate-500">{[p.authors, p.year].filter(Boolean).join(" · ")}</span>}
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/research/projects/${p.project_id}?tab=reading`} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-slate-200">{p.projectTitle}</Link>
          <code className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700">{key}</code>
          <button type="button" onClick={() => copy("key")} className="h-6 rounded px-1.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50">{copied === "key" ? "Copied" : "Copy key"}</button>
          <button type="button" onClick={() => copy("bib")} className="h-6 rounded px-1.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50">{copied === "bib" ? "Copied" : "Copy BibTeX"}</button>
          {copied === "failed" && <span role="alert" className="text-[11px] text-red-700">Copy failed</span>}
        </div>
        {p.takeaway && <p className="whitespace-pre-line rounded-md bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700">{p.takeaway}</p>}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
      <select
        value={p.status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setError(null);
          start(async () => {
            try {
              await updatePaper(p.id, p.project_id, { status: next });
              // The action refreshes /research and the project; this page needs its own refresh.
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not update");
            }
          });
        }}
        className={`h-7 flex-shrink-0 cursor-pointer self-start rounded-full border px-2 text-xs font-medium disabled:opacity-60 ${TONE[p.status] ?? TONE.to_read}`}
        aria-label={`Reading status for ${p.title}`}
      >
        {PAPER_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </li>
  );
}

export function ReadingList({ papers, projects }: { papers: ReadingPaper[]; projects: Array<{ id: string; title: string }> }) {
  const [status, setStatus] = useState<string>("all");
  const [project, setProject] = useState<string>("");
  const inProject = project ? papers.filter((p) => p.project_id === project) : papers;
  const shown = (status === "all" ? inProject : inProject.filter((p) => p.status === status))
    .slice()
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const count = (k: string) => inProject.filter((p) => p.status === k).length;
  const chip = (on: boolean) =>
    `h-8 rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          <button type="button" aria-pressed={status === "all"} onClick={() => setStatus("all")} className={chip(status === "all")}>All {inProject.length}</button>
          {PAPER_STATUS.map((s) => (
            <button key={s.key} type="button" aria-pressed={status === s.key} onClick={() => setStatus(s.key)} className={chip(status === s.key)}>{s.label} {count(s.key)}</button>
          ))}
        </div>
        {projects.length > 1 && (
          <select
            value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project"
            className="ml-auto h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">No papers match these filters.</p>
      ) : (
        <ul className="rounded-lg border border-slate-200 bg-white px-5">{shown.map((p) => <PaperItem key={p.id} p={p} />)}</ul>
      )}
      <p className="text-xs text-slate-500">Citation keys and BibTeX are made from each paper&apos;s title, authors, year and link. Check them before you cite.</p>
    </div>
  );
}
