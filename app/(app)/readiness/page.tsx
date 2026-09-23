import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { loadReadiness } from "@/lib/readiness-data";
import { RISK_LABEL, RISK_TONE } from "@/lib/readiness";
import { StartApplyingList } from "@/components/readiness-controls";
import { PageHeader, SCHOOL_TABS, SubNav } from "@/components/ui";

export const metadata = { title: "Readiness" };

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function ReadinessPage() {
  const supabase = await createClient();
  const today = localDate(new Date());
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Readiness is only available to the workspace owner.</main>;
  }
  const rows = await loadReadiness(supabase, today);
  const { data: candidates } = await supabase
    .from("schools").select("id, name, deadline_date").eq("applying", false).not("deadline_date", "is", null).gte("deadline_date", today).order("deadline_date").limit(12);

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <PageHeader title="Readiness" subtitle="For every school you are applying to: what is done, what is blocking you, and which deadline is closest to trouble." />
        <SubNav items={SCHOOL_TABS} current="/readiness" />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">You aren&rsquo;t tracking any applications yet. Pick the schools you plan to apply to below, or open a school and choose &ldquo;I&rsquo;m applying here&rdquo;.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => {
            const pct = r.total ? Math.round((r.doneCount / r.total) * 100) : 0;
            return (
              <li key={r.school.id} className="border-b border-line/60 last:border-0">
                <Link href={`/schools/${r.school.id}?tab=application`} className="flex flex-col gap-2 py-4 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium truncate">{r.school.name}</span>
                    <span className={`text-sm whitespace-nowrap ${RISK_TONE[r.risk]}`}>
                      {RISK_LABEL[r.risk]}
                      {r.days != null && r.risk !== "submitted" && <span className="text-gray-400"> · {r.days < 0 ? `${-r.days}d ago` : r.days === 0 ? "today" : `${r.days} days left`}</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-1.5 flex-1 rounded bg-surface-raised overflow-hidden"><span className={`block h-full ${r.risk === "urgent" || r.risk === "overdue" ? "bg-red-600" : r.risk === "submitted" ? "bg-teal-600" : "bg-brass"}`} style={{ width: `${r.risk === "submitted" ? 100 : pct}%` }} /></span>
                    <span className="font-mono text-xs text-gray-500">{r.doneCount}/{r.total}</span>
                  </div>
                  {r.risk !== "submitted" && r.pending.length > 0 && (
                    <p className="text-sm text-gray-500 line-clamp-2">Still to do: {r.pending.map((p) => p.label.replace(/ \(.*\)$/, "").toLowerCase()).join(", ")}.</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {(candidates ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-sans text-[15px] font-semibold text-cream border-b border-line pb-2">Schools with a deadline coming up</h2>
          <StartApplyingList schools={candidates ?? []} />
        </section>
      )}
    </main>
  );
}
