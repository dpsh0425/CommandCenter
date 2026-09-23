"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "magic" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "invalid_link") {
      setError("That link is invalid or has expired. Request a new one below.");
    }
  }, []);

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

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    });
    setPending(false);
    if (error) setError(friendly(error.message, error.status));
    else setSent(true);
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
            <button type="button" onClick={() => { setMode("reset"); setError(null); setSent(false); }} className="text-xs text-gray-500 hover:text-cream self-center">
              Forgot password?
            </button>
          </form>
        ) : mode === "reset" ? (
          sent ? (
            <p className="text-sm">If <span className="text-brass">{email}</span> has an account, a reset link is on its way.</p>
          ) : (
            <form onSubmit={handleReset} className="flex flex-col gap-3">
              <p className="text-sm text-gray-500">Enter your email and we'll send a link to choose a new password.</p>
              <input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border rounded px-3 py-2" />
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button type="submit" disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-2 disabled:opacity-50">
                {pending ? "Sending…" : "Send reset link"}
              </button>
              <button type="button" onClick={() => { setMode("password"); setError(null); setSent(false); }} className="text-xs text-gray-500 hover:text-cream self-center">
                Back to sign in
              </button>
            </form>
          )
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

      </div>
    </main>
  );
}
