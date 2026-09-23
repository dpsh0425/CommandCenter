import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OWNER_USER_ID } from "@/lib/owner";
import { NextResponse } from "next/server";

// Development-only shortcut around email delivery/rate limits. Signs in as the
// owner by minting a magic-link token with the service role. Returns 404 in
// any non-development build so it can never exist in production.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const { data: owner, error: lookupError } = await admin.auth.admin.getUserById(OWNER_USER_ID);
  if (lookupError || !owner.user?.email) {
    return new NextResponse("Owner lookup failed", { status: 500 });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: owner.user.email,
  });
  if (linkError || !link.properties?.hashed_token) {
    return new NextResponse("Could not mint sign-in token", { status: 500 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.redirect(new URL("/", request.url));
}
