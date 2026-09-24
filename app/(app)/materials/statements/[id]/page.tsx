import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { StatementEditor, type EditorSnapshot, type EditorStatement } from "@/components/statement-editor";

export const metadata = { title: "Statement" };

export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, { data: statement }, { data: snapshots }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("statements").select("id, kind, title, prompt, word_limit, body, status, sent_on, school_id").eq("id", id).single(),
    supabase.from("statement_snapshots").select("id, body, words, note, created_at").eq("statement_id", id).order("created_at", { ascending: false }),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Statements are only available to the workspace owner.</main>;
  }
  if (!statement) return <main className="p-4 md:p-8 max-w-3xl mx-auto text-sm text-gray-500">Statement not found.</main>;
  let schoolName: string | null = null;
  if (statement.school_id) {
    const { data: school } = await supabase.from("schools").select("name").eq("id", statement.school_id).single();
    schoolName = school?.name ?? null;
  }
  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto">
      <StatementEditor statement={{ ...(statement as Omit<EditorStatement, "schoolName">), schoolName }} snapshots={(snapshots ?? []) as EditorSnapshot[]} />
    </main>
  );
}
