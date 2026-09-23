import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";

export const metadata = { title: "This week" };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
const daysBetween = (from: string, to: string) => Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const rel = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d ago` : `in ${d}d`);
const short = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

type Item = { date: string; label: string; sub: string; href: string; kind: "task" | "deadline" | "letter" | "funding" | "milestone" | "interview" };
const KIND: Record<Item["kind"], { label: string; dot: string }> = {
  task: { label: "Task", dot: "bg-brass" }, deadline: { label: "Deadline", dot: "bg-red-600" }, letter: { label: "Letter", dot: "bg-violet-600" },
  funding: { label: "Funding", dot: "bg-teal-600" }, milestone: { label: "Milestone", dot: "bg-violet-600" }, interview: { label: "Interview", dot: "bg-teal-600" },
};

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const offset = Math.max(-8, Math.min(12, Number(w) || 0));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">The weekly plan is only available to the workspace owner.</main>;
  }

  const now = new Date();
  const today = ymd(now);
  const start = addDays(mondayOf(now), offset * 7);
  const end = addDays(start, 6);
  const startS = ymd(start), endS = ymd(end);
  const lastWeekStart = ymd(addDays(mondayOf(now), -7));
  const lastWeekEnd = ymd(addDays(mondayOf(now), -1));
  const in90 = ymd(addDays(now, 90));
  const tenDaysAgo = ymd(addDays(now, -10));

  const [
    { data: tasks }, { data: schools }, { data: depts }, { data: funds }, { data: letters }, { data: milestones },
    { data: interviews }, { data: profs }, { data: sops }, { data: doneTasks }, { data: winsA },
  ] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, priority, status, schools(name), research_milestones(title)").not("due_date", "is", null).not("status", "in", "(done,cancelled)"),
    supabase.from("schools").select("id, name, deadline_date, application_url, status, sop_version_id").not("deadline_date", "is", null),
    supabase.from("departments").select("id, name, deadline_date, school_id, schools(name)").not("deadline_date", "is", null),
    supabase.from("fundings").select("id, name, deadline_date, status, school_id, schools(name)").not("deadline_date", "is", null).neq("status", "not_eligible"),
    supabase.from("letter_requests").select("id, school_id, status, letter_deadline, people(name), schools(name)"),
    supabase.from("research_milestones").select("id, title, target_date").not("target_date", "is", null).neq("status", "done"),
    supabase.from("interviews").select("id, school_id, scheduled_at, status, schools(name)").eq("status", "scheduled").not("scheduled_at", "is", null),
    supabase.from("professors").select("id, name, school_id, accepting, fit_score, outreach, last_contacted_on, research_areas, schools(name, deadline_date)"),
    supabase.from("schools").select("id").not("sop_version_id", "is", null),
    supabase.from("task_updates").select("created_at").eq("type", "status_change").eq("is_win", true).gte("created_at", new Date(lastWeekStart + "T00:00:00").toISOString()),
    supabase.from("activity_log").select("created_at").eq("is_win", true).gte("created_at", new Date(lastWeekStart + "T00:00:00").toISOString()),
  ]);

  // ---- Everything dated ----
  const all: Item[] = [
    ...(tasks ?? []).map((t: any) => ({ date: t.due_date, label: t.title, sub: [t.schools?.name, t.research_milestones?.title, `${t.priority} priority`].filter(Boolean).join(" · "), href: `/tasks/${t.id}`, kind: "task" as const })),
    ...(schools ?? []).map((s: any) => ({ date: s.deadline_date, label: `${s.name} application deadline`, sub: "school application", href: `/schools/${s.id}`, kind: "deadline" as const })),
    ...(depts ?? []).filter((d: any) => !(schools ?? []).some((s: any) => s.id === d.school_id && s.deadline_date === d.deadline_date)).map((d: any) => ({ date: d.deadline_date, label: `${d.schools?.name} · ${d.name} deadline`, sub: "department", href: `/schools/${d.school_id}`, kind: "deadline" as const })),
    ...(funds ?? []).map((f: any) => ({ date: f.deadline_date, label: `${f.name} (${f.schools?.name})`, sub: `funding · ${String(f.status).replace("_", " ")}`, href: `/schools/${f.school_id}?tab=funding`, kind: "funding" as const })),
    ...((letters ?? []) as any[]).filter((l) => l.letter_deadline && l.status !== "submitted").map((l) => ({ date: l.letter_deadline, label: `${l.people?.name ?? "Recommender"}'s letter for ${l.schools?.name}`, sub: `letter · ${String(l.status).replace("_", " ")}`, href: `/schools/${l.school_id}?tab=application`, kind: "letter" as const })),
    ...(milestones ?? []).map((m: any) => ({ date: m.target_date, label: m.title, sub: "research milestone", href: `/research/${m.id}`, kind: "milestone" as const })),
    ...((interviews ?? []) as any[]).map((i) => ({ date: ymd(new Date(i.scheduled_at)), label: `Interview: ${i.schools?.name}`, sub: new Date(i.scheduled_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), href: `/schools/${i.school_id}?tab=application`, kind: "interview" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const overdue = all.filter((i) => i.date < today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return { date: ymd(d), label: d.toLocaleDateString(undefined, { weekday: "long" }), short: short(d), items: all.filter((x) => x.date === ymd(d)) };
  });
  const weekCount = days.reduce((n, d) => n + d.items.length, 0);

  // ---- Application countdown ----
  const lettersBy = new Map<string, any[]>();
  for (const l of (letters ?? []) as any[]) lettersBy.set(l.school_id, [...(lettersBy.get(l.school_id) ?? []), l]);
  const profsBy = new Map<string, any[]>();
  for (const p of (profs ?? []) as any[]) profsBy.set(p.school_id, [...(profsBy.get(p.school_id) ?? []), p]);
  const sopSet = new Set((sops ?? []).map((s) => s.id));

  const countdown = ((schools ?? []) as any[])
    .filter((s) => s.deadline_date >= today && s.deadline_date <= in90)
    .sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))
    .map((s) => {
      const ls = lettersBy.get(s.id) ?? [];
      const ps = profsBy.get(s.id) ?? [];
      const confirmed = ls.filter((l) => l.status === "confirmed" || l.status === "submitted").length;
      const checks = [
        { ok: ls.length > 0 && confirmed === ls.length, text: ls.length ? `Letters ${confirmed}/${ls.length} confirmed` : "No letters requested" },
        { ok: sopSet.has(s.id), text: sopSet.has(s.id) ? "SOP recorded" : "SOP not recorded" },
        ...(ps.length ? [{ ok: ps.some((p) => p.outreach !== "not_contacted"), text: ps.some((p) => p.outreach !== "not_contacted") ? "Professor contacted" : "No professor contacted" }] : []),
        { ok: !!s.application_url, text: s.application_url ? "Portal link saved" : "Portal link missing" },
      ];
      return { s, days: daysBetween(today, s.deadline_date), checks, ready: checks.filter((c) => c.ok).length };
    });

  // ---- Outreach ----
  const P = (profs ?? []) as any[];
  const followUps = P.filter((p) => (p.outreach === "contacted" || p.outreach === "no_response") && p.last_contacted_on && p.last_contacted_on <= tenDaysAgo)
    .sort((a, b) => a.last_contacted_on.localeCompare(b.last_contacted_on)).slice(0, 6);
  const replies = P.filter((p) => p.outreach === "replied" || p.outreach === "meeting").slice(0, 6);
  const reachOut = P.filter((p) => p.outreach === "not_contacted" && p.accepting !== "no" && p.schools?.deadline_date && p.schools.deadline_date >= today && p.schools.deadline_date <= in90)
    .sort((a, b) => (b.accepting === "yes" ? 1 : 0) - (a.accepting === "yes" ? 1 : 0) || (b.fit_score ?? 0) - (a.fit_score ?? 0) || a.schools.deadline_date.localeCompare(b.schools.deadline_date)).slice(0, 6);

  // ---- Last week ----
  const inLast = (iso: string) => { const d = ymd(new Date(iso)); return d >= lastWeekStart && d <= lastWeekEnd; };
  const doneLast = (doneTasks ?? []).filter((t) => inLast(t.created_at)).length;
  const winsLast = (winsA ?? []).filter((t) => inLast(t.created_at)).length;
  const contactedLast = P.filter((p) => p.last_contacted_on && p.last_contacted_on >= lastWeekStart && p.last_contacted_on <= lastWeekEnd).length;

  const closingSoon = countdown.filter((c) => c.days <= 30).length;
  const tiles = [
    { label: "Due this week", value: weekCount, tone: "" },
    { label: "Overdue", value: overdue.length, tone: overdue.length ? "text-red-600" : "text-teal-600" },
    { label: "Applications closing ≤30d", value: closingSoon, tone: closingSoon ? "text-brass" : "" },
    { label: "Follow-ups to send", value: followUps.length, tone: followUps.length ? "text-brass" : "" },
  ];

  const navBtn = "border rounded px-2.5 py-1 text-xs hover:border-brass";

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : "Week plan"}</h1>
          <p className="text-sm text-gray-500 font-mono">{short(start)} – {short(end)}, {end.getFullYear()}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/week?w=${offset - 1}`} className={navBtn}>← Previous</Link>
          {offset !== 0 && <Link href="/week" className={navBtn}>This week</Link>}
          <Link href={`/week?w=${offset + 1}`} className={navBtn}>Next →</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="border border-line bg-surface rounded-lg p-3">
            <div className={`text-3xl font-mono font-semibold ${t.tone}`}>{t.value}</div>
            <div className="text-xs text-gray-500 uppercase mt-1">{t.label}</div>
          </div>
        ))}
      </div>

      {countdown.length > 0 && (
        <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-wide text-gray-500">Application countdown · next 90 days</h2>
          <ul className="flex flex-col gap-2">
            {countdown.map(({ s, days: d, checks, ready }) => (
              <li key={s.id}>
                <Link href={`/schools/${s.id}?tab=application`} className={`border border-l-4 rounded p-3 flex flex-col gap-2 hover:border-brass ${d <= 14 ? "border-l-red-600" : d <= 30 ? "border-l-brass" : "border-l-line"}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{s.name}</span>
                    <span className={`font-mono text-sm whitespace-nowrap ${d <= 14 ? "text-red-600" : d <= 30 ? "text-brass" : "text-gray-500"}`}>{d} days · {s.deadline_date}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {checks.map((c) => (
                      <span key={c.text} className={`border rounded-full px-2 py-0.5 ${c.ok ? "text-teal-600 border-teal-600" : "text-gray-500 border-line"}`}>{c.ok ? "✓" : "○"} {c.text}</span>
                    ))}
                    <span className="ml-auto text-gray-400 font-mono">{ready}/{checks.length} ready</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {offset >= 0 && overdue.length > 0 && (
        <section className="border border-red-600 rounded-lg p-4 flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wide text-red-600">Overdue · {overdue.length}</h2>
          {overdue.slice(0, 8).map((i, idx) => (
            <Link key={idx} href={i.href} className="flex justify-between gap-3 text-sm hover:text-brass">
              <span className="truncate">{i.label}</span>
              <span className="text-xs font-mono text-red-600 whitespace-nowrap">{rel(daysBetween(today, i.date))}</span>
            </Link>
          ))}
          {overdue.length > 8 && <span className="text-xs text-gray-400">+{overdue.length - 8} more</span>}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wide text-gray-500">Day by day</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {days.map((d) => (
            <div key={d.date} className={`border rounded-lg p-3 flex flex-col gap-1.5 ${d.date === today ? "border-brass bg-brass-soft" : "border-line bg-surface"} ${d.date < today ? "opacity-70" : ""}`}>
              <div className="flex justify-between items-baseline">
                <span className={`text-sm font-medium ${d.date === today ? "text-brass" : ""}`}>{d.label}{d.date === today && " · today"}</span>
                <span className="text-xs text-gray-400 font-mono">{d.short}</span>
              </div>
              {d.items.length === 0 ? (
                <span className="text-xs text-gray-400">Nothing scheduled</span>
              ) : (
                d.items.map((i, idx) => (
                  <Link key={idx} href={i.href} className="flex items-start gap-2 text-sm hover:text-brass">
                    <i className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${KIND[i.kind].dot}`} />
                    <span className="min-w-0">
                      <span className="block truncate">{i.label}</span>
                      <span className="block text-xs text-gray-500 truncate">{KIND[i.kind].label} · {i.sub}</span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 items-start">
        {[
          { title: "Follow up", hint: "Contacted 10+ days ago, no reply", list: followUps, why: (p: any) => `contacted ${p.last_contacted_on}` },
          { title: "Keep the conversation going", hint: "They replied or you have a meeting", list: replies, why: (p: any) => String(p.outreach).replace("_", " ") },
          { title: "Reach out next", hint: "Best fit at schools closing soon", list: reachOut, why: (p: any) => `${p.accepting === "yes" ? "taking students · " : ""}school due ${p.schools?.deadline_date?.slice(5)}` },
        ].map((col) => (
          <div key={col.title} className="border border-line bg-surface rounded-lg p-3 flex flex-col gap-2">
            <div>
              <h3 className="text-xs uppercase tracking-wide text-gray-500">{col.title}</h3>
              <p className="text-[11px] text-gray-400">{col.hint}</p>
            </div>
            {col.list.length === 0 ? (
              <p className="text-xs text-gray-400 border border-dashed border-line rounded p-3 text-center">Nothing here.</p>
            ) : (
              col.list.map((p: any) => (
                <Link key={p.id} href="/outreach" className="text-sm hover:text-brass">
                  <span className="block truncate">{p.name}</span>
                  <span className="block text-xs text-gray-500 truncate">{p.schools?.name} · {col.why(p)}</span>
                </Link>
              ))
            )}
          </div>
        ))}
      </section>

      <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wide text-gray-500">Last week ({short(new Date(lastWeekStart + "T00:00:00"))} – {short(new Date(lastWeekEnd + "T00:00:00"))})</h2>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <span><span className="font-mono text-2xl">{doneLast}</span> <span className="text-xs text-gray-500">tasks completed</span></span>
          <span><span className="font-mono text-2xl">{contactedLast}</span> <span className="text-xs text-gray-500">professors contacted</span></span>
          <span><span className="font-mono text-2xl text-teal-600">{winsLast}</span> <span className="text-xs text-gray-500">wins</span></span>
        </div>
        {doneLast + contactedLast + winsLast === 0 && <p className="text-xs text-gray-400">Quiet week. Pick one thing from the countdown above and start there.</p>}
      </section>
    </main>
  );
}
