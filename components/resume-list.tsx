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
    start(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className={`flex flex-col gap-6 font-sans ${pending ? "opacity-70" : ""}`}>
      {/* Primary Action Row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            run(async () => {
              const id = await createResume();
              router.push(`/materials/resume/${id}`);
            })
          }
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg px-4 py-2 text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
        >
          <span>New resume</span>
        </button>
        {error && <span className="text-rose-600 text-xs font-medium">{error}</span>}
      </div>

      {/* Resume Cards Container */}
      {resumes.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-500 bg-white">
          No resumes yet. Build one here, then make a copy for each kind of application (research-heavy, industry, a specific lab).
        </div>
      ) : (
        <ul className="flex flex-col border border-slate-200 bg-white rounded-xl divide-y divide-slate-100 shadow-2xs">
          {resumes.map((r) => (
            <li
              key={r.id}
              className="group p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <Link
                href={`/materials/resume/${r.id}`}
                className="min-w-0 flex flex-col gap-0.5 group/link"
              >
                <span className="font-semibold text-sm text-slate-900 group-hover/link:text-blue-600 transition-colors truncate">
                  {r.name || "My resume"}
                </span>
                <span className="text-xs text-slate-500">
                  Edited{" "}
                  {new Date(r.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </Link>

              <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() =>
                    run(async () => {
                      const id = await createResume(undefined, r.id);
                      router.push(`/materials/resume/${id}`);
                    })
                  }
                  className="hover:text-slate-900 font-medium transition-colors px-2 py-1 rounded-md hover:bg-slate-200/60 cursor-pointer"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${r.name}"?`))
                      run(async () => {
                        await deleteResume(r.id);
                        router.refresh();
                      });
                  }}
                  className="hover:text-rose-600 font-bold transition-colors p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                  aria-label="Delete resume"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}