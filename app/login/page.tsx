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
      className={`flex-1 py-2 text-xs uppercase tracking-wider font-semibold rounded-md transition-all ${
        mode === m 
          ? "bg-blue-600 text-white shadow-sm" 
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-screen w-full flex bg-slate-50 text-slate-900 font-sans antialiased">
      <div className="flex flex-1 w-full min-h-screen">
        
        {/* LEFT PANEL: White Enterprise Auth Form */}
        <div className="w-full lg:w-[45%] flex flex-col justify-between p-8 sm:p-12 xl:p-16 bg-white border-r border-slate-200">
          
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-sans font-bold text-lg tracking-tight text-slate-900">
              COMMAND<span className="text-blue-600">CENTER</span>
            </span>
          </div>

          {/* Form Container */}
          <div className="my-auto max-w-sm w-full mx-auto py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">Welcome Back</h1>
              <p className="text-sm text-slate-500 mt-2">Sign in to access your grad-school application workspace.</p>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg border border-slate-200 mb-6">
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setMode("reset"); setError(null); setSent(false); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
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
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-slate-400"
                  />
                </div>

                {error && <p className="text-red-600 text-xs font-medium bg-red-50 p-2.5 rounded border border-red-200">{error}</p>}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                >
                  {pending ? "Signing in…" : "Sign In to Workspace"}
                </button>
              </form>
            ) : mode === "reset" ? (
              sent ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                  If <span className="font-semibold text-blue-700">{email}</span> has an account, a reset link is on its way.
                </div>
              ) : (
                <form onSubmit={handleReset} className="flex flex-col gap-4">
                  <p className="text-sm text-slate-600">Enter your email address and we'll send a link to choose a new password.</p>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      autoFocus
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@university.edu"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-slate-400"
                    />
                  </div>
                  {error && <p className="text-red-600 text-xs font-medium bg-red-50 p-2.5 rounded border border-red-200">{error}</p>}
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all disabled:opacity-50"
                  >
                    {pending ? "Sending…" : "Send Reset Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("password"); setError(null); setSent(false); }}
                    className="text-xs text-slate-500 hover:text-slate-800 self-center font-medium mt-1"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              )
            ) : sent ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                Check <span className="font-semibold text-blue-700">{email}</span> for a sign-in magic link.
              </div>
            ) : (
              <form onSubmit={handleMagic} className="flex flex-col gap-4">
                <p className="text-sm text-slate-600">Enter your email address to receive a secure, passwordless magic link.</p>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-slate-400"
                  />
                </div>
                {error && <p className="text-red-600 text-xs font-medium bg-red-50 p-2.5 rounded border border-red-200">{error}</p>}
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Send Magic Link"}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-4">
            <span>© 2026 Command Center</span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-slate-600">Security</a>
              <a href="#" className="hover:text-slate-600">Privacy</a>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Enterprise Blue ERP Feature Showcase */}
        <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-12 xl:p-16 flex-col justify-between relative overflow-hidden text-white">
          
          {/* Subtle Ambient Accent Glows */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Status Indicator */}
          <div className="relative z-10 flex justify-end items-center gap-2 text-xs font-medium text-blue-100/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>System Online · Grad Application Intelligence Engine</span>
          </div>

          {/* Enterprise Showcase Card */}
          <div className="relative z-10 my-auto max-w-lg mx-auto w-full">
            <div className="mb-8">
              <span className="bg-blue-500/30 text-blue-100 border border-blue-400/30 text-xs font-semibold px-3 py-1 rounded-full tracking-wider uppercase">
                Unified Operations
              </span>
              <h2 className="text-3xl font-serif font-bold text-white mt-3 leading-tight">
                Grad-School Application Workspace
              </h2>
              <p className="text-blue-100/80 text-sm mt-2">
                Manage university deadlines, faculty research alignment, and application status tracking in one unified interface.
              </p>
            </div>

            {/* Simulated Live Analytics ERP Card */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                  <span className="text-xs font-mono text-blue-100/70 ml-2">analytics_telemetry.sys</span>
                </div>
                <span className="text-xs bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-medium">
                  Verified Active
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 my-5">
                <div className="bg-slate-900/40 p-3.5 rounded-lg border border-white/10">
                  <span className="text-[10px] uppercase font-semibold text-blue-200/70 tracking-wider">Shortlist</span>
                  <span className="text-lg font-bold text-white block mt-0.5">8 Schools</span>
                  <span className="text-[10px] text-emerald-300 font-medium">NLP Ranked</span>
                </div>
                <div className="bg-slate-900/40 p-3.5 rounded-lg border border-white/10">
                  <span className="text-[10px] uppercase font-semibold text-blue-200/70 tracking-wider">Submissions</span>
                  <span className="text-lg font-bold text-white block mt-0.5">3 Pending</span>
                  <span className="text-[10px] text-amber-300 font-medium">Next in 4d</span>
                </div>
                <div className="bg-slate-900/40 p-3.5 rounded-lg border border-white/10">
                  <span className="text-[10px] uppercase font-semibold text-blue-200/70 tracking-wider">Avg Score</span>
                  <span className="text-lg font-bold text-white block mt-0.5">84.2%</span>
                  <span className="text-[10px] text-blue-200/80 font-medium">Fit Verified</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-blue-100/80 mb-2 font-mono">
                  <span>Application Cycle Pipeline Completion</span>
                  <span>78%</span>
                </div>
                <div className="w-full bg-slate-900/50 h-2 rounded-full overflow-hidden border border-white/10">
                  <div className="bg-gradient-to-r from-blue-300 to-emerald-300 h-full w-[78%]"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Badge */}
          <div className="relative z-10 flex items-center justify-between text-xs text-blue-200/60">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Encrypted Single Sign-On Ready
            </span>
            <span>Enterprise Compliance Grade</span>
          </div>

        </div>

      </div>
    </main>
  );
}