"use client";
import { useState, useTransition } from "react";
import { addPerson, deletePerson, invitePerson, updatePerson } from "@/app/(app)/people/actions";

export const SWATCHES = ["#c98a3e", "#5cae97", "#9f93e0", "#d97e78", "#6f9fd8", "#d99456", "#4f9d8a", "#b07cc6"];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 items-center" role="radiogroup" aria-label="Colour">
      {SWATCHES.map((c) => (
        <button
          key={c} type="button" role="radio" aria-checked={value === c} aria-label={c}
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full border-2 ${value === c ? "border-cream" : "border-transparent"}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function AddPersonForm() {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(SWATCHES[0]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm self-start">
        + Add person
      </button>
    );
  }
  return (
    <form
      className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const name = String(f.get("name") ?? "").trim();
        if (!name) return;
        setError(null);
        start(async () => {
          try {
            await addPerson({
              name, color,
              role: String(f.get("role") ?? "").trim() || undefined,
              area: String(f.get("area") ?? "").trim() || undefined,
              email: String(f.get("email") ?? "").trim() || undefined,
            });
            setOpen(false);
          } catch (err) {
            setError(messageOf(err, "Could not add person"));
          }
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" placeholder="Name *" required autoFocus className="border rounded px-2 py-1.5 text-sm" />
        <input name="role" placeholder="Role (e.g. co-annotator, recommender)" className="border rounded px-2 py-1.5 text-sm" />
        <input name="area" placeholder="Area (e.g. NLP, ML)" className="border rounded px-2 py-1.5 text-sm" />
        <input name="email" type="email" placeholder="Email (optional)" className="border rounded px-2 py-1.5 text-sm" />
      </div>
      <ColorPicker value={color} onChange={setColor} />
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50">{pending ? "Adding…" : "Add person"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">Cancel</button>
      </div>
    </form>
  );
}

export function EditPersonForm({
  id, name, role, area, email, color,
}: { id: string; name: string; role: string | null; area: string | null; email: string | null; color: string }) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState(color);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-xs text-gray-500 underline self-start hover:text-cream">Edit details</button>;
  }
  return (
    <form
      className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const newName = String(f.get("name") ?? "").trim();
        if (!newName) return;
        setError(null);
        start(async () => {
          try {
            await updatePerson(id, {
              name: newName, color: c,
              role: String(f.get("role") ?? "").trim() || null,
              area: String(f.get("area") ?? "").trim() || null,
              email: String(f.get("email") ?? "").trim() || null,
            });
            setOpen(false);
          } catch (err) {
            setError(messageOf(err, "Could not save"));
          }
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" defaultValue={name} required className="border rounded px-2 py-1.5 text-sm" />
        <input name="role" defaultValue={role ?? ""} placeholder="Role" className="border rounded px-2 py-1.5 text-sm" />
        <input name="area" defaultValue={area ?? ""} placeholder="Area" className="border rounded px-2 py-1.5 text-sm" />
        <input name="email" type="email" defaultValue={email ?? ""} placeholder="Email" className="border rounded px-2 py-1.5 text-sm" />
      </div>
      <ColorPicker value={c} onChange={setC} />
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">Cancel</button>
      </div>
    </form>
  );
}

export function InviteForm({ personId, defaultEmail }: { personId: string; defaultEmail: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) return <p className="text-sm text-teal-600">Invite sent. They'll get an email to set a password and sign in.</p>;
  return (
    <form
      className="flex flex-col gap-2 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
        if (!email) return;
        setError(null);
        start(async () => {
          try {
            await invitePerson(personId, email);
            setSent(true);
          } catch (err) {
            const m = messageOf(err, "Could not send invite");
            setError(m.toLowerCase().includes("rate limit") ? "Too many emails sent recently. Wait a few minutes and try again." : m);
          }
        });
      }}
    >
      <div className="flex gap-2">
        <input name="email" type="email" required defaultValue={defaultEmail ?? ""} placeholder="their@email.com" className="border rounded px-2 py-1.5 text-sm flex-1 min-w-0" />
        <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50 whitespace-nowrap">{pending ? "Sending…" : "Send invite"}</button>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </form>
  );
}

export function DeletePersonButton({ id, name, openTasks }: { id: string; name: string; openTasks: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        const extra = openTasks > 0 ? ` Their ${openTasks} open task${openTasks === 1 ? "" : "s"} will become Unassigned.` : "";
        if (!confirm(`Permanently remove ${name}?${extra} This cannot be undone.`)) return;
        start(() => deletePerson(id));
      }}
      className="text-xs text-red-600 border border-red-600 rounded px-2 py-1 self-start disabled:opacity-50"
    >
      Remove permanently
    </button>
  );
}
