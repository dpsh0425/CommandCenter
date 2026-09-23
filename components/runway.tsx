import Link from "next/link";

export type RunwayDeadline = { id: string; name: string; date: string };

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);

export function shortSchoolName(name: string) {
  const known: Record<string, string> = {
    "University of Illinois Urbana-Champaign": "UIUC",
    "Carnegie Mellon University": "CMU",
    "Johns Hopkins University": "JHU",
    "University of Washington-Seattle Campus": "UW",
    "Massachusetts Institute of Technology": "MIT",
  };
  if (known[name]) return known[name];
  return name.replace(/^University of /, "").replace(/ University$/, "").replace(/-.*$/, "").trim();
}

const urgency = (d: number) => (d <= 14 ? "#d97e78" : d <= 45 ? "#c98a3e" : "#9aa2b1");

// A timeline from today to the last deadline. Deadlines that sit close together share one marker,
// so labels never collide.
export function Runway({ deadlines, today }: { deadlines: RunwayDeadline[]; today: string }) {
  if (deadlines.length === 0) return null;
  const sorted = [...deadlines].sort((a, b) => a.date.localeCompare(b.date));
  const span = Math.max(30, daysBetween(today, sorted[sorted.length - 1].date));

  type Cluster = { pct: number; days: number; items: RunwayDeadline[] };
  const clusters: Cluster[] = [];
  for (const d of sorted) {
    const days = Math.max(0, daysBetween(today, d.date));
    const pct = Math.min(100, (days / span) * 100);
    const last = clusters[clusters.length - 1];
    if (last && pct - last.pct < 9) last.items.push(d);
    else clusters.push({ pct, days, items: [d] });
  }

  // Month ticks along the bottom.
  const start = new Date(today + "T00:00:00");
  const ticks: Array<{ pct: number; label: string }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  while (true) {
    const dd = Math.round((cursor.getTime() - start.getTime()) / 86400000);
    if (dd > span) break;
    ticks.push({ pct: (dd / span) * 100, label: cursor.toLocaleDateString(undefined, { month: "short" }) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="relative h-32 select-none" role="img" aria-label="Timeline of your application deadlines">
      {/* track */}
      <div className="absolute left-0 right-0 top-1/2 h-px bg-line" />
      {ticks.filter((t) => !clusters.some((c) => Math.abs(c.pct - t.pct) < 9)).map((t) => (
        <span key={t.label + t.pct} className="absolute top-1/2 -translate-x-1/2" style={{ left: `${t.pct}%` }}>
          <span className="block w-px h-2 bg-line -translate-y-1/2 mx-auto" />
          <span className="block mt-2 text-[10px] uppercase tracking-wider text-gray-400">{t.label}</span>
        </span>
      ))}

      {/* today */}
      <span className="absolute top-1/2 left-0 -translate-y-1/2">
        <span className="block w-3 h-3 rounded-full bg-cream ring-4 ring-cream/15" />
      </span>
      <span className="absolute left-0 top-1/2 mt-4 text-[10px] uppercase tracking-wider text-cream translate-y-3">Today</span>

      {/* deadlines */}
      {clusters.map((c, i) => {
        const above = i % 2 === 0;
        const anchor = c.pct > 88 ? "right-[-8px] text-right" : c.pct < 10 ? "left-[-6px] text-left" : "left-0 -translate-x-1/2 text-center";
        const color = urgency(c.days);
        const first = c.items[0];
        const label = c.items.map((x) => shortSchoolName(x.name)).join(" · ");
        return (
          <div key={first.id} className="absolute inset-y-0" style={{ left: `${c.pct}%` }}>
            <Link
              href={`/schools/${first.id}`}
              title={c.items.map((x) => `${x.name}, ${x.date}`).join("\n")}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 group"
            >
              <span className="block w-3.5 h-3.5 rounded-full border-2 bg-ink transition-transform group-hover:scale-125" style={{ borderColor: color, boxShadow: `0 0 0 4px ${color}22` }} />
            </Link>
            <span className={`absolute whitespace-nowrap text-xs ${anchor} ${above ? "bottom-1/2 mb-4" : "top-1/2 mt-4"}`}>
              <span className="block font-medium text-cream">{label}</span>
              <span className="block font-mono text-[11px]" style={{ color }}>{new Date(first.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {c.days}d</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
