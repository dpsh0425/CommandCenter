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
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-screen min-h-[100dvh] w-full flex flex-col lg:flex-row bg-white font-sans antialiased">
      {/* =========================================================================
          LEFT COLUMN: Auth Form (Full Width on Mobile/Tab, 45% on Desktop)
         ========================================================================= */}
      <section className="w-full lg:w-[45%] min-h-screen min-h-[100dvh] flex flex-col justify-between p-6 sm:p-10 lg:p-16 border-r border-slate-200 bg-white z-10">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900">
            COMMAND<span className="text-blue-600">CENTER</span>
          </span>
        </div>

        {/* Central Form Wrapper */}
        <div className="my-auto py-10 max-w-sm sm:max-w-md w-full mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Please enter your enterprise credentials to access your command workspace.
            </p>
          </div>

          {/* Segmented Mode Selector */}
          <div className="flex p-1 bg-slate-100/80 rounded-lg border border-slate-200 mb-6">
            {renderTab("password", "Password")}
            {renderTab("magic", "Email Link")}
          </div>

          {/* PASSWORD MODE */}
          {mode === "password" ? (
            <form onSubmit={handlePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Corporate Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all shadow-sm"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setSent(false);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors"
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all shadow-sm"
                />
              </div>

              {error && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium leading-snug">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-lg shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
              >
                {pending ? "Authenticating…" : "Sign In to Workspace"}
              </button>
            </form>
          ) : mode === "reset" ? (
            /* RESET MODE */
            sent ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 leading-relaxed">
                Password recovery link dispatched. Please check <span className="font-semibold text-blue-950">{email}</span>.
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your email address to receive password reset instructions.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all shadow-sm"
                  />
                </div>

                {error && (
                  <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {pending ? "Sending Link…" : "Send Reset Link"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setError(null);
                    setSent(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 block mx-auto pt-2 transition-colors font-semibold"
                >
                  ← Return to Sign In
                </button>
              </form>
            )
          ) : (
            /* MAGIC LINK MODE */
            sent ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 leading-relaxed">
                Check <span className="font-semibold text-blue-950">{email}</span> for your magic sign-in link.
              </div>
            ) : (
              <form onSubmit={handleMagic} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your email address to receive a secure passwordless login link.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all shadow-sm"
                  />
                </div>

                {error && (
                  <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {pending ? "Sending Link…" : "Send Magic Link"}
                </button>
              </form>
            )
          )}
        </div>

        {/* Minimal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 pt-6 border-t border-slate-100 gap-2 sm:gap-0">
          <span>© 2026 Command Center</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-600 transition-colors">Security</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          RIGHT COLUMN: Hero Telemetry Showcase (55% Desktop, Hidden on Mobile)
         ========================================================================= */}
      <section className="hidden lg:flex lg:w-[55%] min-h-screen min-h-[100dvh] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-950 p-12 lg:p-16 flex-col justify-between relative overflow-hidden text-white">
        
        {/* Decorative Background Glows */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Indicator */}
        <div className="relative z-10 flex justify-between items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs text-blue-100 font-medium shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            System Online · Grad Application Intelligence Engine
          </div>
          <span className="text-xs font-mono text-blue-200/80 tracking-wider">v4.12.0</span>
        </div>

        {/* Glassmorphic Telemetry Card */}
        <div className="relative z-10 my-auto py-8 max-w-xl w-full">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-8 shadow-2xl shadow-blue-950/40 space-y-6">
            
            {/* Header */}
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-blue-200 block mb-1">
                ENTERPRISE METRIC STREAM
              </span>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Real-Time Application Telemetry
              </h2>
            </div>

            {/* Metrics Tiles */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950/40 border border-white/10 rounded-xl p-4 backdrop-blur-md">
                <span className="text-xs text-slate-300 font-medium block">Shortlist</span>
                <span className="text-lg font-bold text-white mt-1 block tracking-tight">8 Schools</span>
              </div>
              <div className="bg-slate-950/40 border border-white/10 rounded-xl p-4 backdrop-blur-md">
                <span className="text-xs text-slate-300 font-medium block">Submissions</span>
                <span className="text-lg font-bold text-amber-300 mt-1 block tracking-tight">3 Pending</span>
              </div>
              <div className="bg-slate-950/40 border border-white/10 rounded-xl p-4 backdrop-blur-md">
                <span className="text-xs text-slate-300 font-medium block">Avg Score</span>
                <span className="text-lg font-bold text-emerald-300 mt-1 block tracking-tight">84.2%</span>
              </div>
            </div>

            {/* Pipeline Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs text-blue-100 font-medium">
                <span>Application Cycle Pipeline Completion</span>
                <span className="font-bold text-white">78%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-950/50 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-blue-300 via-teal-300 to-emerald-300 rounded-full transition-all duration-500 shadow-sm" 
                  style={{ width: "78%" }} 
                />
              </div>
            </div>

          </div>
        </div>

        {/* Footer Badges */}
        <div className="relative z-10 flex items-center justify-between text-xs text-blue-200/80 pt-6 border-t border-white/10 font-medium">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>SOC2 Type II Certified</span>
          </div>
          <span>SSO / SAML 2.0 Ready</span>
        </div>

      </section>
    </main>
  );
}