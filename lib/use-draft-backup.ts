"use client";
import { useCallback, useEffect, useState } from "react";
import { backupKey, parseBackup, shouldOfferRestore, type Backup } from "@/lib/local-backup";

// Keeps a copy of unsaved text in this browser. Storage can be missing or full, so every access is guarded.
export function useDraftBackup(kind: string, id: string, server: { html: string; version: number }) {
  const key = backupKey(kind, id);
  const [offer, setOffer] = useState<Backup | null>(null);

  useEffect(() => {
    try {
      const b = parseBackup(localStorage.getItem(key));
      setOffer(shouldOfferRestore(b, server) ? b : null);
    } catch { /* storage unavailable */ }
    // Only on first open: later server changes must not re-offer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const write = useCallback((html: string, version: number) => {
    try { localStorage.setItem(key, JSON.stringify({ html, savedAt: Date.now(), version })); } catch { /* ignore */ }
  }, [key]);
  const clear = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    setOffer(null);
  }, [key]);

  return { offer, write, clear };
}
