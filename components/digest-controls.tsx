"use client";
import { useState, useTransition } from "react";
import { sendDigestNow } from "@/app/(app)/account/digest-actions";

export function DigestControls({ configured }: { configured: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <a href="/api/digest?preview=1" target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">Preview it</a>
        <button
          disabled={pending || !configured}
          onClick={() => { setResult(null); start(async () => setResult(await sendDigestNow())); }}
          className="bg-brass text-ink font-medium rounded px-3 py-1.5 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send me one now"}
        </button>
      </div>
      {!configured && <p className="text-xs text-gray-500">Sending is switched off until <code className="font-mono">RESEND_API_KEY</code> is added to the server environment. The preview works without it.</p>}
      {result && <p className={`text-xs ${result.ok ? "text-teal-600" : "text-red-600"}`}>{result.message}</p>}
    </div>
  );
}
