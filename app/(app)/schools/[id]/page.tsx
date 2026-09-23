import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { StatusSelect } from "@/components/status-select";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  AddLetterForm, InterviewRow, LetterRow, NoteForm, ScheduleInterviewForm, SchoolDetailsForm, SchoolTaskForm, SopForm, VisaStepRow,
} from "@/components/school-controls";
import {
  AddDepartmentButton, AddFundingButton, AddProfessorButton, DepartmentHeader, FundingCard, ProfessorCard,
  type DepartmentRow, type FundingRow, type ProfessorRow,
} from "@/components/faculty-controls";
import { AdmissionsPanel, type Profile } from "@/components/admissions-panel";
import { researchGaps } from "@/lib/school-research";

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
    { data: departments }, { data: professors }, { data: fundings },
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
  ]);

  if (!school) {
    return (
      <main className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-3">
        <Link href="/schools" className="text-xs text-gray-500 hover:text-cream">← All schools</Link>
        <p className="text-gray-500">This school doesn't exist or you don't have access to it.</p>
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
  const openTasks = (linkedTasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const deptOptions = depts.map((d) => ({ id: d.id, name: d.name }));
  const profOptions = profs.map((p) => ({ id: p.id, name: p.name }));

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
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold">{school.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <Chip>{[meta.city, school.country].filter(Boolean).join(", ")}</Chip>
              {meta.tier && <Chip tone={TIER_TONE[meta.tier]}>{meta.tier}</Chip>}
              {meta.verified_fit && <Chip tone="text-teal-600 border-teal-600">verified fit</Chip>}
              {meta.csranking_nlp_rank != null && <Chip>NLP rank #{meta.csranking_nlp_rank}</Chip>}
              {meta.composite_score != null && <Chip>score {Number(meta.composite_score).toFixed(1)}</Chip>}
              {meta.deadline_date && (
                <Chip tone={meta.deadline_date < today ? "text-red-600 border-red-600" : "text-brass border-brass"}>
                  deadline {meta.deadline_date} · {relative(daysBetween(today, meta.deadline_date))}
                </Chip>
              )}
            </div>
          </div>
          {isOwner && <StatusSelect schoolId={school.id} value={meta.status} />}
        </div>
        {isOwner && (
          <p className="text-xs text-gray-500 font-mono">
            {depts.length} department{depts.length === 1 ? "" : "s"} · {profs.length} professor{profs.length === 1 ? "" : "s"} · {funds.length} funding option{funds.length === 1 ? "" : "s"} · {completeness}% researched
          </p>
        )}
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
        <div className="flex flex-col gap-6">
          {isOwner && (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Glance title="Dates" href={tabHref("admissions")}>
                  {upcoming.length === 0 ? <Muted>No upcoming dates recorded</Muted> : (
                    <ul className="flex flex-col gap-1">
                      {upcoming.slice(0, 3).map((d, i) => (
                        <li key={i} className="text-xs flex justify-between gap-2"><span className="truncate">{d.label}</span><span className="font-mono text-gray-500 whitespace-nowrap">{d.date.slice(5)}</span></li>
                      ))}
                    </ul>
                  )}
                </Glance>
                <Glance title="Requirements" href={tabHref("admissions")}>
                  <ul className="text-xs flex flex-col gap-1">
                    <li>GRE: {meta.gre_policy ? <b className="font-medium">{meta.gre_policy.replace("_", " ")}</b> : <Muted inline>unknown</Muted>}</li>
                    <li className="line-clamp-2" title={meta.english_test ?? undefined}>English: {meta.english_test ? <b className="font-medium">{meta.english_test}</b> : <Muted inline>unknown</Muted>}</li>
                    <li>Letters: {meta.letters_required != null ? <b className="font-medium">{meta.letters_required}</b> : <Muted inline>unknown</Muted>} · Fee: {meta.application_fee != null ? <b className="font-medium">{meta.fee_currency} {Number(meta.application_fee).toLocaleString()}</b> : <Muted inline>unknown</Muted>}</li>
                  </ul>
                </Glance>
                <Glance title="Funding" href={tabHref("funding")}>
                  {funds.length === 0 && !meta.funding_guarantee ? <Muted>No funding researched yet</Muted> : (
                    <div className="text-xs flex flex-col gap-1">
                      {meta.funding_guarantee && <span>{meta.funding_guarantee}</span>}
                      {bestFunding && <span className="text-gray-500">{funds.length} option{funds.length === 1 ? "" : "s"} · best: <b className="font-medium text-cream">{bestFunding.name}</b> ({bestFunding.status.replace("_", " ")})</span>}
                    </div>
                  )}
                </Glance>
                <Glance title="Faculty" href={tabHref("faculty")}>
                  {profs.length === 0 ? <Muted>No professors added yet</Muted> : (
                    <div className="text-xs flex flex-col gap-1">
                      <span>{profs.length} professor{profs.length === 1 ? "" : "s"} · {takingStudents} taking students</span>
                      <span className="text-gray-500">{contacted} contacted · {replied} replied</span>
                      {bestFit.length > 0 && <span className="text-brass truncate">Best fit: {bestFit.map((p) => p.name).join(", ")}</span>}
                    </div>
                  )}
                </Glance>
              </section>

              <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-xs uppercase tracking-wide text-gray-500">Still to research</h2>
                  <span className="font-mono text-sm">{completeness}% complete</span>
                </div>
                <div className="h-1.5 rounded bg-surface-raised overflow-hidden"><div className="h-full bg-teal-600" style={{ width: `${completeness}%` }} /></div>
                {gaps.length === 0 ? (
                  <p className="text-sm text-teal-600">You know everything you track about this school.</p>
                ) : (
                  <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {gaps.map((g) => (
                      <li key={g.text}>
                        <Link href={tabHref(g.tab)} className="text-sm flex items-center gap-2 hover:text-brass">
                          <span className="text-gray-400" aria-hidden>○</span>
                          <span className="flex-1">{g.text}</span>
                          <span className="text-[10px] uppercase text-gray-400">{g.tab}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {(meta.pros || meta.cons || school.fit_note) && (
                <section className="grid gap-3 sm:grid-cols-2">
                  {school.fit_note && (
                    <div className="border border-line bg-surface rounded-lg p-4 sm:col-span-2">
                      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Why it's a fit</div>
                      <p className="text-sm text-gray-500">{school.fit_note}</p>
                    </div>
                  )}
                  {meta.pros && <div className="border border-teal-600 rounded-lg p-4"><div className="text-xs uppercase tracking-wide text-teal-600 mb-1">Pros</div><p className="text-sm whitespace-pre-line">{meta.pros}</p></div>}
                  {meta.cons && <div className="border border-red-600 rounded-lg p-4"><div className="text-xs uppercase tracking-wide text-red-600 mb-1">Cons</div><p className="text-sm whitespace-pre-line">{meta.cons}</p></div>}
                </section>
              )}
            </>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
            <Section title="Tasks" count={`${openTasks} open · ${(linkedTasks ?? []).length} total`}>
              {(linkedTasks ?? []).length === 0 ? <Empty>No tasks for this school yet.</Empty> : (
                <ul className="flex flex-col gap-2">
                  {(linkedTasks ?? []).map((t) => (
                    <li key={t.id}>
                      <Link href={`/tasks/${t.id}`} className="border rounded p-2.5 text-sm flex justify-between gap-3 items-center hover:border-brass">
                        <span className="min-w-0">
                          <span className={`block truncate ${t.status === "done" ? "line-through text-gray-500" : ""}`}>{t.title}</span>
                          {t.due_date && <span className={`block text-xs ${t.due_date < today && t.status !== "done" ? "text-red-600" : "text-gray-500"}`}>due {t.due_date}</span>}
                        </span>
                        <span className={`text-xs uppercase whitespace-nowrap ${TASK_TONE[t.status]}`}>{t.status.replace("_", " ")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {isOwner && <SchoolTaskForm schoolId={id} people={people ?? []} />}
            </Section>
            {isOwner && (
              <Section title="Activity" count={(activity ?? []).length}>
                <NoteForm schoolId={id} />
                {(activity ?? []).length === 0 ? <Empty>No activity yet. Notes and status changes appear here.</Empty> : <ActivityTimeline items={(activity ?? []) as any} schoolId={id} />}
              </Section>
            )}
          </div>
        </div>
      )}

      {isOwner && tab === "faculty" && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-gray-500 max-w-2xl">
            Map where your research fits. Add the departments that offer your program, then the professors in each, with what they work on and whether they take students. Professors can sit directly under the school if you don't need departments.
          </p>
          {groups.filter((g) => g.dept || g.list.length > 0).map((g) => (
            <section key={g.dept?.id ?? "school"} className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-4">
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
          {meta.funding_guarantee && (
            <div className="border border-teal-600 rounded-lg p-3 text-sm"><span className="text-xs uppercase tracking-wide text-teal-600">Guarantee · </span>{meta.funding_guarantee}</div>
          )}
          <p className="text-sm text-gray-500 max-w-2xl">
            Track every way this school could pay for you, whether it's school-wide, tied to a department, or a professor's grant. Set the status as you learn whether you're eligible and when you apply.
          </p>
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
          <Section title="Admissions facts"><AdmissionsPanel schoolId={id} p={profile} /></Section>
          <Section title="Basics">
            <SchoolDetailsForm
              schoolId={id} deadlineDate={meta.deadline_date} deadlineNote={meta.deadline_note}
              contactEmail={school.contact_email} faculty={school.faculty} fitNote={school.fit_note}
            />
          </Section>
        </div>
      )}

      {isOwner && tab === "application" && (
        <div className="flex flex-col gap-6">
          <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs uppercase tracking-wide text-gray-500">Application readiness</h2>
              <span className="font-mono text-sm">{readyCount}/{checklist.length}</span>
            </div>
            <div className="h-1.5 rounded bg-surface-raised overflow-hidden"><div className="h-full bg-teal-600" style={{ width: `${(readyCount / checklist.length) * 100}%` }} /></div>
            <ul className="flex flex-wrap gap-2 text-xs">
              {checklist.map((c) => (
                <li key={c.label} className={`border rounded-full px-2.5 py-1 flex items-center gap-1.5 ${c.done ? "text-teal-600 border-teal-600" : "text-gray-500 border-line"}`}>
                  <span aria-hidden>{c.done ? "✓" : "○"}</span>{c.label}
                </li>
              ))}
            </ul>
          </section>
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            <div className="flex flex-col gap-6 min-w-0">
              <Section title="Recommendation letters" count={letterList.length}>
                {letterList.length === 0 && <div className="mb-3"><Empty>No letters requested yet.</Empty></div>}
                <ul className="flex flex-col gap-2 mb-3">
                  {letterList.map((l) => <LetterRow key={l.id} id={l.id} schoolId={id} name={l.people?.name ?? "Unknown recommender"} deadline={l.letter_deadline} status={l.status} />)}
                </ul>
                <AddLetterForm schoolId={id} people={people ?? []} />
              </Section>
              <Section title="SOP sent">
                <SopForm schoolId={id} current={hasSop ? { label: sopLabel ?? "Recorded version", sentAt: (sop as any).sop_sent_at } : null} />
              </Section>
            </div>
            <div className="flex flex-col gap-6 min-w-0">
              <Section title="Interviews" count={(interviews ?? []).length}>
                {(interviews ?? []).length === 0 && <div className="mb-3"><Empty>No interviews yet.</Empty></div>}
                <ul className="flex flex-col gap-2 mb-3">
                  {(interviews ?? []).map((iv) => <InterviewRow key={iv.id} id={iv.id} schoolId={id} when={iv.scheduled_at} prep={iv.prep_notes} outcome={iv.outcome_notes} status={iv.status} />)}
                </ul>
                <ScheduleInterviewForm schoolId={id} />
              </Section>
              {visaSteps && visaSteps.length > 0 && (
                <Section title="Visa checklist" count={`${visaSteps.filter((v) => v.status === "done").length}/${visaSteps.length}`}>
                  <ul className="flex flex-col gap-2">{visaSteps.map((v) => <VisaStepRow key={v.id} id={v.id} schoolId={id} name={v.step_name} status={v.status} />)}</ul>
                </Section>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Section({ title, count, children }: { title: string; count?: number | string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-surface rounded-lg p-4">
      <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3 flex justify-between">
        <span>{title}</span>
        {count !== undefined && <span className="font-mono normal-case">{count}</span>}
      </h2>
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
