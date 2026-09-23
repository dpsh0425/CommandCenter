import { NavShell } from "@/components/nav-shell";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <NavShell isOwner={user?.id === OWNER_USER_ID}>{children}</NavShell>;
}
