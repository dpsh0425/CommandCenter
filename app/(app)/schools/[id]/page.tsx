import { ApplyingToggle, ChecklistRows } from "@/components/readiness-controls";
import { assess, buildItems, RISK_LABEL, RISK_TONE } from "@/lib/readiness";
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
  AddDepartmentButton, AddFundingButton, AddProfessorButton, DepartmentHeader, FundingCard, ProfessorCard,
  type DepartmentRow, type FundingRow, type ProfessorRow,
} from "@/components/faculty-controls";
import { AdmissionsPanel, type Profile } from "@/components/admissions-panel";
import { researchGaps } from "@/lib/school-research";
import { LinksPanel } from "@/components/links-panel";
import { Fold, Meta, Section as PlainSection } from "@/components/ui";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d ago` : `in ${d}d`);
const TASK_TONE: Record<string, string> = {
  todo: "text-gray-500", in_progress: "text-brass", blocked: "text-red-600", done: "text-teal-600", cancelled: "text-gray-400",
};
const TIER_TONE: Record<string, string> = { reach: "text-red-600 border-red-600", target: "text-brass border-brass", safe: "text-teal-600 border-teal-600" };
const FUNDING_RANK: Record<string, number> = { awarded: 0, applied: 1, eligible: 2, to_research: 3, not_eligible: 4 };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "faculty", label: "Faculty" },
  { key: "funding", label: "Funding" },
  { key: "admissions", label: "Admissions" },
  { key: "application", label: "Application" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

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
      <main className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-3">
        <Link href="/schools" className="text-xs text-gray-500 hover:text-cream">← All schools</Link>
        <p className="text-gray-500">This school doesn&apos;t exist or you don&apos;t have access to it.</p>
      </main>
    );
  }

  const isOwner = user?.id === OWNER_USER_ID;
  const tab: TabKey = isOwner && TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "overview";
  const today = localDate(new Date());
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
  const checklist = [
    { label: "Contact email", done: !!meta.contact_email },
    { label: "Deadline set", done: !!meta.deadline_date },
    { label: "Outreach started", done: meta.status !== "not_started" || profs.some((p) => p.outreach !== "not_contacted") },
    { label: letterList.length ? `Letters ${lettersConfirmed}/${letterList.length}` : "Letters", done: lettersReady },
    { label: "SOP recorded", done: hasSop },
  ];
  const readyCount = checklist.filter((c) => c.done).length;

  // Every dated obligation for this school, soonest first.
  const dates: Array<{ label: string; date: string }> = [
    ...(meta.deadline_date ? [{ label: "Application deadline", date: meta.deadline_date as string }] : []),
    ...depts.filter((d) => d.deadline_date).map((d) => ({ label: `${d.name} deadline`, date: d.deadline_date as string })),
    ...funds.filter((f) => f.deadline_date && f.status !== "not_eligible").map((f) => ({ label: `${f.name} (funding)`, date: f.deadline_date as string })),
    ...letterList.filter((l) => l.letter_deadline && l.status !== "submitted").map((l) => ({ label: `Letter: ${l.people?.name ?? "recommender"}`, date: l.letter_deadline as string })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = dates.filter((d) => d.date >= today);

  const takingStudents = profs.filter((p) => p.accepting === "yes").length;
  const contacted = profs.filter((p) => p.outreach !== "not_contacted").length;
  const replied = profs.filter((p) => p.outreach === "replied" || p.outreach === "meeting").length;
  const openingsUnknown = profs.filter((p) => p.accepting === "unknown").length;
  const bestFit = profs.filter((p) => (p.fit_score ?? 0) >= 4);
  const bestFunding = [...funds].sort((a, b) => FUNDING_RANK[a.status] - FUNDING_RANK[b.status])[0];

  // What the applicant still doesn't know, each pointing to where to fill it in.
  const { gaps, completeness } = researchGaps(meta, depts.length, profs, funds.length, depts.filter((d) => d.deadline_date).length);

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

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/schools" className="text-xs text-gray-500 hover:text-cream self-start">← All schools</Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex flex-col gap-1">
            <h1 className="text-3xl font-semibold leading-tight">{school.name}</h1>
            <Meta
              items={[
                [meta.city, school.country].filter(Boolean).join(", "),
                meta.tier && <span className={TIER_TONE[meta.tier].split(" ")[0]}>{meta.tier}</span>,
                meta.verified_fit && "verified fit",
                meta.csranking_nlp_rank != null && `NLP rank #${meta.csranking_nlp_rank}`,
              ]}
            />
          </div>
          {isOwner && <StatusSelect schoolId={school.id} value={meta.status} />}
        </div>
      </div>

      {isOwner && (
        <nav className="flex gap-1 border-b border-line overflow-x-auto" aria-label="School sections">
          {TABS.map((t) => (
            <Link
              key={t.key} href={tabHref(t.key)} scroll={false}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? "border-brass text-cream font-medium" : "border-transparent text-gray-500 hover:text-cream"}`}
            >
              {t.label}
              {t.key === "faculty" && profs.length > 0 && <span className="ml-1.5 text-[10px] font-mono text-gray-400">{profs.length}</span>}
              {t.key === "funding" && funds.length > 0 && <span className="ml-1.5 text-[10px] font-mono text-gray-400">{funds.length}</span>}
            </Link>
          ))}
        </nav>
      )}

      {tab === "overview" && (
        <div className="flex flex-col gap-8">
          {isOwner && (
            <>
              <PlainSection title="Next steps" hint={`${completeness}% researched`}>
                {meta.deadline_date && (
                  <p className="text-sm">
                    <span className="text-gray-500">Application deadline </span>
                    <span className="font-medium">{new Date(meta.deadline_date + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>
                    <span className={meta.deadline_date < today ? " text-red-600" : daysBetween(today, meta.deadline_date) <= 30 ? " text-brass" : " text-gray-500"}> · {relative(daysBetween(today, meta.deadline_date))}</span>
                  </p>
                )}
                {gaps.length === 0 ? (
                  <p className="text-sm text-teal-600">You know everything you track about this school.</p>
                ) : (
                  <ul className="flex flex-col">
                    {gaps.slice(0, 4).map((g) => (
                      <li key={g.text} className="border-b border-line/60 last:border-0">
                        <Link href={tabHref(g.tab)} className="flex justify-between gap-4 py-2 text-sm hover:text-brass">
                          <span>{g.text}</span>
                          <span className="text-gray-400 capitalize">{g.tab} →</span>
                        </Link>
                      </li>
                    ))}
                    {gaps.length > 4 && <li className="text-xs text-gray-400 pt-2">and {gaps.length - 4} more to research</li>}
                  </ul>
                )}
              </PlainSection>

              <PlainSection title="Key facts" action={<Link href={tabHref("admissions")} className="hover:text-cream">Edit admissions info</Link>}>
                <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 text-sm">
                  {[
                    ["Application fee", meta.application_fee != null ? `${meta.fee_currency} ${Number(meta.application_fee)}` : null],
                    ["GRE", meta.gre_policy ? ({ required: "Required", optional: "Optional", not_accepted: "Not considered" } as any)[meta.gre_policy] : null],
                    ["English test", meta.english_test],
                    ["Letters needed", meta.letters_required != null ? String(meta.letters_required) : null],
                    ["Funding", meta.funding_guarantee ?? (funds.length ? `${funds.length} option${funds.length === 1 ? "" : "s"} tracked` : null)],
                    ["Program length", meta.program_length],
                  ].map(([label, value]) => (
                    <div key={label as string} className="contents">
                      <dt className="text-gray-500 py-1.5 border-b border-line/60">{label}</dt>
                      <dd className="py-1.5 border-b border-line/60 min-w-0">{value ? <span className="line-clamp-2">{value}</span> : <span className="text-gray-400">Not researched</span>}</dd>
                    </div>
                  ))}
                </dl>
                {school.fit_note && <p className="text-sm text-gray-500 pt-2"><span className="text-gray-400">Why it fits: </span>{school.fit_note}</p>}
              </PlainSection>
            </>
          )}

          <PlainSection title="Tasks" hint={`${openTasks} open`}>
            {(linkedTasks ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No tasks for this school yet.</p>
            ) : (
              <ul className="flex flex-col">
                {(linkedTasks ?? []).map((t) => (
                  <li key={t.id} className="border-b border-line/60 last:border-0">
                    <Link href={`/tasks/${t.id}`} className="flex justify-between gap-4 py-2 text-sm hover:text-brass">
                      <span className={`truncate ${t.status === "done" ? "line-through text-gray-500" : ""}`}>{t.title}</span>
                      <span className={`whitespace-nowrap ${t.due_date && t.due_date < today && t.status !== "done" ? "text-red-600" : "text-gray-400"}`}>{t.due_date ? `due ${t.due_date.slice(5)}` : t.status.replace("_", " ")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {isOwner && (
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-500 hover:text-cream list-none">+ Add a task</summary>
                <SchoolTaskForm schoolId={id} people={people ?? []} />
              </details>
            )}
          </PlainSection>

          {isOwner && (
            <Fold title="Notes and activity" summary={`${(activity ?? []).length} entries`}>
              <NoteForm schoolId={id} />
              {(activity ?? []).length === 0 ? <p className="text-sm text-gray-500">No activity yet. Notes and status changes appear here.</p> : <ActivityTimeline items={((activity ?? []) as any[]).map((a) => (a.type === "note" ? { ...a, html: renderRich(a.content) } : a))} schoolId={id} />}
            </Fold>
          )}

          {isOwner && (
            <Fold title="Links" summary={`${(schoolLinks ?? []).length} saved`}>
              <LinksPanel
                links={(schoolLinks ?? []) as any}
                scope={{ schoolId: id }}
                placeholder="Paste a lab page, funding page, paper or program page…"
                emptyText="No links yet. Save the lab pages, funding pages and papers you rely on."
              />
            </Fold>
          )}
        </div>
      )}

      {isOwner && tab === "faculty" && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-gray-500 max-w-2xl">Group professors by department, or keep them directly under the school.</p>
          {groups.filter((g) => g.dept || g.list.length > 0).map((g) => (
            <section key={g.dept?.id ?? "school"} className="flex flex-col gap-4 pb-6 border-b border-line last:border-0">
              {g.dept ? (
                <DepartmentHeader schoolId={id} dept={g.dept} professorCount={g.list.length} />
              ) : (
                <div>
                  <h3 className="font-serif text-xl leading-tight">{depts.length ? "Not assigned to a department" : "Professors"}</h3>
                  <p className="text-xs text-gray-400">{g.list.length} professor{g.list.length === 1 ? "" : "s"}</p>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {g.list.map((p) => <ProfessorCard key={p.id} schoolId={id} prof={p} departments={deptOptions} />)}
              </div>
              {g.list.length === 0 && <Empty>No professors here yet.</Empty>}
              <AddProfessorButton schoolId={id} departments={deptOptions} departmentId={g.dept?.id ?? null} label={g.dept ? `+ Add professor to ${g.dept.name}` : "+ Add professor"} />
            </section>
          ))}
          {profs.length === 0 && depts.length === 0 && (
            <div className="flex flex-col gap-3">
              <Empty>No professors or departments yet.</Empty>
              <AddProfessorButton schoolId={id} departments={[]} />
            </div>
          )}
          <AddDepartmentButton schoolId={id} />
        </div>
      )}

      {isOwner && tab === "funding" && (
        <div className="flex flex-col gap-4">
          {meta.funding_guarantee ? (
            <p className="font-serif text-2xl leading-snug max-w-2xl"><span className="text-teal-600">Guaranteed. </span>{meta.funding_guarantee}</p>
          ) : (
            <p className="text-sm text-gray-500 max-w-2xl">Every way this school could pay for you: school-wide, by department, or a professor&apos;s grant.</p>
          )}
          {sortedFunds.length === 0 ? <Empty>No funding tracked yet.</Empty> : (
            <div className="grid gap-3 md:grid-cols-2">
              {sortedFunds.map((f) => (
                <FundingCard key={f.id} schoolId={id} funding={f} scopeLabel={scopeLabel(f)} departments={deptOptions} professors={profOptions} />
              ))}
            </div>
          )}
          <AddFundingButton schoolId={id} departments={deptOptions} professors={profOptions} />
        </div>
      )}

      {isOwner && tab === "admissions" && (
        <div className="max-w-3xl">
          <AdmissionsPanel schoolId={id} p={profile} />
        </div>
      )}

      {isOwner && tab === "application" && (
        <div className="max-w-3xl flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-2">
              <h2 className="font-sans text-[15px] font-semibold text-cream">
                {meta.applying ? "Submission checklist" : "Are you applying here?"}
              </h2>
              {meta.applying && (
                <span className={`text-sm ${RISK_TONE[verdict.risk]}`}>
                  {RISK_LABEL[verdict.risk]}
                  {verdict.days != null && verdict.risk !== "submitted" && <span className="text-gray-400"> · {verdict.days < 0 ? `${-verdict.days}d ago` : `${verdict.days} days left`}</span>}
                </span>
              )}
            </div>
            {meta.applying ? (
              <>
                <ChecklistRows schoolId={id} items={readinessItems} />
                <div className="pt-2"><ApplyingToggle schoolId={id} applying /></div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-500">Track this school on your Readiness page with a checklist and a deadline warning.</p>
                <ApplyingToggle schoolId={id} applying={false} />
              </div>
            )}
          </section>

          <Step
            done={lettersReady}
            title="Recommendation letters"
            summary={letterList.length === 0 ? (meta.letters_required ? `None requested yet (${meta.letters_required} needed)` : "None requested yet") : `${lettersConfirmed} of ${letterList.length} confirmed${meta.letters_required ? ` · ${meta.letters_required} needed` : ""}`}
          >
            {letterList.length > 0 && (
              <ul className="flex flex-col gap-2">
                {letterList.map((l) => <LetterRow key={l.id} id={l.id} schoolId={id} name={l.people?.name ?? "Unknown recommender"} deadline={l.letter_deadline} status={l.status} recommenderId={l.recommender_id} askedOn={l.asked_on} lastRemindedOn={l.last_reminded_on} reminderCount={l.reminder_count} receivedOn={l.received_on} today={today} />)}
              </ul>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-cream">+ Request a letter</summary>
              <div className="pt-3"><AddLetterForm schoolId={id} people={people ?? []} /></div>
            </details>
          </Step>

          <Step
            done={hasSop || statementReady}
            title="Statement of purpose"
            summary={statementReady ? "Final" : (schoolStatements ?? []).length > 0 ? "In progress" : hasSop ? "Recorded" : "Not started"}
          >
            <StatementStep schoolId={id} statements={(schoolStatements ?? []) as any[]} generalDrafts={(generalDrafts ?? []) as any[]} />
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-cream">{hasSop ? "Recorded without a draft" : "+ Just record what you sent, without a draft"}</summary>
              <div className="pt-3">
                <SopForm schoolId={id} current={hasSop ? { label: sopLabel ?? "Recorded version", sentAt: (sop as any).sop_sent_at } : null} />
              </div>
            </details>
          </Step>

          <Step
            done={(interviews ?? []).some((i) => i.status === "completed")}
            title="Interviews"
            summary={(interviews ?? []).length === 0 ? "None yet" : `${(interviews ?? []).length} on record`}
          >
            {(interviews ?? []).length > 0 && (
              <ul className="flex flex-col gap-2">
                {(interviews ?? []).map((iv) => <InterviewRow key={iv.id} id={iv.id} schoolId={id} when={iv.scheduled_at} prep={iv.prep_notes} outcome={iv.outcome_notes} status={iv.status} />)}
              </ul>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-cream">+ Schedule an interview</summary>
              <div className="pt-3"><ScheduleInterviewForm schoolId={id} /></div>
            </details>
          </Step>

          {visaSteps && visaSteps.length > 0 && (
            <Step
              done={visaSteps.every((v) => v.status === "done")}
              title="Visa"
              summary={`${visaSteps.filter((v) => v.status === "done").length} of ${visaSteps.length} steps done`}
            >
              <ul className="flex flex-col gap-2">{visaSteps.map((v) => <VisaStepRow key={v.id} id={v.id} schoolId={id} name={v.step_name} status={v.status} />)}</ul>
            </Step>
          )}
        </div>
      )}
    </main>
  );
}

function Step({ done, title, summary, children }: { done: boolean; title: string; summary: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-4">
      <span
        aria-hidden
        className={`mt-0.5 w-6 h-6 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${done ? "bg-teal-600 border-teal-600 text-ink" : "border-line text-transparent"}`}
      >
        ✓
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-3 pb-8 border-b border-line">
        <div>
          <h2 className="font-sans text-[15px] font-semibold text-cream">{title}</h2>
          <p className="text-sm text-gray-500">{summary}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function Section({ title, count, children }: { title: string; count?: number | string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 className="font-sans text-[15px] font-semibold text-cream">{title}</h2>
        {count !== undefined && <span className="font-mono text-xs text-gray-500">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Glance({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} className="border border-line bg-surface rounded-lg p-3 flex flex-col gap-2 hover:border-brass min-w-0">
      <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-mono">{title}</span>
      {children}
    </Link>
  );
}

function Muted({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return <span className={`text-gray-400 italic ${inline ? "" : "text-xs"}`}>{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 border border-dashed border-line rounded p-3 text-center">{children}</p>;
}

function Chip({ children, tone = "text-gray-500 border-line" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`border rounded-full px-2.5 py-0.5 ${tone}`}>{children}</span>;
}
