"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "magic";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function friendly(message: string, status?: number) {
    const msg = message.toLowerCase();
    if (msg.includes("signups not allowed")) return "That email hasn't been invited. Ask the owner to invite you first.";
    if (msg.includes("rate limit") || status === 429) return "Too many sign-in emails sent recently. Wait a few minutes, or sign in with your password.";
    if (msg.includes("invalid login")) return "Wrong email or password. If you haven't set a password yet, use the email link and set one under Account.";
    return message;
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setPending(false);
      setError(friendly(error.message, error.status));
      return;
    }
    window.location.href = "/";
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm`, shouldCreateUser: false },
    });
    setPending(false);
    if (error) setError(friendly(error.message, error.status));
    else setSent(true);
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => { setMode(m); setError(null); setSent(false); }}
      className={`flex-1 py-1.5 text-sm rounded ${mode === m ? "bg-surface-raised text-cream font-medium" : "text-gray-500 hover:text-cream"}`}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm border border-line bg-surface rounded-lg p-8 flex flex-col gap-5">
        <div>
          <div className="font-serif text-3xl italic">Command Center</div>
          <p className="text-sm text-gray-500 mt-1">Your grad-school application workspace.</p>
        </div>

        <div className="flex gap-1 border border-line rounded p-1">
          {tab("password", "Password")}
          {tab("magic", "Email link")}
        </div>

        {mode === "password" ? (
          <form onSubmit={handlePassword} className="flex flex-col gap-3">
            <input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border rounded px-3 py-2" />
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="border rounded px-3 py-2" />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-2 disabled:opacity-50">
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : sent ? (
          <p className="text-sm">Check <span className="text-brass">{email}</span> for a sign-in link.</p>
        ) : (
          <form onSubmit={handleMagic} className="flex flex-col gap-3">
            <input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border rounded px-3 py-2" />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-2 disabled:opacity-50">
              {pending ? "Sending…" : "Email me a sign-in link"}
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
