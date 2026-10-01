"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addLink, deleteLink } from "@/app/(app)/links/actions";
import { deleteProjectDocument, getFileUrl, recordProjectDocument, updateProjectDocument, updateProjectLink } from "@/app/(app)/research/library-actions";
import { FilePreview, LinkPreviewPane } from "@/components/library-preview";
import { LIB_KINDS, guessKind, parseTags } from "@/lib/library";
import { LINK_KINDS, hostOf, timeAgo } from "@/lib/links";
import { formatBytes } from "@/lib/resume";

export type LibItem = {
  id: string; source: "file" | "link"; title: string; kind: string; folder: string | null; tags: string[]; notes: string | null; pinned: boolean; created_at: string;
  file_name?: string; mime_type?: string | null; size_bytes?: number | null; is_current?: boolean; replaces_id?: string | null; version_note?: string | null;
  url?: string; meta?: Record<string, any>;
};

const MAX = 15 * 1024 * 1024;
const kindName = (it: LibItem) =>
  it.source === "file" ? LIB_KINDS.find((k) => k.key === it.kind)?.label ?? it.kind : `Link · ${LINK_KINDS.find((k) => k.key === it.kind)?.label ?? it.kind}`;
const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "h-9 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const ghost = "h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";
const chip = (on: boolean) =>
  `h-8 rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`;

type Sort = "newest" | "oldest" | "name";
type Scope = "all" | "files" | "links" | "pinned";

export function ProjectLibrary({ projectId, userId, items }: { projectId: string; userId: string; items: LibItem[] }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [folder, setFolder] = useState<string>("__all");
  const [tag, setTag] = useState<string>("");
  const [sort, setSort] = useState<Sort>("newest");
  const [showOld, setShowOld] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const visible = useMemo(() => items.filter((i) => showOld || i.source === "link" || i.is_current !== false), [items, showOld]);
  const folders = useMemo(() => {
    const m = new Map<string, number>();
    visible.forEach((i) => { if (i.folder) m.set(i.folder, (m.get(i.folder) ?? 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);
  const tags = useMemo(() => {
    const m = new Map<string, number>();
    visible.forEach((i) => i.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20);
  }, [visible]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = visible.filter((i) => {
      if (scope === "files" && i.source !== "file") return false;
      if (scope === "links" && i.source !== "link") return false;
      if (scope === "pinned" && !i.pinned) return false;
      if (folder === "__none" && i.folder) return false;
      if (folder !== "__all" && folder !== "__none" && i.folder !== folder) return false;
      if (tag && !i.tags.includes(tag)) return false;
      if (q && !`${i.title} ${i.notes ?? ""} ${i.file_name ?? ""} ${i.url ?? ""} ${i.tags.join(" ")} ${i.folder ?? ""} ${kindName(i)}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (sort === "name" ? a.title.localeCompare(b.title) : sort === "oldest" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
  }, [visible, query, scope, folder, tag, sort]);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const fileCount = items.filter((i) => i.source === "file" && i.is_current !== false).length;
  const linkCount = items.filter((i) => i.source === "link").length;
  const bytes = items.reduce((n, i) => n + (i.source === "file" ? i.size_bytes ?? 0 : 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <Adder projectId={projectId} userId={userId} folders={folders.map((f) => f[0])} defaultFolder={folder !== "__all" && folder !== "__none" ? folder : ""} />

      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles, notes, tags, file names…" className={`${field} min-w-[14rem] flex-1`} aria-label="Search the library" />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${field} w-auto`} aria-label="Sort">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-slate-600"><input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Old versions</label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {([["all", `All ${visible.length}`], ["files", `Files ${fileCount}`], ["links", `Links ${linkCount}`], ["pinned", "Pinned"]] as Array<[Scope, string]>).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)} className={chip(scope === k)}>{label}</button>
          ))}
        </div>
        {bytes > 0 && <span className="text-xs tabular-nums text-slate-500">{formatBytes(bytes)} stored</span>}
      </div>

      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.3fr)]" : "lg:grid-cols-[11rem_minmax(0,1fr)]"}`}>
        {/* Folders and tags */}
        <nav className="hidden flex-col gap-5 text-[13px] lg:flex" aria-label="Folders and tags">
          <div className="flex flex-col gap-0.5">
            <h3 className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Folders</h3>
            <RailButton active={folder === "__all"} onClick={() => setFolder("__all")} label="Everything" count={visible.length} />
            <RailButton active={folder === "__none"} onClick={() => setFolder("__none")} label="Unfiled" count={visible.filter((i) => !i.folder).length} />
            {folders.map(([f, n]) => <RailButton key={f} active={folder === f} onClick={() => setFolder(f)} label={f} count={n} />)}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <h3 className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Tags</h3>
              {tag && <button type="button" onClick={() => setTag("")} className="mb-1 px-2 text-left text-xs font-medium text-blue-600 hover:text-blue-700">Clear tag filter</button>}
              {tags.map(([t, n]) => <RailButton key={t} active={tag === t} onClick={() => setTag(tag === t ? "" : t)} label={`#${t}`} count={n} />)}
            </div>
          )}
        </nav>

        <div className="flex min-w-0 flex-col">
          <div className="flex gap-2 pb-3 lg:hidden">
            <select value={folder} onChange={(e) => setFolder(e.target.value)} className={`${field} flex-1`} aria-label="Folder">
              <option value="__all">All folders</option><option value="__none">Unfiled</option>{folders.map(([f]) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className={`${field} flex-1`} aria-label="Tag">
              <option value="">All tags</option>{tags.map(([t]) => <option key={t} value={t}>#{t}</option>)}
            </select>
          </div>
          {shown.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">{items.length === 0 ? "Your library is empty" : "Nothing matches these filters"}</p>
              {items.length === 0 && <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Drop papers, datasets, notebooks and figures above, or paste a GitHub, arXiv or YouTube link.</p>}
            </div>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {shown.map((i) => (
                <li key={i.id} className="border-b border-slate-100 last:border-0">
                  <button type="button" onClick={() => setSelectedId(i.id === selectedId ? null : i.id)} aria-pressed={i.id === selectedId} className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${i.id === selectedId ? "bg-blue-50/60" : ""}`}>
                    <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-semibold uppercase ${i.source === "file" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700"}`} aria-hidden>
                      {i.source === "file" ? (i.file_name?.split(".").pop()?.slice(0, 4) || "file") : "link"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-baseline gap-2">
                        {i.pinned && <span className="text-sm text-blue-600" title="Pinned">★</span>}
                        <span className="break-words text-sm font-semibold text-slate-900">{i.title}</span>
                        {i.is_current === false && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">old version</span>}
                      </span>
                      <span className="truncate text-xs text-slate-500">
                        {[kindName(i), i.source === "file" ? formatBytes(i.size_bytes ?? null) : hostOf(i.url ?? ""), i.folder, timeAgo(i.created_at)].filter(Boolean).join(" · ")}
                      </span>
                      {i.tags.length > 0 && <span className="truncate text-xs text-blue-700">{i.tags.map((t) => `#${t}`).join("  ")}</span>}
                      {i.notes && <span className="line-clamp-1 text-[13px] text-slate-600">{i.notes}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <aside className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] top-0 z-[60] overflow-auto bg-white p-4 lg:static lg:sticky lg:top-20 lg:z-auto lg:max-h-[calc(100vh-6rem)] lg:self-start lg:bg-transparent lg:p-0" aria-label="Preview">
            <Detail key={selected.id} item={selected} all={items} projectId={projectId} userId={userId} folders={folders.map((f) => f[0])} onClose={() => setSelectedId(null)} onSelect={setSelectedId} />
          </aside>
        )}
      </div>
    </div>
  );
}

function RailButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex justify-between gap-2 rounded-md px-2 py-1.5 text-left ${active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
      <span className="truncate">{label}</span><span className="text-xs tabular-nums text-slate-400">{count}</span>
    </button>
  );
}

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => { try { await fn(); after?.(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } });
  };
  return { pending, error, run };
}

// Upload area and link box --------------------------------------------------------------------
async function uploadOne(file: File, userId: string, meta: { projectId: string; folder: string; tags: string[]; kind: string; replacesId?: string | null; title?: string }) {
  if (file.size > MAX) throw new Error(`${file.name} is over 15 MB.`);
  const safe = file.name.replace(/[^\w.\- ]+/g, "_");
  const path = `${userId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await createClient().storage.from("materials").upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return recordProjectDocument({
    projectId: meta.projectId, title: meta.title ?? file.name.replace(/\.[^.]+$/, ""), kind: meta.kind === "auto" ? guessKind(file.name) : meta.kind, storagePath: path,
    fileName: file.name, mimeType: file.type || null, sizeBytes: file.size, folder: meta.folder, tags: meta.tags, replacesId: meta.replacesId ?? null,
  });
}

function Adder({ projectId, userId, folders, defaultFolder }: { projectId: string; userId: string; folders: string[]; defaultFolder: string }) {
  const [folder, setFolder] = useState(defaultFolder);
  const [tagText, setTagText] = useState("");
  const [kind, setKind] = useState("auto");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pending, error: linkError, run } = useRun();

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setErrors([]);
    const errs: string[] = [];
    for (let n = 0; n < list.length; n++) {
      setProgress(`Uploading ${n + 1} of ${list.length}: ${list[n].name}`);
      try { await uploadOne(list[n], userId, { projectId, folder, tags: parseTags(tagText), kind }); } catch (e) { errs.push(e instanceof Error ? e.message : `Could not upload ${list[n].name}`); }
    }
    setProgress(null); setErrors(errs);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-[15px] font-semibold text-slate-900">Add to the library</h2>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${drag ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-slate-50"}`}
      >
        <p className="text-[13px] text-slate-600" role={progress ? "status" : undefined}>{progress ?? "Drop files here to add them to this project"}</p>
        {!progress && <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 text-[13px] font-medium text-blue-600 hover:text-blue-700">or choose files</button>}
        <p className="mt-1 text-[11px] text-slate-400">Up to 15 MB each</p>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} aria-label="Choose files" />
      </div>
      <div className="flex flex-wrap gap-2">
        <input list="lib-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Folder (optional)" className={`${field} max-w-[12rem]`} aria-label="Folder for new items" />
        <datalist id="lib-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Tags, comma separated" className={`${field} max-w-[14rem]`} aria-label="Tags for new items" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${field} max-w-[11rem]`} aria-label="Type of new files">
          <option value="auto">Detect the type</option>{LIB_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const url = String(new FormData(form).get("url") ?? "").trim();
          if (!url) return;
          run(() => addLink({ url, projectId, folder, tags: parseTags(tagText) }), () => form.reset());
        }}
      >
        <input name="url" placeholder="Or paste a link: GitHub repo, arXiv paper, YouTube, dataset, doc…" className={`${field} min-w-0 flex-1`} aria-label="Link URL" />
        <button disabled={pending} className={primary}>{pending ? "Saving…" : "Save link"}</button>
      </form>
      {(linkError || errors.length > 0) && <p role="alert" className="text-xs text-red-700">{[linkError, ...errors].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

// Preview and details ------------------------------------------------------------------------
function Detail({ item, all, projectId, userId, folders, onClose, onSelect }: { item: LibItem; all: LibItem[]; projectId: string; userId: string; folders: string[]; onClose: () => void; onSelect: (id: string) => void }) {
  const { pending, error, run } = useRun();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const versionRef = useRef<HTMLInputElement>(null);
  const isFile = item.source === "file";

  // Older versions of a file point back at it through replaces_id.
  const history: LibItem[] = [];
  if (isFile) {
    let cur: LibItem | undefined = item;
    while (cur?.replaces_id) { const prev: LibItem | undefined = all.find((x) => x.id === cur!.replaces_id); if (!prev) break; history.push(prev); cur = prev; }
  }

  const togglePin = () => run(() => (isFile ? updateProjectDocument(item.id, projectId, { pinned: !item.pinned }) : updateProjectLink(item.id, projectId, { pinned: !item.pinned })));
  const remove = () => {
    setConfirming(false);
    run(async () => { if (isFile) await deleteProjectDocument(item.id, projectId); else await deleteLink(item.id, { projectId }); }, onClose);
  };
  const download = () => run(async () => { window.open(await getFileUrl(item.id, true), "_blank", "noopener"); });

  return (
    <div className="flex flex-col gap-4 lg:max-h-[calc(100vh-3rem)] lg:overflow-auto lg:rounded-lg lg:border lg:border-slate-200 lg:bg-white lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold leading-tight text-slate-900">{item.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {[kindName(item), isFile ? item.file_name : hostOf(item.url ?? ""), isFile ? formatBytes(item.size_bytes ?? null) : null, item.folder ? `in ${item.folder}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" onClick={onClose} className="h-8 w-8 flex-shrink-0 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close preview">✕</button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {isFile
          ? <button type="button" onClick={download} className={primary}>Download</button>
          : <a href={item.url} target="_blank" rel="noopener noreferrer" className={`${primary} inline-flex items-center`}>Open in a new tab ↗</a>}
        <button type="button" onClick={togglePin} className={ghost}>{item.pinned ? "★ Unpin" : "☆ Pin to top"}</button>
        <button type="button" onClick={() => setEditing((v) => !v)} className={ghost}>{editing ? "Close details" : "Edit details"}</button>
        {isFile && <button type="button" onClick={() => versionRef.current?.click()} className={ghost}>Upload a new version</button>}
        {!confirming && <button type="button" onClick={() => setConfirming(true)} className="h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700">Delete</button>}
        <input
          ref={versionRef} type="file" className="hidden" aria-label="New version"
          onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            run(async () => onSelect(await uploadOne(f, userId, { projectId, folder: item.folder ?? "", tags: item.tags, kind: item.kind, replacesId: item.id, title: item.title })));
            e.target.value = "";
          }}
        />
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-800" role="group" aria-label="Confirm delete">
          <span className="min-w-0 flex-1">Delete &ldquo;{item.title}&rdquo;?{isFile ? " The file is removed too." : ""}</span>
          <button type="button" disabled={pending} onClick={remove} className="h-7 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">Delete</button>
          <button type="button" onClick={() => setConfirming(false)} className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white">Keep</button>
        </div>
      )}
      {pending && <p role="status" className="text-xs text-slate-500">Working…</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}

      {editing && (
        <form
          className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
            const patch = { title: v("title"), folder: v("folder") || null, tags: parseTags(v("tags")), notes: v("notes") || null };
            run(() => (isFile ? updateProjectDocument(item.id, projectId, { ...patch, kind: v("kind") }) : updateProjectLink(item.id, projectId, patch)), () => setEditing(false));
          }}
        >
          <input name="title" defaultValue={item.title} required className={`${field} sm:col-span-2`} aria-label="Title" />
          <input name="folder" defaultValue={item.folder ?? ""} list="lib-folders" placeholder="Folder" className={field} aria-label="Folder" />
          <input name="tags" defaultValue={item.tags.join(", ")} placeholder="Tags, comma separated" className={field} aria-label="Tags" />
          {isFile && (
            <select name="kind" defaultValue={item.kind} className={`${field} sm:col-span-2`} aria-label="Type">{LIB_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
          )}
          <textarea name="notes" defaultValue={item.notes ?? ""} rows={4} placeholder="Why this is here, what to look for, how you use it" className={`${field} sm:col-span-2`} aria-label="Notes" />
          <div className="flex gap-2 sm:col-span-2"><button disabled={pending} className={primary}>Save</button><button type="button" onClick={() => setEditing(false)} className={ghost}>Cancel</button></div>
        </form>
      )}
      {!editing && item.notes && <p className="whitespace-pre-line rounded-md bg-slate-50 px-3 py-2 text-[13px] text-slate-700">{item.notes}</p>}
      {!editing && item.tags.length > 0 && <p className="text-xs text-blue-700">{item.tags.map((t) => `#${t}`).join("  ")}</p>}

      <div>{isFile ? <FilePreview id={item.id} fileName={item.file_name ?? item.title} mime={item.mime_type ?? null} /> : <LinkPreviewPane id={item.id} url={item.url ?? ""} meta={item.meta ?? {}} />}</div>

      {history.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-slate-200 pt-3">
          <h4 className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Earlier versions</h4>
          {history.map((h, idx) => (
            <button key={h.id} type="button" onClick={() => onSelect(h.id)} className="rounded-md px-2 py-1 text-left text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900">v{history.length - idx} · {h.file_name} · {timeAgo(h.created_at)}</button>
          ))}
        </div>
      )}
    </div>
  );
}
