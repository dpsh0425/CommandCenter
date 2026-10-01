"use client";
import { useState, useTransition } from "react";
import {
  addDepartment, addFunding, addProfessor, deleteDepartment, deleteFunding, deleteProfessor,
  setFundingStatus, setProfessorOutreach, updateDepartment, updateFunding, updateProfessor,
  type AcceptingStatus, type DepartmentInput, type FundingInput, type FundingStatus, type FundingType,
  type OutreachStatus, type ProfessorInput,
} from "@/app/(app)/schools/[id]/faculty-actions";
import { fundingTypeLabel } from "@/lib/funding-labels";

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };
  return { pending, error, run };
}

const btn = "h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const ghost = "h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";
const addBtn = "h-9 self-start rounded-md border border-dashed border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-blue-600 hover:text-blue-700";
const smallAction = "h-7 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";
const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const Err = ({ message }: { message: string | null }) => (message ? <p role="alert" className="text-xs text-red-700">{message}</p> : null);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">{label}{children}</label>
);
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// `today` comes from the server (APP_TIMEZONE); the browser clock is only a fallback.
const daysUntil = (date: string, today?: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date((today ?? localDate(new Date())) + "T00:00:00").getTime()) / 86400000);
const whenLabel = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d ago` : `in ${d}d`);
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const pill = "rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap";

type Dept = { id: string; name: string };
type Person = { id: string; name: string };

/** Delete button that asks in place: "Remove X? [Remove] [Keep]". */
function ConfirmRemove({ label, question, pending, onConfirm }: { label: string; question: string; pending: boolean; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" disabled={pending} onClick={() => setAsking(true)} className={smallAction}>{label}</button>;
  }
  return (
    <span role="group" aria-label={question} className="inline-flex items-center gap-1.5 rounded-md bg-red-50 py-0.5 pl-2.5 pr-1 text-xs text-red-800">
      {question}
      <button type="button" disabled={pending} onClick={() => { onConfirm(); setAsking(false); }} className="h-6 rounded bg-red-600 px-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60">{label}</button>
      <button type="button" onClick={() => setAsking(false)} className="h-6 rounded px-2 font-medium text-slate-700 hover:bg-white">Keep</button>
    </span>
  );
}

function FormActions({ pending, submitLabel, onCancel }: { pending: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <button disabled={pending} className={btn}>{pending ? "Saving…" : submitLabel}</button>
      <button type="button" onClick={onCancel} className={ghost}>Cancel</button>
    </div>
  );
}

// ============ Departments ============
export type DepartmentRow = {
  id: string; name: string; program: string | null; url: string | null; admissions_url: string | null;
  deadline_date: string | null; requirements: string | null; notes: string | null;
};

function DepartmentForm({ initial, onSubmit, onCancel, pending, error, submitLabel }: {
  initial?: DepartmentRow; onSubmit: (d: DepartmentInput) => void; onCancel: () => void; pending: boolean; error: string | null; submitLabel: string;
}) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          name: val(f, "name"), program: val(f, "program") || null, url: val(f, "url") || null, admissionsUrl: val(f, "admissions_url") || null,
          deadlineDate: val(f, "deadline_date") || null, requirements: val(f, "requirements") || null, notes: val(f, "notes") || null,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Department name *"><input name="name" required defaultValue={initial?.name} placeholder="e.g. Computer Science" className={input} /></Field>
        <Field label="Program"><input name="program" defaultValue={initial?.program ?? ""} placeholder="PhD, MS, PhD/MS…" className={input} /></Field>
        <Field label="Department website"><input name="url" type="url" defaultValue={initial?.url ?? ""} placeholder="https://" className={input} /></Field>
        <Field label="Admissions page"><input name="admissions_url" type="url" defaultValue={initial?.admissions_url ?? ""} placeholder="https://" className={input} /></Field>
        <Field label="Application deadline"><input name="deadline_date" type="date" defaultValue={initial?.deadline_date ?? ""} className={input} /></Field>
      </div>
      <Field label="Requirements"><textarea name="requirements" rows={2} defaultValue={initial?.requirements ?? ""} placeholder="GRE, TOEFL/IELTS minimums, letters, writing sample…" className={input} /></Field>
      <Field label="Notes"><textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} className={input} /></Field>
      <Err message={error} />
      <FormActions pending={pending} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}

export function AddDepartmentButton({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useRun();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={addBtn}>+ Add department</button>;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-[15px] font-semibold text-slate-900">New department</h3>
      <DepartmentForm pending={pending} error={error} submitLabel="Add department" onCancel={() => setOpen(false)} onSubmit={(d) => run(() => addDepartment(schoolId, d), () => setOpen(false))} />
    </div>
  );
}

export function DepartmentHeader({ schoolId, dept, professorCount, today }: { schoolId: string; dept: DepartmentRow; professorCount: number; today?: string }) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useRun();
  const d = dept.deadline_date ? daysUntil(dept.deadline_date, today) : null;
  if (editing) {
    return <DepartmentForm initial={dept} pending={pending} error={error} submitLabel="Save department" onCancel={() => setEditing(false)}
      onSubmit={(x) => run(() => updateDepartment(dept.id, schoolId, x), () => setEditing(false))} />;
  }
  const detail = dept.requirements || dept.notes;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">
            {dept.name}
            <span className="ml-1 text-[13px] font-normal text-slate-500">
              · {[dept.program, `${professorCount} professor${professorCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
            </span>
          </h3>
          {dept.deadline_date && (
            <span className={`mt-1.5 inline-block ${pill} ${d! < 0 || d! <= 30 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
              Deadline {shortDate(dept.deadline_date)} · {whenLabel(d!)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[13px]">
          {dept.url && <a href={dept.url} target="_blank" rel="noopener noreferrer" className="rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">Website ↗</a>}
          {dept.admissions_url && <a href={dept.admissions_url} target="_blank" rel="noopener noreferrer" className="rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">Admissions ↗</a>}
          <button type="button" onClick={() => setEditing(true)} className={smallAction}>Edit</button>
          <ConfirmRemove
            label="Delete" pending={pending}
            question={`Delete ${dept.name}? Its professors and funding move to school level.`}
            onConfirm={() => run(() => deleteDepartment(dept.id, schoolId))}
          />
        </div>
      </div>
      {detail && (
        <details className="text-sm">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-blue-600 hover:text-blue-700 [&::-webkit-details-marker]:hidden">Requirements and notes</summary>
          <div className="mt-2 flex flex-col gap-2 rounded-md bg-slate-50 px-3 py-2.5 text-slate-700">
            {dept.requirements && <p><span className="text-slate-500">Requirements: </span>{dept.requirements}</p>}
            {dept.notes && <p className="whitespace-pre-line text-[13px]">{dept.notes}</p>}
          </div>
        </details>
      )}
      <Err message={error} />
    </div>
  );
}

// ============ Professors ============
export type ProfessorRow = {
  id: string; name: string; title: string | null; department_id: string | null; lab_name: string | null; research_areas: string[];
  research_summary: string | null; homepage_url: string | null; scholar_url: string | null; email: string | null;
  accepting: AcceptingStatus; fit_score: number | null; outreach: OutreachStatus; last_contacted_on: string | null; notes: string | null;
};

export const OUTREACH: Array<{ key: OutreachStatus; label: string; tone: string }> = [
  { key: "not_contacted", label: "Not contacted", tone: "border-slate-300 bg-white text-slate-600" },
  { key: "contacted", label: "Contacted", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  { key: "replied", label: "Replied", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { key: "meeting", label: "Meeting", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { key: "no_response", label: "No response", tone: "border-slate-300 bg-slate-50 text-slate-600" },
  { key: "declined", label: "Declined", tone: "border-red-200 bg-red-50 text-red-700" },
];
const ACCEPTING = { unknown: "Openings unknown", yes: "Taking students", no: "Not taking students" } as const;
const ACCEPTING_TONE = { unknown: "bg-slate-100 text-slate-600", yes: "bg-emerald-50 text-emerald-700", no: "bg-red-50 text-red-700" } as const;

function ProfessorForm({ initial, departments, onSubmit, onCancel, pending, error, submitLabel, defaultDepartmentId }: {
  initial?: ProfessorRow; departments: Dept[]; onSubmit: (p: ProfessorInput) => void; onCancel: () => void;
  pending: boolean; error: string | null; submitLabel: string; defaultDepartmentId?: string | null;
}) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const fit = val(f, "fit_score");
        onSubmit({
          name: val(f, "name"), title: val(f, "title") || null, departmentId: val(f, "department_id") || null, labName: val(f, "lab_name") || null,
          researchAreas: val(f, "research_areas").split(",").map((s) => s.trim()).filter(Boolean),
          researchSummary: val(f, "research_summary") || null, homepageUrl: val(f, "homepage_url") || null, scholarUrl: val(f, "scholar_url") || null,
          email: val(f, "email") || null, accepting: (val(f, "accepting") || "unknown") as AcceptingStatus, fitScore: fit ? Number(fit) : null, notes: val(f, "notes") || null,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *"><input name="name" required defaultValue={initial?.name} className={input} /></Field>
        <Field label="Title"><input name="title" defaultValue={initial?.title ?? ""} placeholder="Associate Professor" className={input} /></Field>
        {departments.length > 0 && (
          <Field label="Department">
            <select name="department_id" defaultValue={initial?.department_id ?? defaultDepartmentId ?? ""} className={input}>
              <option value="">No department (school level)</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Lab or group"><input name="lab_name" defaultValue={initial?.lab_name ?? ""} className={input} /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={initial?.email ?? ""} className={input} /></Field>
        <Field label="Homepage"><input name="homepage_url" type="url" defaultValue={initial?.homepage_url ?? ""} placeholder="https://" className={input} /></Field>
        <Field label="Google Scholar / publications"><input name="scholar_url" type="url" defaultValue={initial?.scholar_url ?? ""} placeholder="https://" className={input} /></Field>
        <Field label="Taking students?">
          <select name="accepting" defaultValue={initial?.accepting ?? "unknown"} className={input}>
            <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </Field>
        <Field label="Fit for you (1-5)">
          <select name="fit_score" defaultValue={initial?.fit_score ?? ""} className={input}>
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Research areas (comma separated)"><input name="research_areas" defaultValue={initial?.research_areas.join(", ") ?? ""} placeholder="machine translation, low-resource NLP, evaluation" className={input} /></Field>
      <Field label="What they work on and why it fits"><textarea name="research_summary" rows={3} defaultValue={initial?.research_summary ?? ""} className={input} /></Field>
      <Field label="Notes"><textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} className={input} /></Field>
      <Err message={error} />
      <FormActions pending={pending} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}

export function AddProfessorButton({ schoolId, departments, departmentId, label = "+ Add professor" }: {
  schoolId: string; departments: Dept[]; departmentId?: string | null; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useRun();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={addBtn}>{label}</button>;
  return (
    <div className="rounded-lg border border-blue-200 bg-white p-5">
      <h3 className="mb-3 text-[15px] font-semibold text-slate-900">New professor</h3>
      <ProfessorForm departments={departments} defaultDepartmentId={departmentId} pending={pending} error={error} submitLabel="Add professor"
        onCancel={() => setOpen(false)} onSubmit={(p) => run(() => addProfessor(schoolId, p), () => setOpen(false))} />
    </div>
  );
}

function FitMeter({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-slate-400">Fit not rated</span>;
  return (
    <span className="inline-flex items-center gap-1.5" title={`Your fit rating: ${score} of 5`}>
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1.5 w-2.5 rounded-sm ${n <= score ? "bg-blue-600" : "bg-slate-200"}`} />)}
      </span>
      <span className="text-xs font-semibold text-blue-700">{score}/5<span className="sr-only"> fit</span></span>
    </span>
  );
}

/** Opens the user's own mail app; nothing is sent or stored by the app. */
function draftEmailHref(prof: ProfessorRow) {
  const topic = prof.research_areas[0];
  const subject = topic ? `Prospective graduate student interested in your work on ${topic}` : "Prospective graduate student interested in your research";
  return `mailto:${prof.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Dear ${prof.name},\n\n`)}`;
}

function OutreachSelect({ schoolId, prof, run, pending }: { schoolId: string; prof: ProfessorRow; run: ReturnType<typeof useRun>["run"]; pending: boolean }) {
  const outreach = OUTREACH.find((o) => o.key === prof.outreach)!;
  return (
    <select
      value={prof.outreach}
      disabled={pending}
      onChange={(e) => run(() => setProfessorOutreach(prof.id, schoolId, e.target.value as OutreachStatus))}
      className={`h-7 cursor-pointer rounded-full border px-2 text-xs font-medium disabled:opacity-60 ${outreach.tone}`}
      aria-label={`Outreach status for ${prof.name}`}
    >
      {OUTREACH.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}

function ProfessorEditor({ schoolId, prof, departments, onDone }: { schoolId: string; prof: ProfessorRow; departments: Dept[]; onDone: () => void }) {
  const { pending, error, run } = useRun();
  return (
    <ProfessorForm initial={prof} departments={departments} pending={pending} error={error} submitLabel="Save professor"
      onCancel={onDone} onSubmit={(p) => run(() => updateProfessor(prof.id, schoolId, p), onDone)} />
  );
}

function RemoveProfessor({ schoolId, prof, run, pending }: { schoolId: string; prof: ProfessorRow; run: ReturnType<typeof useRun>["run"]; pending: boolean }) {
  return <ConfirmRemove label="Remove" question={`Remove ${prof.name}?`} pending={pending} onConfirm={() => run(() => deleteProfessor(prof.id, schoolId))} />;
}

export function ProfessorCard({ schoolId, prof, departments }: { schoolId: string; prof: ProfessorRow; departments: Dept[] }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { pending, error, run } = useRun();

  if (editing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-white p-4 md:col-span-2">
        <ProfessorEditor schoolId={schoolId} prof={prof} departments={departments} onDone={() => setEditing(false)} />
      </div>
    );
  }
  const long = (prof.research_summary?.length ?? 0) > 150;
  return (
    <article className={`flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-slate-900">{prof.name}</div>
          {(prof.title || prof.lab_name) && <div className="text-xs text-slate-500">{[prof.title, prof.lab_name].filter(Boolean).join(" · ")}</div>}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <FitMeter score={prof.fit_score} />
          <span className={`${pill} ${ACCEPTING_TONE[prof.accepting]}`}>{ACCEPTING[prof.accepting]}</span>
        </div>
      </div>

      {prof.research_areas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Research areas">
          {prof.research_areas.map((a) => <li key={a} className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{a}</li>)}
        </ul>
      )}
      {prof.research_summary && (
        <p className={`whitespace-pre-line text-[13px] leading-5 text-slate-600 ${expanded ? "" : "line-clamp-2"}`}>{prof.research_summary}</p>
      )}
      {long && <button type="button" onClick={() => setExpanded((v) => !v)} className="self-start text-xs font-medium text-blue-600 hover:text-blue-700">{expanded ? "Show less" : "Read more"}</button>}
      {prof.notes && <p className="whitespace-pre-line rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{prof.notes}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5 text-xs">
        <OutreachSelect schoolId={schoolId} prof={prof} run={run} pending={pending} />
        <span className="text-slate-500">{prof.last_contacted_on ? `Last contact ${shortDate(prof.last_contacted_on)}` : "Not contacted yet"}</span>
        {prof.email && <a href={draftEmailHref(prof)} className="font-medium text-blue-600 hover:text-blue-700">Draft email</a>}
        {prof.homepage_url && <a href={prof.homepage_url} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-900">Homepage ↗</a>}
        {prof.scholar_url && <a href={prof.scholar_url} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-900">Papers ↗</a>}
        <span className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => setEditing(true)} className={smallAction}>Edit</button>
          <RemoveProfessor schoolId={schoolId} prof={prof} run={run} pending={pending} />
        </span>
      </div>
      <Err message={error} />
    </article>
  );
}

function ProfessorTableRow({ schoolId, prof, departments }: { schoolId: string; prof: ProfessorRow; departments: Dept[] }) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useRun();
  if (editing) {
    return (
      <tr className="border-t border-slate-100">
        <td colSpan={7} className="bg-slate-50 px-5 py-4">
          <ProfessorEditor schoolId={schoolId} prof={prof} departments={departments} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }
  return (
    <tr className={`border-t border-slate-100 align-top ${pending ? "opacity-60" : ""}`}>
      <td className="px-5 py-3">
        <div className="font-semibold text-slate-900">{prof.name}</div>
        {(prof.title || prof.lab_name) && <div className="text-xs text-slate-500">{[prof.title, prof.lab_name].filter(Boolean).join(" · ")}</div>}
        <Err message={error} />
      </td>
      <td className="max-w-[220px] px-2 py-3 text-blue-700">{prof.research_areas.join(", ") || <span className="text-slate-400">—</span>}</td>
      <td className="px-2 py-3"><FitMeter score={prof.fit_score} /></td>
      <td className="px-2 py-3"><span className={`${pill} ${ACCEPTING_TONE[prof.accepting]}`}>{ACCEPTING[prof.accepting]}</span></td>
      <td className="px-2 py-3"><OutreachSelect schoolId={schoolId} prof={prof} run={run} pending={pending} /></td>
      <td className="whitespace-nowrap px-2 py-3 text-slate-500">{prof.last_contacted_on ? shortDate(prof.last_contacted_on) : "—"}</td>
      <td className="px-5 py-3">
        <span className="flex items-center justify-end gap-1 whitespace-nowrap">
          {prof.email && <a href={draftEmailHref(prof)} className="px-1 text-xs font-medium text-blue-600 hover:text-blue-700">Draft email</a>}
          <button type="button" onClick={() => setEditing(true)} className={smallAction}>Edit</button>
          <RemoveProfessor schoolId={schoolId} prof={prof} run={run} pending={pending} />
        </span>
      </td>
    </tr>
  );
}

type FacultyFilter = "all" | "taking" | "not_contacted" | "replied";
const FILTERS: Array<{ key: FacultyFilter; label: string; match: (p: ProfessorRow) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "taking", label: "Taking students", match: (p) => p.accepting === "yes" },
  { key: "not_contacted", label: "Not contacted", match: (p) => p.outreach === "not_contacted" },
  { key: "replied", label: "Replied or meeting", match: (p) => p.outreach === "replied" || p.outreach === "meeting" },
];

/** The whole Faculty tab: summary, filters, card/table toggle, and professors grouped by department. */
export function FacultyView({ schoolId, groups, departments, today }: {
  schoolId: string; groups: Array<{ dept: DepartmentRow | null; list: ProfessorRow[] }>; departments: Dept[]; today?: string;
}) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filter, setFilter] = useState<FacultyFilter>("all");
  const all = groups.flatMap((g) => g.list);
  const match = FILTERS.find((f) => f.key === filter)!.match;
  const visibleGroups = groups.filter((g) => g.dept || g.list.length > 0);
  const contacted = all.filter((p) => p.outreach !== "not_contacted").length;
  const stats = [
    { label: "Professors", value: all.length, sub: `in ${departments.length} department${departments.length === 1 ? "" : "s"}` },
    { label: "Taking students", value: all.filter((p) => p.accepting === "yes").length, sub: `${all.filter((p) => p.accepting === "unknown").length} unknown`, tone: "text-emerald-700" },
    { label: "Contacted", value: contacted, sub: `of ${all.length}` },
    { label: "Replied or meeting", value: all.filter((p) => p.outreach === "replied" || p.outreach === "meeting").length, sub: "counted as wins", tone: "text-blue-700" },
  ];

  if (all.length === 0 && departments.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No professors or departments yet</p>
          <p className="mt-1 text-[13px] text-slate-500">Add the professors whose work matches yours. Group them by department if it helps.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddProfessorButton schoolId={schoolId} departments={[]} />
          <AddDepartmentButton schoolId={schoolId} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{s.label}</p>
            <p className={`text-[22px] font-semibold tabular-nums ${s.value > 0 && s.tone ? s.tone : "text-slate-900"}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter professors">
          {FILTERS.map((f) => (
            <button
              key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={`h-8 rounded-full border px-3 text-[13px] font-medium transition-colors ${
                filter === f.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="View">
          {(["cards", "table"] as const).map((v) => (
            <button
              key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={`h-8 px-3 text-[13px] font-medium capitalize ${view === v ? "bg-slate-100 text-slate-900" : "bg-white text-slate-500 hover:text-slate-900"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {visibleGroups.map((g) => {
        const list = g.list.filter(match);
        return (
          <section key={g.dept?.id ?? "school"} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              {g.dept ? (
                <DepartmentHeader schoolId={schoolId} dept={g.dept} professorCount={g.list.length} today={today} />
              ) : (
                <h3 className="text-base font-semibold text-slate-900">
                  {departments.length ? "Not assigned to a department" : "Professors"}
                  <span className="ml-1 text-[13px] font-normal text-slate-500">· {g.list.length} professor{g.list.length === 1 ? "" : "s"}</span>
                </h3>
              )}
            </div>
            {list.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-slate-500">{g.list.length === 0 ? "No professors here yet." : "No professors here match this filter."}</p>
            ) : view === "cards" ? (
              <div className="grid gap-3 p-4 md:grid-cols-2 md:px-5">
                {list.map((p) => <ProfessorCard key={p.id} schoolId={schoolId} prof={p} departments={departments} />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-5 py-2.5 font-medium">Professor</th>
                      <th className="px-2 py-2.5 font-medium">Research areas</th>
                      <th className="px-2 py-2.5 font-medium">Fit</th>
                      <th className="px-2 py-2.5 font-medium">Openings</th>
                      <th className="px-2 py-2.5 font-medium">Outreach</th>
                      <th className="px-2 py-2.5 font-medium">Last contact</th>
                      <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => <ProfessorTableRow key={p.id} schoolId={schoolId} prof={p} departments={departments} />)}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-5 pb-4">
              <AddProfessorButton schoolId={schoolId} departments={departments} departmentId={g.dept?.id ?? null} label={g.dept ? `+ Add professor to ${g.dept.name}` : "+ Add professor"} />
            </div>
          </section>
        );
      })}

      <AddDepartmentButton schoolId={schoolId} />
      <p className="text-xs text-slate-500">Changing outreach adds a line to Notes and activity. Replies and meetings count as wins.</p>
    </div>
  );
}

// ============ Funding ============
export type FundingRow = {
  id: string; name: string; type: FundingType; amount: number | null; currency: string; period: string | null; covers: string | null;
  deadline_date: string | null; url: string | null; status: FundingStatus; notes: string | null; department_id: string | null; professor_id: string | null;
};

const FUNDING_TYPES: Array<{ key: FundingType; label: string }> = [
  { key: "assistantship", label: "Assistantship (RA/TA)" }, { key: "fellowship", label: "Fellowship" }, { key: "scholarship", label: "Scholarship" },
  { key: "tuition_waiver", label: "Tuition waiver" }, { key: "stipend", label: "Stipend" }, { key: "other", label: "Other" },
];
const FUNDING_STATUSES: Array<{ key: FundingStatus; label: string; tone: string }> = [
  { key: "to_research", label: "To research", tone: "border-slate-300 bg-white text-slate-600" },
  { key: "eligible", label: "Eligible", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  { key: "applied", label: "Applied", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  { key: "awarded", label: "Awarded", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { key: "not_eligible", label: "Not eligible", tone: "border-red-200 bg-red-50 text-red-700" },
];
export { fundingTypeLabel, fundingStatusLabel } from "@/lib/funding-labels";

function FundingForm({ initial, departments, professors, onSubmit, onCancel, pending, error, submitLabel }: {
  initial?: FundingRow; departments: Dept[]; professors: Person[]; onSubmit: (f: FundingInput) => void; onCancel: () => void;
  pending: boolean; error: string | null; submitLabel: string;
}) {
  const scope = initial?.professor_id ? `p:${initial.professor_id}` : initial?.department_id ? `d:${initial.department_id}` : "school";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = val(f, "scope");
        const amount = val(f, "amount");
        onSubmit({
          name: val(f, "name"), type: val(f, "type") as FundingType, amount: amount ? Number(amount) : null, currency: val(f, "currency") || "USD",
          period: val(f, "period") || null, covers: val(f, "covers") || null, deadlineDate: val(f, "deadline_date") || null, url: val(f, "url") || null,
          status: val(f, "status") as FundingStatus, notes: val(f, "notes") || null,
          departmentId: s.startsWith("d:") ? s.slice(2) : null, professorId: s.startsWith("p:") ? s.slice(2) : null,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *"><input name="name" required defaultValue={initial?.name} placeholder="e.g. Dean's Fellowship, Research Assistantship" className={input} /></Field>
        <Field label="Type">
          <select name="type" defaultValue={initial?.type ?? "assistantship"} className={input}>{FUNDING_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
        </Field>
        <Field label="Applies to">
          <select name="scope" defaultValue={scope} className={input}>
            <option value="school">Whole school</option>
            {departments.length > 0 && <optgroup label="Department">{departments.map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name}</option>)}</optgroup>}
            {professors.length > 0 && <optgroup label="Professor's grant">{professors.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup>}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={initial?.status ?? "to_research"} className={input}>{FUNDING_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </Field>
        <Field label="Amount"><input name="amount" type="number" min="0" step="any" defaultValue={initial?.amount ?? ""} className={input} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency"><input name="currency" defaultValue={initial?.currency ?? "USD"} maxLength={3} className={input} /></Field>
          <Field label="Per">
            <select name="period" defaultValue={initial?.period ?? "year"} className={input}>
              <option value="year">year</option><option value="month">month</option><option value="semester">semester</option><option value="total">total</option>
            </select>
          </Field>
        </div>
        <Field label="Deadline"><input name="deadline_date" type="date" defaultValue={initial?.deadline_date ?? ""} className={input} /></Field>
        <Field label="Link"><input name="url" type="url" defaultValue={initial?.url ?? ""} placeholder="https://" className={input} /></Field>
      </div>
      <Field label="What it covers"><input name="covers" defaultValue={initial?.covers ?? ""} placeholder="Full tuition, health insurance, stipend" className={input} /></Field>
      <Field label="Notes"><textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} className={input} /></Field>
      <Err message={error} />
      <FormActions pending={pending} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}

export function AddFundingButton({ schoolId, departments, professors }: { schoolId: string; departments: Dept[]; professors: Person[] }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useRun();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={btn}>+ Add funding</button>;
  return (
    <div className="rounded-lg border border-blue-200 bg-white p-5">
      <h3 className="mb-3 text-[15px] font-semibold text-slate-900">New funding option</h3>
      <FundingForm departments={departments} professors={professors} pending={pending} error={error} submitLabel="Add funding"
        onCancel={() => setOpen(false)} onSubmit={(f) => run(() => addFunding(schoolId, f), () => setOpen(false))} />
    </div>
  );
}

export function FundingCard({ schoolId, funding, scopeLabel, departments, professors, today }: {
  schoolId: string; funding: FundingRow; scopeLabel: string; departments: Dept[]; professors: Person[]; today?: string;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useRun();
  const status = FUNDING_STATUSES.find((s) => s.key === funding.status)!;
  if (editing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-white p-4 md:col-span-2">
        <FundingForm initial={funding} departments={departments} professors={professors} pending={pending} error={error} submitLabel="Save funding"
          onCancel={() => setEditing(false)} onSubmit={(f) => run(() => updateFunding(funding.id, schoolId, f), () => setEditing(false))} />
      </div>
    );
  }
  const d = funding.deadline_date ? daysUntil(funding.deadline_date, today) : null;
  const covers = (funding.covers ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  return (
    <article className={`flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-[18px] py-4 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <span className={`${pill} bg-blue-50 font-semibold text-blue-700`}>{fundingTypeLabel(funding.type)}</span>
            <span className={`${pill} bg-slate-100 text-slate-600`}>{scopeLabel}</span>
          </div>
          <div className="text-[15px] font-semibold text-slate-900">{funding.name}</div>
        </div>
        {funding.amount != null ? (
          <div className="flex-shrink-0 text-right">
            <div className="text-xl font-semibold tabular-nums text-slate-900">{funding.currency} {Number(funding.amount).toLocaleString()}</div>
            {funding.period && <div className="text-xs text-slate-500">{funding.period === "total" ? "total" : `per ${funding.period}`}</div>}
          </div>
        ) : (
          <span className="flex-shrink-0 text-[13px] text-slate-400">Amount unknown</span>
        )}
      </div>
      {covers.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="What it covers">
          {covers.map((c) => <li key={c} className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{c}</li>)}
        </ul>
      )}
      {funding.notes && <p className="whitespace-pre-line rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{funding.notes}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5 text-xs">
        <select
          value={funding.status}
          disabled={pending}
          onChange={(e) => run(() => setFundingStatus(funding.id, schoolId, e.target.value as FundingStatus))}
          className={`h-7 cursor-pointer rounded-full border px-2 text-xs font-medium disabled:opacity-60 ${status.tone}`}
          aria-label={`Status of ${funding.name}`}
        >
          {FUNDING_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {funding.deadline_date ? (
          <span className={d! < 0 || d! <= 30 ? "font-medium text-red-700" : "text-slate-500"}>Deadline {shortDate(funding.deadline_date)} · {whenLabel(d!)}</span>
        ) : (
          <span className="text-slate-500">No deadline</span>
        )}
        {funding.url && <a href={funding.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:text-blue-700">Details ↗</a>}
        <span className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => setEditing(true)} className={smallAction}>Edit</button>
          <ConfirmRemove label="Remove" question={`Remove ${funding.name}?`} pending={pending} onConfirm={() => run(() => deleteFunding(funding.id, schoolId))} />
        </span>
      </div>
      <Err message={error} />
    </article>
  );
}
