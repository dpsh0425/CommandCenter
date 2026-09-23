"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Params = { country?: string; status?: string; q?: string; verified?: string; sort?: string; researched?: string };

const STATUSES = ["not_started", "researching", "contacted", "replied", "submitted", "interview", "accepted", "rejected"];
const SORTS = [
  { key: "score", label: "Best fit first" },
  { key: "deadline", label: "Deadline soonest" },
  { key: "researched", label: "Most researched" },
  { key: "name", label: "Name" },
];
const sel = "border rounded px-2 py-1.5 text-sm bg-transparent";

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

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || undefined }); }}
      >
        <input name="q" defaultValue={p.q ?? ""} placeholder="Search schools, professors or research areas" className="border rounded px-3 py-1.5 text-sm flex-1 min-w-0" />
        <button className="border rounded px-3 py-1.5 text-sm hover:border-brass">Search</button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={p.country ?? ""} onChange={(e) => set({ country: e.target.value || undefined })} className={sel} aria-label="Country">
          <option value="">All countries</option><option>USA</option><option>Canada</option><option>Australia</option>
        </select>
        <select value={p.status ?? ""} onChange={(e) => set({ status: e.target.value || undefined })} className={sel} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={p.sort ?? "score"} onChange={(e) => set({ sort: e.target.value })} className={sel} aria-label="Sort">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-gray-500 cursor-pointer">
          <input type="checkbox" checked={p.researched === "1"} onChange={(e) => set({ researched: e.target.checked ? "1" : undefined })} /> Researched only
        </label>
        <label className="flex items-center gap-1.5 text-gray-500 cursor-pointer">
          <input type="checkbox" checked={p.verified === "1"} onChange={(e) => set({ verified: e.target.checked ? "1" : undefined })} /> Verified fit
        </label>
        {active && <button onClick={() => apply({})} className="text-xs text-gray-500 underline hover:text-cream">Clear</button>}
      </div>
    </div>
  );
}
