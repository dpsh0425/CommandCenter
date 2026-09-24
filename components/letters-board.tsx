"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { markLettersAsked, markLettersReminded, setLetterStatus } from "@/app/(app)/materials/letter-actions";
import { PaperTextarea } from "@/components/paper-textarea";
import { useAction } from "@/lib/use-action";
import {
  FLAG_LABEL, HEAVY_LOAD, LETTER_STATUSES, buildReminderEmail, buildRequestEmail, buildThankYouEmail, daysBetween, groupByRecommender,
  letterFlags, mailtoUrl, type EmailDraft, type LetterRecord, type RecommenderGroup,
} from "@/lib/letters";

const field = "border rounded px-2 py-1.5 text-sm w-full";
const primary = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";
const secondary = "rounded border border-line px-3 py-1.5 text-sm text-gray-500 hover:text-brass disabled:opacity-50";
const STORAGE_KEY = "letters-sign-as";

type Kind = "request" | "reminder" | "thanks";
type Draft = { key: string; kind: Kind; ids: string[]; subject: string; body: string };

const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function build(kind: Kind, g: RecommenderGroup, ls: LetterRecord[], signAs: string): EmailDraft {
  if (kind === "request") return buildRequestEmail(g.name, ls, signAs);
  if (kind === "reminder") return buildReminderEmail(g.name, ls, signAs);
  return buildThankYouEmail(g.name, ls, signAs);
}

const KIND_LABEL: Record<Kind, string> = { request: "Draft request", reminder: "Draft reminder", thanks: "Draft thank-you" };

export function LettersBoard({ letters, today, focus }: { letters: LetterRecord[]; today: string; focus?: string }) {
  const router = useRouter();
  const { pending, error, run: act } = useAction();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [signAs, setSignAs] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v) setSignAs(v); } catch { /* storage unavailable */ }
  }, []);

  const onSignAs = (v: string) => {
    setSignAs(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* storage unavailable */ }
  };

  const run = (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setErrorKey(key);
    act(fn, () => { after?.(); router.refresh(); });
  };

  const openDraft = (g: RecommenderGroup, kind: Kind) => {
    const ls = g.letters.filter((l) => (kind === "request" ? l.status === "not_asked" : kind === "reminder" ? l.status === "asked" || l.status === "confirmed" : l.status === "submitted"));
    const d = build(kind, g, ls, signAs);
    setCopyState("idle");
    setDraft({ key: g.key, kind, ids: ls.map((l) => l.id), subject: d.subject, body: d.body });
  };

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch { setCopyState("failed"); }
  };

  const groups = groupByRecommender(letters, today);

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm text-gray-500 max-w-sm">
        Sign emails as
        <input value={signAs} onChange={(e) => onSignAs(e.target.value)} placeholder="Your name" className={field + " text-cream"} />
      </label>

      {letters.length === 0 && (
        <p className="text-sm text-gray-500">No letter requests yet. Add one from a school&rsquo;s Application tab, under Recommendation letters.</p>
      )}

      {groups.map((g) => {
        const hasKind = (k: Kind) => g.letters.some((l) => (k === "request" ? l.status === "not_asked" : k === "reminder" ? l.status === "asked" || l.status === "confirmed" : l.status === "submitted"));
        const kinds = (["request", "reminder", "thanks"] as Kind[]).filter(hasKind);
        const d = draft && draft.key === g.key ? draft : null;
        const mail = d ? mailtoUrl(g.email, { subject: d.subject, body: d.body }) : null;
        return (
          <section key={g.key} id={`rec-${g.id ?? "none"}`} className={`flex flex-col gap-3 rounded border border-line p-4 ${g.id === focus ? "ring-2 ring-brass" : ""}`}>
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-sans text-[15px] font-semibold">
                {g.id ? <Link href={`/people/${g.id}`} className="hover:text-brass">{g.name}</Link> : g.name}
              </h2>
              <span className="text-xs text-gray-500">
                {g.email ?? (<>No email saved{g.id && <> · <Link href={`/people/${g.id}`} className="text-brass hover:underline">Add one</Link></>}</>)}
              </span>
              <span className="text-xs text-gray-400">{g.open} open</span>
              {g.heavy && <span className="text-xs rounded border border-brass text-brass px-1.5 py-0.5">Heavy load: {g.open} open letters ({HEAVY_LOAD} or more)</span>}
            </header>

            <ul>
              {g.letters.map((l) => {
                const flags = letterFlags(l, today);
                const late = l.letter_deadline ? daysBetween(today, l.letter_deadline) < 0 : false;
                const meta = [
                  l.asked_on ? `asked ${fmt(l.asked_on)}` : null,
                  l.reminder_count > 0 ? `reminded ${l.reminder_count}×${l.last_reminded_on ? ` · last ${fmt(l.last_reminded_on)}` : ""}` : null,
                  l.received_on ? `received ${fmt(l.received_on)}` : null,
                ].filter(Boolean);
                return (
                  <li key={l.id} className="border-b border-line/60 last:border-0 py-2.5 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <Link href={`/schools/${l.school_id}?tab=application`} className="font-medium hover:text-brass">{l.school_name}</Link>
                      {l.letter_deadline && <span className={`text-xs ${late ? "text-red-600" : "text-gray-500"}`}>due {fmt(l.letter_deadline)}</span>}
                      <select
                        aria-label={`Status for ${l.school_name}`} value={l.status} disabled={pending}
                        onChange={(e) => run(g.key, () => setLetterStatus(l.id, e.target.value))}
                        className="border rounded px-2 py-1 text-xs bg-transparent ml-auto"
                      >
                        {LETTER_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                    {(meta.length > 0 || flags.length > 0) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {meta.length > 0 && <span className="text-gray-400">{meta.join(" · ")}</span>}
                        {flags.map((f) => (
                          <span key={f} className={`rounded border px-1.5 py-0.5 ${f === "overdue" ? "border-red-600 text-red-600" : "border-brass text-brass"}`}>{FLAG_LABEL[f]}</span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {kinds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {kinds.map((k) => (
                  <button key={k} disabled={pending} onClick={() => openDraft(g, k)} className={secondary}>{KIND_LABEL[k]}</button>
                ))}
              </div>
            )}

            {d && (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <input value={d.subject} onChange={(e) => setDraft({ ...d, subject: e.target.value })} className={field + " text-cream"} aria-label="Email subject" />
                <PaperTextarea value={d.body} onChange={(e) => setDraft({ ...d, body: e.target.value })} rows={12} aria-label="Email body" />
                <div className="flex flex-wrap items-center gap-2">
                  {mail ? (
                    <a href={mail} className={primary}>Open in mail</a>
                  ) : (
                    <span className="text-xs text-gray-400">{g.email ? "Too long for a mail link, use Copy." : "No email saved for this person, use Copy."}</span>
                  )}
                  <button type="button" onClick={copy} className={secondary}>{copyState === "copied" ? "Copied" : "Copy"}</button>
                  {d.kind === "request" && (
                    <button disabled={pending} onClick={() => run(g.key, () => markLettersAsked(d.ids), () => setDraft(null))} className={secondary}>Mark as asked</button>
                  )}
                  {d.kind === "reminder" && (
                    <button disabled={pending} onClick={() => run(g.key, () => markLettersReminded(d.ids), () => setDraft(null))} className={secondary}>Mark as reminded</button>
                  )}
                  <button type="button" onClick={() => setDraft(null)} className="text-xs text-gray-500 hover:text-cream ml-auto">Close</button>
                </div>
                {copyState === "failed" && <span className="text-red-600 text-xs">Copy failed, select the text and copy it yourself.</span>}
                <p className="text-xs text-gray-400">Nothing is sent from here. Send it from your own mail, then mark it.</p>
              </div>
            )}

            {error && errorKey === g.key && <span className="text-red-600 text-xs">{error}</span>}
          </section>
        );
      })}
    </div>
  );
}
