"use client";
import { useState, useTransition } from "react";
import { updateSchoolProfile, type SchoolProfileInput } from "@/app/(app)/schools/[id]/actions";

export type Profile = {
  city: string | null; application_url: string | null; admissions_url: string | null; application_fee: number | null;
  fee_currency: string; fee_waiver: string | null; gre_policy: "required" | "optional" | "not_accepted" | null;
  english_test: string | null; min_gpa: string | null; letters_required: number | null; writing_sample: string | null;
  program_length: string | null; funding_guarantee: string | null; tuition_note: string | null; living_cost_note: string | null;
  acceptance_note: string | null; international_note: string | null; tier: "reach" | "target" | "safe" | null;
  pros: string | null; cons: string | null;
  deadline_date: string | null; deadline_note: string | null; contact_email: string | null; faculty: string | null; fit_note: string | null;
};

const GRE = { required: "Required", optional: "Optional", not_accepted: "Not considered" } as const;
const TIER = {
  reach: { label: "Reach", cls: "bg-red-50 text-red-700" },
  target: { label: "Target", cls: "bg-blue-50 text-blue-700" },
  safe: { label: "Safe", cls: "bg-emerald-50 text-emerald-700" },
} as const;
const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">{label}{children}</label>
);
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const orNull = (s: string) => s || null;
const card = "rounded-lg border border-slate-200 bg-white";
const cardTitle = "border-b border-slate-200 px-5 py-3 text-[15px] font-semibold text-slate-900";

// Every fact this tab tracks, for the "researched" bar.
const FACTS: Array<keyof Profile> = [
  "deadline_date", "contact_email", "application_url", "admissions_url", "application_fee", "fee_waiver", "letters_required",
  "writing_sample", "gre_policy", "english_test", "min_gpa", "city", "program_length", "funding_guarantee", "tuition_note",
  "living_cost_note", "acceptance_note", "international_note", "tier", "pros", "cons",
];

function EditCard({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <fieldset className={card}>
      <legend className="sr-only">{title}</legend>
      <h3 aria-hidden className={cardTitle}>{title}</h3>
      <div className={`grid gap-3 px-5 py-4 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>
    </fieldset>
  );
}

const Unknown = () => <span className="text-slate-400">Not researched</span>;

function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[8.5rem_1fr] px-5 py-1 text-sm">
      {rows.map(([label, value], i) => (
        <div key={label} className="contents">
          <dt className={`py-2 text-slate-500 ${i < rows.length - 1 ? "border-b border-slate-100" : ""}`}>{label}</dt>
          <dd className={`min-w-0 whitespace-pre-line break-words py-2 text-slate-900 ${i < rows.length - 1 ? "border-b border-slate-100" : ""}`}>{value ?? <Unknown />}</dd>
        </div>
      ))}
    </dl>
  );
}

function Requirement({ label, known, children }: { label: string; known: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 border-b border-slate-100 py-2 last:border-0">
      <span
        aria-hidden
        className={`mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[10px] ${
          known ? "bg-blue-600 text-white" : "border-[1.5px] border-dashed border-slate-400"
        }`}
      >
        {known ? "✓" : ""}
      </span>
      <span className="w-28 flex-shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words">{known ? children : <Unknown />}</span>
      <span className="sr-only">{known ? "(researched)" : ""}</span>
    </li>
  );
}

export function AdmissionsPanel({ schoolId, p }: { schoolId: string; p: Profile }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const fee = val(f, "application_fee");
          const letters = val(f, "letters_required");
          const data: SchoolProfileInput = {
            deadlineDate: orNull(val(f, "deadline_date")), deadlineNote: orNull(val(f, "deadline_note")), contactEmail: orNull(val(f, "contact_email")),
            faculty: orNull(val(f, "faculty")), fitNote: orNull(val(f, "fit_note")),
            city: orNull(val(f, "city")), applicationUrl: orNull(val(f, "application_url")), admissionsUrl: orNull(val(f, "admissions_url")),
            applicationFee: fee ? Number(fee) : null, feeCurrency: val(f, "fee_currency") || "USD", feeWaiver: orNull(val(f, "fee_waiver")),
            grePolicy: (orNull(val(f, "gre_policy")) as SchoolProfileInput["grePolicy"]), englishTest: orNull(val(f, "english_test")),
            minGpa: orNull(val(f, "min_gpa")), lettersRequired: letters ? Number(letters) : null, writingSample: orNull(val(f, "writing_sample")),
            programLength: orNull(val(f, "program_length")), fundingGuarantee: orNull(val(f, "funding_guarantee")),
            tuitionNote: orNull(val(f, "tuition_note")), livingCostNote: orNull(val(f, "living_cost_note")),
            acceptanceNote: orNull(val(f, "acceptance_note")), internationalNote: orNull(val(f, "international_note")),
            tier: (orNull(val(f, "tier")) as SchoolProfileInput["tier"]), pros: orNull(val(f, "pros")), cons: orNull(val(f, "cons")),
          };
          setError(null);
          start(async () => {
            try {
              await updateSchoolProfile(schoolId, data);
              setEditing(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save");
            }
          });
        }}
      >
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <EditCard title="Deadline and contact">
            <Field label="Application deadline"><input name="deadline_date" type="date" defaultValue={p.deadline_date ?? ""} className={input} /></Field>
            <Field label="Deadline note"><input name="deadline_note" defaultValue={p.deadline_note ?? ""} placeholder="e.g. 11:59 pm Pacific, rolling" className={input} /></Field>
            <Field label="Contact email"><input name="contact_email" type="email" defaultValue={p.contact_email ?? ""} className={input} /></Field>
            <Field label="Target faculty"><input name="faculty" defaultValue={p.faculty ?? ""} className={input} /></Field>
            <div className="sm:col-span-2"><Field label="Why it's a fit"><textarea name="fit_note" rows={2} defaultValue={p.fit_note ?? ""} className={input} /></Field></div>
          </EditCard>
          <EditCard title="How to apply">
            <Field label="Application portal link"><input name="application_url" type="url" defaultValue={p.application_url ?? ""} placeholder="https://" className={input} /></Field>
            <Field label="Admissions page"><input name="admissions_url" type="url" defaultValue={p.admissions_url ?? ""} placeholder="https://" className={input} /></Field>
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <Field label="Application fee"><input name="application_fee" type="number" min="0" step="any" defaultValue={p.application_fee ?? ""} className={input} /></Field>
              <Field label="Currency"><input name="fee_currency" maxLength={3} defaultValue={p.fee_currency} className={input} /></Field>
            </div>
            <Field label="Fee waiver"><input name="fee_waiver" defaultValue={p.fee_waiver ?? ""} className={input} /></Field>
            <Field label="Letters required"><input name="letters_required" type="number" min="0" max="10" defaultValue={p.letters_required ?? ""} className={input} /></Field>
            <Field label="Writing sample / portfolio"><input name="writing_sample" defaultValue={p.writing_sample ?? ""} className={input} /></Field>
          </EditCard>
          <EditCard title="Requirements">
            <Field label="GRE">
              <select name="gre_policy" defaultValue={p.gre_policy ?? ""} className={input}>
                <option value="">Not researched</option><option value="required">Required</option><option value="optional">Optional</option><option value="not_accepted">Not considered</option>
              </select>
            </Field>
            <Field label="Minimum GPA"><input name="min_gpa" defaultValue={p.min_gpa ?? ""} className={input} /></Field>
            <div className="sm:col-span-2"><Field label="English test"><input name="english_test" defaultValue={p.english_test ?? ""} placeholder="TOEFL 100 / IELTS 7.0, waiver rules" className={input} /></Field></div>
          </EditCard>
          <EditCard title="Program, cost and place">
            <Field label="City / campus"><input name="city" defaultValue={p.city ?? ""} className={input} /></Field>
            <Field label="Program length"><input name="program_length" defaultValue={p.program_length ?? ""} className={input} /></Field>
            <Field label="Funding guarantee"><input name="funding_guarantee" defaultValue={p.funding_guarantee ?? ""} className={input} /></Field>
            <Field label="Tuition"><input name="tuition_note" defaultValue={p.tuition_note ?? ""} className={input} /></Field>
            <div className="sm:col-span-2"><Field label="Cost of living"><input name="living_cost_note" defaultValue={p.living_cost_note ?? ""} className={input} /></Field></div>
          </EditCard>
          <EditCard title="Admissions intel" cols={1}>
            <Field label="Acceptance rate / class size"><textarea name="acceptance_note" rows={2} defaultValue={p.acceptance_note ?? ""} className={input} /></Field>
            <Field label="International students"><textarea name="international_note" rows={2} defaultValue={p.international_note ?? ""} className={input} /></Field>
          </EditCard>
          <EditCard title="Your decision" cols={1}>
            <Field label="Chance">
              <select name="tier" defaultValue={p.tier ?? ""} className={input}>
                <option value="">Not decided</option><option value="reach">Reach</option><option value="target">Target</option><option value="safe">Safe</option>
              </select>
            </Field>
            <Field label="Pros"><textarea name="pros" rows={2} defaultValue={p.pros ?? ""} className={input} /></Field>
            <Field label="Cons and concerns"><textarea name="cons" rows={2} defaultValue={p.cons ?? ""} className={input} /></Field>
          </EditCard>
        </div>
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border md:px-5">
          <button disabled={pending} className="h-9 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">Cancel</button>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        </div>
      </form>
    );
  }

  const deadline = p.deadline_date ? new Date(p.deadline_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const known = FACTS.filter((k) => p[k] != null && p[k] !== "").length;
  const pct = Math.round((known / FACTS.length) * 100);
  const linkBtn = "inline-flex h-9 items-center rounded-md px-3.5 text-[13px] font-medium transition-colors";

  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-4 px-5 py-3.5`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Your chance</span>
            {p.tier ? (
              <span className={`self-start rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${TIER[p.tier].cls}`}>{TIER[p.tier].label}</span>
            ) : (
              <span className="text-[13px] text-slate-400">Not decided yet</span>
            )}
          </div>
          <span aria-hidden className="hidden h-9 w-px bg-slate-200 sm:block" />
          <div className="flex w-56 flex-col gap-1">
            <span className="text-xs text-slate-600">{known} of {FACTS.length} facts researched</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span className={`block h-full rounded-full ${pct >= 70 ? "bg-emerald-600" : "bg-blue-600"}`} style={{ width: `${pct}%` }} />
            </span>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50">
          Edit admissions info
        </button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className={card}>
          <h3 className={cardTitle}>Requirements</h3>
          <ul className="px-5 py-1.5 text-sm">
            <Requirement label="GRE" known={!!p.gre_policy}>
              {p.gre_policy && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{GRE[p.gre_policy]}</span>}
            </Requirement>
            <Requirement label="English test" known={!!p.english_test}>{p.english_test}</Requirement>
            <Requirement label="Minimum GPA" known={!!p.min_gpa}>{p.min_gpa}</Requirement>
            <Requirement label="Letters" known={p.letters_required != null}>{p.letters_required}</Requirement>
            <Requirement label="Writing sample" known={!!p.writing_sample}>{p.writing_sample}</Requirement>
          </ul>
        </section>

        <section className={card}>
          <h3 className={cardTitle}>Deadline, fee and contacts</h3>
          <div className="flex flex-col gap-3 px-5 py-4 text-sm">
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <span className="text-slate-500">Deadline</span>
              {deadline ? <span className="text-right"><span className="font-semibold text-slate-900">{deadline}</span>{p.deadline_note && <span className="text-slate-500"> · {p.deadline_note}</span>}</span> : <Unknown />}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="text-slate-500">Application fee</span>
              <span className="flex flex-wrap items-center justify-end gap-2">
                {p.application_fee != null ? <span className="font-semibold tabular-nums text-slate-900">{p.fee_currency} {Number(p.application_fee).toLocaleString()}</span> : <Unknown />}
                {p.fee_waiver && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Waiver: {p.fee_waiver}</span>}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <span className="text-slate-500">Program contact</span>
              {p.contact_email ? <a href={`mailto:${p.contact_email}`} className="break-all text-blue-600 hover:text-blue-700">{p.contact_email}</a> : <Unknown />}
            </div>
            {(p.application_url || p.admissions_url) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {p.application_url && <a href={p.application_url} target="_blank" rel="noopener noreferrer" className={`${linkBtn} bg-blue-600 font-semibold text-white hover:bg-blue-700`}>Open application portal ↗</a>}
                {p.admissions_url && <a href={p.admissions_url} target="_blank" rel="noopener noreferrer" className={`${linkBtn} border border-slate-300 text-slate-900 hover:bg-slate-50`}>Admissions page ↗</a>}
              </div>
            )}
            {p.fit_note && <p className="rounded-md bg-slate-50 px-3 py-2 text-[13px] text-slate-600"><span className="text-slate-500">Why it fits: </span>{p.fit_note}</p>}
          </div>
        </section>

        <section className={card}>
          <h3 className={cardTitle}>Program, cost and place</h3>
          <Facts rows={[
            ["Location", p.city], ["Program length", p.program_length], ["Funding guarantee", p.funding_guarantee],
            ["Tuition", p.tuition_note], ["Cost of living", p.living_cost_note],
          ]} />
        </section>

        <section className={card}>
          <h3 className={cardTitle}>Admissions intel</h3>
          <Facts rows={[["Acceptance", p.acceptance_note], ["International", p.international_note]]} />
        </section>

        <section className={card}>
          <h3 className="border-b border-slate-200 px-5 py-3 text-[15px] font-semibold text-emerald-700">Pros</h3>
          <p className="whitespace-pre-line px-5 py-3.5 text-sm text-slate-700">{p.pros ?? <span className="text-slate-400">None noted</span>}</p>
        </section>
        <section className={card}>
          <h3 className="border-b border-slate-200 px-5 py-3 text-[15px] font-semibold text-red-700">Cons and concerns</h3>
          <p className="whitespace-pre-line px-5 py-3.5 text-sm text-slate-700">{p.cons ?? <span className="text-slate-400">None noted</span>}</p>
        </section>
      </div>
    </div>
  );
}
