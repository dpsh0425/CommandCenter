import Link from "next/link";

// Shared layout pieces. The goal is calm pages: one clear title, plain sections separated by
// whitespace and a thin divider, and borders only on things you can click.

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="font-sans text-[15px] font-semibold text-cream">{title}</h2>
          {hint && <span className="text-xs text-gray-400 truncate">{hint}</span>}
        </div>
        {action && <div className="text-xs text-gray-500 flex-shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// A collapsed section: the summary line carries the count so nothing important is hidden.
export function Fold({ title, summary, defaultOpen = false, children }: { title: string; summary?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group border-b border-line pb-2">
      <summary className="flex items-baseline justify-between gap-3 cursor-pointer list-none py-1 [&::-webkit-details-marker]:hidden">
        <span className="flex items-baseline gap-3">
          <span className="font-sans text-[15px] font-semibold text-cream">{title}</span>
          {summary && <span className="text-xs text-gray-400">{summary}</span>}
        </span>
        <span className="text-xs text-gray-500 group-open:hidden">Show</span>
        <span className="text-xs text-gray-500 hidden group-open:inline">Hide</span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

export function Meta({ items }: { items: Array<React.ReactNode | null | false | undefined> }) {
  const shown = items.filter(Boolean);
  return (
    <p className="text-sm text-gray-500 flex flex-wrap gap-x-2">
      {shown.map((item, i) => (
        <span key={i} className="flex gap-2">
          {i > 0 && <span aria-hidden className="text-line">·</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

// Sibling pages that belong together (e.g. Today / This week / Timeline) share one tab row.
export function SubNav({ items, current }: { items: Array<{ href: string; label: string }>; current: string }) {
  return (
    <nav className="flex gap-5 border-b border-line -mb-2" aria-label="Section">
      {items.map((it) => (
        <Link
          key={it.href} href={it.href}
          className={`pb-2 text-sm border-b-2 -mb-px ${current === it.href ? "border-brass text-cream font-medium" : "border-transparent text-gray-500 hover:text-cream"}`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

export const TODAY_TABS = [
  { href: "/today", label: "Today" },
  { href: "/week", label: "This week" },
  { href: "/timeline", label: "Timeline" },
  { href: "/wins", label: "Wins" },
];
export const SCHOOL_TABS = [
  { href: "/schools", label: "All schools" },
  { href: "/compare", label: "Compare" },
  { href: "/readiness", label: "Readiness" },
];
export const MATERIALS_TABS = [
  { href: "/materials", label: "Documents" },
  { href: "/materials/resume", label: "Resume builder" },
];
export const RESEARCH_TABS = [
  { href: "/research", label: "Milestones" },
  { href: "/links", label: "Library" },
];
