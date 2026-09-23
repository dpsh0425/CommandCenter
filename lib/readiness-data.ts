import type { SupabaseClient } from "@supabase/supabase-js";
import { assess, buildItems, RISK_ORDER, type ReadinessSchool } from "@/lib/readiness";

// One call that returns every school you are applying to, with checklist state and risk.
export async function loadReadiness(supabase: SupabaseClient, today: string) {
  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, deadline_date, status, gre_policy, english_test, letters_required, sop_version_id")
    .eq("applying", true);
  const list = (schools ?? []) as ReadinessSchool[];
  if (list.length === 0) return [];
  const ids = list.map((s) => s.id);
  const [{ data: letters }, { data: checks }] = await Promise.all([
    supabase.from("letter_requests").select("school_id, status").in("school_id", ids),
    supabase.from("application_checks").select("school_id, item, done").in("school_id", ids),
  ]);
  return list
    .map((s) => {
      const ls = ((letters ?? []) as any[]).filter((l) => l.school_id === s.id);
      const cs: Record<string, boolean> = {};
      ((checks ?? []) as any[]).filter((c) => c.school_id === s.id).forEach((c) => { cs[c.item] = c.done; });
      const items = buildItems(s, ls, cs);
      return { school: s, items, ...assess(s, items, today) };
    })
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || (a.school.deadline_date ?? "9999").localeCompare(b.school.deadline_date ?? "9999"));
}
