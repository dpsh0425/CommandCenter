"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) return <p className="p-8">Check your email for a sign-in link.</p>;

  return (
    <form onSubmit={handleSubmit} className="p-8 max-w-sm mx-auto flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="border rounded px-3 py-2"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-brass text-ink font-medium rounded px-3 py-2">
        Send magic link
      </button>
    </form>
  );
}
