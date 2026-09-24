"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStatement } from "@/app/(app)/materials/statement-actions";
import { useAction } from "@/lib/use-action";
import { limitState, statementKindLabel, type LimitState } from "@/lib/statements";

type StepStatement = { id: string; kind: string; title: string; status: string; words: number; word_limit: number | null };
const TONE: Record<LimitState, string> = { none: "text-gray-400", ok: "text-gray-400", near: "text-brass", over: "text-red-600" };

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
            <li key={s.id} className="border-b border-line/60 last:border-0">
              <Link href={`/materials/statements/${s.id}`} className="flex items-baseline justify-between gap-4 py-2 hover:text-brass">
                <span className="min-w-0"><span className="block truncate">{s.title}</span><span className="block text-xs text-gray-500">{statementKindLabel(s.kind)} · {s.status === "sent" ? "Sent" : s.status === "final" ? "Final" : "Draft"}</span></span>
                <span className={`text-xs font-mono whitespace-nowrap ${TONE[limitState(s.words, s.word_limit)]}`}>{s.words.toLocaleString()}{s.word_limit ? ` / ${s.word_limit.toLocaleString()}` : ""} words</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!hasSop && (
        <div className="flex flex-wrap items-center gap-4">
          {generalDrafts.map((g) => (
            <button key={g.id} disabled={pending} onClick={() => create(g.id)} className="text-brass hover:underline disabled:opacity-50">Create from &ldquo;{g.title}&rdquo;</button>
          ))}
          <button disabled={pending} onClick={() => create(null)} className="text-gray-500 hover:text-cream disabled:opacity-50">Start blank</button>
        </div>
      )}
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </div>
  );
}
