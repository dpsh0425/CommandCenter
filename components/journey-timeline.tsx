import Link from "next/link";

type Marker = { label: string; date: string; kind: "school" | "milestone"; href: string };

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const days = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);

function relative(delta: number) {
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "yesterday";
  return delta > 0 ? `in ${delta}d` : `${-delta}d ago`;
}

export function JourneyTimeline({ markers }: { markers: Marker[] }) {
  if (!markers.length) {
    return (
      <p className="text-sm text-gray-500 border border-dashed border-line rounded p-6 text-center">
        No confirmed dates yet. Set a deadline on a school or a target date on a milestone.
      </p>
    );
  }

  const today = localDate(new Date());
  const sorted = [...markers].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((m) => m.date >= today).length;

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
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-teal-600" />school deadline</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-violet-600" />research milestone</span>
        <span className="ml-auto font-mono">{upcoming} upcoming</span>
      </div>

      {months.map((key) => {
        const items = byMonth.get(key) ?? [];
        const label = new Date(key + "-01T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
        const showToday = key === currentMonth;
        const before = items.filter((m) => m.date < today);
        const after = items.filter((m) => m.date >= today);

        const row = (m: Marker) => {
          const delta = days(today, m.date);
          return (
            <Link
              key={`${m.kind}-${m.href}`}
              href={m.href}
              className={`flex items-center gap-3 border rounded p-3 text-sm hover:border-brass ${delta < 0 ? "opacity-50" : ""}`}
            >
              <i className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.kind === "school" ? "bg-teal-600" : "bg-violet-600"}`} />
              <span className="flex-1 min-w-0">{m.label}</span>
              <span className="text-right text-xs text-gray-500 whitespace-nowrap">
                <span className="font-mono">{m.date.slice(5)}</span>
                <span className="block">{relative(delta)}</span>
              </span>
            </Link>
          );
        };

        return (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="text-xs uppercase tracking-wide text-gray-500">{label}</h2>
            {before.map(row)}
            {showToday && (
              <div className="flex items-center gap-2 text-xs text-brass font-mono" aria-label="today">
                <span className="h-px flex-1 bg-brass" />
                <span>today · {today}</span>
                <span className="h-px flex-1 bg-brass" />
              </div>
            )}
            {after.map(row)}
          </section>
        );
      })}
    </div>
  );
}
