"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  deleteDocument,
  getDocumentUrl,
  recordDocument,
  updateDocument,
} from "@/app/(app)/materials/actions";
import { DOC_KINDS, formatBytes } from "@/lib/resume";

export type DocRow = {
  id: string;
  title: string;
  kind: string;
  file_name: string;
  size_bytes: number | null;
  version_note: string | null;
  school_id: string | null;
  is_current: boolean;
  created_at: string;
  schoolName?: string;
};

const kindLabel = (k: string) => DOC_KINDS.find((x) => x.key === k)?.label ?? k;
const MAX = 15 * 1024 * 1024;
const field = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const smallAction = "h-7 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50";
const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE");

function DocItem({
  d,
  schools,
}: {
  d: DocRow;
  schools: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);

  // The document actions refresh /materials; this page lives at /materials/documents, so refresh it here too.
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  const open = () =>
    run(async () => {
      window.open(await getDocumentUrl(d.id), "_blank", "noopener");
    });

  return (
    <li className={`flex flex-col gap-2 border-b border-slate-100 py-3.5 last:border-0 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="flex h-11 w-9 flex-shrink-0 items-end justify-center rounded-md bg-slate-100 pb-1.5 text-[10px] font-semibold text-slate-600">{ext(d.file_name)}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={open} className="break-words text-left text-sm font-semibold text-slate-900 hover:text-blue-700">
              {d.title} <span aria-hidden className="text-xs text-slate-400">↗</span>
            </button>
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">{kindLabel(d.kind)}</span>
            {d.schoolName && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">{d.schoolName}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${d.is_current ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {d.is_current ? "Current" : "Older version"}
            </span>
          </div>
          <span className="truncate text-xs text-slate-500">
            {[d.file_name, formatBytes(d.size_bytes), new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })].filter(Boolean).join(" · ")}
          </span>
          {d.version_note && !editing && <span className="self-start rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">{d.version_note}</span>}
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-0.5">
          <button type="button" disabled={pending} onClick={() => run(() => updateDocument(d.id, { isCurrent: !d.is_current }))} className={smallAction}>
            {d.is_current ? "Mark old" : "Mark current"}
          </button>
          <button type="button" onClick={() => setEditing((v) => !v)} className={smallAction}>{editing ? "Close" : "Edit"}</button>
          {asking ? (
            <span role="group" aria-label={`Delete ${d.title}?`} className="inline-flex items-center gap-1.5 rounded-md bg-red-50 py-0.5 pl-2.5 pr-1 text-xs text-red-800">
              Delete the file too?
              <button type="button" disabled={pending} onClick={() => { setAsking(false); run(() => deleteDocument(d.id)); }} className="h-6 rounded bg-red-600 px-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60">Remove</button>
              <button type="button" onClick={() => setAsking(false)} className="h-6 rounded px-2 font-medium text-slate-700 hover:bg-white">Keep</button>
            </span>
          ) : (
            <button type="button" disabled={pending} onClick={() => setAsking(true)} className={`${smallAction} hover:bg-red-50 hover:text-red-700`}>Delete</button>
          )}
        </div>
      </div>

      {editing && (
        <form
          className="ml-[50px] grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                updateDocument(d.id, {
                  title: String(f.get("title") ?? ""),
                  kind: String(f.get("kind") ?? ""),
                  versionNote: String(f.get("note") ?? ""),
                  schoolId: String(f.get("school") ?? "") || null,
                }),
              () => setEditing(false)
            );
          }}
        >
          <input name="title" defaultValue={d.title} required aria-label="Title" className={field} />
          <select name="kind" defaultValue={d.kind} aria-label="Type" className={field}>
            {DOC_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <input name="note" defaultValue={d.version_note ?? ""} placeholder="What's in this version?" aria-label="Version note" className={field} />
          <select name="school" defaultValue={d.school_id ?? ""} aria-label="School" className={field}>
            <option value="">Not tied to a school</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-2 pt-1 sm:col-span-2">
            <button disabled={pending} className="h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">Cancel</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="ml-[50px] text-xs text-red-700">{error}</p>}
    </li>
  );
}

export function DocumentsPanel({
  docs,
  schools,
  userId,
}: {
  docs: DocRow[];
  schools: Array<{ id: string; name: string }>;
  userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("resume");
  const [filter, setFilter] = useState<string>("all");
  const [drawer, setDrawer] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!drawer) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    if (file.size > MAX) {
      setError("That file is over 15 MB.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const safe = file.name.replace(/[^\w.\- ]+/g, "_");
      const path = `${userId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await createClient()
        .storage.from("materials")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error(upErr.message);
      await recordDocument({
        title: String(f.get("title") ?? ""),
        kind,
        storagePath: path,
        fileName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
        versionNote: String(f.get("note") ?? ""),
        schoolId: String(f.get("school") ?? "") || null,
      });
      form.reset();
      setKind("resume");
      setPicked(null);
      setDrawer(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const kinds = Array.from(new Set(docs.map((d) => d.kind)));
  const shown = filter === "all" ? docs : docs.filter((d) => d.kind === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
          {(kinds.length > 1 ? ["all", ...kinds] : []).map((k) => (
            <button
              key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
              className={`h-8 rounded-full border px-3 text-[13px] font-medium transition-colors ${
                filter === k ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {k === "all" ? `All ${docs.length}` : `${kindLabel(k)} ${docs.filter((d) => d.kind === k).length}`}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { setError(null); setDrawer(true); }} className="h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700">
          + Upload a file
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">Nothing uploaded yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Add your resume, transcripts and writing samples here so you can find and reuse them for every application.</p>
        </div>
      ) : (
        <ul className="rounded-lg border border-slate-200 bg-white px-5">
          {shown.map((d) => <DocItem key={d.id} d={d} schools={schools} />)}
        </ul>
      )}

      {drawer && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="upload-title">
          <button type="button" aria-label="Close" tabIndex={-1} onClick={() => !busy && setDrawer(false)} className="absolute inset-0 h-full w-full cursor-default bg-slate-900/35" />
          <form
            onSubmit={upload}
            onKeyDown={(e) => { if (e.key === "Escape" && !busy) setDrawer(false); }}
            className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 id="upload-title" className="text-[17px] font-semibold text-slate-900">Upload a file</h2>
              <button type="button" aria-label="Close" disabled={busy} onClick={() => setDrawer(false)} className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200">
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-slate-400 bg-slate-50 px-4 py-7 text-center transition-colors hover:border-blue-600 hover:bg-blue-50/40 focus-within:border-blue-600">
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600"><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></svg>
                <span className="text-sm font-semibold text-slate-900">{picked ?? "Choose a file"}</span>
                <span className="text-xs text-slate-500">PDF, Word, images or text, up to 15 MB</span>
                <input
                  ref={fileRef} type="file" required aria-label="File" className="sr-only"
                  onChange={(e) => setPicked(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                Type
                <select value={kind} onChange={(e) => setKind(e.target.value)} className={field} aria-label="Document type">
                  {DOC_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                Title
                <input name="title" placeholder="Defaults to the file name" className={field} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                What&apos;s in this version?
                <input name="note" placeholder="Optional" className={field} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                School
                <select name="school" className={field} aria-label="School">
                  <option value="">Not tied to a school</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-200 px-6 py-4">
              <button disabled={busy} className="h-9 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">{busy ? "Uploading…" : "Upload"}</button>
              <button type="button" disabled={busy} onClick={() => setDrawer(false)} className="h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">Cancel</button>
              <span className="ml-auto text-xs text-slate-500">Private to you</span>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
