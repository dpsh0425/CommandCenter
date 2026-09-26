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
      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
        mode === m
          ? "bg-white text-slate-900 shadow-sm border border-slate-200/80 font-medium"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-screen w-full flex bg-slate-50 text-slate-900 font-sans antialiased">
      <div className="flex flex-1 w-full min-h-screen">
        {/* LEFT PANEL: Enterprise Auth Form */}
        <div className="w-full lg:w-[45%] flex flex-col justify-between p-8 sm:p-12 xl:p-16 bg-white border-r border-slate-200/80">
          {/* Brand Header */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-sans font-bold text-base tracking-tight text-slate-900">
              COMMAND<span className="text-blue-600">CENTER</span>
            </span>
          </div>

          {/* Form Container */}
          <div className="my-auto max-w-sm w-full mx-auto py-6">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-sans">
                Welcome Back
              </h1>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Sign in to access your application workspace.
              </p>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-lg border border-slate-200/60 mb-6">
              {tab("password", "Password")}
              {tab("magic", "Email Link")}
            </div>

            {/* Password Form */}
            {mode === "password" ? (
              <form onSubmit={handlePassword} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300/80 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError(null);
                        setSent(false);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300/80 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                  />
                </div>

                {error && (
                  <p className="text-red-600 text-xs font-medium bg-red-50 p-3 rounded-lg border border-red-200/80 leading-snug">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-sm rounded-lg shadow-md shadow-blue-600/15 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                >
                  {pending ? "Signing in…" : "Sign In to Workspace"}
                </button>
              </form>
            ) : mode === "reset" ? (
              sent ? (
                <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-lg text-sm text-blue-900 leading-relaxed">
                  If <span className="font-semibold text-blue-700">{email}</span> has an account, a reset link is on its way.
                </div>
              ) : (
                <form onSubmit={handleReset} className="flex flex-col gap-4">
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Enter your email address and we'll send a link to choose a new password.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
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
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300/80 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                    />
                  </div>
                  {error && (
                    <p className="text-red-600 text-xs font-medium bg-red-50 p-3 rounded-lg border border-red-200/80">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-sm rounded-lg shadow-md shadow-blue-600/15 transition-all disabled:opacity-50"
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
                    className="text-xs text-slate-500 hover:text-slate-800 self-center font-medium mt-1 transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              )
            ) : sent ? (
              <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-lg text-sm text-blue-900 leading-relaxed">
                Check <span className="font-semibold text-blue-700">{email}</span> for a sign-in magic link.
              </div>
            ) : (
              <form onSubmit={handleMagic} className="flex flex-col gap-4">
                <p className="text-sm text-slate-500 leading-relaxed">
                  Enter your email address to receive a secure, passwordless magic link.
                </p>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300/80 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                  />
                </div>
                {error && (
                  <p className="text-red-600 text-xs font-medium bg-red-50 p-3 rounded-lg border border-red-200/80">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-sm rounded-lg shadow-md shadow-blue-600/15 transition-all disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Send Magic Link"}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-4">
            <span>© 2026 Command Center</span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-slate-800 transition-colors">
                Security
              </a>
              <a href="#" className="hover:text-slate-800 transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Layered Enterprise Command Graphic */}
        <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-12 xl:p-16 flex-col justify-between relative overflow-hidden text-white">
          {/* Subtle Grid Pattern Overlay */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}
          />

          {/* Glowing Ambient Accents */}
          <div className="absolute top-1/4 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 left-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Status Indicator Bar */}
          <div className="relative z-10 flex justify-end items-center gap-2.5 text-xs font-mono text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>SYSTEM ONLINE</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">v2.4.0-release</span>
          </div>

          {/* Central Feature Section */}
          <div className="relative z-10 my-auto max-w-lg mx-auto w-full">
            <div className="mb-8">
              <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Unified Operations
              </span>
              <h2 className="text-3xl font-bold text-white tracking-tight leading-tight font-sans">
                Grad-School Application Workspace
              </h2>
              <p className="text-slate-400 text-sm mt-2.5 leading-relaxed">
                Manage university deadlines, faculty research alignment, and application status tracking in one high-throughput command dashboard.
              </p>
            </div>

            {/* Glassmorphic Live Telemetry Preview Card */}
            <div className="backdrop-blur-md bg-white/[0.04] border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden">
              {/* Card Header Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                  <span className="text-xs font-mono text-slate-400 ml-2">analytics_telemetry.sys</span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  VERIFIED ACTIVE
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 my-5">
                <div className="bg-slate-900/60 p-3.5 rounded-lg border border-white/5">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                    Shortlist
                  </span>
                  <span className="text-lg font-bold text-white block mt-0.5">8 Schools</span>
                  <span className="text-[10px] text-emerald-400 font-medium mt-1 block">NLP Ranked</span>
                </div>
                <div className="bg-slate-900/60 p-3.5 rounded-lg border border-white/5">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                    Submissions
                  </span>
                  <span className="text-lg font-bold text-white block mt-0.5">3 Pending</span>
                  <span className="text-[10px] text-amber-400 font-medium mt-1 block">Next in 4d</span>
                </div>
                <div className="bg-slate-900/60 p-3.5 rounded-lg border border-white/5">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                    Avg Fit Score
                  </span>
                  <span className="text-lg font-bold text-white block mt-0.5">84.2%</span>
                  <span className="text-[10px] text-blue-400 font-medium mt-1 block">Verified</span>
                </div>
              </div>

              {/* Pipeline Progress Indicator */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-300 font-mono">
                  <span>Application Pipeline Status</span>
                  <span className="text-blue-400 font-bold">78% Complete</span>
                </div>
                <div className="w-full bg-slate-900/80 h-2 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500 w-[78%]" />
                </div>
              </div>
            </div>
          </div>

          {/* Panel Footer */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              ENCRYPTED SINGLE SIGN-ON
            </span>
            <span>SOC2 TYPE II CERTIFIED</span>
          </div>
        </div>
      </div>
    </main>
  );
}