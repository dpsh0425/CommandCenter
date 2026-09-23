"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchResults } from "@/app/(app)/search-actions";

const EMPTY: SearchResults = { schools: [], professors: [], tasks: [], people: [], milestones: [], links: [] };

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => startTransition(async () => setResults(await globalSearch(query))), 150);
    return () => clearTimeout(t);
  }, [query, open]);

  if (!open) return null;

  function go(item: { href: string; external?: boolean }) {
    setOpen(false);
    setQuery("");
    if (item.external) window.open(item.href, "_blank", "noopener,noreferrer");
    else router.push(item.href);
  }

  const groups: Array<[string, SearchResults[keyof SearchResults]]> = [
    ["Schools", results.schools], ["Professors", results.professors], ["Tasks", results.tasks],
    ["People", results.people], ["Research", results.milestones], ["Saved links", results.links],
  ];
  const hasAnyResults = groups.some(([, items]) => items.length > 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 z-50" onClick={() => setOpen(false)}>
      <div className="bg-surface-raised border border-line rounded-lg shadow-lg w-full max-w-md p-3 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schools, professors, tasks, links…"
          className="w-full border-b pb-2 mb-2 outline-none text-sm"
        />
        {!query.trim() && (
          <p className="text-xs text-gray-400 px-1 py-2">Type to search everything. Press Ctrl J to quick-add a task or link.</p>
        )}
        {query.trim() && !hasAnyResults && <p className="text-sm text-gray-500 px-1 py-2">No matches for "{query}".</p>}
        {groups.map(([label, items]) => items.length > 0 && (
          <div key={label} className="mb-2">
            <div className="text-xs uppercase text-gray-400 px-1">{label}</div>
            {items.map((item) => (
              <button key={item.id} onClick={() => go(item)} className="flex w-full justify-between gap-3 text-left px-1 py-1.5 text-sm hover:bg-gray-100 rounded">
                <span className="truncate">{item.label}{item.external && <span className="text-gray-400"> ↗</span>}</span>
                {item.sub && <span className="text-xs text-gray-400 truncate max-w-[45%]">{item.sub}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
