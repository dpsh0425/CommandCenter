import { createClient } from "@/lib/supabase/server";
import { DashboardAnalytics } from "@/components/dashboard-analytics";

export const metadata = { title: "Dashboard · Command Center" };

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch schools and professors from Supabase
  const [{ data: schools }, { data: professors }] = await Promise.all([
    supabase.from("schools").select("*"),
    supabase.from("professors").select("school_id, name"),
  ]);

  // Map database records to the telemetry format expected by DashboardAnalytics
  const formattedSchools = (schools ?? []).map((s: any) => {
    const prof = (professors ?? []).find((p: any) => p.school_id === s.id);
    return {
      id: String(s.id),
      name: s.name || "Unknown School",
      program: s.program || "Graduate Program",
      country: s.country || "US",
      status: s.status || "Shortlisted",
      fitScore: s.composite_score ?? 75,
      deadlineDays: s.days_left ?? 60,
      verifiedFit: Boolean(s.verified_fit),
      professor: prof?.name || s.faculty || "Unassigned",
    };
  });

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Command Center
        </h1>
        <p className="text-xs text-slate-500">
          Real-time graduate application trajectory and execution telemetry.
        </p>
      </div>

      <DashboardAnalytics initialSchools={formattedSchools} />
    </main>
  );
}