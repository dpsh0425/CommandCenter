"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { markLettersAsked, markLettersReminded, setLetterStatus } from "@/app/(app)/materials/letter-actions";
import { LetterRequestForm, type PersonOpt, type SchoolOpt } from "@/components/letter-request-form";
import { PaperTextarea } from "@/components/paper-textarea";
import { useAction } from "@/lib/use-action";
import {
  FLAG_LABEL, HEAVY_LOAD, LETTER_STATUSES, buildReminderEmail, buildRequestEmail, buildThankYouEmail, daysBetween, groupByRecommender,
  letterFlags, mailtoUrl, type EmailDraft, type LetterRecord, type RecommenderGroup,
} from "@/lib/letters";

const field = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "inline-flex h-9 items-center rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const secondary = "inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50";
const STORAGE_KEY = "letters-sign-as";
const STATUS_TONE: Record<string, string> = {
  not_asked: "border-slate-300 bg-white text-slate-600",
  asked: "border-blue-200 bg-blue-50 text-blue-700",
  confirmed: "border-blue-300 bg-blue-100 text-blue-800",
  submitted: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

type Kind = "request" | "reminder" | "thanks";
type Draft = { key: string; kind: Kind; ids: string[]; subject: string; body: string };

const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

function build(kind: Kind, g: RecommenderGroup, ls: LetterRecord[], signAs: string): EmailDraft {
  if (kind === "request") return buildRequestEmail(g.name, ls, signAs);
  if (kind === "reminder") return buildReminderEmail(g.name, ls, signAs);
  return buildThankYouEmail(g.name, ls, signAs);
}

const KIND_LABEL: Record<Kind, string> = { request: "Draft request", reminder: "Draft reminder", thanks: "Draft thank-you" };
const DRAFT_TITLE: Record<Kind, string> = { request: "Request to", reminder: "Reminder to", thanks: "Thank-you to" };

export function LettersBoard({ letters, people, schools, today, focus }: { letters: LetterRecord[]; people: PersonOpt[]; schools: SchoolOpt[]; today: string; focus?: string }) {
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex items-center gap-2 text-[13px] text-slate-600">
          Sign emails as
          <input value={signAs} onChange={(e) => onSignAs(e.target.value)} placeholder="Your name" className={`${field} w-52`} />
        </label>
      </div>

      <LetterRequestForm people={people} schools={schools} letters={letters} />

      {letters.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No letter requests yet</p>
          <p className="mt-1 text-[13px] text-slate-500">Use Request letters above, or add one from a school&rsquo;s Application tab.</p>
        </div>
      )}

      {groups.map((g) => {
        const hasKind = (k: Kind) => g.letters.some((l) => (k === "request" ? l.status === "not_asked" : k === "reminder" ? l.status === "asked" || l.status === "confirmed" : l.status === "submitted"));
        const kinds = (["request", "reminder", "thanks"] as Kind[]).filter(hasKind);
        const d = draft && draft.key === g.key ? draft : null;
        const mail = d ? mailtoUrl(g.email, { subject: d.subject, body: d.body }) : null;
        return (
          <section
            key={g.key} id={`rec-${g.id ?? "none"}`}
            className={`scroll-mt-20 rounded-lg border bg-white ${g.id === focus ? "border-blue-600 ring-2 ring-blue-600/20" : "border-slate-200"}`}
          >
            <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3.5">
              <span aria-hidden className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-[13px] font-semibold text-blue-700">{initials(g.name)}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-slate-900">
                  {g.id ? <Link href={`/people/${g.id}`} className="hover:text-blue-700">{g.name}</Link> : g.name}
                </h2>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  {g.email ?? (<>No email saved{g.id && <> · <Link href={`/people/${g.id}`} className="font-medium text-blue-600 hover:text-blue-700">Add one</Link></>}</>)}
                  <span>· {g.open} open</span>
                  {g.heavy && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">Heavy load: {g.open} open letters ({HEAVY_LOAD} or more)</span>}
                </p>
              </div>
              {kinds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {kinds.map((k) => (
                    <button key={k} type="button" disabled={pending} onClick={() => openDraft(g, k)} className={secondary}>{KIND_LABEL[k]}</button>
                  ))}
                </div>
              )}
            </header>

            <ul className="px-5">
              {g.letters.map((l) => {
                const flags = letterFlags(l, today);
                const late = l.letter_deadline ? daysBetween(today, l.letter_deadline) < 0 : false;
                const meta = [
                  l.asked_on ? `asked ${fmt(l.asked_on)}` : null,
                  l.reminder_count > 0 ? `reminded ${l.reminder_count}×${l.last_reminded_on ? ` · last ${fmt(l.last_reminded_on)}` : ""}` : null,
                  l.received_on ? `received ${fmt(l.received_on)}` : null,
                ].filter(Boolean);
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 py-2.5 last:border-0">
                    <Link href={`/schools/${l.school_id}?tab=application`} className="min-w-[8rem] text-sm font-semibold text-slate-900 hover:text-blue-700">{l.school_name}</Link>
                    {l.letter_deadline && <span className={`text-xs ${late ? "font-medium text-red-700" : "text-slate-500"}`}>due {fmt(l.letter_deadline)}</span>}
                    {meta.length > 0 && <span className="text-xs text-slate-500">{meta.join(" · ")}</span>}
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                      {flags.map((f) => (
                        <span key={f} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${f === "overdue" || f === "needs_reminder" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{FLAG_LABEL[f]}</span>
                      ))}
                      <select
                        aria-label={`Status for ${l.school_name}`} value={l.status} disabled={pending}
                        onChange={(e) => run(g.key, () => setLetterStatus(l.id, e.target.value))}
                        className={`h-7 cursor-pointer rounded-full border px-2 text-xs font-medium disabled:opacity-60 ${STATUS_TONE[l.status] ?? STATUS_TONE.not_asked}`}
                      >
                        {LETTER_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </span>
                  </li>
                );
              })}
            </ul>

            {d && (
              <div className="mx-5 mb-5 flex flex-col gap-2.5 rounded-lg border border-blue-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-blue-700">{DRAFT_TITLE[d.kind]} {g.name}</span>
                  <button type="button" onClick={() => setDraft(null)} className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900">Close</button>
                </div>
                <input value={d.subject} onChange={(e) => setDraft({ ...d, subject: e.target.value })} className={field} aria-label="Email subject" />
                <PaperTextarea value={d.body} onChange={(e) => setDraft({ ...d, body: e.target.value })} rows={12} aria-label="Email body" />
                <div className="flex flex-wrap items-center gap-2">
                  {mail ? (
                    <a href={mail} className={primary}>Open in mail</a>
                  ) : (
                    <span className="text-xs text-slate-500">{g.email ? "Too long for a mail link, use Copy." : "No email saved for this person, use Copy."}</span>
                  )}
                  <button type="button" onClick={copy} className={secondary}>{copyState === "copied" ? "Copied" : "Copy"}</button>
                  {d.kind === "request" && (
                    <button type="button" disabled={pending} onClick={() => run(g.key, () => markLettersAsked(d.ids), () => setDraft(null))} className={secondary}>Mark as asked</button>
                  )}
                  {d.kind === "reminder" && (
                    <button type="button" disabled={pending} onClick={() => run(g.key, () => markLettersReminded(d.ids), () => setDraft(null))} className={secondary}>Mark as reminded</button>
                  )}
                  <span className="ml-auto text-xs text-slate-500">Nothing is sent from here. Send it from your own mail, then mark it.</span>
                </div>
                {copyState === "failed" && <span role="alert" className="text-xs text-red-700">Copy failed, select the text and copy it yourself.</span>}
              </div>
            )}

            {error && errorKey === g.key && <p role="alert" className="px-5 pb-4 text-xs text-red-700">{error}</p>}
          </section>
        );
      })}
    </div>
  );
}
