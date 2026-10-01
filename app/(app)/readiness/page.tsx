import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { loadReadiness } from "@/lib/readiness-data";
import { RISK_LABEL } from "@/lib/readiness";
import { StartApplyingList } from "@/components/readiness-controls";
import { PageHeader, SCHOOL_TABS, SubNav } from "@/components/ui";
import { todayString } from "@/lib/app-date";

export const metadata = { title: "Readiness" };

const RISK_BADGE: Record<string, string> = {
  overdue: "bg-red-50 text-red-700", urgent: "bg-red-50 text-red-700", watch: "bg-blue-50 text-blue-700",
  ok: "bg-slate-100 text-slate-700", nodate: "bg-slate-100 text-slate-500", submitted: "bg-emerald-50 text-emerald-700",
};
const BAR: Record<string, string> = { overdue: "bg-red-600", urgent: "bg-red-600", submitted: "bg-emerald-600" };

export default async function ReadinessPage() {
  const supabase = await createClient();
  // "Today" in APP_TIMEZONE, not the server clock.
  const today = todayString();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Readiness is only available to the workspace owner.</main>;
  }
  const rows = await loadReadiness(supabase, today);
  const { data: candidates } = await supabase
    .from("schools").select("id, name, deadline_date").eq("applying", false).not("deadline_date", "is", null).gte("deadline_date", today).order("deadline_date").limit(12);

  const atRisk = rows.filter((r) => r.risk === "overdue" || r.risk === "urgent").length;
  const submitted = rows.filter((r) => r.risk === "submitted").length;
  const nextDue = rows
    .filter((r) => r.risk !== "submitted" && r.days != null && r.days >= 0)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];

  const stats: Array<{ label: string; value: string; sub?: string; tone?: string }> = [
    { label: "Tracking", value: String(rows.length), sub: rows.length === 1 ? "application" : "applications" },
    { label: "At risk", value: String(atRisk), sub: "overdue or due soon", tone: atRisk ? "text-red-700" : undefined },
    { label: "Submitted", value: String(submitted), sub: `of ${rows.length}` },
    {
      label: "Next deadline",
      value: nextDue ? (nextDue.days === 0 ? "Today" : `${nextDue.days}d`) : "—",
      sub: nextDue ? nextDue.school.name : "nothing upcoming",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Applications" title="Readiness" subtitle="For every school you are applying to: what is done, what is blocking you, and which deadline is closest to trouble." />
        <SubNav items={SCHOOL_TABS} current="/readiness" />
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone ?? "text-slate-900"}`}>{s.value}</p>
              {s.sub && <p className="truncate text-xs text-slate-500">{s.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">You aren&rsquo;t tracking any applications yet</p>
          <p className="mt-1 text-[13px] text-slate-500">Pick the schools you plan to apply to below, or open a school and choose &ldquo;I&rsquo;m applying here&rdquo;.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const pct = r.risk === "submitted" ? 100 : r.total ? Math.round((r.doneCount / r.total) * 100) : 0;
            const todo = r.pending.map((p) => p.label.replace(/ \(.*\)$/, ""));
            return (
              <li key={r.school.id}>
                <Link
                  href={`/schools/${r.school.id}?tab=application`}
                  className="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-slate-900">{r.school.name}</span>
                      {r.school.deadline_date && (
                        <span className="text-xs text-slate-500">
                          Deadline {new Date(r.school.deadline_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {r.days != null && r.risk !== "submitted" && ` · ${r.days < 0 ? `${-r.days}d ago` : r.days === 0 ? "today" : `${r.days} days left`}`}
                        </span>
                      )}
                    </span>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${RISK_BADGE[r.risk] ?? RISK_BADGE.ok}`}>{RISK_LABEL[r.risk]}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className={`block h-full rounded-full ${BAR[r.risk] ?? "bg-blue-600"}`} style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-xs tabular-nums text-slate-600">{r.doneCount}/{r.total}</span>
                  </div>
                  {r.risk !== "submitted" && todo.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {todo.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{t}</span>
                      ))}
                      {todo.length > 4 && <span className="px-1 py-0.5 text-xs text-slate-500">+{todo.length - 4} more</span>}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {(candidates ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Schools with a deadline coming up</h2>
          <StartApplyingList schools={candidates ?? []} />
        </section>
      )}
    </main>
  );
}
