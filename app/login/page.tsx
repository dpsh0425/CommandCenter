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

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
        setSent(false);
      }}
      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
        mode === m
          ? "bg-slate-800/90 text-white shadow-lg shadow-black/20 border border-slate-700/60"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 font-sans antialiased relative overflow-hidden selection:bg-blue-500/30 selection:text-blue-200">
      {/* Background Glows & Depth Grids */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[125px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[125px] pointer-events-none" />

      {/* Main Glassmorphic Wrapper */}
      <div className="relative z-10 w-full max-w-5xl mx-4 my-8 grid grid-cols-1 lg:grid-cols-12 backdrop-blur-2xl bg-slate-900/60 border border-slate-800/80 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden">
        
        {/* LEFT PANEL: Glass Auth Card Form */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/60 bg-slate-900/40">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 border border-blue-400/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-base tracking-tight text-white">
              COMMAND<span className="text-blue-400">CENTER</span>
            </span>
          </div>

          {/* Core Content Form */}
          <div className="my-auto py-8 max-w-md w-full mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Enter your credentials to access your centralized command dashboard.
              </p>
            </div>

            {/* Tactile Mode Switcher */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-800/80 mb-6 shadow-inner">
              {tab("password", "Password")}
              {tab("magic", "Email Link")}
            </div>

            {/* Password Form */}
            {mode === "password" ? (
              <form onSubmit={handlePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError(null);
                        setSent(false);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                  />
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium leading-snug">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 border border-blue-400/20 transition-all disabled:opacity-50"
                >
                  {pending ? "Signing in…" : "Sign In to Workspace"}
                </button>
              </form>
            ) : mode === "reset" ? (
              sent ? (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-200 leading-relaxed">
                  If <span className="font-semibold text-white">{email}</span> has an account, a reset link is on its way.
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Enter your email address and we'll send a link to reset your password.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@university.edu"
                      className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                    />
                  </div>
                  {error && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50"
                  >
                    {pending ? "Sending…" : "Send Reset Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("password");
                      setError(null);
                      setSent(false);
                    }}
                    className="text-xs text-slate-400 hover:text-white block mx-auto pt-2 transition-colors font-medium"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              )
            ) : sent ? (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-200 leading-relaxed">
                Check <span className="font-semibold text-white">{email}</span> for a sign-in magic link.
              </div>
            ) : (
              <form onSubmit={handleMagic} className="space-y-4">
                <p className="text-sm text-slate-400 leading-relaxed">
                  Enter your email address to receive a passwordless magic link.
                </p>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                  />
                </div>
                {error && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Send Magic Link"}
                </button>
              </form>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-6 border-t border-slate-800/60">
            <span>© 2026 Command Center</span>
            <span className="font-mono text-[11px] text-slate-400">Encrypted SSO</span>
          </div>
        </div>

        {/* RIGHT PANEL: Live Telemetry & Glass Display */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between bg-slate-950/50 relative overflow-hidden">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              SYSTEM ACTIVE
            </span>
            <span>v2.4.0</span>
          </div>

          <div className="my-auto py-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 mb-4">
              Unified Workspace
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Application Pipeline Overview
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Track deadlines, faculty outreach, and milestone telemetry in real time.
            </p>

            {/* Frosted Telemetry Widget */}
            <div className="mt-6 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-2xl space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Shortlist</span>
                  <span className="text-base font-bold text-white mt-0.5 block">8 Schools</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Submissions</span>
                  <span className="text-base font-bold text-amber-400 mt-0.5 block">3 Pending</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Fit Score</span>
                  <span className="text-base font-bold text-emerald-400 mt-0.5 block">84.2%</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>Overall Readiness</span>
                  <span className="text-blue-400 font-bold">78%</span>
                </div>
                <div className="h-2 w-full bg-slate-950/80 rounded-full overflow-hidden border border-slate-800/60 p-0.5">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full w-[78%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            SOC2 TYPE II CERTIFIED • END-TO-END ENCRYPTED
          </div>
        </div>

      </div>
    </main>
  );
}