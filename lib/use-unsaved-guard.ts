"use client";
import { useEffect } from "react";

// Asks the browser to confirm before closing or reloading the tab while there are unsaved changes.
export function useUnsavedGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
