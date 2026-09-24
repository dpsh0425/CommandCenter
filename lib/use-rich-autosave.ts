"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveResult } from "@/lib/save-result";
import { useDraftBackup } from "@/lib/use-draft-backup";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";

export type AutosaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

type Opts = {
  kind: string; id: string; initial: string; version: number;
  save: (id: string, html: string, baseVersion: number) => Promise<SaveResult>; delayMs?: number;
};

// Autosaves long-form text, keeps a crash backup in this browser, saves once more on leaving, and stops saving after a
// conflict. Behaves like the statement editor so any rich text field can reuse it.
export function useRichAutosave({ kind, id, initial, version: initialVersion, save, delayMs = 1500 }: Opts) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<AutosaveState>("saved");
  const [resetKey, setResetKey] = useState(0);
  const [words, setWords] = useState<number | null>(null);
  const backup = useDraftBackup(kind, id, { html: initial, version: initialVersion });
  const { write: writeBackup, clear: clearBackup } = backup;

  const version = useRef(initialVersion);
  // The text as last stored on the server (or as loaded). Nothing saves while the editor matches it, which also keeps
  // React's development double-run of effects from saving unchanged text.
  const lastSaved = useRef(initial);
  const conflict = useRef(false);
  const unsaved = useRef(false);
  const wroteBackup = useRef(false);
  const latest = useRef(text);
  latest.current = text;
  const saveRef = useRef(save);
  saveRef.current = save;

  const doSave = useCallback(async (sent: string): Promise<SaveResult> => {
    return saveRef.current(id, sent, version.current).catch(
      (): SaveResult => ({ ok: false, reason: "error", message: "Could not save." }),
    );
  }, [id]);

  // Applies a save result to the refs and the visible state. Returns true when the sent text is stored.
  const apply = useCallback((sent: string, r: SaveResult): boolean => {
    if (r.ok) {
      version.current = r.version;
      lastSaved.current = sent;
      setWords(r.words);
      const unchanged = latest.current === sent;
      unsaved.current = !unchanged;
      setState(unchanged ? "saved" : "dirty");
      if (unchanged) clearBackup();
      return true;
    }
    if (r.reason === "stale") { conflict.current = true; setState("conflict"); }
    else setState("error");
    return false;
  }, [clearBackup]);

  // Autosave after the last change; after a conflict nothing saves again.
  useEffect(() => {
    if (text === lastSaved.current) {
      if (!conflict.current) {
        unsaved.current = false;
        setState("saved");
        // Undoing back to the stored text leaves nothing unsaved, so drop the copy written a moment ago. A backup from an earlier session is untouched.
        if (wroteBackup.current) { wroteBackup.current = false; clearBackup(); }
      }
      return;
    }
    if (conflict.current) return;
    setState("dirty");
    unsaved.current = true;
    writeBackup(text, version.current);
    wroteBackup.current = true;
    const t = setTimeout(async () => {
      if (conflict.current || text === lastSaved.current) return;
      setState("saving");
      apply(text, await doSave(text));
    }, delayMs);
    return () => clearTimeout(t);
  }, [text, delayMs, writeBackup, clearBackup, apply, doSave]);

  // One last save when leaving the page, if something is unsaved.
  useEffect(() => () => {
    if (unsaved.current && !conflict.current) saveRef.current(id, latest.current, version.current).catch(() => {});
  }, [id]);

  useUnsavedGuard(state !== "saved");

  const flush = useCallback(async (): Promise<boolean> => {
    const current = latest.current;
    if (current === lastSaved.current) return !conflict.current;
    if (conflict.current) return false;
    setState("saving");
    return apply(current, await doSave(current));
  }, [apply, doSave]);

  const restoreBackup = useCallback(() => {
    const o = backup.offer;
    if (o) { setText(o.html); setResetKey((k) => k + 1); }
    clearBackup();
  }, [backup.offer, clearBackup]);

  const replace = useCallback((html: string, newVersion?: number) => {
    setText(html);
    setResetKey((k) => k + 1);
    if (newVersion !== undefined) {
      version.current = newVersion;
      lastSaved.current = html;
      unsaved.current = false;
      conflict.current = false;
      wroteBackup.current = false;
      setState("saved");
      clearBackup();
    }
  }, [clearBackup]);

  return { text, setText, state, resetKey, words, offer: backup.offer, restoreBackup, discardBackup: clearBackup, flush, replace };
}
