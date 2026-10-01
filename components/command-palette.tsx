"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchResults } from "@/app/(app)/search-actions";
import {
  ArrowUpRightIcon,
  CalendarCheckIcon,
  FileTextIcon,
  FlaskIcon,
  GraduationCapIcon,
  HomeIcon,
  LinkIcon,
  ListChecksIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  UserIcon,
  UsersIcon,
  BarChartIcon,
  WalletIcon,
  type IconComponent,
} from "@/components/icons";

const EMPTY: SearchResults = { schools: [], professors: [], tasks: [], people: [], milestones: [], links: [] };

// Shown before anything is typed: the app's own pages, no data.
const JUMP_TO: Array<{ href: string; label: string; sub: string; Icon: IconComponent }> = [
  { href: "/", label: "Home", sub: "Overview", Icon: HomeIcon },
  { href: "/today", label: "Today", sub: "Overview", Icon: CalendarCheckIcon },
  { href: "/schools", label: "Schools", sub: "Applications", Icon: GraduationCapIcon },
  { href: "/outreach", label: "Outreach", sub: "Applications", Icon: SendIcon },
  { href: "/people", label: "People", sub: "Applications", Icon: UsersIcon },
  { href: "/tasks", label: "Tasks", sub: "Work", Icon: ListChecksIcon },
  { href: "/research", label: "Research", sub: "Work", Icon: FlaskIcon },
  { href: "/materials", label: "Materials", sub: "Work", Icon: FileTextIcon },
  { href: "/analytics", label: "Analytics", sub: "Insights", Icon: BarChartIcon },
  { href: "/finance", label: "Costs & funding", sub: "Insights", Icon: WalletIcon },
];

const GROUP_ICONS: Record<string, IconComponent> = {
  Schools: GraduationCapIcon,
  Professors: UserIcon,
  Tasks: ListChecksIcon,
  People: UsersIcon,
  Research: FlaskIcon,
  "Saved links": LinkIcon,
};

type Row = {
  key: string;
  label: string;
  sub?: string;
  Icon: IconComponent;
  run: () => void;
  external?: boolean;
};

export function CommandPalette({
  open,
  setOpen,
  onQuickAdd,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Opens Quick add; passed only for the owner. */
  onQuickAdd?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [, startTransition] = useTransition();
  const [activeIndex, setActiveIndex] = useState(0);
  const latestRequest = useRef(0);
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
    // Only the newest request may update the list, so a slow older response can't overwrite it.
    const requestId = ++latestRequest.current;
    const t = setTimeout(
      () =>
        startTransition(async () => {
          const next = await globalSearch(query);
          if (requestId === latestRequest.current) setResults(next);
        }),
      150,
    );
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results]);

  useEffect(() => {
    document.getElementById(`cc-palette-row-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

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
  const searching = query.trim().length > 0;

  // One flat list of rows (with group headings) so arrow keys move through everything in order.
  const sections: Array<{ heading: string; rows: Row[] }> = searching
    ? groups
        .filter(([, items]) => items.length > 0)
        .map(([label, items]) => ({
          heading: label,
          rows: items.map((item) => ({
            key: `${label}-${item.id}`,
            label: item.label,
            sub: item.sub,
            Icon: GROUP_ICONS[label] ?? SearchIcon,
            external: item.external,
            run: () => go(item),
          })),
        }))
    : [
        {
          heading: "Jump to",
          rows: JUMP_TO.map((p) => ({ key: p.href, label: p.label, sub: p.sub, Icon: p.Icon, run: () => go(p) })),
        },
        ...(onQuickAdd
          ? [
              {
                heading: "Actions",
                rows: [
                  {
                    key: "quick-add",
                    label: "Quick add a task or link",
                    sub: "Ctrl J",
                    Icon: PlusIcon,
                    run: () => {
                      setOpen(false);
                      setQuery("");
                      onQuickAdd();
                    },
                  },
                ],
              },
            ]
          : []),
      ];
  const flat = sections.flatMap((s) => s.rows);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[Math.min(activeIndex, flat.length - 1)]?.run();
    }
  }

  let rowIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="flex max-h-[70vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-[52px] flex-shrink-0 items-center gap-2.5 border-b border-slate-200 px-4">
          <SearchIcon className="h-[18px] w-[18px] flex-shrink-0 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search schools, professors, tasks, people, links…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="cc-palette-list"
            aria-activedescendant={flat.length ? `cc-palette-row-${activeIndex}` : undefined}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:!outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 hover:text-slate-900"
          >
            Esc
          </button>
        </div>

        <div id="cc-palette-list" role="listbox" aria-label="Results" className="flex-1 overflow-y-auto p-2">
          {searching && !hasAnyResults && (
            <p className="px-2 py-6 text-center text-sm text-slate-500">No matches for &ldquo;{query}&rdquo;.</p>
          )}
          {sections.map((section) => (
            <div key={section.heading} role="group" aria-label={section.heading} className="mb-1 last:mb-0">
              <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                {section.heading}
              </div>
              {section.rows.map((row) => {
                rowIndex += 1;
                const i = rowIndex;
                const active = i === activeIndex;
                return (
                  <button
                    key={row.key}
                    id={`cc-palette-row-${i}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={row.run}
                    onMouseMove={() => setActiveIndex(i)}
                    className={`flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm ${
                      active ? "bg-blue-50 text-blue-700" : "text-slate-900"
                    }`}
                  >
                    <row.Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600" : "text-slate-500"}`} />
                    <span className="min-w-0 flex-1 truncate">
                      {row.label}
                      {row.external && <ArrowUpRightIcon className="ml-1 inline h-3.5 w-3.5 text-slate-400" />}
                    </span>
                    {row.sub && (
                      <span className={`max-w-[45%] truncate text-xs ${row.key === "quick-add" ? "font-mono" : ""} ${active ? "text-blue-700/80" : "text-slate-500"}`}>
                        {row.sub}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex h-10 flex-shrink-0 items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 text-xs text-slate-600">
          <span><span className="font-mono">↑ ↓</span> to move</span>
          <span><span className="font-mono">↵</span> to open</span>
          <span><span className="font-mono">esc</span> to close</span>
          <span className="ml-auto hidden text-slate-500 sm:inline">Type to search everything</span>
        </div>
      </div>
    </div>
  );
}
