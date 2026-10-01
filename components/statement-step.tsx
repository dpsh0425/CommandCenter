"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStatement } from "@/app/(app)/materials/statement-actions";
import { useAction } from "@/lib/use-action";
import { limitState, statementKindLabel, type LimitState } from "@/lib/statements";

type StepStatement = { id: string; kind: string; title: string; status: string; words: number; word_limit: number | null };
const TONE: Record<LimitState, string> = { none: "text-slate-500", ok: "text-slate-500", near: "text-blue-700", over: "text-red-700" };

export function StatementStep({ schoolId, statements, generalDrafts }: { schoolId: string; statements: StepStatement[]; generalDrafts: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const hasSop = statements.some((s) => s.kind === "statement_of_purpose");

  const create = (fromId: string | null) => {
    run(async () => {
      const r = await createStatement({ kind: "statement_of_purpose", schoolId, fromId });
      if (r.ok) router.push(`/materials/statements/${r.data}`);
      return r;
    });
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      {statements.length > 0 && (
        <ul className="flex flex-col">
          {statements.map((s) => (
            <li key={s.id}>
              <Link href={`/materials/statements/${s.id}`} className="flex items-center justify-between gap-4 rounded-md px-3 py-2 transition-colors hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{s.title}</span>
                  <span className="block text-xs text-slate-500">{statementKindLabel(s.kind)} · {s.status === "sent" ? "Sent" : s.status === "final" ? "Final" : "Draft"}</span>
                </span>
                <span className={`whitespace-nowrap font-mono text-xs ${TONE[limitState(s.words, s.word_limit)]}`}>
                  {s.words.toLocaleString()}{s.word_limit ? ` / ${s.word_limit.toLocaleString()}` : ""} words
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!hasSop && (
        <div className="flex flex-wrap items-center gap-2">
          {generalDrafts.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={pending}
              onClick={() => create(g.id)}
              className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
            >
              Create from &ldquo;{g.title}&rdquo;
            </button>
          ))}
          <button
            type="button"
            disabled={pending}
            onClick={() => create(null)}
            className="h-8 rounded-md px-2.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
          >
            Start blank
          </button>
        </div>
      )}
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
