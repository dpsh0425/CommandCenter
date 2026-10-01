import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { Fold, PageHeader, SubNav, TODAY_TABS } from "@/components/ui";
import { CopyUpdate } from "@/components/copy-update";
import { loadResearchWeek, summarizeProjectWeek, type ProjectWeek } from "@/lib/research-week";
import { formatMinutes, projectStatusLabel } from "@/lib/research";
import { FLAG_LABEL, lettersToChase, type ChaseInput } from "@/lib/letters";
import { todayString, zonedDay, zonedMidnightISO, zonedTime } from "@/lib/app-date";

export const metadata = { title: "This week" };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
const daysBetween = (from: string, to: string) => Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const rel = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d ago` : `in ${d}d`);
const short = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

type Item = { date: string; label: string; sub: string; href: string; kind: "task" | "deadline" | "letter" | "funding" | "milestone" | "interview" };
const KIND: Record<Item["kind"], { label: string; dot: string }> = {
  task: { label: "Task", dot: "bg-blue-600" }, deadline: { label: "Deadline", dot: "bg-rose-600" }, letter: { label: "Letter", dot: "bg-violet-600" },
  funding: { label: "Funding", dot: "bg-emerald-600" }, milestone: { label: "Milestone", dot: "bg-slate-500" }, interview: { label: "Interview", dot: "bg-cyan-600" },
};
const KIND_ORDER: Item["kind"][] = ["task", "deadline", "letter", "funding", "milestone", "interview"];

const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3";
const cardTitle = "text-[15px] font-semibold text-slate-900";
const hintText = "ml-1 text-[13px] font-normal text-slate-500";
const rowLink = "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-900 transition-colors hover:bg-slate-50";

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const offset = Math.max(-8, Math.min(12, Number(w) || 0));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">The weekly plan is only available to the workspace owner.</main>;
  }

  // Anchor every date to today in APP_TIMEZONE (the server clock runs in UTC).
  const now = new Date(todayString() + "T00:00:00");
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
    supabase.from("letter_requests").select("id, school_id, recommender_id, status, letter_deadline, asked_on, last_reminded_on, people(name), schools(name)"),
    supabase.from("research_milestones").select("id, title, target_date").not("target_date", "is", null).neq("status", "done"),
    supabase.from("interviews").select("id, school_id, scheduled_at, status, schools(name)").eq("status", "scheduled").not("scheduled_at", "is", null),
    supabase.from("professors").select("id, name, school_id, accepting, fit_score, outreach, last_contacted_on, research_areas, schools(name, deadline_date)"),
    supabase.from("schools").select("id").not("sop_version_id", "is", null),
    supabase.from("task_updates").select("created_at").eq("type", "status_change").eq("is_win", true).gte("created_at", zonedMidnightISO(lastWeekStart)),
    supabase.from("activity_log").select("created_at").eq("is_win", true).gte("created_at", zonedMidnightISO(lastWeekStart)),
  ]);

  const chase = lettersToChase(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((letters ?? []) as any[]).map((l): ChaseInput => ({
      id: l.id, school_id: l.school_id, school_name: l.schools?.name ?? "School", recommender_id: l.recommender_id,
      recommender_name: l.people?.name ?? "Recommender", status: l.status, letter_deadline: l.letter_deadline,
      asked_on: l.asked_on, last_reminded_on: l.last_reminded_on,
    })),
    today,
  );

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // ---- Everything dated ----
  const all: Item[] = [
    ...(tasks ?? []).map((t: any) => ({ date: t.due_date, label: t.title, sub: [t.schools?.name, t.research_milestones?.title, `${t.priority} priority`].filter(Boolean).join(" · "), href: `/tasks/${t.id}`, kind: "task" as const })),
    ...(schools ?? []).map((s: any) => ({ date: s.deadline_date, label: `${s.name} application deadline`, sub: "school application", href: `/schools/${s.id}`, kind: "deadline" as const })),
    ...(depts ?? []).filter((d: any) => !(schools ?? []).some((s: any) => s.id === d.school_id && s.deadline_date === d.deadline_date)).map((d: any) => ({ date: d.deadline_date, label: `${d.schools?.name} · ${d.name} deadline`, sub: "department", href: `/schools/${d.school_id}`, kind: "deadline" as const })),
    ...(funds ?? []).map((f: any) => ({ date: f.deadline_date, label: `${f.name} (${f.schools?.name})`, sub: `funding · ${String(f.status).replace("_", " ")}`, href: `/schools/${f.school_id}?tab=funding`, kind: "funding" as const })),
    ...((letters ?? []) as any[]).filter((l) => l.letter_deadline && l.status !== "submitted").map((l) => ({ date: l.letter_deadline, label: `${l.people?.name ?? "Recommender"}'s letter for ${l.schools?.name}`, sub: `letter · ${String(l.status).replace("_", " ")}`, href: `/schools/${l.school_id}?tab=application`, kind: "letter" as const })),
    ...(milestones ?? []).map((m: any) => ({ date: m.target_date, label: m.title, sub: "research milestone", href: `/research/${m.id}`, kind: "milestone" as const })),
    ...((interviews ?? []) as any[]).map((i) => ({ date: zonedDay(i.scheduled_at), label: `Interview: ${i.schools?.name}`, sub: zonedTime(i.scheduled_at), href: `/schools/${i.school_id}?tab=application`, kind: "interview" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const overdue = all.filter((i) => i.date < today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return { date: ymd(d), label: d.toLocaleDateString("en-US", { weekday: "long" }), short: short(d), items: all.filter((x) => x.date === ymd(d)) };
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

  // ---- Research ----
  const research = await loadResearchWeek(supabase, startS, today);
  const isPastWeek = endS < today;
  const researchLines = (r: ProjectWeek) => summarizeProjectWeek(r, isPastWeek);
  const researchText = research.length
    ? [`Research update, ${short(start)} to ${short(end)}`, "", ...research.flatMap((r) => {
        const ls = researchLines(r);
        return [`${r.title} (${projectStatusLabel(r.status)})`, ...(ls.length ? ls.map((l) => `- ${l.k}: ${l.v}`) : ["- Nothing recorded this week."]), ""];
      })].join("\n").trim()
    : "";
  const researchTotal = research.reduce((n, r) => n + r.minutes, 0);

  // ---- Outreach ----
  const P = (profs ?? []) as any[];
  const followUps = P.filter((p) => (p.outreach === "contacted" || p.outreach === "no_response") && p.last_contacted_on && p.last_contacted_on <= tenDaysAgo)
    .sort((a, b) => a.last_contacted_on.localeCompare(b.last_contacted_on)).slice(0, 6);
  const replies = P.filter((p) => p.outreach === "replied" || p.outreach === "meeting").slice(0, 6);
  const reachOut = P.filter((p) => p.outreach === "not_contacted" && p.accepting !== "no" && p.schools?.deadline_date && p.schools.deadline_date >= today && p.schools.deadline_date <= in90)
    .sort((a, b) => (b.accepting === "yes" ? 1 : 0) - (a.accepting === "yes" ? 1 : 0) || (b.fit_score ?? 0) - (a.fit_score ?? 0) || a.schools.deadline_date.localeCompare(b.schools.deadline_date)).slice(0, 6);

  // ---- Last week ----
  const inLast = (iso: string) => { const d = zonedDay(iso); return d >= lastWeekStart && d <= lastWeekEnd; };
  const doneLast = (doneTasks ?? []).filter((t) => inLast(t.created_at)).length;
  const winsLast = (winsA ?? []).filter((t) => inLast(t.created_at)).length;
  const contactedLast = P.filter((p) => p.last_contacted_on && p.last_contacted_on >= lastWeekStart && p.last_contacted_on <= lastWeekEnd).length;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const dayLabel = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const daysWithItems = days.filter((d) => d.items.length > 0);
  const nextStep = (checks: Array<{ ok: boolean; text: string }>) => checks.find((c) => !c.ok)?.text;
  const navBtn = "flex h-9 items-center px-3 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50";
  const kindsUsed = KIND_ORDER.filter((k) => all.some((i) => i.kind === k && i.date >= startS && i.date <= endS));

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader
          eyebrow="Overview"
          title={offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : "Week plan"}
          subtitle={`${short(start)} to ${short(end)}, ${end.getFullYear()}`}
          actions={
            <nav aria-label="Change week" className="flex overflow-hidden rounded-md border border-slate-300 bg-white">
              <Link href={`/week?w=${offset - 1}`} className={`${navBtn} border-r border-slate-200`}>← Previous</Link>
              {offset !== 0 ? (
                <Link href="/week" className={`${navBtn} border-r border-slate-200`}>This week</Link>
              ) : (
                <span className="flex h-9 items-center border-r border-slate-200 px-3 text-[13px] font-medium text-slate-400">This week</span>
              )}
              <Link href={`/week?w=${offset + 1}`} className={navBtn}>Next →</Link>
            </nav>
          }
        />
        <SubNav items={TODAY_TABS} current="/week" />
      </div>

      {/* Week strip */}
      <div className="flex flex-col gap-2.5">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:pb-0">
          {days.map((d) => {
            const isToday = d.date === today;
            const date = new Date(d.date + "T00:00:00");
            const inner = (
              <>
                <span className={`text-xs ${isToday ? "font-semibold text-blue-700" : "text-slate-500"}`}>
                  {date.toLocaleDateString("en-US", { weekday: "short" })}{isToday && " · Today"}
                </span>
                <span className={`text-lg font-semibold tabular-nums ${isToday ? "text-blue-700" : "text-slate-900"}`}>{date.getDate()}</span>
                {d.items.length ? (
                  <span className="flex flex-wrap items-center gap-1" aria-label={`${d.items.length} ${d.items.length === 1 ? "item" : "items"}`}>
                    {d.items.slice(0, 5).map((it, i) => (
                      <i key={i} className={`h-[7px] w-[7px] rounded-full ${KIND[it.kind].dot}`} aria-hidden="true" />
                    ))}
                    {d.items.length > 5 && <span className="text-[11px] text-slate-500">+{d.items.length - 5}</span>}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Nothing due</span>
                )}
              </>
            );
            const cls = `flex min-w-[88px] flex-1 flex-col gap-1.5 rounded-lg px-3 py-2.5 ${
              isToday ? "border-[1.5px] border-blue-600 bg-blue-50" : "border border-slate-200 bg-white"
            }`;
            return d.items.length ? (
              <a key={d.date} href={`#day-${d.date}`} className={`${cls} transition-colors hover:border-slate-300`}>{inner}</a>
            ) : (
              <div key={d.date} className={cls}>{inner}</div>
            );
          })}
        </div>
        {kindsUsed.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {kindsUsed.map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <i className={`h-2 w-2 rounded-full ${KIND[k].dot}`} aria-hidden="true" />
                {KIND[k].label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Agenda */}
        <section className={card}>
          <div className={cardHead}>
            <h2 className={cardTitle}>{offset === 0 ? "On your plate" : "Scheduled"}</h2>
            {(weekCount > 0 || overdue.length > 0) && <span className="text-[13px] text-slate-500">{weekCount} this week</span>}
          </div>
          {daysWithItems.length === 0 && !(offset >= 0 && overdue.length > 0) && (
            <p className="px-5 py-6 text-sm text-slate-500">
              Nothing due {offset === 0 ? "this week" : "that week"}. A good time to move an application forward.
            </p>
          )}
          {offset >= 0 && overdue.length > 0 && (
            <div className="pb-1">
              <h3 className="px-5 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.04em] text-red-700">Overdue</h3>
              <ul className="px-2">
                {overdue.slice(0, 8).map((i, idx) => (
                  <li key={idx}>
                    <Link href={i.href} className={rowLink}>
                      <i className={`h-[7px] w-[7px] flex-shrink-0 rounded-full ${KIND[i.kind].dot}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{i.label}</span>
                      <span className="whitespace-nowrap text-xs text-red-700">{rel(daysBetween(today, i.date))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {overdue.length > 8 && <p className="px-5 pt-1 text-xs text-slate-500">and {overdue.length - 8} more</p>}
            </div>
          )}
          {daysWithItems.map((d) => (
            <div key={d.date} id={`day-${d.date}`} className="scroll-mt-20 pb-1 last:pb-2">
              <h3 className={`px-5 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.04em] ${d.date === today ? "text-blue-700" : "text-slate-500"}`}>
                {dayLabel(d.date)}{d.date === today && " · Today"}
              </h3>
              <ul className="px-2">
                {d.items.map((i, idx) => (
                  <li key={idx}>
                    <Link href={i.href} className={rowLink}>
                      <i className={`h-[7px] w-[7px] flex-shrink-0 rounded-full ${KIND[i.kind].dot}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{i.label}</span>
                      <span className="whitespace-nowrap text-xs text-slate-500">{KIND[i.kind].label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Side column */}
        <div className="flex min-w-0 flex-col gap-4">
          {countdown.length > 0 && (
            <section className={card}>
              <div className={cardHead}>
                <h2 className={cardTitle}>Application deadlines<span className={hintText}>· next 90 days</span></h2>
              </div>
              <ul className="px-2 py-1.5">
                {countdown.map(({ s, days: d, checks, ready }) => {
                  const next = nextStep(checks);
                  const allDone = ready === checks.length;
                  return (
                    <li key={s.id}>
                      <Link href={`/schools/${s.id}?tab=application`} className="flex flex-col gap-1.5 rounded-md px-3 py-2.5 transition-colors hover:bg-slate-50">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-900">{s.name}</span>
                          <span className={`flex-shrink-0 text-xs font-semibold tabular-nums ${d <= 14 ? "text-red-700" : d <= 30 ? "text-blue-700" : "text-slate-500"}`}>
                            {d} {d === 1 ? "day" : "days"}
                          </span>
                        </span>
                        <span className="h-1 rounded-full bg-slate-100">
                          <span className={`block h-1 rounded-full ${allDone ? "bg-emerald-600" : "bg-blue-600"}`} style={{ width: `${Math.round((ready / checks.length) * 100)}%` }} />
                        </span>
                        <span className={`text-xs ${allDone ? "text-emerald-700" : "text-slate-500"}`}>
                          {allDone ? "Everything ready" : `${ready} of ${checks.length} steps · next: ${next?.toLowerCase()}`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {offset === 0 && chase.length > 0 && (
            <section className={card}>
              <div className={cardHead}>
                <h2 className={cardTitle}>Recommenders to chase<span className={hintText}>· {chase.length}</span></h2>
              </div>
              <ul className="px-2 py-1.5">
                {chase.slice(0, 8).map(({ letter, flag, reason }) => (
                  <li key={letter.id}>
                    <Link
                      href={`/materials/letters${letter.recommender_id ? `?focus=${letter.recommender_id}` : ""}`}
                      className="flex items-start justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">{letter.recommender_name}: {letter.school_name}</span>
                        <span className="block text-xs text-slate-500">{reason}</span>
                      </span>
                      <span className={`whitespace-nowrap text-xs font-medium ${flag === "overdue" ? "text-red-700" : "text-blue-700"}`}>{FLAG_LABEL[flag]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {chase.length > 8 && <p className="px-5 pb-3 text-xs text-slate-500">and {chase.length - 8} more on the Letters tab</p>}
            </section>
          )}

          <section className={`${card} flex flex-col gap-3 px-5 py-4`}>
            <h2 className={cardTitle}>Last week</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { n: doneLast, label: doneLast === 1 ? "task done" : "tasks done" },
                { n: contactedLast, label: contactedLast === 1 ? "professor contacted" : "professors contacted" },
                { n: winsLast, label: winsLast === 1 ? "win" : "wins" },
              ].map((x) => (
                <div key={x.label} className="rounded-md bg-slate-50 px-2 py-2.5">
                  <div className="text-xl font-semibold tabular-nums text-slate-900">{x.n}</div>
                  <div className="text-xs text-slate-500">{x.label}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {research.length > 0 && (
        <section className={card}>
          <div className={cardHead}>
            <h2 className={cardTitle}>Research{researchTotal ? <span className={hintText}>· {formatMinutes(researchTotal)} logged</span> : null}</h2>
            <CopyUpdate text={researchText} />
          </div>
          <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
            {research.map((r) => {
              const ls = researchLines(r);
              return (
                <div key={r.id} className="flex min-w-0 flex-col gap-1.5">
                  <h3 className="flex items-baseline justify-between gap-3 text-sm">
                    <Link href={`/research/projects/${r.id}`} className="font-semibold text-slate-900 hover:text-blue-700">{r.title}</Link>
                    <span className="text-xs text-slate-500">{projectStatusLabel(r.status)}</span>
                  </h3>
                  {ls.length === 0 ? (
                    <p className="text-[13px] text-slate-500">
                      Nothing recorded {offset === 0 ? "yet this week" : "that week"}.{" "}
                      <Link href={`/research/projects/${r.id}?tab=journal`} className="font-medium text-blue-600 hover:text-blue-700">Log what you did</Link>.
                    </p>
                  ) : (
                    <dl className="flex flex-col text-[13px]">
                      {ls.map((l) => (
                        <div key={l.k} className="flex gap-4 py-1">
                          <dt className="w-32 flex-shrink-0 text-slate-500">{l.k}</dt>
                          <dd className="min-w-0 break-words text-slate-900">{l.v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className={`${card} px-5 py-3`}>
        <Fold
          title="People to contact"
          summary={[followUps.length && `${followUps.length} to follow up`, replies.length && `${replies.length} in conversation`, reachOut.length && `${reachOut.length} to reach out to`].filter(Boolean).join(" · ") || "Nobody needs attention"}
          defaultOpen={followUps.length > 0}
        >
          <div className="grid gap-5 md:grid-cols-3">
            {[
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { title: "Follow up", hint: "Contacted 10 or more days ago, no reply", list: followUps, why: (p: any) => `contacted ${p.last_contacted_on}` },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { title: "Keep talking", hint: "They replied or a meeting is booked", list: replies, why: (p: any) => String(p.outreach).replace("_", " ") },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { title: "Reach out next", hint: "Best fit at schools closing soon", list: reachOut, why: (p: any) => `${p.accepting === "yes" ? "taking students · " : ""}school due ${p.schools?.deadline_date?.slice(5)}` },
            ].filter((c) => c.list.length > 0).map((col) => (
              <div key={col.title} className="flex min-w-0 flex-col">
                <h3 className="text-[13px] font-semibold text-slate-900">{col.title}</h3>
                <p className="mb-1.5 text-xs text-slate-500">{col.hint}</p>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {col.list.map((p: any) => (
                  <Link key={p.id} href="/outreach" className="flex flex-col rounded-md py-1.5 text-[13px] transition-colors hover:text-blue-700">
                    <span className="truncate text-slate-900">{p.name} <span className="text-slate-500">· {p.schools?.name}</span></span>
                    <span className="text-xs text-slate-500">{col.why(p)}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </Fold>
      </section>
    </main>
  );
}
