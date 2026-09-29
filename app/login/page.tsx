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

  async function handleGoogleLogin() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (error) setError(friendly(error.message));
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
      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
        mode === m
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#F3F4F6] font-sans antialiased flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Floating Panjaya-Style Card Container */}
      <div className="w-full max-w-[1000px] min-h-[620px] bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col md:flex-row my-auto">
        
        {/* Left Column: Form Section */}
        <div className="w-full md:w-[48%] bg-white p-8 sm:p-12 flex flex-col justify-between">
          <div>
            <div className="mb-6">
              <h1 
                style={{ fontFamily: "Inter, system-ui, sans-serif" }}
                className="text-2xl font-bold text-slate-900 tracking-tight"
              >
                Sign in to your account
              </h1>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-3">
                Welcome back. Sign in to access your graduate research application timeline, faculty fit scores, and critical path milestones.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Need access?{" "}
                <a href="#request" className="text-[#6D28D9] font-medium hover:underline">
                  Request an invite
                </a>
              </p>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-11 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg flex items-center justify-center gap-2.5 transition-all shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Continue with Google
            </button>

            {/* Visual Divider */}
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                or
              </span>
            </div>

            {/* Tab Switcher for Password / Magic Link */}
            <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200/80 mb-4">
              {renderTab("password", "Password")}
              {renderTab("magic", "Email Link")}
            </div>

            {/* Dynamic Form Modes */}
            {mode === "password" ? (
              <form onSubmit={handlePassword} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 block">
                    Work email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/15 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-600 block">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError(null);
                        setSent(false);
                      }}
                      className="text-[11px] text-[#6D28D9] hover:underline font-medium"
                    >
                      Forgot?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/15 transition-all"
                  />
                </div>

                {error && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full h-11 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-lg text-xs font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 disabled:opacity-70"
                >
                  {pending ? "Signing in…" : "Sign in to Command Center"}
                </button>
              </form>
            ) : mode === "reset" ? (
              sent ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 leading-relaxed font-mono">
                  Recovery link sent to <span className="font-bold">{email}</span>.
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 block">
                      Work email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/15 transition-all"
                    />
                  </div>

                  {error && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full h-11 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-70"
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
                    className="text-xs text-slate-500 hover:text-slate-900 block mx-auto pt-1 font-medium"
                  >
                    ← Back to password sign in
                  </button>
                </form>
              )
            ) : (
              sent ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 leading-relaxed font-mono">
                  Magic link sent to <span className="font-bold">{email}</span>.
                </div>
              ) : (
                <form onSubmit={handleMagic} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 block">
                      Work email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/15 transition-all"
                    />
                  </div>

                  {error && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full h-11 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-70"
                  >
                    {pending ? "Sending Link…" : "Send code"}
                  </button>
                </form>
              )
            )}
          </div>

          <footer className="text-[11px] text-slate-400 font-mono mt-6">
            © 2026 Command Center
          </footer>
        </div>

        {/* Right Column: Panjaya Dark Gradient Promo Panel */}
        <div className="hidden md:flex w-[52%] bg-gradient-to-br from-[#171B36] to-[#2B2F5C] p-10 flex-col justify-center text-white relative">
          <div className="max-w-[380px] mx-auto space-y-6">
            <div>
              <h2 
                style={{ fontFamily: "Inter, system-ui, sans-serif" }}
                className="text-2xl font-bold leading-tight tracking-tight text-white"
              >
                Your grad school pipeline, on one timeline
              </h2>
              <p className="text-xs text-white/70 mt-2 leading-relaxed">
                Track deadlines, faculty fit, and milestones in one place.
              </p>
            </div>

            {/* Feature Bullets */}
            <ul className="space-y-3.5 text-xs text-white/90">
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] mt-1.5 shrink-0 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                <span>Application timeline with critical-path milestone tracking</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] mt-1.5 shrink-0 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                <span>Faculty fit scores matched to your research profile</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] mt-1.5 shrink-0 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                <span>Deadline alerts before they become emergencies</span>
              </li>
            </ul>

            {/* Testimonial Card */}
            <div className="bg-white/[0.06] border border-white/10 rounded-xl p-5 backdrop-blur-sm mt-8">
              <div className="text-[#FBBF24] text-xs tracking-widest mb-2">
                ★★★★★
              </div>
              <p className="text-xs italic text-white/85 leading-relaxed">
                "This tool turned a chaotic application season into a clear, sequenced plan."
              </p>
              <p className="text-[11px] font-semibold text-white mt-3">
                — Maya R., Accepted at Stanford PhD
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}