"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteSnapshot, deleteStatement, restoreSnapshot, saveSnapshot, saveStatementBody, setStatementStatus, updateStatementMeta, type SaveResult,
} from "@/app/(app)/materials/statement-actions";
import { htmlToText } from "@/lib/rich-text";
import { RichEditorLazy } from "@/components/rich-editor-lazy";
import { RichHtml } from "@/components/rich-view";
import { StatementMetrics } from "@/components/statement-metrics";
import { WritingHintsPanel } from "@/components/writing-hints-panel";
import { VersionDiff } from "@/components/version-diff";
import { StatementExport } from "@/components/statement-export";
import { useDraftBackup } from "@/lib/use-draft-backup";
import { STATEMENT_KINDS, STATEMENT_STATUS, statementKindLabel } from "@/lib/statements";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { useAction } from "@/lib/use-action";
import { fail } from "@/lib/action-result";

export type EditorStatement = {
  id: string; kind: string; title: string; prompt: string | null; word_limit: number | null; char_limit: number | null; body: string; status: string; sent_on: string | null;
  school_id: string | null; schoolName: string | null; body_version: number;
};
export type EditorSnapshot = { id: string; body: string; words: number; note: string | null; created_at: string; html: string };

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "h-9 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const quiet = "h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";
const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3";
const smallAction = "h-7 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50";

/** A button that asks in place before doing something that can't be undone easily. */
function ConfirmButton({ label, question, confirmLabel, onConfirm, disabled, className = smallAction, tone = "danger" }: {
  label: string; question: string; confirmLabel: string; onConfirm: () => void; disabled?: boolean; className?: string; tone?: "danger" | "primary";
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={className}>{label}</button>;
  return (
    <span role="group" aria-label={question} className={`inline-flex flex-wrap items-center gap-1.5 rounded-md py-1 pl-2.5 pr-1 text-xs ${tone === "danger" ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-900"}`}>
      {question}
      <button
        type="button" disabled={disabled} onClick={() => { setAsking(false); onConfirm(); }}
        className={`h-6 rounded px-2 font-semibold text-white disabled:opacity-60 ${tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="h-6 rounded px-2 font-medium text-slate-700 hover:bg-white">Keep</button>
    </span>
  );
}

export function StatementEditor({ statement, snapshots }: { statement: EditorStatement; snapshots: EditorSnapshot[] }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const [text, setText] = useState(statement.body);
  const [limit, setLimit] = useState<number | null>(statement.word_limit);
  const [charLimit, setCharLimit] = useState<number | null>(statement.char_limit);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error" | "conflict">("saved");
  const version = useRef(statement.body_version);
  const [resetKey, setResetKey] = useState(0);
  const conflict = useRef(false);
  const backup = useDraftBackup("statement", statement.id, { html: statement.body, version: statement.body_version });
  const { write: writeBackup, clear: clearBackup } = backup;
  const [metaSaved, setMetaSaved] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  // The text as last stored on the server (or as loaded). Nothing saves while the editor matches it, which also keeps
  // React's development double-run of effects from saving an unchanged statement.
  const lastSaved = useRef(statement.body);
  const wroteBackup = useRef(false);
  const latest = useRef(text);
  latest.current = text;
  const unsaved = useRef(false);

  // Autosave 1.5 seconds after the last keystroke; saves again on leaving the page. After a conflict nothing saves again.
  useEffect(() => {
    if (text === lastSaved.current) {
      if (!conflict.current) {
        unsaved.current = false; setSaveState("saved");
        // Undoing back to the stored text leaves nothing unsaved, so drop the copy written a moment ago. A backup from an earlier session is untouched.
        if (wroteBackup.current) { wroteBackup.current = false; clearBackup(); }
      }
      return;
    }
    if (conflict.current) return;
    setSaveState("dirty");
    unsaved.current = true;
    writeBackup(text, version.current);
    wroteBackup.current = true;
    const t = setTimeout(async () => {
      if (conflict.current || text === lastSaved.current) return;
      setSaveState("saving");
      const r = await saveStatementBody(statement.id, text, version.current).catch(
        (): SaveResult => ({ ok: false, reason: "error", message: "Could not save." }),
      );
      if (r.ok) { version.current = r.version; lastSaved.current = text; unsaved.current = false; setSaveState("saved"); clearBackup(); }
      else if (r.reason === "stale") { conflict.current = true; setSaveState("conflict"); }
      else setSaveState("error");
    }, 1500);
    return () => clearTimeout(t);
  }, [text, statement.id, writeBackup, clearBackup]);
  useEffect(() => () => { if (unsaved.current && !conflict.current) saveStatementBody(statement.id, latest.current, version.current).catch(() => {}); }, [statement.id]);
  useUnsavedGuard(saveState !== "saved");
  // The page's entry animation makes its own stacking layer, so the phone nav would sit over the overlay; hide it while focused.
  useEffect(() => {
    document.body.classList.toggle("writing-focus", focus);
    return () => document.body.classList.remove("writing-focus");
  }, [focus]);

  // Saves pending text before an export. Applies the result exactly like the autosave; resolves true when it is safe to export.
  async function flushSave(): Promise<boolean> {
    const current = latest.current;
    if (current === lastSaved.current) return !conflict.current;
    if (conflict.current) return false;
    setSaveState("saving");
    const r = await saveStatementBody(statement.id, current, version.current).catch(
      (): SaveResult => ({ ok: false, reason: "error", message: "Could not save." }),
    );
    if (r.ok) { version.current = r.version; lastSaved.current = current; unsaved.current = latest.current !== current; setSaveState(latest.current === current ? "saved" : "dirty"); if (latest.current === current) clearBackup(); return true; }
    if (r.reason === "stale") { conflict.current = true; setSaveState("conflict"); }
    else setSaveState("error");
    return false;
  }
  const saveLabel = saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : saveState === "conflict" ? "Not saved: changed elsewhere" : "Could not save. Copy your text before leaving.";

  const viewed = snapshots.find((s) => s.id === viewing) ?? null;
  const compared = snapshots.find((s) => s.id === comparing) ?? null;
  const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const restore = (s: EditorSnapshot) =>
    run(async () => { const r = await restoreSnapshot(s.id); if (!r.ok) return r; lastSaved.current = r.data.body; setText(r.data.body); version.current = r.data.version; setResetKey((k) => k + 1); unsaved.current = false; conflict.current = false; setSaveState("saved"); clearBackup(); }, () => router.refresh());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Link href="/materials/statements" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← Statements</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="break-words text-[26px] font-semibold leading-[34px] tracking-tight text-slate-900">{statement.title}</h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700">{statementKindLabel(statement.kind)}</span>
              {statement.schoolName ? (
                <Link href={`/schools/${statement.school_id}?tab=application`} className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-800 hover:bg-slate-200">{statement.schoolName} ↗</Link>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">General draft</span>
              )}
              {statement.sent_on && <span className="text-slate-500">Sent {new Date(statement.sent_on + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
            </div>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Status">
              {STATEMENT_STATUS.map((s, i) => (
                <button
                  key={s.key} type="button" disabled={pending} onClick={() => run(() => setStatementStatus(statement.id, s.key), () => router.refresh())}
                  className={`h-9 px-3.5 text-[13px] transition-colors disabled:opacity-60 ${i > 0 ? "border-l border-slate-300" : ""} ${
                    statement.status === s.key ? "bg-blue-600 font-semibold text-white" : "bg-white font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  aria-pressed={statement.status === s.key}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="max-w-xs text-[11px] text-slate-500 sm:text-right">{statement.school_id && statement.kind === "statement_of_purpose" ? "Final or Sent ticks the statement on the school's readiness checklist." : "Final means it is ready to submit."}</p>
          </div>
        </div>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          {statement.prompt && (
            <details open className={`${card} px-4 py-3`}>
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">The prompt</summary>
              <p className="mt-2 whitespace-pre-line text-[13px] text-slate-600">{statement.prompt}</p>
            </details>
          )}

          {(viewed || compared) && (
            <section className={`${card} border-blue-200`}>
              <div className={cardHead}>
                <h2 className="text-[13px] font-semibold text-slate-900">
                  {compared ? <>Comparing &ldquo;{compared.note ?? "Saved version"}&rdquo; with your current text</> : <>Viewing &ldquo;{viewed!.note ?? "Saved version"}&rdquo;</>}
                </h2>
                <button type="button" onClick={() => { setViewing(null); setComparing(null); }} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 hover:bg-slate-50">Close</button>
              </div>
              <div className="px-4 pb-4">
                {compared ? <VersionDiff before={compared.body} after={text} /> : <RichHtml html={viewed!.html} className="paper paper-page mt-3 max-h-96 overflow-auto" />}
              </div>
            </section>
          )}

          <section
            className={focus ? "fixed inset-0 z-50 flex flex-col gap-1 overflow-auto bg-white p-4 md:px-[12%] md:py-8" : `${card} flex flex-col gap-1 p-3 md:p-4`}
            onKeyDown={(e) => { if (focus && e.key === "Escape" && !e.defaultPrevented) setFocus(false); }}
          >
            {focus && (
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={() => setFocus(false)} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 hover:bg-slate-50">Exit focus mode</button>
              </div>
            )}
            {backup.offer && (
              <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-900" role="status">
                <span>We found changes from {new Date(backup.offer.savedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} on this device that were never saved. Restore them?</span>
                <button type="button" className={primary} onClick={() => { const o = backup.offer; if (o) { setText(o.html); setResetKey((k) => k + 1); } clearBackup(); }}>Restore</button>
                <button type="button" className={quiet} onClick={clearBackup}>Discard</button>
              </div>
            )}
            {saveState === "conflict" && (
              <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
                <span>This was changed somewhere else, so your last edits were not saved. Copy your text, then reload to see the latest.</span>
                <button type="button" className={primary} onClick={() => { try { void navigator.clipboard.writeText(htmlToText(text)); } catch { /* ignore */ } }}>Copy my text</button>
                <button type="button" className={quiet} onClick={() => window.location.reload()}>Reload</button>
              </div>
            )}
            <RichEditorLazy
              value={text} onChange={(html) => { if (html !== latest.current) setText(html); }} label="Statement text" variant="full"
              placeholder="Write here. It saves on its own." resetKey={resetKey} printable
            />
            <div className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-2.5 text-xs">
              <StatementMetrics text={text} wordLimit={limit} charLimit={charLimit} />
              <span className="flex items-center gap-3">
                {!focus && <button type="button" onClick={() => setFocus(true)} className="font-medium text-blue-600 hover:text-blue-700">Focus mode</button>}
                <span className={saveState === "error" || saveState === "conflict" ? "font-medium text-red-700" : saveState === "saved" ? "text-slate-500" : "text-blue-700"} aria-live="polite">{saveLabel}</span>
              </span>
            </div>
          </section>

          <div className={`${card} px-4 py-3`}>
            <WritingHintsPanel text={text} />
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <section className={card}>
            <div className={cardHead}>
              <h2 className="text-[15px] font-semibold text-slate-900">Versions<span className="ml-1 font-normal text-slate-500">· {snapshots.length}</span></h2>
            </div>
            <form
              className="flex gap-2 border-b border-slate-100 px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const note = String(new FormData(form).get("note") ?? "");
                run(async () => {
                  // Make sure the latest text is stored before it is copied into a version.
                  const r = await saveStatementBody(statement.id, latest.current, version.current);
                  if (!r.ok) {
                    if (r.reason === "stale") { conflict.current = true; setSaveState("conflict"); return fail("Not saved: this was changed somewhere else."); }
                    return fail(r.message);
                  }
                  version.current = r.version; lastSaved.current = latest.current; unsaved.current = false; setSaveState("saved"); clearBackup();
                  return await saveSnapshot(statement.id, note);
                }, () => { form.reset(); router.refresh(); });
              }}
            >
              <input name="note" placeholder="Name this version" className={`${field} h-9 min-w-0 flex-1 py-0`} aria-label="Version note" />
              <button disabled={pending} className={primary}>Save</button>
            </form>
            {snapshots.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-slate-500">No saved versions yet. Save one before a big rewrite so you can go back.</p>
            ) : (
              <ol className="px-2 py-1.5">
                {snapshots.map((s, i) => {
                  const active = viewing === s.id || comparing === s.id;
                  return (
                    <li key={s.id} className={`flex flex-col gap-1 rounded-md px-2 py-2 ${active ? "bg-blue-50" : ""}`}>
                      <div className="flex gap-2.5">
                        <span aria-hidden className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${i === 0 ? "bg-blue-600" : "bg-slate-300"}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-slate-900">{s.note ?? "Saved version"}</span>
                          <span className="block text-xs text-slate-500">{stamp(s.created_at)} · {s.words.toLocaleString()} words</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-0.5 pl-4">
                        <button type="button" onClick={() => { setComparing(null); setViewing(viewing === s.id ? null : s.id); }} className={smallAction}>{viewing === s.id ? "Hide" : "View"}</button>
                        <button type="button" onClick={() => { setViewing(null); setComparing(comparing === s.id ? null : s.id); }} className={`${smallAction} text-blue-600`}>{comparing === s.id ? "Hide compare" : "Compare"}</button>
                        <ConfirmButton
                          label="Restore" question="Replace your text with this version? Your current text is saved as a version first." confirmLabel="Restore" tone="primary"
                          disabled={pending} onConfirm={() => restore(s)}
                        />
                        <ConfirmButton
                          label="Delete" question="Delete this saved version?" confirmLabel="Delete"
                          disabled={pending} onConfirm={() => run(() => deleteSnapshot(s.id, statement.id), () => router.refresh())}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className={card}>
            <div className={cardHead}><h2 className="text-[15px] font-semibold text-slate-900">Export</h2></div>
            <div className="px-4 py-3">
              <StatementExport statementId={statement.id} text={text} beforeExport={flushSave} />
            </div>
          </section>

          <details className={`${card} group`}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
              Details: title, type, prompt, limits
              <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-90">›</span>
            </summary>
            <form
              className="grid gap-3 border-t border-slate-100 px-4 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
                const wl = Number(v("limit")) || null;
                const cl = Number(v("charlimit")) || null;
                setMetaSaved(false);
                run(() => updateStatementMeta(statement.id, { title: v("title"), kind: v("kind"), prompt: v("prompt") || null, wordLimit: wl, charLimit: cl }), () => { setLimit(wl); setCharLimit(cl); setMetaSaved(true); router.refresh(); });
              }}
            >
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Title<input name="title" defaultValue={statement.title} required className={field} /></label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Type
                <select name="kind" defaultValue={statement.kind} className={field}>{STATEMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Word limit<input name="limit" type="number" min={1} defaultValue={statement.word_limit ?? ""} placeholder="No limit" className={field} /></label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Character limit<input name="charlimit" type="number" min={1} defaultValue={statement.char_limit ?? ""} placeholder="No limit" className={field} /></label>
              </div>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">The school&rsquo;s prompt<textarea name="prompt" defaultValue={statement.prompt ?? ""} rows={4} placeholder="Paste the question or instructions from the application" className={field} /></label>
              <div className="flex items-center gap-3">
                <button disabled={pending} className={primary}>Save details</button>
                {metaSaved && !pending && <span role="status" className="text-xs text-emerald-700">Saved</span>}
              </div>
            </form>
          </details>

          <div className="pt-1">
            <ConfirmButton
              label="Delete this statement" question={`Delete "${statement.title}" and all its saved versions? This cannot be undone.`} confirmLabel="Delete"
              className="h-8 rounded-md px-2.5 text-[13px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              disabled={pending} onConfirm={() => run(() => deleteStatement(statement.id), () => router.push("/materials/statements"))}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
