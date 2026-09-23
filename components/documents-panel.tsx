"use client";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteDocument, getDocumentUrl, recordDocument, updateDocument } from "@/app/(app)/materials/actions";
import { DOC_KINDS, formatBytes } from "@/lib/resume";

export type DocRow = {
  id: string; title: string; kind: string; file_name: string; size_bytes: number | null; version_note: string | null;
  school_id: string | null; is_current: boolean; created_at: string; schoolName?: string;
};

const kindLabel = (k: string) => DOC_KINDS.find((x) => x.key === k)?.label ?? k;
const MAX = 15 * 1024 * 1024;

function DocItem({ d, schools }: { d: DocRow; schools: Array<{ id: string; name: string }> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try { await fn(); after?.(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  };
  const open = () => run(async () => { window.open(await getDocumentUrl(d.id), "_blank", "noopener"); });

  return (
    <li className={`group py-3 border-b border-line/60 last:border-0 flex flex-col gap-1.5 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={open} className="font-medium hover:text-brass text-left break-words">{d.title} <span aria-hidden className="text-gray-400">↗</span></button>
          <div className="text-xs text-gray-400 truncate">
            {[d.file_name, formatBytes(d.size_bytes), new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })].filter(Boolean).join(" · ")}
            {d.schoolName && <span className="text-brass"> · {d.schoolName}</span>}
            {!d.is_current && <span> · older version</span>}
          </div>
        </div>
        <div className="flex gap-3 text-xs text-gray-500 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          <button onClick={() => run(() => updateDocument(d.id, { isCurrent: !d.is_current }))} className="hover:text-cream">{d.is_current ? "Mark old" : "Mark current"}</button>
          <button onClick={() => setEditing((v) => !v)} className="hover:text-cream">Edit</button>
          <button onClick={() => { if (confirm(`Delete "${d.title}"? The file is removed too.`)) run(() => deleteDocument(d.id)); }} className="hover:text-red-600" aria-label="Delete document">✕</button>
        </div>
      </div>
      {d.version_note && !editing && <p className="text-sm text-gray-500 border-l-2 border-line pl-2">{d.version_note}</p>}
      {editing && (
        <form
          className="grid gap-2 sm:grid-cols-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => updateDocument(d.id, {
              title: String(f.get("title") ?? ""), kind: String(f.get("kind") ?? ""), versionNote: String(f.get("note") ?? ""), schoolId: String(f.get("school") ?? "") || null,
            }), () => setEditing(false));
          }}
        >
          <input name="title" defaultValue={d.title} required className="border rounded px-2 py-1.5 text-sm" />
          <select name="kind" defaultValue={d.kind} className="border rounded px-2 py-1.5 text-sm bg-transparent">
            {DOC_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <input name="note" defaultValue={d.version_note ?? ""} placeholder="What's in this version?" className="border rounded px-2 py-1.5 text-sm" />
          <select name="school" defaultValue={d.school_id ?? ""} className="border rounded px-2 py-1.5 text-sm bg-transparent">
            <option value="">Not tied to a school</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500">Cancel</button>
          </div>
        </form>
      )}
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </li>
  );
}

export function DocumentsPanel({ docs, schools, userId }: { docs: DocRow[]; schools: Array<{ id: string; name: string }>; userId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("resume");
  const [filter, setFilter] = useState<string>("all");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Choose a file first."); return; }
    if (file.size > MAX) { setError("That file is over 15 MB."); return; }
    setBusy(true); setError(null);
    try {
      const safe = file.name.replace(/[^\w.\- ]+/g, "_");
      const path = `${userId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await createClient().storage.from("materials").upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error(upErr.message);
      await recordDocument({
        title: String(f.get("title") ?? ""), kind, storagePath: path, fileName: file.name, mimeType: file.type || null, sizeBytes: file.size,
        versionNote: String(f.get("note") ?? ""), schoolId: String(f.get("school") ?? "") || null,
      });
      form.reset(); setKind("resume");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const kinds = Array.from(new Set(docs.map((d) => d.kind)));
  const shown = filter === "all" ? docs : docs.filter((d) => d.kind === filter);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={upload} className="flex flex-col gap-3 border-b border-line pb-6">
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" required aria-label="File" className="text-sm flex-1 min-w-0 file:mr-3 file:rounded file:border file:border-line file:bg-surface-raised file:px-3 file:py-1.5 file:text-cream" />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-transparent" aria-label="Document type">
            {DOC_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input name="title" placeholder="Title (defaults to the file name)" className="border rounded px-2 py-1.5 text-sm" />
          <input name="note" placeholder="What's in this version? (optional)" className="border rounded px-2 py-1.5 text-sm" />
          <select name="school" className="border rounded px-2 py-1.5 text-sm bg-transparent" aria-label="School">
            <option value="">Not tied to a school</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50">{busy ? "Uploading…" : "Upload"}</button>
          <span className="text-xs text-gray-400">PDF, Word, images or text, up to 15 MB. Files are private to you.</span>
          {error && <span className="text-red-600 text-xs">{error}</span>}
        </div>
      </form>

      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-x-5 border-b border-line text-sm -mb-2">
          {["all", ...kinds].map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={`pb-2 border-b-2 -mb-px ${filter === k ? "border-brass text-cream font-medium" : "border-transparent text-gray-500 hover:text-cream"}`}>
              {k === "all" ? `All ${docs.length}` : `${kindLabel(k)} ${docs.filter((d) => d.kind === k).length}`}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-gray-400 py-6">Nothing uploaded yet. Add your resume, transcripts and writing samples here so you can find and reuse them for every application.</p>
      ) : (
        <ul className="flex flex-col">{shown.map((d) => <DocItem key={d.id} d={d} schools={schools} />)}</ul>
      )}
    </div>
  );
}
