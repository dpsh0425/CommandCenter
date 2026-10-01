"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const input = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password.length < 8) return setMessage({ ok: false, text: "Use at least 8 characters." });
    if (password !== confirm) return setMessage({ ok: false, text: "Passwords don't match." });
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setPassword("");
    setConfirm("");
    setMessage({ ok: true, text: "Password saved. You can now sign in with email and password." });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        New password
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className={input} required />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Confirm new password
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={input} required />
      </label>
      <p className="text-xs text-slate-500">At least 8 characters.</p>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>}
      <button disabled={pending} className="h-9 self-start rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
