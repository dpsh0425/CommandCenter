"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { buildDigest } from "@/lib/digest";
import { sendEmail } from "@/lib/email";

// Sends the digest to the signed-in owner right now, so the layout and content can be checked.
export async function sendDigestNow(): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID || !user.email) return { ok: false, message: "Only the workspace owner can send the digest." };
  const digest = await buildDigest(supabase, process.env.APP_URL || "");
  const result = await sendEmail({ to: user.email, subject: digest.subject, html: digest.html, text: digest.text });
  return result.ok ? { ok: true, message: `Sent to ${user.email}.` } : { ok: false, message: result.error };
}
