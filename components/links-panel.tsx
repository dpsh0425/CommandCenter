"use client";
import { useState, useTransition } from "react";
import { addLink, deleteLink, refreshLink, togglePinLink, updateLink, type LinkScope } from "@/app/(app)/links/actions";
import { LINK_KINDS, hostOf, timeAgo, type LinkKind } from "@/lib/links";

export type LinkRow = {
  id: string; url: string; title: string; kind: LinkKind; notes: string | null; pinned: boolean; created_at: string;
  meta: Record<string, any>; school_id?: string | null; milestone_id?: string | null; professor_id?: string | null;
  scopeLabel?: string;
};

const KIND_TONE: Record<LinkKind, string> = {
  github: "text-cream border-line", paper: "text-violet-600 border-violet-600", dataset: "text-teal-600 border-teal-600",
  doc: "text-brass border-brass", website: "text-gray-500 border-line", video: "text-red-600 border-red-600", other: "text-gray-500 border-line",
};
const kindLabel = (k: string) => LINK_KINDS.find((x) => x.key === k)?.label ?? k;

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

function LinkCard({ link }: { link: LinkRow }) {
  const { pending, error, run } = useRun();
  const scope: LinkScope = { schoolId: link.school_id ?? undefined, milestoneId: link.milestone_id ?? undefined, professorId: link.professor_id ?? undefined };
  const [editing, setEditing] = useState(false);
  const m = link.meta ?? {};
  const isRepo = link.kind === "github" && (m.description !== undefined || m.stars !== undefined || m.unavailable);
  const canRefresh = link.kind === "github" || link.kind === "paper";

  return (
    <li className={`border rounded-lg p-3 flex flex-col gap-1.5 ${link.pinned ? "border-brass bg-brass-soft" : "border-line bg-surface-raised"} ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${KIND_TONE[link.kind]}`}>{kindLabel(link.kind)}</span>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brass break-words">{link.title} <span aria-hidden className="text-gray-400">↗</span></a>
          </div>
          <div className="text-xs text-gray-400 truncate">{hostOf(link.url)}{link.scopeLabel && <span className="text-brass"> · {link.scopeLabel}</span>}</div>
        </div>
        <div className="flex gap-3 text-xs text-gray-500 flex-shrink-0">
          <button onClick={() => run(() => togglePinLink(link.id, !link.pinned, scope))} className={link.pinned ? "text-brass" : "hover:text-cream"} title={link.pinned ? "Unpin" : "Pin to top"}>{link.pinned ? "★" : "☆"}</button>
          {canRefresh && <button onClick={() => run(() => refreshLink(link.id, scope))} className="hover:text-cream" title="Refresh details">↻</button>}
          <button onClick={() => setEditing((v) => !v)} className="hover:text-cream">Edit</button>
          <button onClick={() => { if (confirm(`Remove "${link.title}"?`)) run(() => deleteLink(link.id, scope)); }} className="hover:text-red-600" aria-label="Remove link">✕</button>
        </div>
      </div>

      {isRepo && !m.unavailable && (
        <div className="flex flex-col gap-1.5">
          {m.description && <p className="text-sm text-gray-500">{m.description}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 font-mono">
            {m.language && <span className="text-cream">{m.language}</span>}
            <span>★ {Number(m.stars ?? 0).toLocaleString()}</span>
            <span>⑂ {Number(m.forks ?? 0).toLocaleString()}</span>
            <span>{Number(m.openIssues ?? 0)} open issues</span>
            {m.pushedAt && <span>pushed {timeAgo(m.pushedAt)}</span>}
            {m.license && <span>{m.license}</span>}
            {m.archived && <span className="text-red-600">archived</span>}
          </div>
          {Array.isArray(m.topics) && m.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">{m.topics.map((t: string) => <span key={t} className="text-[11px] rounded bg-brass-soft text-brass px-1.5 py-0.5">{t}</span>)}</div>
          )}
        </div>
      )}
      {m.unavailable && <p className="text-xs text-gray-400 italic">Repository details unavailable: {String(m.unavailable)}.</p>}
      {link.kind === "paper" && Array.isArray(m.authors) && m.authors.length > 0 && (
        <p className="text-xs text-gray-500">{m.authors.join(", ")}{m.moreAuthors ? ` +${m.moreAuthors} more` : ""}{m.published ? ` · ${String(m.published).slice(0, 4)}` : ""}</p>
      )}
      {link.notes && !editing && <p className="text-sm text-gray-500 whitespace-pre-line border-l-2 border-line pl-2">{link.notes}</p>}

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
          <input name="title" defaultValue={link.title} required className="border rounded px-2 py-1.5 text-sm" />
          <textarea name="notes" defaultValue={link.notes ?? ""} rows={2} placeholder="Why this matters, how you use it…" className="border rounded px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500">Cancel</button>
          </div>
        </form>
      )}
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </li>
  );
}

export function LinksPanel({
  links, scope, placeholder = "Paste a link: GitHub repo, arXiv paper, dataset, doc…", emptyText = "No links saved yet.",
}: { links: LinkRow[]; scope: LinkScope; placeholder?: string; emptyText?: string }) {
  const { pending, error, run } = useRun();
  const [details, setDetails] = useState(false);
  const [filter, setFilter] = useState<LinkKind | "all">("all");

  const sorted = [...links].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  const kinds = Array.from(new Set(links.map((l) => l.kind)));
  const shown = filter === "all" ? sorted : sorted.filter((l) => l.kind === filter);

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
          <input name="url" required placeholder={placeholder} className="border rounded px-3 py-1.5 text-sm flex-1 min-w-0" aria-label="Link URL" />
          <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50 whitespace-nowrap">{pending ? "Saving…" : "Save link"}</button>
        </div>
        {details && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="title" placeholder="Title (optional, we fetch it for GitHub and arXiv)" className="border rounded px-2 py-1.5 text-sm" />
            <input name="notes" placeholder="Note (optional)" className="border rounded px-2 py-1.5 text-sm" />
          </div>
        )}
        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setDetails((v) => !v)} className="text-gray-500 underline hover:text-cream">{details ? "Hide details" : "Add title or note"}</button>
          {error && <span className="text-red-600">{error}</span>}
        </div>
      </form>

      {kinds.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {(["all", ...kinds] as Array<LinkKind | "all">).map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-2.5 py-0.5 rounded-full text-xs border ${filter === k ? "bg-brass text-ink font-medium border-brass" : "hover:border-brass"}`}>
              {k === "all" ? `All ${links.length}` : `${kindLabel(k)} ${links.filter((l) => l.kind === k).length}`}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-xs text-gray-400 border border-dashed border-line rounded p-4 text-center">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2">{shown.map((l) => <LinkCard key={l.id} link={l} />)}</ul>
      )}
    </div>
  );
}
