"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createResume, deleteResume } from "@/app/(app)/materials/actions";

export type ResumeRow = { id: string; name: string; updated_at: string };

function PaperThumb() {
  return (
    <span aria-hidden className="block h-[132px] rounded-t bg-white px-3.5 py-3 shadow-sm">
      <span className="mx-auto mb-1.5 block h-[7px] w-1/2 rounded-sm bg-slate-700" />
      <span className="mx-auto mb-2.5 block h-1 w-[70%] rounded-sm bg-slate-300" />
      <span className="mb-1.5 block h-[5px] w-[30%] rounded-sm bg-slate-500" />
      <span className="mb-1 block h-1 rounded-sm bg-slate-200" />
      <span className="mb-2.5 block h-1 w-[85%] rounded-sm bg-slate-200" />
      <span className="mb-1.5 block h-[5px] w-[30%] rounded-sm bg-slate-500" />
      <span className="mb-1 block h-1 rounded-sm bg-slate-200" />
    </span>
  );
}

export function ResumeList({ resumes }: { resumes: ResumeRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

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

  const create = () =>
    run(async () => {
      const id = await createResume();
      router.push(`/materials/resume/${id}`);
    });

  return (
    <div className={`flex flex-col gap-4 ${pending ? "cursor-progress" : ""}`}>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {resumes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No resumes yet</p>
          <p className="max-w-md text-[13px] text-slate-500">Build one here, then make a copy for each kind of application (research-heavy, industry, a specific lab).</p>
          <button type="button" disabled={pending} onClick={create} className="h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">+ New resume</button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((r) => (
            <li key={r.id} className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300">
              <Link href={`/materials/resume/${r.id}`} className="block bg-slate-100 px-7 pt-[18px]" aria-label={`Open ${r.name || "My resume"}`}>
                <PaperThumb />
              </Link>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/materials/resume/${r.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-blue-700">{r.name || "My resume"}</Link>
                  <span className="text-xs text-slate-500">Edited {new Date(r.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                {asking === r.id ? (
                  <span role="group" aria-label={`Delete ${r.name}?`} className="inline-flex items-center gap-1.5 rounded-md bg-red-50 py-0.5 pl-2.5 pr-1 text-xs text-red-800">
                    Delete?
                    <button
                      type="button" disabled={pending}
                      onClick={() => { setAsking(null); run(async () => { await deleteResume(r.id); router.refresh(); }); }}
                      className="h-6 rounded bg-red-600 px-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Remove
                    </button>
                    <button type="button" onClick={() => setAsking(null)} className="h-6 rounded px-2 font-medium text-slate-700 hover:bg-white">Keep</button>
                  </span>
                ) : (
                  <span className="flex">
                    <button
                      type="button" disabled={pending}
                      onClick={() => run(async () => { const id = await createResume(undefined, r.id); router.push(`/materials/resume/${id}`); })}
                      className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button" disabled={pending} onClick={() => setAsking(r.id)}
                      className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </span>
                )}
              </div>
            </li>
          ))}
          <li>
            <button
              type="button" disabled={pending} onClick={create}
              className="flex h-full min-h-[210px] w-full flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-slate-300 bg-white text-sm font-medium text-slate-600 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-60"
            >
              + New resume
              <span className="text-xs font-normal text-slate-500">or duplicate one to tailor it</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
