"use client";
import { useState, useTransition } from "react";
import {
  addDepartment, addFunding, addProfessor, deleteDepartment, deleteFunding, deleteProfessor,
  setFundingStatus, setProfessorOutreach, updateDepartment, updateFunding, updateProfessor,
  type AcceptingStatus, type DepartmentInput, type FundingInput, type FundingStatus, type FundingType,
  type OutreachStatus, type ProfessorInput,
} from "@/app/(app)/schools/[id]/faculty-actions";

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

const btn = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";
const input = "border rounded px-2 py-1.5 text-sm w-full";
const Err = ({ message }: { message: string | null }) => (message ? <p className="text-red-600 text-xs">{message}</p> : null);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="text-xs text-gray-500 flex flex-col gap-1">{label}{children}</label>
);
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysUntil = (date: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date(localDate(new Date()) + "T00:00:00").getTime()) / 86400000);
const whenLabel = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d ago` : `in ${d}d`);

type Dept = { id: string; name: string };
type Person = { id: string; name: string };

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
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          name: val(f, "name"), program: val(f, "program") || null, url: val(f, "url") || null, admissionsUrl: val(f, "admissions_url") || null,
          deadlineDate: val(f, "deadline_date") || null, requirements: val(f, "requirements") || null, notes: val(f, "notes") || null,
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Department name *"><input name="name" required defaultValue={initial?.name} placeholder="e.g. Computer Science" className={input} /></Field>
        <Field label="Program"><input name="program" defaultValue={initial?.program ?? ""} placeholder="PhD, MS, PhD/MS…" className={input} /></Field>
        <Field label="Department website"><input name="url" type="url" defaultValue={initial?.url ?? ""} placeholder="https://" className={input} /></Field>
        <Field label="Admissions page"><input name="admissions_url" type="url" defaultValue={initial?.admissions_url ?? ""} placeholder="https://" className={input} /></Field>
        <Field label="Application deadline"><input name="deadline_date" type="date" defaultValue={initial?.deadline_date ?? ""} className={input} /></Field>
      </div>
      <Field label="Requirements"><textarea name="requirements" rows={2} defaultValue={initial?.requirements ?? ""} placeholder="GRE, TOEFL/IELTS minimums, letters, writing sample…" className={input} /></Field>
      <Field label="Notes"><textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} className={input} /></Field>
      <Err message={error} />
      <div className="flex gap-2">
        <button disabled={pending} className={btn}>{pending ? "Saving…" : submitLabel}</button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500">Cancel</button>
      </div>
    </form>
  );
}

export function AddDepartmentButton({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useRun();
  if (!open) return <button onClick={() => setOpen(true)} className="border border-dashed border-line rounded px-3 py-1.5 text-sm text-gray-500 hover:border-brass hover:text-cream self-start">+ Add department</button>;
  return (
    <div className="border border-line bg-surface rounded-lg p-4">
      <DepartmentForm pending={pending} error={error} submitLabel="Add department" onCancel={() => setOpen(false)} onSubmit={(d) => run(() => addDepartment(schoolId, d), () => setOpen(false))} />
    </div>
  );
}

export function DepartmentHeader({ schoolId, dept, professorCount }: { schoolId: string; dept: DepartmentRow; professorCount: number }) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useRun();
  const d = dept.deadline_date ? daysUntil(dept.deadline_date) : null;
  if (editing) {
    return <DepartmentForm initial={dept} pending={pending} error={error} submitLabel="Save department" onCancel={() => setEditing(false)}
      onSubmit={(x) => run(() => updateDepartment(dept.id, schoolId, x), () => setEditing(false))} />;
  }
  const detail = dept.requirements || dept.notes;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-serif text-2xl leading-tight">{dept.name}</h3>
          <p className="text-sm text-gray-500 flex flex-wrap gap-x-2">
            {[dept.program, `${professorCount} professor${professorCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
            {dept.deadline_date && <span className={d! < 0 ? "text-red-600" : "text-brass"}>· deadline {dept.deadline_date} ({whenLabel(d!)})</span>}
          </p>
        </div>
        <div className="flex gap-4 text-sm items-center text-gray-500">
          {dept.url && <a href={dept.url} target="_blank" rel="noopener noreferrer" className="hover:text-brass">Website</a>}
          {dept.admissions_url && <a href={dept.admissions_url} target="_blank" rel="noopener noreferrer" className="hover:text-brass">Admissions</a>}
          <button onClick={() => setEditing(true)} className="hover:text-cream">Edit</button>
          <button
            disabled={pending}
            onClick={() => { if (confirm(`Delete department "${dept.name}"? Its professors and funding stay, moved to school level.`)) run(() => deleteDepartment(dept.id, schoolId)); }}
            className="hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </div>
      {detail && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-cream">Requirements and notes</summary>
          <div className="pt-2 flex flex-col gap-2 text-gray-500">
            {dept.requirements && <p><span className="text-gray-400">Requirements: </span>{dept.requirements}</p>}
            {dept.notes && <p className="whitespace-pre-line text-xs">{dept.notes}</p>}
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
  { key: "not_contacted", label: "Not contacted", tone: "text-gray-500 border-line" },
  { key: "contacted", label: "Contacted", tone: "text-brass border-brass" },
  { key: "replied", label: "Replied", tone: "text-teal-600 border-teal-600" },
  { key: "meeting", label: "Meeting", tone: "text-teal-600 border-teal-600" },
  { key: "no_response", label: "No response", tone: "text-gray-500 border-line" },
  { key: "declined", label: "Declined", tone: "text-red-600 border-red-600" },
];
const ACCEPTING = { unknown: "Openings unknown", yes: "Taking students", no: "Not taking students" } as const;
const ACCEPTING_TONE = { unknown: "text-gray-500 border-line", yes: "text-teal-600 border-teal-600", no: "text-red-600 border-red-600" } as const;

function ProfessorForm({ initial, departments, onSubmit, onCancel, pending, error, submitLabel, defaultDepartmentId }: {
  initial?: ProfessorRow; departments: Dept[]; onSubmit: (p: ProfessorInput) => void; onCancel: () => void;
  pending: boolean; error: string | null; submitLabel: string; defaultDepartmentId?: string | null;
}) {
  return (
    <form
      className="flex flex-col gap-2"
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
      <div className="grid gap-2 sm:grid-cols-2">
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
      <div className="flex gap-2">
        <button disabled={pending} className={btn}>{pending ? "Saving…" : submitLabel}</button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500">Cancel</button>
      </div>
    </form>
  );
}

export function AddProfessorButton({ schoolId, departments, departmentId, label = "+ Add professor" }: {
  schoolId: string; departments: Dept[]; departmentId?: string | null; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useRun();
  if (!open) return <button onClick={() => setOpen(true)} className="border border-dashed border-line rounded px-3 py-1.5 text-sm text-gray-500 hover:border-brass hover:text-cream self-start">{label}</button>;
  return (
    <div className="border border-line bg-surface-raised rounded-lg p-4">
      <ProfessorForm departments={departments} defaultDepartmentId={departmentId} pending={pending} error={error} submitLabel="Add professor"
        onCancel={() => setOpen(false)} onSubmit={(p) => run(() => addProfessor(schoolId, p), () => setOpen(false))} />
    </div>
  );
}

export function ProfessorCard({ schoolId, prof, departments }: { schoolId: string; prof: ProfessorRow; departments: Dept[] }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { pending, error, run } = useRun();
  const outreach = OUTREACH.find((o) => o.key === prof.outreach)!;

  if (editing) {
    return (
      <div className="border border-brass rounded-lg p-4 bg-surface-raised">
        <ProfessorForm initial={prof} departments={departments} pending={pending} error={error} submitLabel="Save professor"
          onCancel={() => setEditing(false)} onSubmit={(p) => run(() => updateProfessor(prof.id, schoolId, p), () => setEditing(false))} />
      </div>
    );
  }
  const long = (prof.research_summary?.length ?? 0) > 150;
  return (
    <div className={`group rounded-xl border border-line bg-surface p-4 flex flex-col gap-2.5 transition-colors hover:border-line/80 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{prof.name}</div>
          {(prof.title || prof.lab_name) && <div className="text-xs text-gray-500">{[prof.title, prof.lab_name].filter(Boolean).join(" · ")}</div>}
        </div>
        <div className="flex items-center gap-2 text-xs flex-shrink-0">
          {prof.fit_score != null && (
            <span className="font-mono text-brass" title={`Fit ${prof.fit_score}/5`} aria-label={`Fit ${prof.fit_score} of 5`}>
              {"●".repeat(prof.fit_score)}<span className="text-line">{"●".repeat(5 - prof.fit_score)}</span>
            </span>
          )}
          {prof.accepting !== "unknown" && <span className={prof.accepting === "yes" ? "text-teal-600" : "text-red-600"}>{ACCEPTING[prof.accepting]}</span>}
        </div>
      </div>

      {prof.research_areas.length > 0 && <p className="text-xs text-brass">{prof.research_areas.join(" · ")}</p>}
      {prof.research_summary && (
        <p className={`text-sm text-gray-500 whitespace-pre-line ${expanded ? "" : "line-clamp-2"}`}>{prof.research_summary}</p>
      )}
      {long && <button onClick={() => setExpanded((v) => !v)} className="text-xs text-gray-500 hover:text-cream self-start">{expanded ? "Show less" : "Read more"}</button>}
      {prof.notes && <p className="text-xs text-gray-400 whitespace-pre-line border-l-2 border-line pl-2">{prof.notes}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs pt-2 border-t border-line/60">
        <select
          value={prof.outreach}
          disabled={pending}
          onChange={(e) => run(() => setProfessorOutreach(prof.id, schoolId, e.target.value as OutreachStatus))}
          className={`rounded-full border px-2 py-0.5 bg-transparent cursor-pointer ${outreach.tone}`}
          aria-label={`Outreach status for ${prof.name}`}
        >
          {OUTREACH.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        {prof.last_contacted_on && <span className="text-gray-400">last {prof.last_contacted_on}</span>}
        {prof.homepage_url && <a href={prof.homepage_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-brass">Homepage</a>}
        {prof.scholar_url && <a href={prof.scholar_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-brass">Papers</a>}
        {prof.email && <a href={`mailto:${prof.email}`} className="text-gray-500 hover:text-brass">Email</a>}
        <span className="ml-auto flex gap-3 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-cream">Edit</button>
          <button
            disabled={pending}
            onClick={() => { if (confirm(`Remove ${prof.name}?`)) run(() => deleteProfessor(prof.id, schoolId)); }}
            className="text-gray-400 hover:text-red-600"
          >
            Remove
          </button>
        </span>
      </div>
      <Err message={error} />
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
  { key: "to_research", label: "To research", tone: "text-gray-500 border-line" }, { key: "eligible", label: "Eligible", tone: "text-brass border-brass" },
  { key: "applied", label: "Applied", tone: "text-brass border-brass" }, { key: "awarded", label: "Awarded", tone: "text-teal-600 border-teal-600" },
  { key: "not_eligible", label: "Not eligible", tone: "text-red-600 border-red-600" },
];
export const fundingTypeLabel = (t: string) => FUNDING_TYPES.find((x) => x.key === t)?.label ?? t;

function FundingForm({ initial, departments, professors, onSubmit, onCancel, pending, error, submitLabel }: {
  initial?: FundingRow; departments: Dept[]; professors: Person[]; onSubmit: (f: FundingInput) => void; onCancel: () => void;
  pending: boolean; error: string | null; submitLabel: string;
}) {
  const scope = initial?.professor_id ? `p:${initial.professor_id}` : initial?.department_id ? `d:${initial.department_id}` : "school";
  return (
    <form
      className="flex flex-col gap-2"
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
      <div className="grid gap-2 sm:grid-cols-2">
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
        <div className="grid grid-cols-2 gap-2">
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
      <div className="flex gap-2">
        <button disabled={pending} className={btn}>{pending ? "Saving…" : submitLabel}</button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500">Cancel</button>
      </div>
    </form>
  );
}

export function AddFundingButton({ schoolId, departments, professors }: { schoolId: string; departments: Dept[]; professors: Person[] }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useRun();
  if (!open) return <button onClick={() => setOpen(true)} className="border border-dashed border-line rounded px-3 py-1.5 text-sm text-gray-500 hover:border-brass hover:text-cream self-start">+ Add funding</button>;
  return (
    <div className="border border-line bg-surface rounded-lg p-4">
      <FundingForm departments={departments} professors={professors} pending={pending} error={error} submitLabel="Add funding"
        onCancel={() => setOpen(false)} onSubmit={(f) => run(() => addFunding(schoolId, f), () => setOpen(false))} />
    </div>
  );
}

export function FundingCard({ schoolId, funding, scopeLabel, departments, professors }: {
  schoolId: string; funding: FundingRow; scopeLabel: string; departments: Dept[]; professors: Person[];
}) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useRun();
  const status = FUNDING_STATUSES.find((s) => s.key === funding.status)!;
  if (editing) {
    return (
      <div className="border border-brass rounded-lg p-4 bg-surface-raised">
        <FundingForm initial={funding} departments={departments} professors={professors} pending={pending} error={error} submitLabel="Save funding"
          onCancel={() => setEditing(false)} onSubmit={(f) => run(() => updateFunding(funding.id, schoolId, f), () => setEditing(false))} />
      </div>
    );
  }
  const d = funding.deadline_date ? daysUntil(funding.deadline_date) : null;
  return (
    <div className={`group rounded-xl border border-line bg-surface p-4 flex flex-col gap-2.5 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{funding.name}</div>
          <div className="text-xs text-gray-500">{fundingTypeLabel(funding.type)} · {scopeLabel}</div>
        </div>
        {funding.amount != null && (
          <div className="text-right flex-shrink-0">
            <div className="font-serif text-2xl leading-none text-brass">{funding.currency} {Number(funding.amount).toLocaleString()}</div>
            {funding.period && <div className="text-xs text-gray-400 mt-1">per {funding.period}</div>}
          </div>
        )}
      </div>
      {funding.covers && <p className="text-sm text-gray-500">{funding.covers}</p>}
      {funding.notes && <p className="text-xs text-gray-400 whitespace-pre-line">{funding.notes}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs pt-2 border-t border-line/60">
        <select
          value={funding.status}
          disabled={pending}
          onChange={(e) => run(() => setFundingStatus(funding.id, schoolId, e.target.value as FundingStatus))}
          className={`rounded-full border px-2 py-0.5 bg-transparent cursor-pointer ${status.tone}`}
          aria-label={`Status of ${funding.name}`}
        >
          {FUNDING_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {funding.deadline_date && <span className={d! < 0 ? "text-red-600" : "text-gray-500"}>deadline {funding.deadline_date} ({whenLabel(d!)})</span>}
        {funding.url && <a href={funding.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-brass">Details ↗</a>}
        <span className="ml-auto flex gap-3 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-cream">Edit</button>
          <button
            disabled={pending}
            onClick={() => { if (confirm(`Remove "${funding.name}"?`)) run(() => deleteFunding(funding.id, schoolId)); }}
            className="text-gray-400 hover:text-red-600"
          >
            Remove
          </button>
        </span>
      </div>
      <Err message={error} />
    </div>
  );
}
