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

const primary = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";

// A rich text field that saves itself, with a crash-backup offer and a conflict warning.
export function RichDraft({ kind, id, initial, version, label, save, onWords, placeholder, minHeight, variant = "full" }: RichDraftProps) {
  const { text, setText, state, resetKey, offer, restoreBackup, discardBackup } = useRichAutosave({ kind, id, initial, version, save });
  const words = countWordsHtml(text);
  useEffect(() => { onWords?.(words); }, [words, onWords]);

  const saveLabel = state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "dirty" ? "Unsaved changes" : state === "conflict" ? "Not saved: changed elsewhere" : "Could not save. Copy your text before leaving.";

  return (
    <div className="flex flex-col gap-1">
      {offer && (
        <div className="flex flex-wrap items-center gap-3 text-sm border border-brass rounded px-3 py-2 mb-2" role="status">
          <span>We found changes from {new Date(offer.savedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} on this device that were never saved. Restore them?</span>
          <button type="button" className={primary} onClick={restoreBackup}>Restore</button>
          <button type="button" className="text-gray-500 hover:text-cream" onClick={discardBackup}>Discard</button>
        </div>
      )}
      {state === "conflict" && (
        <div className="flex flex-wrap items-center gap-3 text-sm border border-red-600 rounded px-3 py-2 mb-2" role="alert">
          <span>This was changed somewhere else, so your last edits were not saved. Copy your text, then reload to see the latest.</span>
          <button type="button" className={primary} onClick={() => { try { void navigator.clipboard.writeText(htmlToText(text)); } catch { /* ignore */ } }}>Copy my text</button>
          <button type="button" className="text-gray-500 hover:text-cream" onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}
      <RichEditorLazy
        value={text} onChange={(h) => { if (h !== text) setText(h); }} resetKey={resetKey}
        label={label} variant={variant} placeholder={placeholder} minHeight={minHeight}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs">
        <span className="text-gray-400">{words.toLocaleString()} {words === 1 ? "word" : "words"}</span>
        <span className={state === "error" || state === "conflict" ? "text-red-600" : "text-gray-400"} aria-live="polite">{saveLabel}</span>
      </div>
    </div>
  );
}
