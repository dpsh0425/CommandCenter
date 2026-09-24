"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteSnapshot, deleteStatement, restoreSnapshot, saveSnapshot, saveStatementBody, setStatementStatus, updateStatementMeta,
} from "@/app/(app)/materials/statement-actions";
import { countWords } from "@/lib/research";
import { STATEMENT_KINDS, STATEMENT_STATUS, limitState, statementKindLabel, type LimitState } from "@/lib/statements";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";

export type EditorStatement = {
  id: string; kind: string; title: string; prompt: string | null; word_limit: number | null; body: string; status: string; sent_on: string | null;
  school_id: string | null; schoolName: string | null;
};
export type EditorSnapshot = { id: string; body: string; words: number; note: string | null; created_at: string };

const field = "border rounded px-2 py-1.5 text-sm w-full";
const primary = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";
const COUNT_TONE: Record<LimitState, string> = { none: "text-gray-400", ok: "text-gray-400", near: "text-brass", over: "text-red-600" };

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => { try { await fn(); after?.(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } });
  };
  return { pending, error, run };
}

export function StatementEditor({ statement, snapshots }: { statement: EditorStatement; snapshots: EditorSnapshot[] }) {
  const router = useRouter();
  const { pending, error, run } = useRun();
  const [text, setText] = useState(statement.body);
  const [limit, setLimit] = useState<number | null>(statement.word_limit);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [metaSaved, setMetaSaved] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const first = useRef(true);
  const latest = useRef(text);
  latest.current = text;
  const unsaved = useRef(false);

  // Autosave 1.5 seconds after the last keystroke; saves again on leaving the page.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaveState("dirty");
    unsaved.current = true;
    const t = setTimeout(async () => {
      setSaveState("saving");
      try { await saveStatementBody(statement.id, text); unsaved.current = false; setSaveState("saved"); } catch { setSaveState("error"); }
    }, 1500);
    return () => clearTimeout(t);
  }, [text, statement.id]);
  useEffect(() => () => { if (unsaved.current) saveStatementBody(statement.id, latest.current).catch(() => {}); }, [statement.id]);
  useUnsavedGuard(saveState !== "saved");

  const words = countWords(text);
  const state = limitState(words, limit);
  const saveLabel = saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : "Could not save. Copy your text before leaving.";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/materials/statements" className="text-xs text-gray-500 hover:text-cream self-start">← Statements</Link>
        <h1 className="text-3xl leading-tight break-words">{statement.title}</h1>
        <p className="text-sm text-gray-500">
          {[statementKindLabel(statement.kind), statement.schoolName ? (
            <Link key="s" href={`/schools/${statement.school_id}?tab=application`} className="text-brass hover:underline">{statement.schoolName}</Link>
          ) : "General draft"].reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, " · ", x] : [x]), [])}
        </p>
      </div>

      {statement.prompt && (
        <section className="border-l-2 border-line pl-4">
          <h2 className="font-sans text-xs font-semibold text-gray-400 mb-1">The prompt</h2>
          <p className="text-sm text-gray-500 whitespace-pre-line">{statement.prompt}</p>
        </section>
      )}

      <section className="flex flex-col gap-1">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={22}
          placeholder="Write here. It saves on its own." className={field + " font-serif text-base leading-relaxed"} aria-label="Statement text"
        />
        <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs">
          <span className={`font-mono ${COUNT_TONE[state]}`}>
            {words.toLocaleString()}{limit ? ` of ${limit.toLocaleString()}` : ""} words{state === "over" ? ` · ${(words - (limit ?? 0)).toLocaleString()} over` : state === "near" ? " · close to the limit" : ""}
          </span>
          <span className={saveState === "error" ? "text-red-600" : "text-gray-400"} aria-live="polite">{saveLabel}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">Status</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {STATEMENT_STATUS.map((s) => (
            <button
              key={s.key} disabled={pending} onClick={() => run(() => setStatementStatus(statement.id, s.key), () => router.refresh())}
              className={`rounded border px-3 py-1 ${statement.status === s.key ? "border-brass text-cream font-medium" : "border-line text-gray-500 hover:text-cream"}`}
              aria-pressed={statement.status === s.key}
            >
              {s.label}
            </button>
          ))}
          {statement.sent_on && <span className="text-xs text-gray-400">Sent {statement.sent_on}</span>}
        </div>
        <p className="text-xs text-gray-400">{statement.school_id && statement.kind === "statement_of_purpose" ? "Marking this Final or Sent ticks the statement on the school's readiness checklist." : "Final means it is ready to submit."}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">Versions</h2>
        <form
          className="flex flex-wrap gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const note = String(new FormData(form).get("note") ?? "");
            run(async () => {
              // Make sure the latest text is stored before it is copied into a version.
              await saveStatementBody(statement.id, latest.current);
              unsaved.current = false; setSaveState("saved");
              await saveSnapshot(statement.id, note);
            }, () => { form.reset(); router.refresh(); });
          }}
        >
          <input name="note" placeholder="Name this version, e.g. after advisor feedback" className={field + " flex-1 min-w-[14rem]"} aria-label="Version note" />
          <button disabled={pending} className={primary}>Save a version</button>
        </form>
        {snapshots.length === 0 ? (
          <p className="text-sm text-gray-500">No saved versions yet. Save one before a big rewrite so you can go back.</p>
        ) : (
          <ul className="flex flex-col">
            {snapshots.map((s) => (
              <li key={s.id} className="border-b border-line/60 last:border-0 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm truncate">{s.note ?? "Saved version"}</span>
                    <span className="block text-xs text-gray-400">{new Date(s.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {s.words.toLocaleString()} words</span>
                  </span>
                  <span className="flex gap-3 text-xs text-gray-500 whitespace-nowrap">
                    <button onClick={() => setViewing(viewing === s.id ? null : s.id)} className="hover:text-cream">{viewing === s.id ? "Hide" : "View"}</button>
                    <button
                      disabled={pending}
                      onClick={() => { if (confirm("Replace the current text with this version? Your current text is saved as a version first.")) run(async () => { const r = await restoreSnapshot(s.id); setText(r.body); unsaved.current = false; setSaveState("saved"); }, () => router.refresh()); }}
                      className="hover:text-brass"
                    >
                      Restore
                    </button>
                    <button disabled={pending} onClick={() => { if (confirm("Delete this saved version?")) run(() => deleteSnapshot(s.id, statement.id), () => router.refresh()); }} className="hover:text-red-600" aria-label="Delete version">✕</button>
                  </span>
                </div>
                {viewing === s.id && <p className="text-sm text-gray-500 whitespace-pre-line font-serif mt-2 border-l-2 border-line pl-3 max-h-72 overflow-auto">{s.body || "(empty)"}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="text-sm group">
        <summary className="cursor-pointer text-gray-500 hover:text-cream list-none border-b border-line pb-2">Details: title, type, prompt, word limit</summary>
        <form
          className="grid gap-3 sm:grid-cols-2 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
            const wl = Number(v("limit")) || null;
            setMetaSaved(false);
            run(() => updateStatementMeta(statement.id, { title: v("title"), kind: v("kind"), prompt: v("prompt") || null, wordLimit: wl }), () => { setLimit(wl); setMetaSaved(true); router.refresh(); });
          }}
        >
          <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">Title<input name="title" defaultValue={statement.title} required className={field + " text-cream"} /></label>
          <label className="flex flex-col gap-1 text-gray-500">Type
            <select name="kind" defaultValue={statement.kind} className={field + " text-cream bg-transparent"}>{STATEMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-gray-500">Word limit<input name="limit" type="number" min={1} defaultValue={statement.word_limit ?? ""} placeholder="No limit" className={field + " text-cream"} /></label>
          <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">The school&rsquo;s prompt<textarea name="prompt" defaultValue={statement.prompt ?? ""} rows={4} placeholder="Paste the question or instructions from the application" className={field + " text-cream"} /></label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button disabled={pending} className={primary}>Save details</button>
            {metaSaved && !pending && <span className="text-teal-600 text-xs">Saved</span>}
          </div>
        </form>
      </details>

      <div className="flex items-center gap-4 text-sm">
        <button
          disabled={pending}
          onClick={() => { if (confirm(`Delete "${statement.title}" and all its saved versions? This cannot be undone.`)) run(() => deleteStatement(statement.id), () => router.push("/materials/statements")); }}
          className="text-gray-500 hover:text-red-600"
        >
          Delete this statement
        </button>
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </div>
    </div>
  );
}
