"use client";

import { useRef, useState, useTransition } from "react";
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

function DocItem({
  d,
  schools,
}: {
  d: DocRow;
  schools: Array<{ id: string; name: string }>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        after?.();
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
    <li
      className={`group py-3.5 border-b border-slate-200 last:border-0 flex flex-col gap-2 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={open}
            className="font-medium text-slate-900 hover:text-blue-600 text-left break-words transition-colors flex items-center gap-1"
          >
            <span>{d.title}</span>
            <span aria-hidden className="text-slate-400 text-xs">
              ↗
            </span>
          </button>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            {[
              d.file_name,
              formatBytes(d.size_bytes),
              new Date(d.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            ]
              .filter(Boolean)
              .join(" · ")}
            {d.schoolName && (
              <span className="text-slate-700 font-medium"> · {d.schoolName}</span>
            )}
            {!d.is_current && (
              <span className="text-slate-500 font-medium"> · older version</span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-3 text-xs text-slate-500 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          <button
            onClick={() =>
              run(() => updateDocument(d.id, { isCurrent: !d.is_current }))
            }
            className="hover:text-slate-900 font-medium transition-colors"
          >
            {d.is_current ? "Mark old" : "Mark current"}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="hover:text-slate-900 font-medium transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (
                confirm(`Delete "${d.title}"? The file will be removed too.`)
              )
                run(() => deleteDocument(d.id));
            }}
            className="hover:text-rose-600 font-bold transition-colors"
            aria-label="Delete document"
          >
            ✕
          </button>
        </div>
      </div>

      {d.version_note && !editing && (
        <p className="text-xs text-slate-600 border-l-2 border-slate-300 pl-2 mt-0.5">
          {d.version_note}
        </p>
      )}

      {/* Edit Form Drawer */}
      {editing && (
        <form
          className="grid gap-2 sm:grid-cols-2 pt-2 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1"
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
          <input
            name="title"
            defaultValue={d.title}
            required
            className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="kind"
            defaultValue={d.kind}
            className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            {DOC_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            name="note"
            defaultValue={d.version_note ?? ""}
            placeholder="What's in this version?"
            className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="school"
            defaultValue={d.school_id ?? ""}
            className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Not tied to a school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2 sm:col-span-2 pt-1">
            <button
              disabled={pending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const kinds = Array.from(new Set(docs.map((d) => d.kind)));
  const shown = filter === "all" ? docs : docs.filter((d) => d.kind === filter);

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Document Upload Form */}
      <form
        onSubmit={upload}
        className="flex flex-col gap-3 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs"
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            ref={fileRef}
            type="file"
            required
            aria-label="File"
            className="text-xs text-slate-700 flex-1 min-w-0 border border-slate-300 rounded-lg p-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:text-white file:px-3 file:py-1 file:text-xs file:font-semibold hover:file:bg-slate-800 file:cursor-pointer"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="border border-slate-300 bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 sm:w-48"
            aria-label="Document type"
          >
            {DOC_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <input
            name="title"
            placeholder="Title (defaults to file name)"
            className="border border-slate-300 bg-white rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <input
            name="note"
            placeholder="What's in this version? (optional)"
            className="border border-slate-300 bg-white rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="school"
            className="border border-slate-300 bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            aria-label="School"
          >
            <option value="">Not tied to a school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-slate-400">
            PDF, Word, images or text, up to 15 MB. Files are private to you.
          </span>
          <div className="flex items-center gap-3">
            {error && <span className="text-rose-600 text-xs font-medium">{error}</span>}
            <button
              disabled={busy}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-5 py-2 text-xs transition-all shadow-2xs disabled:opacity-50 whitespace-nowrap"
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </form>

      {/* Category Filter Pills */}
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-x-5 border-b border-slate-200 text-xs font-medium -mb-2">
          {["all", ...kinds].map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`pb-2.5 border-b-2 transition-colors -mb-px ${
                filter === k
                  ? "border-blue-600 text-slate-900 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {k === "all"
                ? `All ${docs.length}`
                : `${kindLabel(k)} ${docs.filter((d) => d.kind === k).length}`}
            </button>
          ))}
        </div>
      )}

      {/* Document Listing */}
      {shown.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-300 rounded-xl bg-white">
          Nothing uploaded yet. Add your resume, transcripts and writing samples here so you can find and reuse them for every application.
        </p>
      ) : (
        <ul className="flex flex-col border border-slate-200 bg-white rounded-xl px-4 py-1 shadow-2xs divide-y divide-slate-100">
          {shown.map((d) => (
            <DocItem key={d.id} d={d} schools={schools} />
          ))}
        </ul>
      )}
    </div>
  );
}