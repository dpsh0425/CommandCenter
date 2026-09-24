import { createAdminClient } from "@/lib/supabase/admin";
import { REQUIRED_ENV, missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

// Liveness for the host and monitors. Reveals only two booleans, never names, keys or error text.
export async function GET() {
  if (missingEnv(REQUIRED_ENV).length > 0) return Response.json({ ok: false, db: false }, { status: 503 });
  try {
    const { error } = await createAdminClient().from("schools").select("id").limit(1);
    const db = !error;
    return Response.json({ ok: db, db }, { status: db ? 200 : 503 });
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
