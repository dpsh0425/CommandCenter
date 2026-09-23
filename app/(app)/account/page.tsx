import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "@/components/password-form";
import { OWNER_USER_ID } from "@/lib/owner";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Account</h1>

      <section className="border rounded p-4 flex flex-col gap-1 text-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">Signed in as</div>
        <div>{user?.email}</div>
        <div className="text-xs text-gray-500">{user?.id === OWNER_USER_ID ? "Owner — full access" : "Collaborator — assigned tasks only"}</div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Password</h2>
          <p className="text-sm text-gray-500">Set or change the password used on the sign-in page.</p>
        </div>
        <PasswordForm />
      </section>
    </main>
  );
}
