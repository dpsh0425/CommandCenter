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
};

const GRE = { required: "Required", optional: "Optional", not_accepted: "Not accepted" } as const;
const TIER_TONE = { reach: "text-red-600 border-red-600", target: "text-brass border-brass", safe: "text-teal-600 border-teal-600" } as const;
const input = "border rounded px-2 py-1.5 text-sm w-full";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="text-xs text-gray-500 flex flex-col gap-1">{label}{children}</label>
);
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const orNull = (s: string) => s || null;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5 text-sm border-b border-line last:border-0">
      <dt className="text-gray-500 text-xs pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
const Unknown = () => <span className="text-gray-400 italic text-xs">not researched</span>;
const Link_ = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-brass underline">{children}</a>
);

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
          const input: SchoolProfileInput = {
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
              await updateSchoolProfile(schoolId, input);
              setEditing(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save");
            }
          });
        }}
      >
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="text-xs uppercase tracking-wide text-gray-500 mb-1">How to apply</legend>
          <Field label="Application portal link"><input name="application_url" type="url" defaultValue={p.application_url ?? ""} placeholder="https://" className={input} /></Field>
          <Field label="Admissions page"><input name="admissions_url" type="url" defaultValue={p.admissions_url ?? ""} placeholder="https://" className={input} /></Field>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <Field label="Application fee"><input name="application_fee" type="number" min="0" step="any" defaultValue={p.application_fee ?? ""} className={input} /></Field>
            <Field label="Currency"><input name="fee_currency" maxLength={3} defaultValue={p.fee_currency} className={input} /></Field>
          </div>
          <Field label="Fee waiver"><input name="fee_waiver" defaultValue={p.fee_waiver ?? ""} placeholder="e.g. available for international applicants" className={input} /></Field>
          <Field label="Letters required"><input name="letters_required" type="number" min="0" max="10" defaultValue={p.letters_required ?? ""} className={input} /></Field>
          <Field label="Writing sample / portfolio"><input name="writing_sample" defaultValue={p.writing_sample ?? ""} placeholder="e.g. not required" className={input} /></Field>
        </fieldset>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="text-xs uppercase tracking-wide text-gray-500 mb-1">Requirements</legend>
          <Field label="GRE">
            <select name="gre_policy" defaultValue={p.gre_policy ?? ""} className={input}>
              <option value="">Not researched</option><option value="required">Required</option><option value="optional">Optional</option><option value="not_accepted">Not accepted</option>
            </select>
          </Field>
          <Field label="English test minimums"><input name="english_test" defaultValue={p.english_test ?? ""} placeholder="TOEFL 100 / IELTS 7.0, waiver rules" className={input} /></Field>
          <Field label="Minimum GPA"><input name="min_gpa" defaultValue={p.min_gpa ?? ""} placeholder="e.g. 3.0/4.0 or none stated" className={input} /></Field>
        </fieldset>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="text-xs uppercase tracking-wide text-gray-500 mb-1">Program, cost and place</legend>
          <Field label="City / campus"><input name="city" defaultValue={p.city ?? ""} className={input} /></Field>
          <Field label="Program length"><input name="program_length" defaultValue={p.program_length ?? ""} placeholder="e.g. 5 years PhD" className={input} /></Field>
          <Field label="Funding guarantee"><input name="funding_guarantee" defaultValue={p.funding_guarantee ?? ""} placeholder="e.g. 5 years for admitted PhD students" className={input} /></Field>
          <Field label="Tuition"><input name="tuition_note" defaultValue={p.tuition_note ?? ""} className={input} /></Field>
          <Field label="Cost of living"><input name="living_cost_note" defaultValue={p.living_cost_note ?? ""} placeholder="rent, typical monthly cost vs stipend" className={input} /></Field>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="text-xs uppercase tracking-wide text-gray-500 mb-1">Admissions intel</legend>
          <Field label="Acceptance rate / class size"><textarea name="acceptance_note" rows={2} defaultValue={p.acceptance_note ?? ""} className={input} /></Field>
          <Field label="International students (visa support, community, offices)"><textarea name="international_note" rows={2} defaultValue={p.international_note ?? ""} className={input} /></Field>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="text-xs uppercase tracking-wide text-gray-500 mb-1">Your decision</legend>
          <Field label="Chance">
            <select name="tier" defaultValue={p.tier ?? ""} className={input}>
              <option value="">Not decided</option><option value="reach">Reach</option><option value="target">Target</option><option value="safe">Safe</option>
            </select>
          </Field>
          <Field label="Pros"><textarea name="pros" rows={2} defaultValue={p.pros ?? ""} className={input} /></Field>
          <Field label="Cons / concerns"><textarea name="cons" rows={2} defaultValue={p.cons ?? ""} className={input} /></Field>
        </fieldset>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50">{pending ? "Saving…" : "Save admissions info"}</button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500">Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center gap-3">
        {p.tier ? <span className={`border rounded-full px-2.5 py-0.5 text-xs uppercase ${TIER_TONE[p.tier]}`}>{p.tier}</span> : <span className="text-xs text-gray-400 italic">chance not decided</span>}
        <button onClick={() => setEditing(true)} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm">Edit admissions info</button>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">How to apply</h3>
        <dl>
          <Row label="Portal">{p.application_url ? <Link_ href={p.application_url}>Open application</Link_> : <Unknown />}</Row>
          <Row label="Admissions page">{p.admissions_url ? <Link_ href={p.admissions_url}>Open admissions page</Link_> : <Unknown />}</Row>
          <Row label="Application fee">
            {p.application_fee != null ? <span className="font-mono">{p.fee_currency} {Number(p.application_fee).toLocaleString()}{p.fee_waiver && <span className="font-sans text-gray-500"> · {p.fee_waiver}</span>}</span> : p.fee_waiver ?? <Unknown />}
          </Row>
          <Row label="Letters needed">{p.letters_required != null ? p.letters_required : <Unknown />}</Row>
          <Row label="Writing sample">{p.writing_sample ?? <Unknown />}</Row>
        </dl>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Requirements</h3>
        <dl>
          <Row label="GRE">{p.gre_policy ? GRE[p.gre_policy] : <Unknown />}</Row>
          <Row label="English test">{p.english_test ?? <Unknown />}</Row>
          <Row label="Minimum GPA">{p.min_gpa ?? <Unknown />}</Row>
        </dl>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Program, cost and place</h3>
        <dl>
          <Row label="Location">{p.city ?? <Unknown />}</Row>
          <Row label="Program length">{p.program_length ?? <Unknown />}</Row>
          <Row label="Funding guarantee">{p.funding_guarantee ?? <Unknown />}</Row>
          <Row label="Tuition">{p.tuition_note ?? <Unknown />}</Row>
          <Row label="Cost of living">{p.living_cost_note ?? <Unknown />}</Row>
        </dl>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Admissions intel</h3>
        <dl>
          <Row label="Acceptance">{p.acceptance_note ?? <Unknown />}</Row>
          <Row label="International">{p.international_note ?? <Unknown />}</Row>
        </dl>
      </div>

      {(p.pros || p.cons) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-teal-600 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-teal-600 mb-1">Pros</div>
            <p className="text-sm whitespace-pre-line">{p.pros ?? <Unknown />}</p>
          </div>
          <div className="border border-red-600 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-red-600 mb-1">Cons</div>
            <p className="text-sm whitespace-pre-line">{p.cons ?? <Unknown />}</p>
          </div>
        </div>
      )}
    </div>
  );
}
