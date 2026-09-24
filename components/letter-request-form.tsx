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

const field = "border rounded px-2 py-1.5 text-sm w-full";
const primary = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass";
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
    <details className="rounded border border-line">
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">Request letters</summary>
      <form onSubmit={submit} className="flex flex-col gap-4 border-t border-line p-4">
        {people.length === 0 ? (
          <p className="text-sm text-gray-500">Add a recommender on the <Link href="/people" className="text-brass hover:underline">People page</Link> first.</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-500 max-w-sm">
              Recommender
              <select value={recommender} onChange={(e) => { setRecommender(e.target.value); setDone(null); }} className={field + " bg-transparent text-cream"}>
                <option value="">Choose a recommender</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>

            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm text-gray-500 max-w-sm">
                Find a school
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className={field + " text-cream"} />
              </label>
              <ul className="max-h-56 overflow-auto rounded border border-line divide-y divide-line/60">
                {shown.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No schools match.</li>}
                {shown.map((s) => {
                  const already = taken.has(s.id);
                  return (
                    <li key={s.id}>
                      <label className={`flex items-start gap-2 px-3 py-2 text-sm ${already ? "opacity-50" : "cursor-pointer hover:bg-surface-raised"}`}>
                        <input type="checkbox" className="mt-1 shrink-0" disabled={already} checked={!already && chosen.includes(s.id)} onChange={() => toggle(s.id)} />
                        <span className="min-w-0 break-words">
                          {s.name}
                          {s.applying && <span className="ml-2 text-xs rounded border border-brass text-brass px-1.5 py-0.5">applying</span>}
                          {s.deadline_date && <span className="ml-2 text-xs text-gray-500">due {fmt(s.deadline_date)}</span>}
                          {already && <span className="ml-2 text-xs text-gray-400">already requested</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <label className="flex flex-col gap-1 text-sm text-gray-500 max-w-sm">
              Letter deadline for all
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field + " text-cream"} />
              <span className="text-xs text-gray-400">Leave blank to use each school&rsquo;s own deadline.</span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={pending || !recommender || picked.length === 0} className={primary}>Request letters ({picked.length})</button>
              {done && <span role="status" className="text-xs text-teal-600">{done}</span>}
              {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
            </div>
          </>
        )}
      </form>
    </details>
  );
}
