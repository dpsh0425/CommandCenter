"use client";
import { useEffect, useRef, useState } from "react";
import { htmlToText, portalText, toEditorHtml } from "@/lib/rich-text";

const btn = "rounded border border-line px-3 py-1.5 text-sm text-gray-500 hover:text-cream disabled:opacity-50";
type Feedback = { key: "plain" | "portal"; ok: boolean } | null;

export function StatementExport({ statementId, text, beforeExport }: { statementId: string; text: string; beforeExport: () => Promise<boolean> }) {
  const [straight, setStraight] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try { if (localStorage.getItem("portal-straight-quotes") === "1") setStraight(true); } catch { /* storage unavailable */ }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  function flash(f: Feedback) {
    setFeedback(f);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 2000);
  }
  async function copy(key: "plain" | "portal", value: string) {
    setMessage(null);
    try { await navigator.clipboard.writeText(value); flash({ key, ok: true }); } catch { flash({ key, ok: false }); }
  }
  async function prepared() {
    setMessage(null);
    setBusy(true);
    try {
      const ok = await beforeExport();
      if (!ok) setMessage("Save failed, so the download was not started.");
      return ok;
    } catch { setMessage("Save failed, so the download was not started."); return false; }
    finally { setBusy(false); }
  }
  async function download() {
    if (!(await prepared())) return;
    const a = document.createElement("a");
    a.href = `/api/statements/${statementId}/export`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function print() {
    if (!(await prepared())) return;
    window.print();
  }
  const label = (key: "plain" | "portal", idle: string) => (feedback?.key === key && feedback.ok ? "Copied" : idle);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={download} className={btn}>Download Word (.docx)</button>
        <button type="button" disabled={busy} onClick={print} className={btn}>Print or save as PDF</button>
        <button type="button" onClick={() => copy("plain", htmlToText(toEditorHtml(text)))} className={btn}>{label("plain", "Copy as plain text")}</button>
        <button type="button" onClick={() => copy("portal", portalText(text, { straightQuotes: straight }))} className={btn}>{label("portal", "Copy for a portal")}</button>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox" checked={straight}
            onChange={(e) => { setStraight(e.target.checked); try { localStorage.setItem("portal-straight-quotes", e.target.checked ? "1" : "0"); } catch { /* storage unavailable */ } }}
          />
          Use straight quotes
        </label>
      </div>
      {feedback && !feedback.ok && <p className="text-xs text-red-600" role="alert">Copy failed, select the text and copy it yourself.</p>}
      {message && <p className="text-xs text-red-600" role="alert">{message}</p>}
      <p className="text-xs text-gray-400">Plain text with single blank lines between paragraphs, ready to paste into an application form.</p>
    </div>
  );
}
