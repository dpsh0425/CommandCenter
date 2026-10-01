import Link from "next/link";
import { todayString } from "@/lib/app-date";

type Marker = { label: string; date: string; kind: "school" | "milestone"; href: string };

const days = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);

function relative(delta: number) {
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "yesterday";
  return delta > 0 ? `in ${delta}d` : `${-delta}d ago`;
}

const monthLabel = (key: string, opts: Intl.DateTimeFormatOptions) => new Date(key + "-01T00:00:00").toLocaleDateString("en-US", opts);
const addMonths = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

function KindMark({ kind, size = 8 }: { kind: Marker["kind"]; size?: number }) {
  return kind === "school" ? (
    <i className="flex-shrink-0 rounded-full bg-blue-600" style={{ width: size, height: size }} aria-hidden="true" />
  ) : (
    <i className="flex-shrink-0 rotate-45 bg-violet-600" style={{ width: size - 1, height: size - 1 }} aria-hidden="true" />
  );
}

/** Six-month lane chart: one row per kind, a mark at each date, and a line for today. */
function Lanes({ markers, today }: { markers: Marker[]; today: string }) {
  const startKey = today.slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(startKey, i));
  const rangeStart = `${startKey}-01`;
  const rangeEnd = `${addMonths(startKey, 6)}-01`;
  const span = days(rangeStart, rangeEnd);
  const pos = (date: string) => (days(rangeStart, date) / span) * 100;
  const inRange = markers.filter((m) => m.date >= rangeStart && m.date < rangeEnd);
  const lanes: Array<{ kind: Marker["kind"]; label: string }> = [
    { kind: "school", label: "School deadlines" },
    { kind: "milestone", label: "Research" },
  ];
  const todayPos = pos(today);

  return (
    <section className="hidden rounded-lg border border-slate-200 bg-white px-5 pb-4 pt-4 md:block" aria-label="Next six months">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-slate-900">Next 6 months</h2>
        <span className="flex gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><KindMark kind="school" size={9} />School deadline</span>
          <span className="flex items-center gap-1.5"><KindMark kind="milestone" size={10} />Research milestone</span>
        </span>
      </div>
      <div className="grid grid-cols-[150px_minmax(0,1fr)] border-b border-slate-200 pb-1.5 text-xs text-slate-500">
        <span />
        <div className="grid grid-cols-6">
          {months.map((k) => <span key={k}>{monthLabel(k, { month: "short" })}</span>)}
        </div>
      </div>
      {lanes.map((lane, li) => (
        <div key={lane.kind} className={`grid grid-cols-[150px_minmax(0,1fr)] items-center ${li === 0 ? "border-b border-slate-100" : ""}`}>
          <span className="text-[13px] font-medium text-slate-900">{lane.label}</span>
          <div className="relative h-11">
            <span className="absolute inset-y-0 w-0.5 bg-blue-300" style={{ left: `${todayPos}%` }} aria-hidden="true" />
            {inRange.filter((m) => m.kind === lane.kind).map((m) => (
              <Link
                key={`${m.kind}-${m.href}-${m.date}`}
                href={m.href}
                title={`${m.label} · ${new Date(m.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                aria-label={`${m.label}, ${m.date}`}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                style={{ left: `${pos(m.date)}%` }}
              >
                {m.kind === "school" ? (
                  <i className={`block h-3 w-3 rounded-full border-2 border-white ring-1 ${m.date < today ? "bg-blue-300 ring-blue-300" : "bg-blue-600 ring-blue-600"}`} />
                ) : (
                  <i className={`block h-2.5 w-2.5 rotate-45 ${m.date < today ? "bg-violet-300" : "bg-violet-600"}`} />
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[150px_minmax(0,1fr)]">
        <span />
        <div className="relative h-4">
          <span className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-blue-700" style={{ left: `${todayPos}%` }}>
            Today
          </span>
        </div>
      </div>
    </section>
  );
}

export function JourneyTimeline({ markers }: { markers: Marker[] }) {
  if (!markers.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No confirmed dates yet. Set a deadline on a school or a target date on a milestone.
      </p>
    );
  }

  const today = todayString();
  const sorted = [...markers].sort((a, b) => a.date.localeCompare(b.date));

  const byMonth = new Map<string, Marker[]>();
  for (const m of sorted) {
    const key = m.date.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), m]);
  }
  const currentMonth = today.slice(0, 7);
  const months = Array.from(byMonth.keys());
  if (!byMonth.has(currentMonth)) months.push(currentMonth);
  months.sort();

  return (
    <div className="flex flex-col gap-4">
      <Lanes markers={sorted} today={today} />

      <div className="flex flex-wrap gap-4 text-xs text-slate-600 md:hidden">
        <span className="flex items-center gap-1.5"><KindMark kind="school" />School deadline</span>
        <span className="flex items-center gap-1.5"><KindMark kind="milestone" />Research milestone</span>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        {months.map((key) => {
          const items = byMonth.get(key) ?? [];
          const showToday = key === currentMonth;
          const before = items.filter((m) => m.date < today);
          const after = items.filter((m) => m.date >= today);

          const row = (m: Marker) => {
            const delta = days(today, m.date);
            const d = new Date(m.date + "T00:00:00");
            return (
              <Link
                key={`${m.kind}-${m.href}-${m.date}`}
                href={m.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-slate-50 ${delta < 0 ? "opacity-55" : ""}`}
              >
                <span className="flex w-10 flex-shrink-0 flex-col items-center leading-tight">
                  <span className="text-base font-semibold tabular-nums text-slate-900">{d.getDate()}</span>
                  <span className="text-[11px] text-slate-500">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                </span>
                <KindMark kind={m.kind} />
                <span className={`min-w-0 flex-1 truncate text-sm text-slate-900 ${m.kind === "school" ? "font-semibold" : ""}`}>{m.label}</span>
                <span className="whitespace-nowrap text-xs text-slate-500">{relative(delta)}</span>
              </Link>
            );
          };

          return (
            <section key={key} className="rounded-lg border border-slate-200 bg-white">
              <h2 className="flex justify-between border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-slate-600">
                <span>{monthLabel(key, { month: "long", year: "numeric" })}</span>
                <span className="font-normal normal-case tracking-normal text-slate-500">{items.length || "Nothing"}</span>
              </h2>
              <div className="px-2 py-1.5">
                {before.map(row)}
                {showToday && (
                  <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-blue-700" aria-label="today">
                    <span className="h-px flex-1 bg-blue-300" />
                    TODAY · {new Date(today + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
                    <span className="h-px flex-1 bg-blue-300" />
                  </div>
                )}
                {after.map(row)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
