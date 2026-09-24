"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteSnapshot, deleteStatement, restoreSnapshot, saveSnapshot, saveStatementBody, setStatementStatus, updateStatementMeta, type SaveResult,
} from "@/app/(app)/materials/statement-actions";
import { countWordsHtml, htmlToText } from "@/lib/rich-text";
import { RichEditorLazy } from "@/components/rich-editor-lazy";
import { RichHtml } from "@/components/rich-view";
import { useDraftBackup } from "@/lib/use-draft-backup";
import { STATEMENT_KINDS, STATEMENT_STATUS, limitState, statementKindLabel, type LimitState } from "@/lib/statements";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";

export type EditorStatement = {
  id: string; kind: string; title: string; prompt: string | null; word_limit: number | null; body: string; status: string; sent_on: string | null;
  school_id: string | null; schoolName: string | null; body_version: number;
};
export type EditorSnapshot = { id: string; body: string; words: number; note: string | null; created_at: string; html: string };

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
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error" | "conflict">("saved");
  const version = useRef(statement.body_version);
  const [resetKey, setResetKey] = useState(0);
  const conflict = useRef(false);
  const backup = useDraftBackup("statement", statement.id, { html: statement.body, version: statement.body_version });
  const { write: writeBackup, clear: clearBackup } = backup;
  const [metaSaved, setMetaSaved] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const first = useRef(true);
  const latest = useRef(text);
  latest.current = text;
  const unsaved = useRef(false);

  // Autosave 1.5 seconds after the last keystroke; saves again on leaving the page. After a conflict nothing saves again.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (conflict.current) return;
    setSaveState("dirty");
    unsaved.current = true;
    writeBackup(text, version.current);
    const t = setTimeout(async () => {
      if (conflict.current) return;
      setSaveState("saving");
      const r = await saveStatementBody(statement.id, text, version.current).catch(
        (): SaveResult => ({ ok: false, reason: "error", message: "Could not save." }),
      );
      if (r.ok) { version.current = r.version; unsaved.current = false; setSaveState("saved"); clearBackup(); }
      else if (r.reason === "stale") { conflict.current = true; setSaveState("conflict"); }
      else setSaveState("error");
    }, 1500);
    return () => clearTimeout(t);
  }, [text, statement.id, writeBackup, clearBackup]);
  useEffect(() => () => { if (unsaved.current && !conflict.current) saveStatementBody(statement.id, latest.current, version.current).catch(() => {}); }, [statement.id]);
  useUnsavedGuard(saveState !== "saved");

  const words = countWordsHtml(text);
  const state = limitState(words, limit);
  const saveLabel = saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : saveState === "conflict" ? "Not saved: changed elsewhere" : "Could not save. Copy your text before leaving.";

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
        {backup.offer && (
          <div className="flex flex-wrap items-center gap-3 text-sm border border-brass rounded px-3 py-2 mb-2" role="status">
            <span>We found changes from {new Date(backup.offer.savedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} on this device that were never saved. Restore them?</span>
            <button type="button" className={primary} onClick={() => { const o = backup.offer; if (o) { setText(o.html); setResetKey((k) => k + 1); } clearBackup(); }}>Restore</button>
            <button type="button" className="text-gray-500 hover:text-cream" onClick={clearBackup}>Discard</button>
          </div>
        )}
        {saveState === "conflict" && (
          <div className="flex flex-wrap items-center gap-3 text-sm border border-red-600 rounded px-3 py-2 mb-2" role="alert">
            <span>This was changed somewhere else, so your last edits were not saved. Copy your text, then reload to see the latest.</span>
            <button type="button" className={primary} onClick={() => { try { void navigator.clipboard.writeText(htmlToText(text)); } catch { /* ignore */ } }}>Copy my text</button>
            <button type="button" className="text-gray-500 hover:text-cream" onClick={() => window.location.reload()}>Reload</button>
          </div>
        )}
        <RichEditorLazy
          value={text} onChange={(html) => { if (html !== latest.current) setText(html); }} label="Statement text" variant="full"
          placeholder="Write here. It saves on its own." resetKey={resetKey}
        />
        <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs">
          <span className={`font-mono ${COUNT_TONE[state]}`}>
            {words.toLocaleString()}{limit ? ` of ${limit.toLocaleString()}` : ""} words{state === "over" ? ` · ${(words - (limit ?? 0)).toLocaleString()} over` : state === "near" ? " · close to the limit" : ""}
          </span>
          <span className={saveState === "error" || saveState === "conflict" ? "text-red-600" : "text-gray-400"} aria-live="polite">{saveLabel}</span>
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
              const r = await saveStatementBody(statement.id, latest.current, version.current);
              if (!r.ok) {
                if (r.reason === "stale") { conflict.current = true; setSaveState("conflict"); throw new Error("Not saved: this was changed somewhere else."); }
                throw new Error(r.message);
              }
              version.current = r.version; unsaved.current = false; setSaveState("saved"); clearBackup();
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
                      onClick={() => { if (confirm("Replace the current text with this version? Your current text is saved as a version first.")) run(async () => { const r = await restoreSnapshot(s.id); setText(r.body); version.current = r.version; setResetKey((k) => k + 1); unsaved.current = false; conflict.current = false; setSaveState("saved"); clearBackup(); }, () => router.refresh()); }}
                      className="hover:text-brass"
                    >
                      Restore
                    </button>
                    <button disabled={pending} onClick={() => { if (confirm("Delete this saved version?")) run(() => deleteSnapshot(s.id, statement.id), () => router.refresh()); }} className="hover:text-red-600" aria-label="Delete version">✕</button>
                  </span>
                </div>
                {viewing === s.id && <RichHtml html={s.html} className="paper paper-page max-h-72 overflow-auto mt-2" />}
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
