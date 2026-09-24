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
const field = "border rounded px-2 py-1.5 text-sm w-full";
const primary = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";

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
    <div className="flex flex-col gap-6">
      <Adder projectId={projectId} userId={userId} folders={folders.map((f) => f[0])} defaultFolder={folder !== "__all" && folder !== "__none" ? folder : ""} />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles, notes, tags, file names…" className="border rounded px-3 py-1.5 flex-1 min-w-[14rem]" aria-label="Search the library" />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="border rounded px-2 py-1.5 bg-transparent" aria-label="Sort">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name</option>
        </select>
        <label className="flex items-center gap-1.5 text-gray-500 cursor-pointer"><input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} /> Old versions</label>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line -mt-3">
        <div className="flex gap-5 text-sm">
          {([["all", `All ${visible.length}`], ["files", `Files ${fileCount}`], ["links", `Links ${linkCount}`], ["pinned", "Pinned"]] as Array<[Scope, string]>).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)} className={`pb-2 border-b-2 -mb-px ${scope === k ? "border-brass text-cream font-medium" : "border-transparent text-gray-500 hover:text-cream"}`}>{label}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400 pb-2">{bytes ? `${formatBytes(bytes)} stored` : ""}</span>
      </div>

      <div className={`grid gap-6 ${selected ? "lg:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.3fr)]" : "lg:grid-cols-[11rem_minmax(0,1fr)]"}`}>
        {/* Folders and tags */}
        <nav className="hidden lg:flex flex-col gap-5 text-sm" aria-label="Folders and tags">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-sans text-xs font-semibold text-gray-400 mb-1">Folders</h3>
            <RailButton active={folder === "__all"} onClick={() => setFolder("__all")} label="Everything" count={visible.length} />
            <RailButton active={folder === "__none"} onClick={() => setFolder("__none")} label="Unfiled" count={visible.filter((i) => !i.folder).length} />
            {folders.map(([f, n]) => <RailButton key={f} active={folder === f} onClick={() => setFolder(f)} label={f} count={n} />)}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <h3 className="font-sans text-xs font-semibold text-gray-400 mb-1">Tags</h3>
              {tag && <button onClick={() => setTag("")} className="text-left text-xs text-brass hover:underline mb-1">Clear tag filter</button>}
              {tags.map(([t, n]) => <RailButton key={t} active={tag === t} onClick={() => setTag(tag === t ? "" : t)} label={`#${t}`} count={n} />)}
            </div>
          )}
        </nav>

        <div className="flex flex-col min-w-0">
          <div className="lg:hidden flex gap-2 pb-3 text-sm">
            <select value={folder} onChange={(e) => setFolder(e.target.value)} className="border rounded px-2 py-1.5 bg-transparent flex-1" aria-label="Folder">
              <option value="__all">All folders</option><option value="__none">Unfiled</option>{folders.map(([f]) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="border rounded px-2 py-1.5 bg-transparent flex-1" aria-label="Tag">
              <option value="">All tags</option>{tags.map(([t]) => <option key={t} value={t}>#{t}</option>)}
            </select>
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              {items.length === 0 ? "Your library is empty. Drop papers, datasets, notebooks and figures above, or paste a GitHub, arXiv or YouTube link." : "Nothing matches these filters."}
            </p>
          ) : (
            <ul className="flex flex-col">
              {shown.map((i) => (
                <li key={i.id} className="border-b border-line/60 last:border-0">
                  <button onClick={() => setSelectedId(i.id === selectedId ? null : i.id)} className={`w-full text-left flex flex-col gap-1 py-3 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised ${i.id === selectedId ? "bg-surface-raised" : ""}`}>
                    <span className="flex items-baseline gap-2">
                      {i.pinned && <span className="text-brass text-sm" title="Pinned">★</span>}
                      <span className="font-medium break-words">{i.title}</span>
                      {i.is_current === false && <span className="text-xs text-gray-400">old version</span>}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      {[kindName(i), i.source === "file" ? formatBytes(i.size_bytes ?? null) : hostOf(i.url ?? ""), i.folder, timeAgo(i.created_at)].filter(Boolean).join(" · ")}
                    </span>
                    {i.tags.length > 0 && <span className="text-xs text-brass truncate">{i.tags.map((t) => `#${t}`).join("  ")}</span>}
                    {i.notes && <span className="text-sm text-gray-500 line-clamp-1">{i.notes}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <aside className="fixed inset-x-0 top-0 bottom-14 z-[60] bg-ink overflow-auto p-4 lg:static lg:z-auto lg:p-0 lg:bg-transparent lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)]" aria-label="Preview">
            <Detail key={selected.id} item={selected} all={items} projectId={projectId} userId={userId} folders={folders.map((f) => f[0])} onClose={() => setSelectedId(null)} onSelect={setSelectedId} />
          </aside>
        )}
      </div>
    </div>
  );
}

function RailButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} className={`flex justify-between gap-2 text-left px-2 py-1 rounded ${active ? "bg-surface-raised text-cream font-medium" : "text-gray-500 hover:text-cream hover:bg-surface-raised"}`}>
      <span className="truncate">{label}</span><span className="font-mono text-xs text-gray-400">{count}</span>
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
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={`rounded-lg border border-dashed px-4 py-6 text-center text-sm transition-colors ${drag ? "border-brass bg-surface-raised" : "border-line"}`}
      >
        <p className="text-gray-500">{progress ?? "Drop files here to add them to this project"}</p>
        {!progress && <button type="button" onClick={() => fileRef.current?.click()} className="text-brass hover:underline mt-1">or choose files</button>}
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} aria-label="Choose files" />
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <input list="lib-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Folder (optional)" className={field + " max-w-[12rem]"} aria-label="Folder for new items" />
        <datalist id="lib-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Tags, comma separated" className={field + " max-w-[14rem]"} aria-label="Tags for new items" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={field + " max-w-[11rem] bg-transparent"} aria-label="Type of new files">
          <option value="auto">Detect the type</option>{LIB_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
      </div>
      <form
        className="flex gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const url = String(new FormData(form).get("url") ?? "").trim();
          if (!url) return;
          run(() => addLink({ url, projectId, folder, tags: parseTags(tagText) }), () => form.reset());
        }}
      >
        <input name="url" placeholder="Or paste a link: GitHub repo, arXiv paper, YouTube, dataset, doc…" className={field + " flex-1 min-w-0"} aria-label="Link URL" />
        <button disabled={pending} className={primary + " whitespace-nowrap"}>{pending ? "Saving…" : "Save link"}</button>
      </form>
      {(linkError || errors.length > 0) && <p className="text-red-600 text-xs">{[linkError, ...errors].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

// Preview and details ------------------------------------------------------------------------
function Detail({ item, all, projectId, userId, folders, onClose, onSelect }: { item: LibItem; all: LibItem[]; projectId: string; userId: string; folders: string[]; onClose: () => void; onSelect: (id: string) => void }) {
  const { pending, error, run } = useRun();
  const [editing, setEditing] = useState(false);
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
    if (!confirm(`Delete "${item.title}"?${isFile ? " The file is removed too." : ""}`)) return;
    run(async () => { if (isFile) await deleteProjectDocument(item.id, projectId); else await deleteLink(item.id, { projectId }); }, onClose);
  };
  const download = () => run(async () => { window.open(await getFileUrl(item.id, true), "_blank", "noopener"); });

  return (
    <div className="flex flex-col gap-4 lg:border lg:border-line lg:rounded-lg lg:p-4 lg:overflow-auto lg:max-h-[calc(100vh-3rem)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-2xl leading-tight break-words">{item.title}</h3>
          <p className="text-xs text-gray-400 mt-1">
            {[kindName(item), isFile ? item.file_name : hostOf(item.url ?? ""), isFile ? formatBytes(item.size_bytes ?? null) : null, item.folder ? `in ${item.folder}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-cream" aria-label="Close preview">✕</button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {isFile ? <button onClick={download} className="text-brass hover:underline">Download</button> : <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">Open in a new tab ↗</a>}
        <button onClick={togglePin} className="text-gray-500 hover:text-cream">{item.pinned ? "Unpin" : "Pin to top"}</button>
        <button onClick={() => setEditing((v) => !v)} className="text-gray-500 hover:text-cream">{editing ? "Close details" : "Edit details"}</button>
        {isFile && <button onClick={() => versionRef.current?.click()} className="text-gray-500 hover:text-cream">Upload a new version</button>}
        <button onClick={remove} className="text-gray-500 hover:text-red-600">Delete</button>
        <input
          ref={versionRef} type="file" className="hidden" aria-label="New version"
          onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            run(async () => onSelect(await uploadOne(f, userId, { projectId, folder: item.folder ?? "", tags: item.tags, kind: item.kind, replacesId: item.id, title: item.title })));
            e.target.value = "";
          }}
        />
      </div>
      {pending && <p className="text-xs text-gray-400">Working…</p>}
      {error && <p className="text-red-600 text-xs">{error}</p>}

      {editing && (
        <form
          className="grid gap-2 sm:grid-cols-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
            const patch = { title: v("title"), folder: v("folder") || null, tags: parseTags(v("tags")), notes: v("notes") || null };
            run(() => (isFile ? updateProjectDocument(item.id, projectId, { ...patch, kind: v("kind") }) : updateProjectLink(item.id, projectId, patch)), () => setEditing(false));
          }}
        >
          <input name="title" defaultValue={item.title} required className={field + " sm:col-span-2"} aria-label="Title" />
          <input name="folder" defaultValue={item.folder ?? ""} list="lib-folders" placeholder="Folder" className={field} aria-label="Folder" />
          <input name="tags" defaultValue={item.tags.join(", ")} placeholder="Tags, comma separated" className={field} aria-label="Tags" />
          {isFile && (
            <select name="kind" defaultValue={item.kind} className={field + " bg-transparent sm:col-span-2"} aria-label="Type">{LIB_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
          )}
          <textarea name="notes" defaultValue={item.notes ?? ""} rows={4} placeholder="Why this is here, what to look for, how you use it" className={field + " sm:col-span-2"} aria-label="Notes" />
          <div className="sm:col-span-2 flex gap-2"><button disabled={pending} className={primary}>Save</button><button type="button" onClick={() => setEditing(false)} className="text-gray-500">Cancel</button></div>
        </form>
      )}
      {!editing && item.notes && <p className="text-sm text-gray-500 whitespace-pre-line border-l-2 border-line pl-3">{item.notes}</p>}
      {!editing && item.tags.length > 0 && <p className="text-xs text-brass">{item.tags.map((t) => `#${t}`).join("  ")}</p>}

      <div>{isFile ? <FilePreview id={item.id} fileName={item.file_name ?? item.title} mime={item.mime_type ?? null} /> : <LinkPreviewPane id={item.id} url={item.url ?? ""} meta={item.meta ?? {}} />}</div>

      {history.length > 0 && (
        <div className="flex flex-col gap-1 text-sm border-t border-line pt-3">
          <h4 className="font-sans text-xs font-semibold text-gray-400">Earlier versions</h4>
          {history.map((h, idx) => (
            <button key={h.id} onClick={() => onSelect(h.id)} className="text-left text-gray-500 hover:text-cream">v{history.length - idx} · {h.file_name} · {timeAgo(h.created_at)}</button>
          ))}
        </div>
      )}
    </div>
  );
}
