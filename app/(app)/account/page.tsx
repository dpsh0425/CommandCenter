import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "@/components/password-form";
import { OWNER_USER_ID } from "@/lib/owner";
import { DigestControls } from "@/components/digest-controls";
import { emailConfigured } from "@/lib/email";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Account</h1>

      {welcome && (
        <div className="border border-brass bg-brass-soft rounded p-4 text-sm">
          <div className="font-medium text-cream">You're in. Set a password to finish.</div>
          <p className="text-gray-500 mt-1">Choose a password below so you can sign in with your email any time.</p>
        </div>
      )}

      <section className="border rounded p-4 flex flex-col gap-1 text-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">Signed in as</div>
        <div>{user?.email}</div>
        <div className="text-xs text-gray-500">{user?.id === OWNER_USER_ID ? "Owner — full access" : "Collaborator — assigned tasks only"}</div>
      </section>

      {user?.id === OWNER_USER_ID && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Monday email</h2>
            <p className="text-sm text-gray-500">A weekly summary sent to {user?.email}: applications at risk, deadlines, tasks, professors to follow up, and last week&rsquo;s research.</p>
          </div>
          <DigestControls configured={emailConfigured()} />
        </section>
      )}

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
