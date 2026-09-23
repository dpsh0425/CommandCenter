"use client";
import { useState } from "react";
import { deletePerson, invitePerson } from "@/app/(app)/people/actions";

type Person = {
  id: string;
  name: string;
  role: string | null;
  area: string | null;
  color: string;
  openTaskCount: number;
  authUserId: string | null;
};

export function PersonCard({ person, canInvite }: { person: Person; canInvite: boolean }) {
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Permanently remove ${person.name}? Their tasks will fall back to Unassigned. This cannot be undone.`)) return;
    deletePerson(person.id);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await invitePerson(person.id, email);
      setInviting(false);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to invite");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border rounded p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: person.color }}>
          {person.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </span>
        <div>
          <div className="font-medium text-sm">{person.name}</div>
          <div className="text-xs text-gray-500">{person.role}</div>
        </div>
      </div>
      <div className="text-xs text-gray-500">{person.openTaskCount} open task{person.openTaskCount === 1 ? "" : "s"}</div>

      {person.authUserId ? (
        <span className="text-xs text-teal-600 border border-teal-600 rounded px-2 py-1 self-start">Account linked</span>
      ) : !canInvite ? null : inviting ? (
        <form onSubmit={handleInvite} className="flex flex-col gap-1">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com"
            className="border rounded px-2 py-1 text-sm"
          />
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="bg-brass text-ink font-medium rounded px-2 py-1 text-xs disabled:opacity-50">
              {pending ? "Sending…" : "Send invite"}
            </button>
            <button type="button" onClick={() => { setInviting(false); setError(null); }} className="text-xs text-gray-500 px-2 py-1">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setInviting(true)} className="text-xs text-brass border border-brass rounded px-2 py-1 self-start">
          Invite to log in
        </button>
      )}

      {canInvite && (
        <button onClick={handleDelete} className="text-xs text-red-600 border border-red-600 rounded px-2 py-1 self-start">Remove permanently</button>
      )}
    </div>
  );
}
