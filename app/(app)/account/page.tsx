import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "@/components/password-form";
import { OWNER_USER_ID } from "@/lib/owner";
import { DigestControls } from "@/components/digest-controls";
import { emailConfigured } from "@/lib/email";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Account" };

const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === OWNER_USER_ID;
  const configured = emailConfigured();
  const initial = (user?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-4 p-4 md:p-8">
      <PageHeader eyebrow="Settings" title="Account" />

      {welcome && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-[18px] py-3.5" role="status">
          <p className="text-sm font-semibold text-blue-900">You&apos;re in. Set a password to finish.</p>
          <p className="mt-0.5 text-[13px] text-blue-800">Choose a password below so you can sign in with your email any time.</p>
        </div>
      )}

      <section className={`${card} flex flex-wrap items-center gap-3.5 px-5 py-4`}>
        <span aria-hidden className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-base font-semibold text-white">{initial}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Signed in as</p>
          <p className="truncate text-[15px] font-semibold text-slate-900">{user?.email}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${isOwner ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
          {isOwner ? "Owner · full access" : "Collaborator · assigned tasks only"}
        </span>
      </section>

      {isOwner && (
        <section className={card}>
          <div className={cardHead}>
            <h2 className="text-[15px] font-semibold text-slate-900">Monday email</h2>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${configured ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{configured ? "Sending on" : "Sending off"}</span>
          </div>
          <div className="flex flex-col gap-3 px-5 py-4">
            <p className="text-[13px] text-slate-600">A weekly summary sent to {user?.email}: applications at risk, deadlines, tasks, professors to follow up, and last week&rsquo;s research.</p>
            <DigestControls configured={configured} />
          </div>
        </section>
      )}

      <section className={card}>
        <div className={cardHead}><h2 className="text-[15px] font-semibold text-slate-900">Password</h2></div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-[13px] text-slate-600">Set or change the password used on the sign-in page.</p>
          <PasswordForm />
        </div>
      </section>

      {isOwner && (
        <Link href="/status" className={`${card} flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:border-slate-300`}>
          <span>
            <span className="block text-[15px] font-semibold text-slate-900">Status</span>
            <span className="block text-[13px] text-slate-600">Database connection, settings and your data at a glance.</span>
          </span>
          <span aria-hidden className="text-slate-400">›</span>
        </Link>
      )}
    </main>
  );
}
