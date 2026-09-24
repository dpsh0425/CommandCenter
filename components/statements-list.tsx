"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStatement } from "@/app/(app)/materials/statement-actions";
import { STATEMENT_KINDS, limitState, statementKindLabel, type LimitState } from "@/lib/statements";

export type StatementRow = {
  id: string; kind: string; title: string; status: string; words: number; word_limit: number | null; school_id: string | null; updated_at: string;
};
type SchoolOpt = { id: string; name: string };

const field = "border rounded px-2 py-1.5 text-sm w-full";
const LIMIT_TONE: Record<LimitState, string> = { none: "text-gray-400", ok: "text-gray-400", near: "text-brass", over: "text-red-600" };
const STATUS_TONE: Record<string, string> = { draft: "text-gray-500", final: "text-teal-600", sent: "text-teal-600" };
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Row({ s, schoolName }: { s: StatementRow; schoolName?: string }) {
  const state = limitState(s.words, s.word_limit);
  return (
    <li className="border-b border-line/60 last:border-0">
      <Link href={`/materials/statements/${s.id}`} className="flex items-baseline justify-between gap-4 py-3 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
        <span className="min-w-0">
          <span className="block font-medium truncate">{s.title}</span>
          <span className="block text-xs text-gray-500 truncate">{[statementKindLabel(s.kind), schoolName, `edited ${when(s.updated_at)}`].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="text-right whitespace-nowrap">
          <span className={`block text-sm ${STATUS_TONE[s.status]}`}>{s.status === "sent" ? "Sent" : s.status === "final" ? "Final" : "Draft"}</span>
          <span className={`block text-xs font-mono ${LIMIT_TONE[state]}`}>{s.words.toLocaleString()}{s.word_limit ? ` / ${s.word_limit.toLocaleString()}` : ""} words</span>
        </span>
      </Link>
    </li>
  );
}

export function StatementsList({ statements, schools }: { statements: StatementRow[]; schools: SchoolOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("statement_of_purpose");
  const [schoolId, setSchoolId] = useState("");
  const [fromGeneral, setFromGeneral] = useState(true);

  const schoolName = new Map(schools.map((s) => [s.id, s.name]));
  const general = statements.filter((s) => !s.school_id);
  const tailored = statements.filter((s) => s.school_id);
  const generalOfKind = general.find((g) => g.kind === kind);
  const bySchool = new Map<string, StatementRow[]>();
  tailored.forEach((s) => bySchool.set(s.school_id!, [...(bySchool.get(s.school_id!) ?? []), s]));

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-3 text-sm border-b border-line pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            try {
              const id = await createStatement({ kind, schoolId: schoolId || null, fromId: schoolId && fromGeneral && generalOfKind ? generalOfKind.id : null });
              router.push(`/materials/statements/${id}`);
            } catch (err) { setError(err instanceof Error ? err.message : "Could not create the statement."); }
          });
        }}
      >
        <div className="flex flex-wrap gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field + " max-w-[13rem] bg-transparent"} aria-label="Statement type">
            {STATEMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={field + " max-w-[18rem] bg-transparent"} aria-label="School">
            <option value="">General draft (not for one school)</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 disabled:opacity-50">{pending ? "Creating…" : "New statement"}</button>
        </div>
        {schoolId && generalOfKind && (
          <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
            <input type="checkbox" checked={fromGeneral} onChange={(e) => setFromGeneral(e.target.checked)} /> Start from my general {statementKindLabel(kind).toLowerCase()} (copies its text and prompt)
          </label>
        )}
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </form>

      {statements.length === 0 ? (
        <p className="text-sm text-gray-500">No statements yet. Start with a general draft, then make a tailored version for each school from it, each with its own prompt and word limit.</p>
      ) : (
        <>
          <section className="flex flex-col">
            <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">General drafts</h2>
            {general.length === 0 ? <p className="text-sm text-gray-400 py-3">None yet.</p> : <ul>{general.map((s) => <Row key={s.id} s={s} />)}</ul>}
          </section>
          {Array.from(bySchool.entries()).length > 0 && (
            <section className="flex flex-col">
              <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">By school</h2>
              <ul>{tailored.map((s) => <Row key={s.id} s={s} schoolName={schoolName.get(s.school_id!)} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
