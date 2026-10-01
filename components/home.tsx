import Link from "next/link";
import {
  ArrowUpRightIcon,
  FileTextIcon,
  ListChecksIcon,
  TrophyIcon,
  type IconComponent,
} from "@/components/icons";

// Presentational pieces for the Home dashboard. All data comes in as props from app/(app)/page.tsx.

/* ── KPI card ── */

export function KpiCard({
  href,
  label,
  value,
  detail,
  tone = "neutral",
  Icon,
}: {
  href: string;
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "danger" | "success";
  Icon: IconComponent;
}) {
  const detailClass = tone === "danger" ? "text-red-700" : tone === "success" ? "text-emerald-700" : "text-slate-500";
  return (
    <Link
      href={href}
      className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
    >
      <span className="flex items-center gap-2.5 text-[13px] font-medium text-slate-600">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </span>
      <span className="text-[32px] font-semibold leading-9 tracking-tight text-slate-900 tabular-nums">{value}</span>
      <span className={`flex items-center gap-1.5 text-[13px] ${detailClass}`}>
        {tone === "danger" && <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden="true" />}
        {detail}
      </span>
    </Link>
  );
}

/* ── Card shell with a header row ── */

export function Panel({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <h2 className="text-[15px] font-semibold text-slate-900">
          {title}
          {hint && <span className="ml-1 text-[13px] font-normal text-slate-500">· {hint}</span>}
        </h2>
        {action && (
          <Link href={action.href} className="flex-shrink-0 text-[13px] font-medium text-blue-600 hover:text-blue-700">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-slate-500">{children}</p>;
}

/* ── Dated items (tasks, deadlines, milestones, letters) ── */

export type DatedItem = {
  label: string;
  sub: string;
  href: string;
  date: string;
  kind: "task" | "school" | "milestone" | "letter" | "readiness";
};

const shortDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function relDays(delta: number) {
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta < 0) return `${-delta}d overdue`;
  return `In ${delta}d`;
}

export function AttentionList({ items }: { items: Array<DatedItem & { delta: number }> }) {
  return (
    <ul className="px-2 py-1.5">
      {items.map((it, i) => {
        const badge =
          it.delta < 0
            ? "bg-red-50 text-red-700"
            : it.delta === 0
              ? "bg-blue-50 text-blue-700"
              : "bg-slate-100 text-slate-700";
        return (
          <li key={`${it.href}-${i}`}>
            <Link
              href={it.href}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-slate-50"
            >
              <span className={`w-[84px] flex-shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium ${badge}`}>
                {relDays(it.delta)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{it.label}</span>
              <span className="hidden flex-shrink-0 text-xs text-slate-500 sm:inline">{it.sub}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function UpcomingList({ items }: { items: Array<DatedItem & { delta: number }> }) {
  return (
    <ul className="px-2 py-1.5">
      {items.map((it, i) => (
        <li key={`${it.href}-${i}`}>
          <Link
            href={it.href}
            className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 sm:grid-cols-[64px_1fr_160px_64px]"
          >
            <span className="font-mono text-[13px] text-slate-600">{shortDate(it.date)}</span>
            <span className={`min-w-0 truncate ${it.kind === "school" ? "font-semibold text-slate-900" : "text-slate-900"}`}>
              {it.label}
            </span>
            <span className={`hidden truncate text-xs sm:block ${it.kind === "school" ? "text-blue-700" : "text-slate-500"}`}>{it.sub}</span>
            <span className="text-right text-xs text-slate-500">{relDays(it.delta).toLowerCase()}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ── Application pipeline ── */

export const PIPELINE: Array<{ key: string; label: string; color: string }> = [
  { key: "not_started", label: "Not started", color: "#CBD5E1" },
  { key: "researching", label: "Researching", color: "#94A3B8" },
  { key: "contacted", label: "Contacted", color: "#93C5FD" },
  { key: "replied", label: "Replied", color: "#3B82F6" },
  { key: "submitted", label: "Submitted", color: "#1D4ED8" },
  { key: "interview", label: "Interview", color: "#7C3AED" },
  { key: "accepted", label: "Accepted", color: "#059669" },
  { key: "rejected", label: "Rejected", color: "#E11D48" },
];

export function PipelineBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  return (
    <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Schools by application status">
        {PIPELINE.filter((p) => (counts[p.key] ?? 0) > 0).map((p) => (
          <Link
            key={p.key}
            href={`/schools?status=${p.key}`}
            title={`${p.label}: ${counts[p.key]}`}
            style={{ width: `${((counts[p.key] ?? 0) / total) * 100}%`, background: p.color }}
            className="min-w-[4px] transition-opacity hover:opacity-80"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
        {PIPELINE.map((p) => (
          <Link key={p.key} href={`/schools?status=${p.key}`} className="flex items-center gap-2 text-slate-700 hover:text-slate-900">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden="true" />
            <span className="truncate">{p.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-900">{counts[p.key] ?? 0}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Next school deadline ── */

export function NextDeadlineCard({
  school,
}: {
  school: { id: string; name: string; date: string; days: number; done?: number; total?: number } | null;
}) {
  if (!school) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Next school deadline</span>
        <p className="text-sm text-slate-500">
          No upcoming deadlines. Add a deadline on a school&apos;s page to start the countdown.
        </p>
        <Link href="/schools" className="text-[13px] font-medium text-blue-600 hover:text-blue-700">
          Go to schools →
        </Link>
      </div>
    );
  }
  const pct = school.total ? Math.round(((school.done ?? 0) / school.total) * 100) : null;
  return (
    <Link
      href={`/schools/${school.id}?tab=application`}
      className="flex flex-col gap-3.5 rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Next school deadline</span>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-[17px] font-semibold text-slate-900">{school.name}</span>
          <span className="text-[13px] text-slate-500">
            {new Date(school.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>
        <span className="flex-shrink-0 text-right">
          <span className="text-[32px] font-semibold leading-9 tracking-tight text-blue-600 tabular-nums">{school.days}</span>
          <span className="text-[13px] text-slate-500"> {school.days === 1 ? "day" : "days"}</span>
        </span>
      </div>
      {pct !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Application checklist</span>
            <span>
              {school.done} of {school.total} done
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </Link>
  );
}

/* ── Recent activity ── */

export type ActivityEntry = {
  id: string;
  text: string;
  context: string;
  at: string;
  href: string;
  win: boolean;
  kind: "school" | "task";
};

function ago(iso: string, now: Date) {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityFeed({ entries, now }: { entries: ActivityEntry[]; now: Date }) {
  return (
    <ol className="flex flex-col px-5 pb-2 pt-1">
      {entries.map((e) => {
        const Icon = e.win ? TrophyIcon : e.kind === "task" ? ListChecksIcon : FileTextIcon;
        return (
          <li key={e.id} className="border-b border-slate-100 last:border-0">
            <Link href={e.href} className="group flex gap-3 py-2.5">
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                  e.win ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="line-clamp-2 text-[13px] leading-[18px] text-slate-900 group-hover:text-blue-700">{e.text}</span>
                <span className="truncate text-xs text-slate-500">
                  {e.context} · {ago(e.at, now)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Quick access ── */

export function QuickAccess({
  links,
}: {
  links: Array<{ href: string; label: string; detail: string }>;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4">
      <h2 className="text-[15px] font-semibold text-slate-900">Quick access</h2>
      <div className="grid grid-cols-2 gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group flex flex-col gap-1 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="flex items-center justify-between text-sm font-medium text-slate-900">
              {l.label}
              <ArrowUpRightIcon className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600" />
            </span>
            <span className="truncate text-xs text-slate-500">{l.detail}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
