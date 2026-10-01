"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";

type Params = { country?: string; status?: string; q?: string; verified?: string; sort?: string; researched?: string };

const STATUSES = ["not_started", "researching", "contacted", "replied", "submitted", "interview", "accepted", "rejected"];
const SORTS = [
  { key: "score", label: "Best fit first" },
  { key: "deadline", label: "Deadline soonest" },
  { key: "researched", label: "Most researched" },
  { key: "name", label: "Name" },
];
const sel = "h-9 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900";
const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

// One compact row instead of a wall of pills. Any change applies immediately.
export function SchoolFilters({ initial }: { initial: Params }) {
  const router = useRouter();
  const [p, setP] = useState<Params>(initial);

  function apply(next: Params) {
    setP(next);
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "sort" && v === "score")) sp.set(k, v);
    router.push(sp.toString() ? `/schools?${sp}` : "/schools");
  }
  const set = (patch: Params) => apply({ ...p, ...patch });
  const active = Boolean(p.country || p.status || p.q || p.verified || p.researched);
  const chip = (on: boolean) =>
    `h-[30px] rounded-full border px-3 text-xs font-medium transition-colors ${
      on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="relative min-w-0 flex-1 basis-64 sm:max-w-sm"
        onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || undefined }); }}
        role="search"
      >
        <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
        <input
          name="q"
          defaultValue={p.q ?? ""}
          placeholder="Search schools, professors or research areas"
          aria-label="Search schools"
          className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600"
        />
      </form>
      <select value={p.country ?? ""} onChange={(e) => set({ country: e.target.value || undefined })} className={sel} aria-label="Country">
        <option value="">All countries</option><option>USA</option><option>Canada</option><option>Australia</option>
      </select>
      <select value={p.status ?? ""} onChange={(e) => set({ status: e.target.value || undefined })} className={sel} aria-label="Status">
        <option value="">Any status</option>
        {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
      </select>
      <select value={p.sort ?? "score"} onChange={(e) => set({ sort: e.target.value })} className={sel} aria-label="Sort">
        {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <button type="button" aria-pressed={p.researched === "1"} onClick={() => set({ researched: p.researched === "1" ? undefined : "1" })} className={chip(p.researched === "1")}>
        Researched only
      </button>
      <button type="button" aria-pressed={p.verified === "1"} onClick={() => set({ verified: p.verified === "1" ? undefined : "1" })} className={chip(p.verified === "1")}>
        Verified fit
      </button>
      {active && (
        <button type="button" onClick={() => apply({})} className="text-[13px] font-medium text-blue-600 hover:text-blue-700">
          Clear filters
        </button>
      )}
    </div>
  );
}
