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
    if (msg.includes("signups not allowed"))
      return "That email hasn't been invited. Ask the owner to invite you first.";
    if (msg.includes("rate limit") || status === 429)
      return "Too many sign-in emails sent recently. Wait a few minutes, or sign in with your password.";
    if (msg.includes("invalid login"))
      return "Wrong email or password. If you haven't set a password yet, use the email link and set one under Account.";
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

  const renderTab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
        setSent(false);
      }}
      className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all duration-200 ${
        mode === m
          ? "bg-[#1A1A1A] text-white shadow-sm"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#FBFBFB] text-slate-900 font-sans antialiased flex flex-col justify-between p-6 sm:p-10 lg:p-12">
      
      {/* Brand Header */}
      <header className="flex items-center justify-between max-w-7xl w-full mx-auto">
        <h1 className="font-serif italic text-xl tracking-tight text-slate-900 font-medium">
          Command Center
        </h1>
        <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
          v2.0 · Admissions Intelligence
        </span>
      </header>

      {/* Main Form Container */}
      <main className="w-full max-w-md mx-auto my-auto space-y-6 py-10">
        
        {/* Header Text */}
        <div className="space-y-2 text-center">
          <p className="text-[11px] font-mono uppercase tracking-widest text-amber-700 font-semibold">
            Authentication
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl text-slate-900 tracking-tight font-normal">
            Welcome back.
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Sign in to access your graduate research application timeline, faculty fit scores, and critical path milestones.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
          {renderTab("password", "Password")}
          {renderTab("magic", "Email Link")}
        </div>

        {/* Form Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
          {mode === "password" ? (
            /* PASSWORD MODE */
            <form onSubmit={handlePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="applicant@university.edu"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setSent(false);
                    }}
                    className="text-[11px] text-amber-700 hover:underline font-medium"
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium leading-snug">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full py-3 bg-[#1A1A1A] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50"
              >
                {pending ? "Authenticating…" : "Sign in to Command Center →"}
              </button>
            </form>
          ) : mode === "reset" ? (
            /* RESET MODE */
            sent ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed font-mono">
                Password recovery link dispatched. Please check <span className="font-bold">{email}</span>.
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your corporate or university email address to receive password reset instructions.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="applicant@university.edu"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-3 bg-[#1A1A1A] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm disabled:opacity-50"
                >
                  {pending ? "Sending Link…" : "Send Recovery Link"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setError(null);
                    setSent(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 block mx-auto pt-2 transition-colors font-medium"
                >
                  ← Return to Sign In
                </button>
              </form>
            )
          ) : (
            /* MAGIC LINK MODE */
            sent ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed font-mono">
                Check <span className="font-bold">{email}</span> for your magic sign-in link.
              </div>
            ) : (
              <form onSubmit={handleMagic} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your email address to receive a secure, passwordless authentication link.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="applicant@university.edu"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-3 bg-[#1A1A1A] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm disabled:opacity-50"
                >
                  {pending ? "Sending Link…" : "Send Magic Link"}
                </button>
              </form>
            )
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          Need access?{" "}
          <a href="#request" className="text-slate-800 font-medium hover:underline">
            Request an invite
          </a>
        </p>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center md:text-left text-[11px] text-slate-400 font-mono">
        © 2026 Command Center · All rights reserved.
      </footer>
    </div>
  );
}