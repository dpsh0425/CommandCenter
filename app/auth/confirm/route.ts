import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

// Invite and password-recovery links land on Account so the user sets a password.
const SET_PASSWORD_TYPES: EmailOtpType[] = ["invite", "recovery"];

// Handles both link styles Supabase can produce:
//  - ?token_hash=...&type=...  (our custom email templates)
//  - ?code=...                 (PKCE redirect from Supabase's built-in verify endpoint)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) redirect(SET_PASSWORD_TYPES.includes(type) ? "/account?welcome=1" : "/");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(searchParams.get("type") === "recovery" ? "/account?welcome=1" : "/");
  }
  redirect("/login?error=invalid_link");
}
