"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "magic" | "reset";

/* ── Icons (inline Lucide paths, so this page needs no extra dependency) ── */

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const CommandIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
  </Svg>
);
const EyeIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
const EyeOffIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </Svg>
);
const MailCheckIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    <path d="m16 19 2 2 4-4" />
  </Svg>
);
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </Svg>
);
const AlertCircleIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </Svg>
);
const SpinnerIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </Svg>
);
const GraduationCapIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
    <path d="M22 10v6" />
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
  </Svg>
);
const FileTextIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </Svg>
);
const ListChecksIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m3 17 2 2 4-4" />
    <path d="m3 7 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  </Svg>
);
const GoogleIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

/* ── Shared class strings ── */

const labelClass = "block text-[13px] font-medium text-slate-700";
const inputClass =
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600 sm:text-sm";
const primaryButtonClass =
  "mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70";
const textButtonClass = "text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline";

// Illustration only: placeholder names, never real data.
const SAMPLE_DEADLINES = [
  { name: "University A", date: "Dec 1", status: "SOP ready", highlight: true },
  { name: "University B", date: "Dec 15", status: "Letters 2 / 3", highlight: false },
  { name: "University C", date: "Jan 5", status: "Draft", highlight: false },
];

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setSent(false);
  }

  const renderTab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      aria-pressed={mode === m}
      className={`h-9 rounded-md text-[13px] font-semibold transition-colors ${
        mode === m
          ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );

  const errorBox = error && (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-[13px] leading-5 text-red-700"
    >
      <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  );

  const emailField = (
    <div className="space-y-1.5">
      <label htmlFor="email" className={labelClass}>
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@university.edu"
        className={inputClass}
      />
    </div>
  );

  const submitButton = (idle: string, busy: string) => (
    <button type="submit" disabled={pending} className={primaryButtonClass}>
      {pending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
      {pending ? busy : idle}
    </button>
  );

  const showSentPanel = sent && mode !== "password";

  return (
    <div className="flex min-h-screen min-h-[100dvh] w-full bg-white font-sans text-slate-900 antialiased">
      {/* ── Left: brand, form, footer ── */}
      <div className="flex w-full flex-col justify-between px-6 py-8 sm:px-10 lg:w-[45%] lg:px-14 lg:py-10">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-blue-600 text-white">
            <CommandIcon className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Command Center</span>
        </div>

        <main className="mx-auto w-full max-w-[380px] py-12">
          {showSentPanel ? (
            /* ── Link sent ── */
            <div className="flex flex-col items-start gap-4" aria-live="polite">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <MailCheckIcon className="h-[22px] w-[22px]" />
              </span>
              <h1 className="text-[28px] font-semibold leading-9 tracking-tight">Check your inbox</h1>
              <p className="text-sm leading-[22px] text-slate-600">
                We sent a {mode === "reset" ? "password reset link" : "sign-in link"} to{" "}
                <strong className="font-semibold text-slate-900">{email}</strong>. Click it to finish signing in.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                <button type="button" onClick={() => setSent(false)} className={textButtonClass}>
                  Use a different email
                </button>
                {mode === "reset" && (
                  <button
                    type="button"
                    onClick={() => switchMode("password")}
                    className="text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-900"
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </div>
          ) : mode === "reset" ? (
            /* ── Reset password ── */
            <div>
              <button
                type="button"
                onClick={() => switchMode("password")}
                className="mb-5 flex items-center gap-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to sign in
              </button>
              <h1 className="text-[28px] font-semibold leading-9 tracking-tight">Reset your password</h1>
              <p className="mb-7 mt-2 text-sm leading-[22px] text-slate-600">
                Enter your email and we&apos;ll send you a link to choose a new password.
              </p>
              <form onSubmit={handleReset} className="space-y-4">
                {emailField}
                {errorBox}
                {submitButton("Send reset link", "Sending link…")}
              </form>
            </div>
          ) : (
            /* ── Sign in (password or email link) ── */
            <div>
              <h1 className="text-[28px] font-semibold leading-9 tracking-tight">Sign in</h1>
              <p className="mb-7 mt-2 text-sm leading-[22px] text-slate-600">
                Applications, research and deadlines in one place.
              </p>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-medium tracking-[0.06em] text-slate-500">OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div role="group" aria-label="Sign-in method" className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                {renderTab("password", "Password")}
                {renderTab("magic", "Email link")}
              </div>

              {mode === "password" ? (
                <form onSubmit={handlePassword} className="space-y-4">
                  {emailField}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <label htmlFor="password" className={labelClass}>
                        Password
                      </label>
                      <button type="button" onClick={() => switchMode("reset")} className={textButtonClass}>
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        className={`${inputClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-0.5 top-0.5 flex h-10 w-10 items-center justify-center rounded text-slate-500 transition-colors hover:text-slate-900"
                      >
                        {showPassword ? <EyeOffIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                  </div>
                  {errorBox}
                  {submitButton("Sign in", "Signing in…")}
                </form>
              ) : (
                <form onSubmit={handleMagic} className="space-y-4">
                  {emailField}
                  {errorBox}
                  {submitButton("Email me a sign-in link", "Sending link…")}
                </form>
              )}
            </div>
          )}
        </main>

        <footer className="space-y-1 text-xs leading-[18px] text-slate-500">
          <p>Invite-only workspace. Ask the owner for access.</p>
          <p>© 2026 Command Center</p>
        </footer>
      </div>

      {/* ── Right: brand panel (desktop only) ── */}
      <aside
        className="hidden items-center justify-center bg-blue-600 p-14 text-white lg:flex lg:w-[55%]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="flex w-full max-w-[480px] flex-col gap-8">
          <div className="space-y-3">
            <h2 className="text-[30px] font-semibold leading-[38px] tracking-tight">
              Every application, deadline and draft in one place
            </h2>
            <p className="text-[15px] leading-6 text-blue-50">
              Plan the season, track what each school needs, and see what&apos;s due this week.
            </p>
          </div>

          <figure className="space-y-3.5 rounded-xl border border-white/15 bg-blue-800 p-5">
            <figcaption className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">Next deadlines</span>
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-medium tracking-[0.06em] text-blue-200">
                SAMPLE PREVIEW
              </span>
            </figcaption>
            <ul>
              {SAMPLE_DEADLINES.map((d, i) => (
                <li
                  key={d.name}
                  className={`grid grid-cols-[1fr_72px_110px] items-center py-2.5 text-[13px] ${
                    i < SAMPLE_DEADLINES.length - 1 ? "border-b border-white/15" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-300" />
                    {d.name}
                  </span>
                  <span className="font-mono text-blue-200">{d.date}</span>
                  <span
                    className={`justify-self-end text-xs ${
                      d.highlight ? "rounded-full bg-blue-600 px-2.5 py-0.5 text-white" : "text-blue-200"
                    }`}
                  >
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-blue-200">
                <span>Overall readiness</span>
                <span className="font-mono">70%</span>
              </div>
              <div className="h-1.5 rounded-full bg-blue-950">
                <div className="h-1.5 w-[70%] rounded-full bg-blue-300" />
              </div>
            </div>
          </figure>

          <ul className="space-y-3.5 text-sm">
            <li className="flex items-center gap-3">
              <GraduationCapIcon className="h-5 w-5 text-blue-200" />
              Schools, deadlines and readiness
            </li>
            <li className="flex items-center gap-3">
              <FileTextIcon className="h-5 w-5 text-blue-200" />
              Statements, letters and your resume
            </li>
            <li className="flex items-center gap-3">
              <ListChecksIcon className="h-5 w-5 text-blue-200" />
              Tasks, timeline and a Monday digest email
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
