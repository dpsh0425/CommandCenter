"use client";
import { useEffect } from "react";
import { RichEditorLazy } from "@/components/rich-editor-lazy";
import { countWordsHtml, htmlToText } from "@/lib/rich-text";
import { useRichAutosave } from "@/lib/use-rich-autosave";
import type { SaveResult } from "@/lib/save-result";

export type RichDraftProps = {
  kind: string; id: string; initial: string; version: number; label: string;
  save: (id: string, html: string, baseVersion: number) => Promise<SaveResult>;
  onWords?: (words: number) => void; placeholder?: string; minHeight?: string; variant?: "full" | "compact";
};

const primary = "h-8 whitespace-nowrap rounded-md bg-blue-600 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";

// A rich text field that saves itself, with a crash-backup offer and a conflict warning.
export function RichDraft({ kind, id, initial, version, label, save, onWords, placeholder, minHeight, variant = "full" }: RichDraftProps) {
  const { text, setText, state, resetKey, offer, restoreBackup, discardBackup } = useRichAutosave({ kind, id, initial, version, save });
  const words = countWordsHtml(text);
  useEffect(() => { onWords?.(words); }, [words, onWords]);

  const saveLabel = state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "dirty" ? "Unsaved changes" : state === "conflict" ? "Not saved: changed elsewhere" : "Could not save. Copy your text before leaving.";

  return (
    <div className="flex flex-col gap-1">
      {offer && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[13px] text-blue-900" role="status">
          <span>We found changes from {new Date(offer.savedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} on this device that were never saved. Restore them?</span>
          <button type="button" className={primary} onClick={restoreBackup}>Restore</button>
          <button type="button" className="h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 hover:bg-white hover:text-slate-900" onClick={discardBackup}>Discard</button>
        </div>
      )}
      {state === "conflict" && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-900" role="alert">
          <span>This was changed somewhere else, so your last edits were not saved. Copy your text, then reload to see the latest.</span>
          <button type="button" className={primary} onClick={() => { try { void navigator.clipboard.writeText(htmlToText(text)); } catch { /* ignore */ } }}>Copy my text</button>
          <button type="button" className="h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 hover:bg-white hover:text-slate-900" onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}
      <RichEditorLazy
        value={text} onChange={(h) => { if (h !== text) setText(h); }} resetKey={resetKey}
        label={label} variant={variant} placeholder={placeholder} minHeight={minHeight}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs">
        <span className="tabular-nums text-slate-500">{words.toLocaleString()} {words === 1 ? "word" : "words"}</span>
        <span className={state === "error" || state === "conflict" ? "text-red-700" : "text-slate-500"} aria-live="polite">{saveLabel}</span>
      </div>
    </div>
  );
}
