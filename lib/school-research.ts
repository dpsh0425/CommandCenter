export type GapTab = "admissions" | "funding" | "faculty";
export type Gap = { text: string; tab: GapTab };

type ProfLite = { accepting: string; outreach: string };

const TRACKED = 13;

// What an applicant still doesn't know about a school. Each gap says where to fill it in.
export function researchGaps(s: any, departmentCount: number, professors: ProfLite[], fundingCount: number, departmentDeadlines = 0) {
  const gaps: Gap[] = [];
  const openingsUnknown = professors.filter((p) => p.accepting === "unknown").length;
  const contacted = professors.filter((p) => p.outreach !== "not_contacted").length;

  if (!s.deadline_date && departmentDeadlines === 0) gaps.push({ text: "Application deadline", tab: "admissions" });
  if (!s.gre_policy) gaps.push({ text: "GRE policy", tab: "admissions" });
  if (!s.english_test) gaps.push({ text: "English test requirement", tab: "admissions" });
  if (s.letters_required == null) gaps.push({ text: "How many letters are required", tab: "admissions" });
  if (s.application_fee == null && !s.fee_waiver) gaps.push({ text: "Application fee and waiver", tab: "admissions" });
  if (!s.application_url) gaps.push({ text: "Application portal link", tab: "admissions" });
  if (!s.funding_guarantee && fundingCount === 0) gaps.push({ text: "Whether funding is guaranteed", tab: "funding" });
  if (fundingCount === 0) gaps.push({ text: "Funding options (assistantships, fellowships)", tab: "funding" });
  if (!s.living_cost_note && !s.city) gaps.push({ text: "Location and cost of living", tab: "admissions" });
  if (departmentCount === 0) gaps.push({ text: "Which department(s) your research fits", tab: "faculty" });
  if (professors.length === 0) gaps.push({ text: "Professors whose work matches yours", tab: "faculty" });
  if (openingsUnknown > 0) gaps.push({ text: `${openingsUnknown} professor${openingsUnknown === 1 ? "" : "s"}: are they taking students?`, tab: "faculty" });
  if (professors.length > 0 && contacted === 0) gaps.push({ text: "You haven't contacted any professor yet", tab: "faculty" });
  if (!s.tier) gaps.push({ text: "Your chance call (reach / target / safe)", tab: "admissions" });

  const completeness = Math.max(0, Math.round(((TRACKED - Math.min(gaps.length, TRACKED)) / TRACKED) * 100));
  return { gaps, completeness };
}
