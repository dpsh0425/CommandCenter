"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as materialsActions from "@/app/(app)/materials/actions";

const createStatement = (materialsActions as any).createStatement as (
  id?: string,
  duplicatedFrom?: string,
) => Promise<string>;
const deleteStatement = (materialsActions as any).deleteStatement as
  | ((id: string) => Promise<void>)
  | undefined;

export type StatementRow = {
  id: string;
  kind: string;
  title: string;
  status: string;
  words: number | null;
  word_limit: number | null;
  school_id: string | null;
  updated_at: string;
};

export function StatementsList({
  statements,
  schools,
}: {
  statements: StatementRow[];
  schools: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

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
      {/* Primary Action Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            run(async () => {
              const id = await createStatement();
              router.push(`/materials/statements/${id}`);
            })
          }
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg px-4 py-2 text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
        >
          <span>New statement</span>
        </button>
        {error && <span className="text-rose-600 text-xs font-medium">{error}</span>}
      </div>

      {/* Statement Cards Container */}
      {statements.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-500 bg-white">
          No statements drafted yet. Draft personal statements and SOPs tailored to each school.
        </div>
      ) : (
        <ul className="flex flex-col border border-slate-200 bg-white rounded-xl divide-y divide-slate-100 shadow-2xs">
          {statements.map((s) => {
            const schoolName = s.school_id ? schoolMap.get(s.school_id) : null;
            return (
              <li
                key={s.id}
                className="group p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <Link
                  href={`/materials/statements/${s.id}`}
                  className="min-w-0 flex flex-col gap-0.5 group/link"
                >
                  <span className="font-semibold text-sm text-slate-900 group-hover/link:text-blue-600 transition-colors truncate">
                    {s.title || "Untitled Statement"}
                  </span>
                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    {schoolName && <span className="text-slate-700 font-medium">For {schoolName}</span>}
                    {schoolName && <span>·</span>}
                    {s.words !== null && <span>{s.words} words</span>}
                    {s.word_limit && <span>/ {s.word_limit} limit</span>}
                    {(s.words !== null || s.word_limit) && <span>·</span>}
                    <span>
                      Edited{" "}
                      {new Date(s.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
                  {s.status && (
                    <span className="text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md capitalize">
                      {s.status.replace("_", " ")}
                    </span>
                  )}
                  <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() =>
                        run(async () => {
                          const id = await createStatement(undefined, s.id);
                          router.push(`/materials/statements/${id}`);
                        })
                      }
                      className="hover:text-slate-900 font-medium transition-colors px-2 py-1 rounded-md hover:bg-slate-200/60 cursor-pointer"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${s.title}"?`))
                          run(async () => {
                            await deleteStatement(s.id);
                            router.refresh();
                          });
                      }}
                      className="hover:text-rose-600 font-bold transition-colors p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                      aria-label="Delete statement"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}