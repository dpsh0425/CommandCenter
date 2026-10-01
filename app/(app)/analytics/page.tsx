import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { PageHeader } from "@/components/ui";
import { AnalyticsActivity, type WeekPoint } from "@/components/analytics-activity";
import { todayString, zonedDay } from "@/lib/app-date";

export const metadata = { title: "Analytics" };

// The stages a school moves through, in order. "Not started" and "Rejected" sit outside the funnel.
const FUNNEL: Array<{ key: string; label: string; color: string }> = [
  { key: "researching", label: "Researching", color: "#94A3B8" },
  { key: "contacted", label: "Contacted", color: "#93C5FD" },
  { key: "replied", label: "Replied", color: "#3B82F6" },
  { key: "submitted", label: "Submitted", color: "#1D4ED8" },
  { key: "interview", label: "Interview", color: "#7C3AED" },
  { key: "accepted", label: "Accepted", color: "#059669" },
];
const OUTREACH: Array<{ key: string; label: string; color: string }> = [
  { key: "not_contacted", label: "Not contacted", color: "#CBD5E1" },
  { key: "contacted", label: "Contacted", color: "#93C5FD" },
  { key: "replied", label: "Replied", color: "#2563EB" },
  { key: "meeting", label: "Meeting", color: "#059669" },
  { key: "no_response", label: "No response", color: "#64748B" },
  { key: "declined", label: "Declined", color: "#DC2626" },
];
const LETTERS: Array<{ key: string; label: string }> = [
  { key: "not_asked", label: "Not asked" }, { key: "asked", label: "Asked" }, { key: "confirmed", label: "Confirmed" }, { key: "submitted", label: "Submitted" },
];
const TIERS: Array<{ key: string | null; label: string; color: string }> = [
  { key: "reach", label: "Reach", color: "#DC2626" }, { key: "target", label: "Target", color: "#2563EB" },
  { key: "safe", label: "Safe", color: "#059669" }, { key: null, label: "Not set", color: "#94A3B8" },
];

const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3";
const dayNum = (ymd: string) => Math.round(new Date(ymd + "T00:00:00Z").getTime() / 86400000);
const ymdOf = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
const mondayOf = (ymd: string) => { const n = dayNum(ymd); const dow = (new Date(ymd + "T00:00:00Z").getUTCDay() + 6) % 7; return ymdOf(n - dow); };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: schools }, { data: activity }, { data: professors }, { data: letters }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("schools").select("id, status, tier, composite_score, applying"),
    supabase.from("activity_log").select("occurred_at, is_win"),
    supabase.from("professors").select("outreach, fit_score"),
    supabase.from("letter_requests").select("status, asked_on, received_on, reminder_count"),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Analytics are only available to the workspace owner.</main>;
  }
  const today = todayString();
  const sList = schools ?? [], aList = activity ?? [], pList = professors ?? [], lList = letters ?? [];

  // ── Weekly activity, Monday-based weeks in APP_TIMEZONE, from the first entry (at most two years back) to this week.
  const thisWeek = mondayOf(today);
  const counts = new Map<string, { n: number; wins: number }>();
  for (const a of aList) {
    const w = mondayOf(zonedDay(a.occurred_at));
    const c = counts.get(w) ?? { n: 0, wins: 0 };
    if (a.is_win) c.wins += 1; else c.n += 1;
    counts.set(w, c);
  }
  const firstWeek = Array.from(counts.keys()).sort()[0] ?? thisWeek;
  const span = Math.min(104, Math.max(1, Math.round((dayNum(thisWeek) - dayNum(firstWeek)) / 7) + 1));
  const weeks: WeekPoint[] = Array.from({ length: Math.max(span, 12) }, (_, i) => {
    const w = ymdOf(dayNum(thisWeek) - (Math.max(span, 12) - 1 - i) * 7);
    const c = counts.get(w) ?? { n: 0, wins: 0 };
    return { week: w, updates: c.n, wins: c.wins };
  });

  // ── Status funnel: schools that reached each stage or beyond.
  const rank = (s: string) => FUNNEL.findIndex((f) => f.key === s);
  const inFunnel = sList.filter((s) => rank(s.status) >= 0);
  const funnel = FUNNEL.map((f, i) => ({ ...f, n: inFunnel.filter((s) => rank(s.status) >= i).length }));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));
  const notStarted = sList.filter((s) => s.status === "not_started").length;
  const rejected = sList.filter((s) => s.status === "rejected").length;
  const applying = sList.filter((s) => s.applying).length;
  const submitted = sList.filter((s) => ["submitted", "interview", "accepted", "rejected"].includes(s.status)).length;

  // ── Outreach.
  const outCount = (k: string) => pList.filter((p) => p.outreach === k).length;
  const contacted = pList.filter((p) => p.outreach !== "not_contacted");
  const replied = contacted.filter((p) => p.outreach === "replied" || p.outreach === "meeting");
  const rate = (list: typeof contacted) => ({ n: list.length, r: list.filter((p) => p.outreach === "replied" || p.outreach === "meeting").length });
  const hi = rate(contacted.filter((p) => (p.fit_score ?? 0) >= 4));
  const lo = rate(contacted.filter((p) => p.fit_score != null && p.fit_score <= 3));
  const fitLine = hi.n >= 3 && lo.n >= 3
    ? `Fit 4–5 professors replied ${pct(hi.r, hi.n)}% of the time (${hi.r} of ${hi.n}); fit 1–3, ${pct(lo.r, lo.n)}% (${lo.r} of ${lo.n}).`
    : null;

  // ── Letters.
  const letterCount = (k: string) => lList.filter((l) => l.status === k).length;
  const turnaround = lList.filter((l) => l.asked_on && l.received_on).map((l) => dayNum(l.received_on as string) - dayNum(l.asked_on as string)).filter((d) => d >= 0);
  const avgDays = turnaround.length ? Math.round(turnaround.reduce((a, b) => a + b, 0) / turnaround.length) : null;
  const reminders = lList.reduce((n, l) => n + (l.reminder_count ?? 0), 0);

  // ── Fit score spread (composite score, 0–100) and the chance call.
  const scored = sList.filter((s) => s.composite_score != null).map((s) => Number(s.composite_score));
  const buckets = [0, 20, 40, 60, 80].map((lo2, i) => ({ label: `${lo2}–${lo2 + 20}`, n: scored.filter((v) => (i === 4 ? v >= lo2 : v >= lo2 && v < lo2 + 20)).length }));
  const bucketMax = Math.max(1, ...buckets.map((b) => b.n));
  const tiers = TIERS.map((t) => ({ ...t, n: sList.filter((s) => (s.tier ?? null) === t.key).length }));
  const tierMax = Math.max(1, ...tiers.map((t) => t.n));

  const empty = sList.length === 0 && aList.length === 0 && pList.length === 0 && lList.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow="Insights" title="Analytics" subtitle="How your applications are moving, from the records you already keep." />

      {empty ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">Nothing to measure yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Add schools, log activity and track professors and letters, and the charts fill in from those records.</p>
          <Link href="/schools" className="mt-3 inline-block text-[13px] font-medium text-blue-600 hover:text-blue-700">Go to schools →</Link>
        </div>
      ) : (
        <AnalyticsActivity
          weeks={weeks}
          tiles={{
            schools: sList.length, applying, submitted,
            replyRate: contacted.length ? pct(replied.length, contacted.length) : null, replied: replied.length, contacted: contacted.length,
            lettersIn: letterCount("submitted"), lettersTotal: lList.length, avgDays,
          }}
        >
          <section className={card}>
            <div className={cardHead}>
              <h2 className="text-[15px] font-semibold text-slate-900">Status funnel</h2>
              <span className="text-xs text-slate-500">Schools that reached each stage or beyond</span>
            </div>
            {inFunnel.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-slate-500">No schools have moved past &ldquo;Not started&rdquo; yet.</p>
            ) : (
              <div className="flex flex-col gap-2 px-5 py-4 text-[13px]">
                {funnel.map((f) => (
                  <div key={f.key} className="grid grid-cols-[100px_minmax(0,1fr)_40px] items-center gap-3">
                    <span className="text-slate-600">{f.label}</span>
                    <span className="h-[22px] rounded bg-slate-50">
                      <span className="block h-full rounded" style={{ width: `${Math.max(f.n ? 2 : 0, (f.n / funnelMax) * 100)}%`, background: f.color }} />
                    </span>
                    <span className={`text-right font-semibold tabular-nums ${f.n ? "text-slate-900" : "text-slate-400"}`}>{f.n}</span>
                  </div>
                ))}
                <p className="pt-1 text-xs text-slate-500">{notStarted} not started · {rejected} rejected, shown separately so they don&apos;t distort the funnel.</p>
              </div>
            )}
          </section>

          <section className={card}>
            <div className={cardHead}>
              <h2 className="text-[15px] font-semibold text-slate-900">Outreach responses</h2>
              <span className="text-xs text-slate-500">{pList.length} professor{pList.length === 1 ? "" : "s"}</span>
            </div>
            {pList.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-slate-500">No professors yet. Add them on a school&apos;s Faculty tab.</p>
            ) : (
              <div className="flex flex-col gap-3 px-5 py-4">
                <div className="flex h-[26px] overflow-hidden rounded-md" role="img" aria-label={OUTREACH.map((o) => `${o.label} ${outCount(o.key)}`).join(", ")}>
                  {OUTREACH.filter((o) => outCount(o.key) > 0).map((o) => (
                    <span key={o.key} style={{ width: `${(outCount(o.key) / pList.length) * 100}%`, background: o.color }} />
                  ))}
                </div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                  {OUTREACH.map((o) => (
                    <li key={o.key} className="flex items-center gap-1.5">
                      <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: o.color }} />{o.label} <span className="font-semibold tabular-nums text-slate-900">{outCount(o.key)}</span>
                    </li>
                  ))}
                </ul>
                {fitLine && <p className="border-t border-slate-100 pt-2.5 text-[13px] text-slate-700">{fitLine}</p>}
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-3 lg:col-span-2">
            <section className={card}>
              <div className={cardHead}><h2 className="text-[15px] font-semibold text-slate-900">Your chance call</h2></div>
              <div className="flex flex-col gap-2 px-5 py-4 text-[13px]">
                {tiers.map((t) => (
                  <div key={t.label} className="grid grid-cols-[64px_minmax(0,1fr)_24px] items-center gap-2">
                    <span className={t.key ? "text-slate-700" : "text-slate-500"}>{t.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${(t.n / tierMax) * 100}%`, background: t.color }} /></span>
                    <span className="text-right font-semibold tabular-nums">{t.n}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className={card}>
              <div className={cardHead}><h2 className="text-[15px] font-semibold text-slate-900">Fit score spread</h2><span className="text-xs text-slate-500">{scored.length} scored</span></div>
              {scored.length === 0 ? <p className="px-5 py-4 text-[13px] text-slate-500">No fit scores yet.</p> : (
                <div className="px-5 py-4">
                  <div className="flex h-24 items-end gap-1.5" role="img" aria-label={buckets.map((b) => `${b.label}: ${b.n}`).join(", ")}>
                    {buckets.map((b, i) => (
                      <span key={b.label} className="flex-1 rounded-t" title={`${b.label}: ${b.n}`} style={{ height: `${Math.max(b.n ? 4 : 0, (b.n / bucketMax) * 100)}%`, background: ["#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#2563EB"][i] }} />
                    ))}
                  </div>
                  <div className="flex justify-between pt-1.5 text-[11px] text-slate-500">{buckets.map((b) => <span key={b.label}>{b.label}</span>)}</div>
                </div>
              )}
            </section>
            <section className={card}>
              <div className={cardHead}><h2 className="text-[15px] font-semibold text-slate-900">Letters</h2></div>
              {lList.length === 0 ? <p className="px-5 py-4 text-[13px] text-slate-500">No letters requested yet.</p> : (
                <dl className="flex flex-col gap-2 px-5 py-4 text-[13px]">
                  {LETTERS.map((l) => (
                    <div key={l.key} className="flex justify-between"><dt className="text-slate-600">{l.label}</dt><dd className={`font-semibold tabular-nums ${l.key === "submitted" && letterCount(l.key) ? "text-emerald-700" : ""}`}>{letterCount(l.key)}</dd></div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-2"><dt className="text-slate-600">Reminders sent</dt><dd className="font-semibold tabular-nums">{reminders}</dd></div>
                </dl>
              )}
            </section>
          </div>
        </AnalyticsActivity>
      )}
    </main>
  );
}
