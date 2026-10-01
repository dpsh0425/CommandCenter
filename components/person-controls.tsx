"use client";
import { useState, useTransition } from "react";
import { addPerson, deletePerson, invitePerson, updatePerson } from "@/app/(app)/people/actions";

export const SWATCHES = ["#2563eb", "#5cae97", "#9f93e0", "#d97e78", "#6f9fd8", "#0891b2", "#4f9d8a", "#b07cc6"];

const input = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "h-9 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const ghost = "h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";
const Err = ({ message }: { message: string | null }) => (message ? <p role="alert" className="text-xs text-red-700">{message}</p> : null);

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Colour">
      <span className="mr-1 text-xs font-medium text-slate-600">Colour</span>
      {SWATCHES.map((c) => (
        <button
          key={c} type="button" role="radio" aria-checked={value === c} aria-label={c}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full ring-offset-2 transition-shadow ${value === c ? "ring-2 ring-slate-900" : "hover:ring-2 hover:ring-slate-300"}`}
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
      <button type="button" onClick={() => setOpen(true)} className={`${primary} self-start`}>
        + Add person
      </button>
    );
  }
  return (
    <form
      className="flex w-full flex-col gap-3 rounded-lg border border-blue-200 bg-white p-5 sm:w-[560px]"
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
      <h2 className="text-[15px] font-semibold text-slate-900">New person</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" placeholder="Name *" required autoFocus aria-label="Name" className={input} />
        <input name="role" placeholder="Role (e.g. co-annotator, recommender)" aria-label="Role" className={input} />
        <input name="area" placeholder="Area (e.g. NLP, ML)" aria-label="Area" className={input} />
        <input name="email" type="email" placeholder="Email (optional)" aria-label="Email" className={input} />
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <Err message={error} />
      <div className="flex gap-2">
        <button disabled={pending} className={primary}>{pending ? "Adding…" : "Add person"}</button>
        <button type="button" onClick={() => setOpen(false)} className={ghost}>Cancel</button>
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
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-8 self-start rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50">
        Edit details
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-white p-5"
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
      <h2 className="text-[15px] font-semibold text-slate-900">Edit details</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" defaultValue={name} required aria-label="Name" className={input} />
        <input name="role" defaultValue={role ?? ""} placeholder="Role" aria-label="Role" className={input} />
        <input name="area" defaultValue={area ?? ""} placeholder="Area" aria-label="Area" className={input} />
        <input name="email" type="email" defaultValue={email ?? ""} placeholder="Email" aria-label="Email" className={input} />
      </div>
      <ColorPicker value={c} onChange={setC} />
      <Err message={error} />
      <div className="flex gap-2">
        <button disabled={pending} className={primary}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className={ghost}>Cancel</button>
      </div>
    </form>
  );
}

export function InviteForm({ personId, defaultEmail }: { personId: string; defaultEmail: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) return <p role="status" className="text-[13px] text-emerald-700">Invite sent. They&apos;ll get an email to set a password and sign in.</p>;
  return (
    <form
      className="flex flex-col gap-2"
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
        <input name="email" type="email" required defaultValue={defaultEmail ?? ""} placeholder="their@email.com" aria-label="Email to invite" className={`${input} min-w-0 flex-1`} />
        <button disabled={pending} className="h-9 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-60">{pending ? "Sending…" : "Send invite"}</button>
      </div>
      <Err message={error} />
    </form>
  );
}

export function DeletePersonButton({ id, name, openTasks }: { id: string; name: string; openTasks: number }) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button" disabled={pending} onClick={() => setAsking(true)}
        className="h-8 rounded-md border border-red-300 bg-white px-3 text-[13px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        Remove permanently
      </button>
    );
  }
  const extra = openTasks > 0 ? ` Their ${openTasks} open task${openTasks === 1 ? "" : "s"} will become Unassigned.` : "";
  return (
    <span role="group" aria-label={`Remove ${name}?`} className="flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
      Permanently remove {name}?{extra}
      <button type="button" disabled={pending} onClick={() => start(() => deletePerson(id))} className="h-7 rounded bg-red-600 px-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
        {pending ? "Removing…" : "Remove"}
      </button>
      <button type="button" disabled={pending} onClick={() => setAsking(false)} className="h-7 rounded px-2.5 font-medium text-slate-700 hover:bg-white">Keep</button>
    </span>
  );
}
