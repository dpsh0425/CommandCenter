"use client";
import { useState, useTransition } from "react";
import { addLink, deleteLink, refreshLink, togglePinLink, updateLink, type LinkScope } from "@/app/(app)/links/actions";
import { LINK_KINDS, hostOf, timeAgo, type LinkKind } from "@/lib/links";

export type LinkRow = {
  id: string; url: string; title: string; kind: LinkKind; notes: string | null; pinned: boolean; created_at: string;
  meta: Record<string, any>; school_id?: string | null; milestone_id?: string | null; professor_id?: string | null; project_id?: string | null;
  scopeLabel?: string;
};

const KIND_TONE: Record<LinkKind, string> = {
  github: "bg-slate-900 text-white", paper: "bg-violet-50 text-violet-700", dataset: "bg-emerald-50 text-emerald-700",
  doc: "bg-blue-50 text-blue-700", website: "bg-slate-100 text-slate-600", video: "bg-red-50 text-red-700", other: "bg-slate-100 text-slate-600",
};
const kindLabel = (k: string) => LINK_KINDS.find((x) => x.key === k)?.label ?? k;
const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "h-9 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const iconBtn = "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900";
const chip = (on: boolean) =>
  `h-8 rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`;

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
  return { pending, error, run };
}

function LinkCard({ link, compact }: { link: LinkRow; compact: boolean }) {
  const { pending, error, run } = useRun();
  const scope: LinkScope = { schoolId: link.school_id ?? undefined, milestoneId: link.milestone_id ?? undefined, professorId: link.professor_id ?? undefined, projectId: link.project_id ?? undefined };
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const m = link.meta ?? {};
  const isRepo = link.kind === "github" && (m.description !== undefined || m.stars !== undefined || m.unavailable);
  const canRefresh = link.kind === "github" || link.kind === "paper";

  return (
    <li className={`flex h-full flex-col gap-2 rounded-lg border bg-white px-4 py-3.5 ${link.pinned ? "border-blue-200" : "border-slate-200"} ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND_TONE[link.kind] ?? KIND_TONE.other}`}>{kindLabel(link.kind)}</span>
            {link.scopeLabel && <span className="max-w-[14rem] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{link.scopeLabel}</span>}
          </div>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-semibold text-slate-900 hover:text-blue-700">{link.title} <span aria-hidden className="text-xs text-slate-400">↗</span></a>
          <div className="truncate text-xs text-slate-500">{hostOf(link.url)} · saved {timeAgo(link.created_at)}</div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button type="button" onClick={() => run(() => togglePinLink(link.id, !link.pinned, scope))} className={`${iconBtn} ${link.pinned ? "text-blue-600" : ""}`} title={link.pinned ? "Unpin" : "Pin to top"} aria-label={link.pinned ? "Unpin" : "Pin to top"} aria-pressed={link.pinned}>{link.pinned ? "★" : "☆"}</button>
          {canRefresh && <button type="button" onClick={() => run(() => refreshLink(link.id, scope))} className={iconBtn} title="Refresh details" aria-label="Refresh details">↻</button>}
          <button type="button" onClick={() => setEditing((v) => !v)} className={iconBtn}>Edit</button>
          <button type="button" onClick={() => setConfirming(true)} className={`${iconBtn} hover:bg-red-50 hover:text-red-700`} aria-label="Remove link">✕</button>
        </div>
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-800" role="group" aria-label="Confirm remove">
          <span className="min-w-0 flex-1">Remove &ldquo;{link.title}&rdquo;?</span>
          <button type="button" disabled={pending} onClick={() => { setConfirming(false); run(() => deleteLink(link.id, scope)); }} className="h-7 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">Remove</button>
          <button type="button" onClick={() => setConfirming(false)} className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white">Keep</button>
        </div>
      )}

      {isRepo && !m.unavailable && (
        <div className="flex flex-col gap-1.5">
          {m.description && <p className={`text-[13px] text-slate-600 ${compact ? "line-clamp-2" : ""}`}>{m.description}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-slate-500">
            {m.language && <span className="font-medium text-slate-800">{m.language}</span>}
            <span>★ {Number(m.stars ?? 0).toLocaleString("en-US")}</span>
            <span>⑂ {Number(m.forks ?? 0).toLocaleString("en-US")}</span>
            <span>{Number(m.openIssues ?? 0)} open issues</span>
            {m.pushedAt && <span>pushed {timeAgo(m.pushedAt)}</span>}
            {m.license && <span>{m.license}</span>}
            {m.archived && <span className="font-medium text-red-700">archived</span>}
          </div>
          {Array.isArray(m.topics) && m.topics.length > 0 && <p className="truncate text-xs text-blue-700">{m.topics.join(" · ")}</p>}
        </div>
      )}
      {m.unavailable && <p className="text-xs italic text-slate-500">Repository details unavailable: {String(m.unavailable)}.</p>}
      {link.kind === "paper" && Array.isArray(m.authors) && m.authors.length > 0 && (
        <p className={`text-xs text-slate-500 ${compact ? "line-clamp-1" : ""}`}>{m.authors.join(", ")}{m.moreAuthors ? ` +${m.moreAuthors} more` : ""}{m.published ? ` · ${String(m.published).slice(0, 4)}` : ""}</p>
      )}
      {link.notes && !editing && <p className={`whitespace-pre-line rounded-md bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700 ${compact ? "line-clamp-3" : ""}`}>{link.notes}</p>}

      {editing && (
        <form
          className="flex flex-col gap-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const title = String(f.get("title") ?? "").trim();
            if (title) run(() => updateLink(link.id, scope, { title, notes: String(f.get("notes") ?? "") || null }), () => setEditing(false));
          }}
        >
          <input name="title" defaultValue={link.title} required aria-label="Title" className={field} />
          <textarea name="notes" defaultValue={link.notes ?? ""} rows={2} placeholder="Why this matters, how you use it…" aria-label="Note" className={field} />
          <div className="flex gap-2">
            <button disabled={pending} className={primary}>Save</button>
            <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">Cancel</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </li>
  );
}

export function LinksPanel({
  links, scope, placeholder = "Paste a link: GitHub repo, arXiv paper, dataset, doc…", emptyText = "No links saved yet.", browse = false,
}: { links: LinkRow[]; scope: LinkScope; placeholder?: string; emptyText?: string; browse?: boolean }) {
  const { pending, error, run } = useRun();
  const [details, setDetails] = useState(false);
  const [filter, setFilter] = useState<LinkKind | "all">("all");
  const [from, setFrom] = useState<string>("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  const sorted = [...links].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  const kinds = Array.from(new Set(links.map((l) => l.kind)));
  const sources = browse ? Array.from(new Set(links.map((l) => l.scopeLabel).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)) : [];
  const q = query.trim().toLowerCase();
  const shown = sorted
    .filter((l) => filter === "all" || l.kind === filter)
    .filter((l) => !from || l.scopeLabel === from)
    .filter((l) => !q || `${l.title} ${l.url} ${l.notes ?? ""} ${l.scopeLabel ?? ""}`.toLowerCase().includes(q));
  const compact = browse && view === "grid";

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const url = String(f.get("url") ?? "").trim();
          if (!url) return;
          run(
            () => addLink({ url, title: String(f.get("title") ?? "").trim() || undefined, notes: String(f.get("notes") ?? "").trim() || undefined, ...scope }),
            () => { form.reset(); setDetails(false); }
          );
        }}
      >
        <div className="flex gap-2">
          <input name="url" required placeholder={placeholder} className={`${field} min-w-0 flex-1`} aria-label="Link URL" />
          <button disabled={pending} className={primary}>{pending ? "Saving…" : "Save link"}</button>
        </div>
        {details && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="title" placeholder="Title (optional, we fetch it for GitHub and arXiv)" aria-label="Title" className={field} />
            <input name="notes" placeholder="Note (optional)" aria-label="Note" className={field} />
          </div>
        )}
        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setDetails((v) => !v)} className="font-medium text-blue-600 hover:text-blue-700">{details ? "Hide details" : "Add title or note"}</button>
          {error && <span role="alert" className="text-red-700">{error}</span>}
        </div>
      </form>

      {(kinds.length > 1 || browse) && links.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {kinds.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
              {(["all", ...kinds] as Array<LinkKind | "all">).map((k) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={chip(filter === k)}>
                  {k === "all" ? `All ${links.length}` : `${kindLabel(k)} ${links.filter((l) => l.kind === k).length}`}
                </button>
              ))}
            </div>
          )}
          {browse && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search links" aria-label="Search links" className="h-8 w-44 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20" />
              {sources.length > 1 && (
                <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Where it's from" className="h-8 max-w-[12rem] rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20">
                  <option value="">From anywhere</option>
                  {sources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <div className="flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="View">
                {(["list", "grid"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-8 px-3 text-[13px] font-medium capitalize ${view === v ? "bg-slate-100 text-slate-900" : "bg-white text-slate-500 hover:text-slate-900"}`}>{v}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-[13px] text-slate-500">{links.length === 0 ? emptyText : "No links match these filters."}</p>
      ) : (
        <ul className={compact ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-2"}>{shown.map((l) => <LinkCard key={l.id} link={l} compact={compact} />)}</ul>
      )}
    </div>
  );
}
