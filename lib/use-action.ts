"use client";
import { useState, useTransition } from "react";
import { isFailure } from "@/lib/action-result";

// Runs a server action and shows its problem, whether the action returned a failure result or something went wrong
// on the way. Works with actions that return a result and with older ones that return nothing.
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (isFailure(r)) { setError(r.message); return; }
        after?.();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };
  return { pending, error, run, setError };
}
