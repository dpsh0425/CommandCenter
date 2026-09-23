"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="border rounded px-3 py-2" required />
      <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className="border rounded px-3 py-2" required />
      {message && <p className={`text-sm ${message.ok ? "text-teal-600" : "text-red-600"}`}>{message.text}</p>}
      <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-2 self-start disabled:opacity-50">
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
