"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm`, shouldCreateUser: false },
    });
    setPending(false);
    if (error) {
      const msg = error.message.toLowerCase();
      setError(
        msg.includes("signups not allowed")
          ? "That email hasn't been invited. Ask the owner to invite you first."
          : msg.includes("rate limit") || error.status === 429
          ? "Too many sign-in emails sent recently. Wait a few minutes and try again."
          : error.message
      );
    } else setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm border border-line bg-surface rounded-lg p-8 flex flex-col gap-5">
        <div>
          <div className="font-serif text-3xl italic">Command Center</div>
          <p className="text-sm text-gray-500 mt-1">Your grad-school application workspace.</p>
        </div>

        {sent ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">Check <span className="text-brass">{email}</span> for a sign-in link.</p>
            <button onClick={() => setSent(false)} className="text-xs text-gray-500 underline self-start">
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="border rounded px-3 py-2"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-2 disabled:opacity-50">
              {pending ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}

        {process.env.NODE_ENV === "development" && (
          <a href="/auth/dev-login" className="text-xs text-gray-500 border border-dashed border-line rounded px-3 py-2 text-center hover:border-brass">
            Dev: sign in as owner (skips email)
          </a>
        )}
      </div>
    </main>
  );
}
