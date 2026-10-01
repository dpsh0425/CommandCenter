import { ApplyingToggle, ChecklistRows } from "@/components/readiness-controls";
import { assess, buildItems, RISK_LABEL } from "@/lib/readiness";
import Link from "next/link";
import { StatementStep } from "@/components/statement-step";
import { hasFinalStatement } from "@/lib/statements";
import { createClient } from "@/lib/supabase/server";
import { renderRich } from "@/lib/rich-text-server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { StatusSelect } from "@/components/status-select";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  AddLetterForm, InterviewRow, LetterRow, NoteForm, ScheduleInterviewForm, SchoolTaskForm, SopForm, VisaStepRow,
} from "@/components/school-controls";
import {
  AddFundingButton, FacultyView, FundingCard, fundingStatusLabel,
  type DepartmentRow, type FundingRow, type ProfessorRow,
} from "@/components/faculty-controls";
import { AdmissionsPanel, type Profile } from "@/components/admissions-panel";
import { researchGaps } from "@/lib/school-research";
import { LinksPanel } from "@/components/links-panel";
import { Fold } from "@/components/ui";
import { todayString } from "@/lib/app-date";

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d ago` : `in ${d}d`);
const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  reach: { label: "Reach", cls: "bg-red-50 text-red-700" },
  target: { label: "Target", cls: "bg-blue-50 text-blue-700" },
  safe: { label: "Safe", cls: "bg-emerald-50 text-emerald-700" },
};
const RISK_BADGE: Record<string, string> = {
  overdue: "bg-red-50 text-red-700", urgent: "bg-red-50 text-red-700", watch: "bg-blue-50 text-blue-700",
  ok: "bg-slate-100 text-slate-700", nodate: "bg-slate-100 text-slate-500", submitted: "bg-emerald-50 text-emerald-700",
};
const FUNDING_RANK: Record<string, number> = { awarded: 0, applied: 1, eligible: 2, to_research: 3, not_eligible: 4 };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "faculty", label: "Faculty" },
  { key: "funding", label: "Funding" },
  { key: "admissions", label: "Admissions" },
  { key: "application", label: "Application" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3";
const cardTitle = "text-[15px] font-semibold text-slate-900";
const hint = "ml-1 text-[13px] font-normal text-slate-500";
const disclosure = "cursor-pointer list-none text-[13px] font-medium text-blue-600 hover:text-blue-700 [&::-webkit-details-marker]:hidden";

export default async function SchoolDetailPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const supabase = await createClient();
  const [
    { data: { user } }, { data: school }, { data: activity }, { data: linkedTasks }, { data: letters },
    { data: people }, { data: sop }, { data: interviews }, { data: visaSteps },
    { data: departments }, { data: professors }, { data: fundings }, { data: schoolLinks },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("schools").select("*").eq("id", id).single(),
    supabase.from("activity_log").select("*").eq("school_id", id).order("occurred_at", { ascending: false }),
    supabase.from("tasks").select("id, title, status, due_date, priority").eq("school_id", id).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("letter_requests").select("*, people(name)").eq("school_id", id).order("created_at"),
    supabase.from("people").select("id, name").order("name"),
    supabase.from("schools").select("sop_version_id, sop_sent_at, sop_versions(label)").eq("id", id).single(),
    supabase.from("interviews").select("*").eq("school_id", id).order("scheduled_at"),
    supabase.from("visa_steps").select("*").eq("school_id", id).order("created_at"),
    supabase.from("departments").select("*").eq("school_id", id).order("name"),
    supabase.from("professors").select("*").eq("school_id", id).order("name"),
    supabase.from("fundings").select("*").eq("school_id", id),
    supabase.from("links").select("*").eq("school_id", id),
  ]);

  if (!school) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 p-4 md:p-8">
        <Link href="/schools" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← All schools</Link>
        <p className="text-sm text-slate-600">This school doesn&apos;t exist or you don&apos;t have access to it.</p>
      </main>
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const isOwner = user?.id === OWNER_USER_ID;
  const tab: TabKey = isOwner && TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "overview";
  // "Today" in APP_TIMEZONE, not the server clock.
  const today = todayString();
  const meta = school as any;
  const profile = meta as Profile;
  const letterList = (letters ?? []) as any[];
  const depts = (departments ?? []) as DepartmentRow[];
  const profs = (professors ?? []) as ProfessorRow[];
  const funds = (fundings ?? []) as FundingRow[];
  const sopLabel = (sop as any)?.sop_versions?.label as string | undefined;
  const hasSop = !!(sop as any)?.sop_version_id;
  const { data: schoolStatements } = await supabase.from("statements").select("id, kind, title, status, words, word_limit").eq("school_id", id).order("created_at");
  const { data: generalDrafts } = await supabase.from("statements").select("id, title").is("school_id", null).eq("kind", "statement_of_purpose").order("updated_at", { ascending: false });
  const statementReady = hasFinalStatement((schoolStatements ?? []) as any[]);
  const openTasks = (linkedTasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const deptOptions = depts.map((d) => ({ id: d.id, name: d.name }));
  const profOptions = profs.map((p) => ({ id: p.id, name: p.name }));

  const { data: checkRows } = await supabase.from("application_checks").select("item, done").eq("school_id", id);
  const checkMap: Record<string, boolean> = {};
  (checkRows ?? []).forEach((c: any) => { checkMap[c.item] = c.done; });
  const readinessItems = buildItems(
    { id, name: meta.name, deadline_date: meta.deadline_date, status: meta.status, gre_policy: meta.gre_policy, english_test: meta.english_test, letters_required: meta.letters_required, sop_version_id: (sop as any)?.sop_version_id ?? null, has_statement: statementReady },
    letterList, checkMap
  );
  const verdict = assess(
    { id, name: meta.name, deadline_date: meta.deadline_date, status: meta.status, gre_policy: meta.gre_policy, english_test: meta.english_test, letters_required: meta.letters_required, sop_version_id: (sop as any)?.sop_version_id ?? null, has_statement: statementReady },
    readinessItems, today
  );
  const lettersConfirmed = letterList.filter((l) => l.status === "confirmed" || l.status === "submitted").length;
  const lettersReady = letterList.length > 0 && lettersConfirmed === letterList.length;

  // What the applicant still doesn't know, each pointing to where to fill it in.
  const { gaps, completeness } = researchGaps(meta, depts.length, profs, funds.length, depts.filter((d) => d.deadline_date).length);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const tabHref = (t: TabKey) => `/schools/${id}${t === "overview" ? "" : `?tab=${t}`}`;

  // Professors grouped by department, unassigned last.
  const groups = [
    ...depts.map((d) => ({ dept: d, list: profs.filter((p) => p.department_id === d.id) })),
    { dept: null as DepartmentRow | null, list: profs.filter((p) => !p.department_id || !depts.some((d) => d.id === p.department_id)) },
  ].map((g) => ({ ...g, list: [...g.list].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0) || a.name.localeCompare(b.name)) }));

  const scopeLabel = (f: FundingRow) =>
    f.professor_id ? `${profs.find((p) => p.id === f.professor_id)?.name ?? "Professor"}'s grant`
      : f.department_id ? depts.find((d) => d.id === f.department_id)?.name ?? "Department" : "Whole school";
  const sortedFunds = [...funds].sort((a, b) => FUNDING_RANK[a.status] - FUNDING_RANK[b.status] || (a.deadline_date ?? "9").localeCompare(b.deadline_date ?? "9"));
  // Best awarded amount, only when every award is in the same currency (no conversion).
  const awardedWithAmount = funds.filter((f) => f.status === "awarded" && f.amount != null);
  const bestOffer = new Set(awardedWithAmount.map((f) => f.currency)).size === 1
    ? [...awardedWithAmount].sort((a, b) => Number(b.amount) - Number(a.amount))[0] : null;
  const nextFundingDeadline = funds
    .filter((f) => f.deadline_date && f.deadline_date >= today && f.status !== "awarded" && f.status !== "not_eligible")
    .sort((a, b) => a.deadline_date!.localeCompare(b.deadline_date!))[0];

  const deadlineDays = meta.deadline_date ? daysBetween(today, meta.deadline_date) : null;
  const deadlineTone = deadlineDays == null ? "" : deadlineDays < 0 || deadlineDays <= 30 ? "text-red-700" : "text-slate-600";
  const tier = meta.tier ? TIER_BADGE[meta.tier] : undefined;
  const longDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const interviewList = interviews ?? [];

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-4 p-4 md:p-8">
      <Link href="/schools" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← All schools</Link>

      {/* ── Header ── */}
      <section className={`${card} flex flex-wrap items-start justify-between gap-5 px-5 py-5 md:px-6`}>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">School</p>
          <h1 className="text-[26px] font-semibold leading-[34px] tracking-tight text-slate-900">{school.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[meta.city, school.country].filter(Boolean).length > 0 && (
              <span className="mr-1 text-slate-600">{[meta.city, school.country].filter(Boolean).join(", ")}</span>
            )}
            {tier && <span className={`rounded-full px-2.5 py-0.5 font-semibold ${tier.cls}`}>{tier.label}</span>}
            {meta.verified_fit && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">Verified fit</span>}
            {meta.csranking_nlp_rank != null && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">NLP rank #{meta.csranking_nlp_rank}</span>}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {isOwner && (
            <label className="flex w-full flex-col gap-1 text-xs text-slate-500 sm:w-[180px]">
              Status
              <StatusSelect schoolId={school.id} value={meta.status} />
            </label>
          )}
          {meta.deadline_date && (
            <span className={`text-[13px] font-medium ${deadlineTone}`}>
              Deadline {new Date(meta.deadline_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {relative(deadlineDays!)}
            </span>
          )}
        </div>
      </section>

      {/* ── Tabs ── */}
      {isOwner && (
        <nav className="flex gap-6 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="School sections">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = t.key === "faculty" ? profs.length : t.key === "funding" ? funds.length : 0;
            return (
              <Link
                key={t.key} href={tabHref(t.key)} scroll={false}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 text-sm transition-colors ${
                  active ? "border-blue-600 font-semibold text-slate-900" : "border-transparent font-medium text-slate-500 hover:text-slate-900"
                }`}
              >
                {t.label}
                {count > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600">{count}</span>}
              </Link>
            );
          })}
        </nav>
      )}

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {isOwner && (
            <section className={card}>
              <div className={cardHead}>
                <h2 className={cardTitle}>Next steps<span className={hint}>· {completeness}% researched</span></h2>
              </div>
              <div className="flex flex-col gap-2 px-5 py-4">
                {meta.deadline_date && (
                  <p className="text-sm">
                    <span className="text-slate-500">Application deadline </span>
                    <span className="font-medium text-slate-900">{longDate(meta.deadline_date)}</span>
                    <span className={deadlineTone}> · {relative(deadlineDays!)}</span>
                  </p>
                )}
                {gaps.length === 0 ? (
                  <p className="text-sm text-emerald-700">You know everything you track about this school.</p>
                ) : (
                  <ul className="-mx-2 flex flex-col">
                    {gaps.slice(0, 4).map((g) => (
                      <li key={g.text}>
                        <Link href={tabHref(g.tab)} className="flex justify-between gap-4 rounded-md px-2 py-2 text-sm transition-colors hover:bg-slate-50">
                          <span className="text-slate-900">{g.text}</span>
                          <span className="capitalize text-blue-600">{g.tab} →</span>
                        </Link>
                      </li>
                    ))}
                    {gaps.length > 4 && <li className="px-2 pt-1 text-xs text-slate-500">and {gaps.length - 4} more to research</li>}
                  </ul>
                )}
              </div>
            </section>
          )}

          {isOwner && (
            <section className={card}>
              <div className={cardHead}>
                <h2 className={cardTitle}>Key facts</h2>
                <Link href={tabHref("admissions")} className="text-[13px] font-medium text-blue-600 hover:text-blue-700">Edit admissions info</Link>
              </div>
              <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 px-5 py-2 text-sm">
                {[
                  ["Application fee", meta.application_fee != null ? `${meta.fee_currency} ${Number(meta.application_fee)}` : null],
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["GRE", meta.gre_policy ? ({ required: "Required", optional: "Optional", not_accepted: "Not considered" } as any)[meta.gre_policy] : null],
                  ["English test", meta.english_test],
                  ["Letters needed", meta.letters_required != null ? String(meta.letters_required) : null],
                  ["Funding", meta.funding_guarantee ?? (funds.length ? `${funds.length} option${funds.length === 1 ? "" : "s"} tracked` : null)],
                  ["Program length", meta.program_length],
                ].map(([label, value]) => (
                  <div key={label as string} className="contents">
                    <dt className="border-b border-slate-100 py-2 text-slate-500">{label}</dt>
                    <dd className="min-w-0 border-b border-slate-100 py-2 text-slate-900">
                      {value ? <span className="line-clamp-2">{value}</span> : <span className="text-slate-400">Not researched</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              {school.fit_note && (
                <p className="px-5 pb-4 pt-1 text-[13px] text-slate-600"><span className="text-slate-500">Why it fits: </span>{school.fit_note}</p>
              )}
            </section>
          )}

          <section className={`${card} lg:col-span-2`}>
            <div className={cardHead}>
              <h2 className={cardTitle}>Tasks<span className={hint}>· {openTasks} open</span></h2>
            </div>
            <div className="px-3 py-2">
              {(linkedTasks ?? []).length === 0 ? (
                <p className="px-2 py-2 text-sm text-slate-500">No tasks for this school yet.</p>
              ) : (
                <ul className="flex flex-col">
                  {(linkedTasks ?? []).map((t) => {
                    const late = t.due_date && t.due_date < today && t.status !== "done";
                    return (
                      <li key={t.id}>
                        <Link href={`/tasks/${t.id}`} className="flex justify-between gap-4 rounded-md px-2 py-2 text-sm transition-colors hover:bg-slate-50">
                          <span className={`truncate ${t.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</span>
                          <span className={`whitespace-nowrap text-xs ${late ? "font-medium text-red-700" : "text-slate-500"}`}>
                            {t.due_date ? `due ${new Date(t.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : t.status.replace(/_/g, " ")}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {isOwner && (
                <details className="px-2 pb-2 pt-1">
                  <summary className={disclosure}>+ Add a task</summary>
                  <SchoolTaskForm schoolId={id} people={people ?? []} />
                </details>
              )}
            </div>
          </section>

          {isOwner && (
            <section className={`${card} lg:col-span-2`}>
              <div className={cardHead}>
                <h2 className={cardTitle}>Notes and activity<span className={hint}>· {(activity ?? []).length} entries</span></h2>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4">
                <NoteForm schoolId={id} />
                {(activity ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No activity yet. Notes and status changes appear here.</p>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <ActivityTimeline items={((activity ?? []) as any[]).map((a) => (a.type === "note" ? { ...a, html: renderRich(a.content) } : a))} schoolId={id} />
                )}
              </div>
            </section>
          )}

          {isOwner && (
            <section className={`${card} px-5 py-3 lg:col-span-2`}>
              <Fold title="Links" summary={`${(schoolLinks ?? []).length} saved`}>
                <LinksPanel
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  links={(schoolLinks ?? []) as any}
                  scope={{ schoolId: id }}
                  placeholder="Paste a lab page, funding page, paper or program page…"
                  emptyText="No links yet. Save the lab pages, funding pages and papers you rely on."
                />
              </Fold>
            </section>
          )}
        </div>
      )}

      {/* ── Faculty ── */}
      {isOwner && tab === "faculty" && (
        <FacultyView schoolId={id} groups={groups} departments={deptOptions} today={today} />
      )}

      {/* ── Funding ── */}
      {isOwner && tab === "funding" && (
        <div className="flex flex-col gap-4">
          {meta.funding_guarantee ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-[18px] py-3.5">
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-emerald-700"><path d="M20 6 9 17l-5-5" /></svg>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Funding guaranteed</p>
                <p className="whitespace-pre-line text-[13px] text-emerald-800">{meta.funding_guarantee}</p>
              </div>
            </div>
          ) : (
            <p className="max-w-2xl text-sm text-slate-600">Every way this school could pay for you: school-wide, by department, or a professor&apos;s grant.</p>
          )}

          {funds.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Options tracked</p>
                <p className="text-[22px] font-semibold tabular-nums text-slate-900">{funds.length}</p>
                <p className="text-xs text-slate-500">
                  {Object.entries(funds.reduce<Record<string, number>>((m, f) => ({ ...m, [f.status]: (m[f.status] ?? 0) + 1 }), {}))
                    .sort(([a], [b]) => FUNDING_RANK[a] - FUNDING_RANK[b])
                    .map(([st, n]) => `${n} ${fundingStatusLabel(st).toLowerCase()}`).join(" · ")}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Best offer so far</p>
                {bestOffer ? (
                  <>
                    <p className="text-[22px] font-semibold tabular-nums text-emerald-700">{bestOffer.currency} {Number(bestOffer.amount).toLocaleString()}</p>
                    <p className="truncate text-xs text-slate-500">{bestOffer.period ? (bestOffer.period === "total" ? "total" : `per ${bestOffer.period}`) + " · " : ""}{bestOffer.name}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[22px] font-semibold text-slate-400">—</p>
                    <p className="text-xs text-slate-500">{awardedWithAmount.length ? "Awards are in different currencies" : "Nothing awarded yet"}</p>
                  </>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Next funding deadline</p>
                {nextFundingDeadline ? (
                  <>
                    <p className={`text-[22px] font-semibold ${daysBetween(today, nextFundingDeadline.deadline_date!) <= 30 ? "text-red-700" : "text-slate-900"}`}>{relative(daysBetween(today, nextFundingDeadline.deadline_date!))}</p>
                    <p className="truncate text-xs text-slate-500">{new Date(nextFundingDeadline.deadline_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {nextFundingDeadline.name}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[22px] font-semibold text-slate-400">—</p>
                    <p className="text-xs text-slate-500">No open funding deadlines</p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-slate-900">Funding options{funds.length > 0 && <span className="ml-1 text-[13px] font-normal text-slate-500">· best status first</span>}</h2>
          </div>
          {sortedFunds.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No funding tracked yet</p>
              <p className="mt-1 text-[13px] text-slate-500">Add assistantships, fellowships, waivers or a professor&apos;s grant.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sortedFunds.map((f) => (
                <FundingCard key={f.id} schoolId={id} funding={f} scopeLabel={scopeLabel(f)} departments={deptOptions} professors={profOptions} today={today} />
              ))}
            </div>
          )}
          <AddFundingButton schoolId={id} departments={deptOptions} professors={profOptions} />
        </div>
      )}

      {/* ── Admissions ── */}
      {isOwner && tab === "admissions" && <AdmissionsPanel schoolId={id} p={profile} />}

      {/* ── Application ── */}
      {isOwner && tab === "application" && (
        <ol className="flex flex-col gap-3">
          <Step
            n={1}
            done={verdict.risk === "submitted"}
            title={meta.applying ? "Submission checklist" : "Are you applying here?"}
            right={meta.applying ? (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${RISK_BADGE[verdict.risk] ?? RISK_BADGE.ok}`}>
                {RISK_LABEL[verdict.risk]}
                {verdict.days != null && verdict.risk !== "submitted" && ` · ${verdict.days < 0 ? `${-verdict.days}d ago` : `${verdict.days}d left`}`}
              </span>
            ) : undefined}
          >
            {meta.applying ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className={`block h-full rounded-full ${verdict.risk === "submitted" ? "bg-emerald-600" : "bg-blue-600"}`} style={{ width: `${verdict.total ? Math.round((verdict.doneCount / verdict.total) * 100) : 0}%` }} />
                  </span>
                  <span className="text-xs tabular-nums text-slate-600">{verdict.doneCount} of {verdict.total} done</span>
                </div>
                <ChecklistRows schoolId={id} items={readinessItems} />
                <div><ApplyingToggle schoolId={id} applying /></div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-slate-600">Track this school on your Readiness page with a checklist and a deadline warning.</p>
                <ApplyingToggle schoolId={id} applying={false} />
              </div>
            )}
          </Step>

          <Step
            n={2}
            done={lettersReady}
            title="Recommendation letters"
            summary={letterList.length === 0 ? (meta.letters_required ? `None requested yet (${meta.letters_required} needed)` : "None requested yet") : `${lettersConfirmed} of ${letterList.length} confirmed${meta.letters_required ? ` · ${meta.letters_required} needed` : ""}`}
          >
            {letterList.length > 0 && (
              <ul className="-mx-3 flex flex-col">
                {letterList.map((l) => <LetterRow key={l.id} id={l.id} schoolId={id} name={l.people?.name ?? "Unknown recommender"} deadline={l.letter_deadline} status={l.status} recommenderId={l.recommender_id} askedOn={l.asked_on} lastRemindedOn={l.last_reminded_on} reminderCount={l.reminder_count} receivedOn={l.received_on} today={today} />)}
              </ul>
            )}
            <details>
              <summary className={disclosure}>+ Request a letter</summary>
              <div className="pt-3"><AddLetterForm schoolId={id} people={people ?? []} /></div>
            </details>
          </Step>

          <Step
            n={3}
            done={hasSop || statementReady}
            title="Statement of purpose"
            summary={statementReady ? "Final" : (schoolStatements ?? []).length > 0 ? "In progress" : hasSop ? "Recorded" : "Not started"}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <StatementStep schoolId={id} statements={(schoolStatements ?? []) as any[]} generalDrafts={(generalDrafts ?? []) as any[]} />
            <details>
              <summary className={disclosure}>{hasSop ? "Recorded without a draft" : "+ Just record what you sent, without a draft"}</summary>
              <div className="pt-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <SopForm schoolId={id} current={hasSop ? { label: sopLabel ?? "Recorded version", sentAt: (sop as any).sop_sent_at } : null} />
              </div>
            </details>
          </Step>

          <Step
            n={4}
            done={interviewList.some((i) => i.status === "completed")}
            title="Interviews"
            summary={interviewList.length === 0 ? "None yet" : `${interviewList.length} on record`}
          >
            {interviewList.length > 0 && (
              <ul className="-mx-3 flex flex-col">
                {interviewList.map((iv) => <InterviewRow key={iv.id} id={iv.id} schoolId={id} when={iv.scheduled_at} prep={iv.prep_notes} outcome={iv.outcome_notes} status={iv.status} />)}
              </ul>
            )}
            <details>
              <summary className={disclosure}>+ Schedule an interview</summary>
              <div className="pt-3"><ScheduleInterviewForm schoolId={id} /></div>
            </details>
          </Step>

          {visaSteps && visaSteps.length > 0 ? (
            <Step
              n={5}
              done={visaSteps.every((v) => v.status === "done")}
              title="Visa"
              summary={`${visaSteps.filter((v) => v.status === "done").length} of ${visaSteps.length} steps done`}
            >
              <ul className="-mx-3 flex flex-col">{visaSteps.map((v) => <VisaStepRow key={v.id} id={v.id} schoolId={id} name={v.step_name} status={v.status} />)}</ul>
            </Step>
          ) : (
            <li className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-3.5">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">5</span>
              <span className="text-[15px] font-semibold text-slate-600">Visa</span>
              <span className="ml-auto text-right text-[13px] text-slate-500">The visa checklist appears when this school is set to Accepted.</span>
            </li>
          )}
        </ol>
      )}
    </main>
  );
}

function Step({
  n, done, title, summary, right, children,
}: { n: number; done: boolean; title: string; summary?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
        <span
          aria-hidden
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            done ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"
          }`}
        >
          {done ? "✓" : n}
        </span>
        <h2 className="text-[15px] font-semibold text-slate-900">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h2>
        {summary && <span className="text-[13px] text-slate-500">· {summary}</span>}
        {right && <span className="ml-auto">{right}</span>}
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">{children}</div>
    </li>
  );
}
