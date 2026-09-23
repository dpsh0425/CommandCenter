import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ResearchPage() {
  const supabase = await createClient();
  const { data: milestones } = await supabase.from("research_milestones").select("*").order("target_date");
  return (
    <main className="p-8 max-w-2xl mx-auto flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">The Broken Ruler</h1>
      <p className="text-sm text-gray-500">Nepali benchmark measurement-error study — Week 1 foundation milestones.</p>
      {(milestones ?? []).map((m) => (
        <Link key={m.id} href={`/research/${m.id}`} className="border rounded p-3 hover:border-black">
          <div className="flex justify-between">
            <span className="font-medium">{m.title}</span>
            <span className="text-xs uppercase text-gray-500">{m.status.replace("_", " ")}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{m.description}</p>
        </Link>
      ))}
    </main>
  );
}
