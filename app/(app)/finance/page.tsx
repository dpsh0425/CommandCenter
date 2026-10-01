import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { PageHeader } from "@/components/ui";
import { fundingStatusLabel, fundingTypeLabel } from "@/lib/funding-labels";
import { todayString } from "@/lib/app-date";

export const metadata = { title: "Costs & funding" };

const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3";
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const money = (cur: string, n: number) => `${cur} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const PERIOD: Record<string, string> = { year: "/ yr", month: "/ mo", semester: "/ semester", total: "total" };
const STATUS_BADGE: Record<string, string> = {
  awarded: "bg-emerald-50 text-emerald-700", applied: "bg-blue-50 text-blue-700", eligible: "bg-blue-50 text-blue-700",
};
const RANK: Record<string, number> = { awarded: 0, applied: 1, eligible: 2 };

/** Adds amounts per currency; nothing is ever converted between currencies. */
function byCurrency(rows: Array<{ cur: string; amount: number }>) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.cur, (m.get(r.cur) ?? 0) + r.amount));
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

export default async function FinancePage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: schools }, { data: fundings }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("schools").select("id, name, deadline_date, application_fee, fee_currency, fee_waiver").eq("applying", true).order("deadline_date", { ascending: true, nullsFirst: false }),
    supabase.from("fundings").select("id, name, type, amount, currency, period, covers, status, deadline_date, school_id, schools(name)").in("status", ["awarded", "applied", "eligible"]),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Costs and funding are only available to the workspace owner.</main>;
  }
  const today = todayString();
  const list = schools ?? [];
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const funds = ((fundings ?? []) as any[]).sort((a, b) => RANK[a.status] - RANK[b.status] || (a.deadline_date ?? "9").localeCompare(b.deadline_date ?? "9"));

  const withFee = list.filter((s) => s.application_fee != null).map((s) => ({ ...s, cur: s.fee_currency || "USD", amount: Number(s.application_fee) }));
  const totals = byCurrency(withFee);
  const main = totals[0]?.[0] ?? null; // the running total uses the most-used currency
  const soon = withFee.filter((s) => s.deadline_date && daysBetween(today, s.deadline_date) >= 0 && daysBetween(today, s.deadline_date) <= 30);
  const soonTotals = byCurrency(soon);
  const waivers = list.filter((s) => s.fee_waiver).length;
  const awarded = funds.filter((f) => f.status === "awarded");
  const awardedWithAmount = awarded.filter((f) => f.amount != null);
  const bestAward = new Set(awardedWithAmount.map((f) => f.currency)).size === 1
    ? [...awardedWithAmount].sort((a, b) => Number(b.amount) - Number(a.amount))[0] : null;

  let running = 0;
  const rows = list.map((s) => {
    const fee = s.application_fee != null ? Number(s.application_fee) : null;
    const cur = s.fee_currency || "USD";
    if (fee != null && cur === main) running += fee;
    return { s, fee, cur, running, d: s.deadline_date ? daysBetween(today, s.deadline_date) : null };
  });

  const tiles: Array<{ label: string; value: string; sub: string; tone?: string }> = [
    {
      label: "Fees for applying schools", value: totals.length ? money(totals[0][0], totals[0][1]) : "—",
      sub: totals.length > 1 ? `+ ${totals.slice(1).map(([c, n]) => money(c, n)).join(" + ")}` : `${list.length} school${list.length === 1 ? "" : "s"}${withFee.length < list.length ? `, ${list.length - withFee.length} fee unknown` : ""}`,
    },
    { label: "Due in the next 30 days", value: soonTotals.length ? soonTotals.map(([c, n]) => money(c, n)).join(" + ") : "—", sub: soon.length ? `${soon.length} deadline${soon.length === 1 ? "" : "s"}` : "no fees due soon", tone: soon.length ? "text-red-700" : undefined },
    { label: "Waiver noted", value: String(waivers), sub: `of ${list.length} school${list.length === 1 ? "" : "s"}`, tone: waivers ? "text-emerald-700" : undefined },
    {
      label: "Funding awarded", value: bestAward ? money(bestAward.currency, Number(bestAward.amount)) : awarded.length ? String(awarded.length) : "—",
      sub: bestAward ? `${bestAward.period ? (PERIOD[bestAward.period] ?? bestAward.period) + " · " : ""}best of ${awarded.length} offer${awarded.length === 1 ? "" : "s"}` : awarded.length ? "offers, amounts in different currencies or unknown" : "nothing awarded yet",
      tone: awarded.length ? "text-emerald-700" : undefined,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow="Insights" title="Costs & funding" subtitle="Application fees and funding offers, read from your schools. Edit them on each school's Admissions and Funding tabs." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={`${card} px-4 py-3`}>
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t.label}</p>
            <p className={`truncate text-[22px] font-semibold tabular-nums ${t.tone ?? "text-slate-900"}`}>{t.value}</p>
            <p className="truncate text-xs text-slate-500">{t.sub}</p>
          </div>
        ))}
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className={cardHead}>
          <h2 className="text-[15px] font-semibold text-slate-900">Application fees<span className="ml-1 font-normal text-slate-500">· schools you are applying to, by deadline</span></h2>
        </div>
        {list.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-slate-500">No schools marked as applying yet. Open a school&apos;s Application tab and choose &ldquo;I&apos;m applying here&rdquo;.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">School</th>
                  <th className="px-2 py-2.5 font-medium">Deadline</th>
                  <th className="px-2 py-2.5 text-right font-medium">Fee</th>
                  <th className="px-2 py-2.5 font-medium">Waiver</th>
                  <th className="px-5 py-2.5 text-right font-medium">Running total{main ? ` (${main})` : ""}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, fee, cur, running: run, d }) => (
                  <tr key={s.id} className="border-t border-slate-100 align-top">
                    <td className="px-5 py-3"><Link href={`/schools/${s.id}?tab=admissions`} className="font-semibold text-slate-900 hover:text-blue-700">{s.name}</Link></td>
                    <td className={`whitespace-nowrap px-2 py-3 ${d != null && d >= 0 && d <= 30 ? "font-medium text-red-700" : "text-slate-600"}`}>
                      {s.deadline_date ? `${shortDate(s.deadline_date)}${d != null && d >= 0 && d <= 30 ? ` · ${d}d` : d != null && d < 0 ? " · passed" : ""}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{fee != null ? money(cur, fee) : <span className="text-slate-400">Not researched</span>}</td>
                    <td className="px-2 py-3">
                      {s.fee_waiver ? <span className="inline-block max-w-[220px] truncate rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700" title={s.fee_waiver}>{s.fee_waiver}</span> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                      {fee != null && cur !== main ? <span className="text-xs text-slate-400">other currency</span> : run.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className={cardHead}>
          <h2 className="text-[15px] font-semibold text-slate-900">Funding offers and applications<span className="ml-1 font-normal text-slate-500">· awarded, applied and eligible</span></h2>
        </div>
        {funds.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-slate-500">No awarded, applied or eligible funding yet. Track options on each school&apos;s Funding tab.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Funding</th>
                  <th className="px-2 py-2.5 font-medium">School</th>
                  <th className="px-2 py-2.5 font-medium">Type</th>
                  <th className="px-2 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {funds.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100 align-top">
                    <td className="px-5 py-3">
                      <span className="font-semibold text-slate-900">{f.name}</span>
                      {f.covers && <span className="block text-xs text-slate-500">{f.covers}</span>}
                    </td>
                    <td className="px-2 py-3"><Link href={`/schools/${f.school_id}?tab=funding`} className="text-slate-700 hover:text-blue-700">{f.schools?.name ?? "School"}</Link></td>
                    <td className="px-2 py-3"><span className="whitespace-nowrap rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">{fundingTypeLabel(f.type)}</span></td>
                    <td className="px-2 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[f.status]}`}>{fundingStatusLabel(f.status)}</span></td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                      {f.amount != null ? <span className="font-semibold">{money(f.currency, Number(f.amount))}{f.period ? ` ${PERIOD[f.period] ?? `/ ${f.period}`}` : ""}</span> : <span className="text-slate-400">Amount unknown</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-[18px] py-3.5">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-slate-500"><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
        <p className="text-[13px] text-slate-600">Score-sending costs, a budget and a spending log aren&apos;t tracked yet; they need somewhere to be saved. Totals here are never converted between currencies.</p>
      </div>
    </main>
  );
}
