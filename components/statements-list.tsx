"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStatement, deleteStatement } from "@/app/(app)/materials/statement-actions";
import { useAction } from "@/lib/use-action";
import { STATEMENT_KINDS, limitState, statementKindLabel, type LimitState } from "@/lib/statements";

export type StatementRow = {
  id: string; kind: string; title: string; status: string; words: number; word_limit: number | null; school_id: string | null; updated_at: string;
};
type SchoolOpt = { id: string; name: string };

const field = "h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const LIMIT_TEXT: Record<LimitState, string> = { none: "text-slate-600", ok: "text-slate-600", near: "text-blue-700", over: "font-medium text-red-700" };
const LIMIT_BAR: Record<LimitState, string> = { none: "bg-blue-600", ok: "bg-blue-600", near: "bg-blue-700", over: "bg-red-600" };
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  final: { label: "Final", cls: "bg-blue-100 text-blue-800" },
  sent: { label: "Sent", cls: "bg-emerald-50 text-emerald-700" },
};
const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Row({ s, onDelete, pending }: { s: StatementRow; onDelete: (s: StatementRow) => void; pending: boolean }) {
  const [asking, setAsking] = useState(false);
  const state = limitState(s.words, s.word_limit);
  const pct = s.word_limit ? Math.min(100, Math.round((s.words / s.word_limit) * 100)) : 0;
  const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.draft;
  return (
    <li className="group flex items-center gap-2 rounded-md transition-colors hover:bg-slate-50">
      <Link href={`/materials/statements/${s.id}`} className="grid min-w-0 flex-1 grid-cols-1 items-center gap-x-4 gap-y-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_14rem_4.5rem]">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{s.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">{statementKindLabel(s.kind)}</span>
            <span className="text-[11px] text-slate-500">edited {when(s.updated_at)}</span>
          </span>
        </span>
        <span className="flex flex-col gap-1">
          <span className={`text-xs tabular-nums ${LIMIT_TEXT[state]}`}>
            {s.words.toLocaleString()}{s.word_limit ? ` / ${s.word_limit.toLocaleString()}` : ""} words
            {state === "over" && s.word_limit ? ` · ${(s.words - s.word_limit).toLocaleString()} over` : !s.word_limit ? " · no limit" : ""}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            {s.word_limit ? <span className={`block h-full rounded-full ${LIMIT_BAR[state]}`} style={{ width: `${pct}%` }} /> : null}
          </span>
        </span>
        <span className={`justify-self-start rounded-full px-2 py-0.5 text-center text-[11px] font-medium sm:justify-self-stretch ${badge.cls}`}>{badge.label}</span>
      </Link>
      <span className="flex-shrink-0 pr-2">
        {asking ? (
          <span role="group" aria-label={`Delete ${s.title}?`} className="inline-flex items-center gap-1.5 rounded-md bg-red-50 py-0.5 pl-2.5 pr-1 text-xs text-red-800">
            Delete?
            <button type="button" disabled={pending} onClick={() => { onDelete(s); setAsking(false); }} className="h-6 rounded bg-red-600 px-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60">Remove</button>
            <button type="button" onClick={() => setAsking(false)} className="h-6 rounded px-2 font-medium text-slate-700 hover:bg-white">Keep</button>
          </span>
        ) : (
          <button
            type="button" disabled={pending} onClick={() => setAsking(true)} aria-label={`Delete ${s.title}`}
            className="h-7 rounded-md px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
          >
            Delete
          </button>
        )}
      </span>
    </li>
  );
}

export function StatementsList({ statements, schools }: { statements: StatementRow[]; schools: SchoolOpt[] }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const [kind, setKind] = useState<string>("statement_of_purpose");
  const [schoolId, setSchoolId] = useState("");
  const [fromGeneral, setFromGeneral] = useState(true);

  const schoolName = new Map(schools.map((s) => [s.id, s.name]));
  const general = statements.filter((s) => !s.school_id);
  const tailored = statements.filter((s) => s.school_id);
  const generalOfKind = general.find((g) => g.kind === kind);
  const bySchool = new Map<string, StatementRow[]>();
  tailored.forEach((s) => bySchool.set(s.school_id!, [...(bySchool.get(s.school_id!) ?? []), s]));
  const schoolGroups = Array.from(bySchool.entries()).sort(([a], [b]) => (schoolName.get(a) ?? "").localeCompare(schoolName.get(b) ?? ""));

  const onDelete = (s: StatementRow) => run(() => deleteStatement(s.id), () => router.refresh());

  return (
    <div className={`flex flex-col gap-4 ${pending ? "cursor-progress" : ""}`}>
      <form
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await createStatement({ kind, schoolId: schoolId || null, fromId: schoolId && fromGeneral && generalOfKind ? generalOfKind.id : null });
            if (r.ok) router.push(`/materials/statements/${r.data}`);
            return r;
          });
        }}
      >
        <h2 className="text-[15px] font-semibold text-slate-900">New statement</h2>
        <div className="flex flex-wrap gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${field} w-full sm:w-56`} aria-label="Statement type">
            {STATEMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={`${field} w-full sm:w-72`} aria-label="School">
            <option value="">General draft (not for one school)</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button disabled={pending} className="h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">{pending ? "Working…" : "Create"}</button>
        </div>
        {schoolId && generalOfKind && (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
            <input type="checkbox" checked={fromGeneral} onChange={(e) => setFromGeneral(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Start from my general {statementKindLabel(kind).toLowerCase()} (copies its text and prompt)
          </label>
        )}
        {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
      </form>

      {statements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No statements yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Start with a general draft, then make a tailored version for each school from it, each with its own prompt and word limit.</p>
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
              <h2 className="text-[15px] font-semibold text-slate-900">General drafts<span className="ml-1 font-normal text-slate-500">· {general.length}</span></h2>
              <span className="text-xs text-slate-500">Starting points you tailor per school</span>
            </div>
            {general.length === 0 ? <p className="px-5 py-4 text-[13px] text-slate-500">None yet.</p> : (
              <ul className="px-2 py-1">{general.map((s) => <Row key={s.id} s={s} onDelete={onDelete} pending={pending} />)}</ul>
            )}
          </section>
          {schoolGroups.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-3">
                <h2 className="text-[15px] font-semibold text-slate-900">Tailored for a school<span className="ml-1 font-normal text-slate-500">· {tailored.length}</span></h2>
              </div>
              {schoolGroups.map(([id, list], i) => (
                <div key={id} className={i > 0 ? "border-t border-slate-100" : ""}>
                  <Link href={`/schools/${id}?tab=application`} className="block px-5 pb-1 pt-3 text-xs font-semibold text-slate-600 hover:text-blue-700">{schoolName.get(id) ?? "School"}</Link>
                  <ul className="px-2 pb-1">{list.map((s) => <Row key={s.id} s={s} onDelete={onDelete} pending={pending} />)}</ul>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
