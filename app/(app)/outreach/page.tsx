import { createClient } from "@/lib/supabase/server";
import { OutreachBoard, OutreachProf } from "@/components/outreach-board";

export default async function OutreachPage() {
  const supabase = await createClient();

  const { data: professors, error } = await supabase
    .from("professors")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching professors:", error);
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Faculty Outreach Tracking
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor initial contacts, follow-ups, and scheduled meetings across target programs.
        </p>
      </div>

      <OutreachBoard professors={(professors as OutreachProf[]) || []} />
    </main>
  );
}