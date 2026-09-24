import { timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OWNER_USER_ID } from "@/lib/owner";
import { buildDigest } from "@/lib/digest";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// GET or POST. A scheduler authenticates with "Authorization: Bearer <CRON_SECRET>";
// otherwise the signed-in owner can use ?preview=1 (see it) or ?dry=1 (see the subject and text).
async function handle(req: Request) {
  const url = new URL(req.url);
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const secret = process.env.CRON_SECRET;

  let supabase;
  let viaSecret = false;
  if (secret && bearer && safeEqual(bearer, secret)) {
    supabase = createAdminClient();
    viaSecret = true;
  } else {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (user?.id !== OWNER_USER_ID) return new Response("Unauthorized", { status: 401 });
    supabase = session;
  }

  const digest = await buildDigest(supabase, process.env.APP_URL || url.origin);
  if (url.searchParams.get("preview")) return new Response(digest.html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  if (url.searchParams.get("dry")) return Response.json({ subject: digest.subject, text: digest.text, sections: digest.sections.length });

  // Send to the owner's address only.
  const { data, error } = await createAdminClient().auth.admin.getUserById(OWNER_USER_ID);
  const to = data?.user?.email;
  if (error || !to) return Response.json({ ok: false, error: "Could not find the owner's email address." }, { status: 500 });
  const result = await sendEmail({ to, subject: digest.subject, html: digest.html, text: digest.text });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 502 });
  return Response.json({ ok: true, id: result.id, to: viaSecret ? undefined : to, subject: digest.subject });
}

export const GET = handle;
export const POST = handle;
