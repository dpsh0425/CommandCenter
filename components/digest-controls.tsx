"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { sendDigestNow } from "@/app/(app)/account/digest-actions";

export function DigestControls({ configured }: { configured: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/api/digest?preview=1" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50">Preview it ↗</a>
        <button
          type="button"
          disabled={pending || !configured}
          onClick={() => { setResult(null); start(async () => setResult(await sendDigestNow())); }}
          className="h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send me one now"}
        </button>
      </div>
      {!configured && (
        <p className="text-xs text-slate-500">
          Sending is switched off until <code className="font-mono text-slate-700">RESEND_API_KEY</code> is added to the server environment. The preview works without it.{" "}
          <Link href="/status" className="font-medium text-blue-600 hover:text-blue-700">See Status</Link>
        </p>
      )}
      {result && <p role={result.ok ? "status" : "alert"} className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.message}</p>}
    </div>
  );
}
