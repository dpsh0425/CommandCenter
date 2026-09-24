import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { sanitizeHtml } from "@/lib/rich-text-server";
import { toEditorHtml } from "@/lib/rich-text";
import { buildDocx } from "@/lib/statement-docx";
import { contentDisposition, exportFileName } from "@/lib/statements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = () => new Response("Not found", { status: 404 });

// Owner only. Anyone else, signed in or not, gets the same 404 so the route reveals nothing.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) return NOT_FOUND();
  const { data: st } = await supabase.from("statements").select("title, body, school_id").eq("id", id).single();
  if (!st) return NOT_FOUND();
  let schoolName: string | null = null;
  if (st.school_id) {
    const { data: school } = await supabase.from("schools").select("name").eq("id", st.school_id).single();
    schoolName = school?.name ?? null;
  }
  const buf = await buildDocx(sanitizeHtml(toEditorHtml(st.body)), { title: st.title });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": contentDisposition(exportFileName(st.title, schoolName, "docx")),
      "Cache-Control": "no-store",
    },
  });
}
