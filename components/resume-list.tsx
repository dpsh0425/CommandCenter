"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createResume, deleteResume } from "@/app/(app)/materials/actions";

export type ResumeRow = { id: string; name: string; updated_at: string };

export function ResumeList({ resumes }: { resumes: ResumeRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    start(async () => { try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } });
  };

  return (
    <div className={`flex flex-col gap-4 ${pending ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-3">
        <button onClick={() => run(async () => router.push(`/materials/resume/${await createResume()}`))} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm">New resume</button>
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </div>
      {resumes.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No resumes yet. Build one here, then make a copy for each kind of application (research-heavy, industry, a specific lab).</p>
      ) : (
        <ul className="flex flex-col">
          {resumes.map((r) => (
            <li key={r.id} className="group py-3 border-b border-line/60 last:border-0 flex items-baseline justify-between gap-3">
              <Link href={`/materials/resume/${r.id}`} className="min-w-0">
                <span className="font-medium hover:text-brass block truncate">{r.name}</span>
                <span className="text-xs text-gray-400">Edited {new Date(r.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              </Link>
              <div className="flex gap-3 text-xs text-gray-500 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                <button onClick={() => run(async () => router.push(`/materials/resume/${await createResume(undefined, r.id)}`))} className="hover:text-cream">Duplicate</button>
                <button onClick={() => { if (confirm(`Delete "${r.name}"?`)) run(async () => { await deleteResume(r.id); router.refresh(); }); }} className="hover:text-red-600" aria-label="Delete resume">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
