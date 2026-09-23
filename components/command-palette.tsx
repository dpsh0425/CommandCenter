"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch } from "@/app/(app)/search-actions";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof globalSearch>>>({ schools: [], tasks: [], people: [], milestones: [] });
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => setResults(await globalSearch(query)));
  }, [query, open]);

  if (!open) return null;

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const groups: Array<[string, typeof results.schools]> = [
    ["Schools", results.schools], ["Tasks", results.tasks], ["People", results.people], ["Research", results.milestones],
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 z-50" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-3" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schools, tasks, people, research…"
          className="w-full border-b pb-2 mb-2 outline-none text-sm"
        />
        {groups.map(([label, items]) => items.length > 0 && (
          <div key={label} className="mb-2">
            <div className="text-xs uppercase text-gray-400 px-1">{label}</div>
            {items.map((item) => (
              <button key={item.id} onClick={() => go(item.href)} className="block w-full text-left px-1 py-1.5 text-sm hover:bg-gray-100 rounded">
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
