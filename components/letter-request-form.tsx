"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addLetterRequests } from "@/app/(app)/materials/letter-actions";
import { useAction } from "@/lib/use-action";
import { isFailure } from "@/lib/action-result";
import type { LetterRecord } from "@/lib/letters";

export type PersonOpt = { id: string; name: string; email: string | null };
export type SchoolOpt = { id: string; name: string; deadline_date: string | null; applying: boolean | null };

const field = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50";
const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function LetterRequestForm({ people, schools, letters }: { people: PersonOpt[]; schools: SchoolOpt[]; letters: LetterRecord[] }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const [recommender, setRecommender] = useState("");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const taken = new Set(recommender ? letters.filter((l) => l.recommender_id === recommender).map((l) => l.school_id) : []);
  const q = query.trim().toLowerCase();
  const shown = schools
    .filter((s) => !q || s.name.toLowerCase().includes(q))
    .sort((a, b) => Number(!!b.applying) - Number(!!a.applying));
  const picked = chosen.filter((id) => !taken.has(id));

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommender || picked.length === 0) return;
    setDone(null);
    run(async () => {
      const r = await addLetterRequests(recommender, picked, deadline || null);
      if (!isFailure(r)) {
        const { added, skipped } = r.data;
        setDone(`Added ${added} letter request${added === 1 ? "" : "s"}${skipped ? `, ${skipped} already existed` : ""}.`);
        setChosen([]);
        router.refresh();
      }
      return r;
    });
  };

  return (
    <details className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[15px] font-semibold text-slate-900">Request letters</span>
        <span className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-[13px] font-semibold text-white group-open:bg-slate-100 group-open:text-slate-700">
          <span className="group-open:hidden">+ Request letters</span><span className="hidden group-open:inline">Close</span>
        </span>
      </summary>
      <form onSubmit={submit} className="flex flex-col gap-4 border-t border-slate-200 p-5">
        {people.length === 0 ? (
          <p className="text-[13px] text-slate-600">Add a recommender on the <Link href="/people" className="font-medium text-blue-600 hover:text-blue-700">People page</Link> first.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                Recommender
                <select value={recommender} onChange={(e) => { setRecommender(e.target.value); setDone(null); }} className={field}>
                  <option value="">Choose a recommender</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                Letter deadline for all
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} />
                <span className="font-normal text-slate-500">Leave blank to use each school&rsquo;s own deadline.</span>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:max-w-sm">
                Find a school
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className={field} />
              </label>
              <ul className="max-h-56 divide-y divide-slate-100 overflow-auto rounded-md border border-slate-200">
                {shown.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No schools match.</li>}
                {shown.map((s) => {
                  const already = taken.has(s.id);
                  return (
                    <li key={s.id}>
                      <label className={`flex items-start gap-2.5 px-3 py-2 text-sm ${already ? "opacity-50" : "cursor-pointer hover:bg-slate-50"}`}>
                        <input type="checkbox" className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-600" disabled={already} checked={!already && chosen.includes(s.id)} onChange={() => toggle(s.id)} />
                        <span className="min-w-0 break-words text-slate-900">
                          {s.name}
                          {s.applying && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">Applying</span>}
                          {s.deadline_date && <span className="ml-2 text-xs text-slate-500">due {fmt(s.deadline_date)}</span>}
                          {already && <span className="ml-2 text-xs text-slate-500">(already requested)</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={pending || !recommender || picked.length === 0} className={primary}>Request letters ({picked.length})</button>
              {done && <span role="status" className="text-xs text-emerald-700">{done}</span>}
              {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
            </div>
          </>
        )}
      </form>
    </details>
  );
}
