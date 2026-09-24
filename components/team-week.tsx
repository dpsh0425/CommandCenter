import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { formatMinutes, kindLabel } from "@/lib/research";
import type { PersonWeek } from "@/lib/team-week";

const list = (items: string[], max = 3) => (items.length <= max ? items.join("; ") : `${items.slice(0, max).join("; ")} and ${items.length - max} more`);

export function TeamWeek({
  projectId, people, unattributedMinutes, unattributedEntries, offset, label, isPast,
}: { projectId: string; people: PersonWeek[]; unattributedMinutes: number; unattributedEntries: number; offset: number; label: string; isPast: boolean }) {
  const base = `/research/projects/${projectId}?tab=team`;
  const nav = "text-sm text-gray-500 hover:text-cream";
  const maxMinutes = Math.max(1, ...people.map((p) => p.minutes), unattributedMinutes);
  const total = people.reduce((n, p) => n + p.minutes, 0) + unattributedMinutes;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 className="font-sans text-[15px] font-semibold text-cream">
          {offset === 0 ? "This week" : offset === -1 ? "Last week" : offset === 1 ? "Next week" : "Week of"} <span className="font-normal text-gray-400">{label}</span>
          {total > 0 && <span className="font-normal text-gray-400"> · {formatMinutes(total)} logged</span>}
        </h2>
        <div className="flex gap-4">
          <Link href={`${base}&w=${offset - 1}`} className={nav}>← Previous</Link>
          {offset !== 0 && <Link href={base} className={nav}>This week</Link>}
          {offset < 4 && <Link href={`${base}&w=${offset + 1}`} className={nav}>Next →</Link>}
        </div>
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-gray-500">No one is on this project yet, and nobody has been credited with any work. Add people below, then set &ldquo;who did it&rdquo; when you log work or assign tasks.</p>
      ) : (
        <ul className="flex flex-col">
          {people.map((p) => {
            const quiet = p.minutes === 0 && p.tasksDone.length === 0 && p.experiments.length === 0 && p.sectionsEdited.length === 0 && p.meetings.length === 0;
            const rows: Array<{ k: string; v: React.ReactNode }> = [];
            if (p.minutes > 0) rows.push({ k: "Time", v: `${formatMinutes(p.minutes)} in ${p.entryCount} ${p.entryCount === 1 ? "entry" : "entries"}. ${p.byKind.slice(0, 3).map((x) => `${kindLabel(x.kind)} ${formatMinutes(x.minutes)}`).join(", ")}` });
            else if (p.entryCount > 0) rows.push({ k: "Time", v: `${p.entryCount} ${p.entryCount === 1 ? "entry" : "entries"}, no minutes recorded` });
            if (p.recent.length > 0) rows.push({ k: "Worked on", v: list(p.recent) });
            if (p.experiments.length > 0) rows.push({ k: "Experiments", v: list(p.experiments.map((x) => `${x.name} (${x.note})`)) });
            if (p.tasksDone.length > 0) rows.push({ k: "Tasks done", v: list(p.tasksDone) });
            if (p.sectionsEdited.length > 0) rows.push({ k: "Writing", v: `edited ${list(p.sectionsEdited)}` });
            if (p.meetings.length > 0) rows.push({ k: "Meetings", v: list(p.meetings) });
            return (
              <li key={p.id ?? p.name} className="border-b border-line/60 last:border-0 py-4 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} color={p.color} size={32} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/people/${p.id}`} className="font-medium hover:text-brass block truncate">{p.name}</Link>
                    <span className="text-xs text-gray-500">{[p.role, p.onTeam ? null : "not on the team"].filter(Boolean).join(" · ") || "team member"}</span>
                  </div>
                  <div className="text-right text-xs text-gray-500 whitespace-nowrap">
                    <div>{p.tasksOpen} open task{p.tasksOpen === 1 ? "" : "s"}</div>
                    {p.tasksOverdue > 0 && <div className="text-red-600">{p.tasksOverdue} overdue</div>}
                    {!isPast && p.tasksDueThisWeek > 0 && <div>{p.tasksDueThisWeek} due this week</div>}
                  </div>
                </div>
                {p.minutes > 0 && <div className="h-1 rounded bg-surface-raised overflow-hidden"><div className="h-full bg-brass" style={{ width: `${Math.round((p.minutes / maxMinutes) * 100)}%` }} /></div>}
                {rows.length > 0 ? (
                  <dl className="flex flex-col text-sm">
                    {rows.map((r) => (
                      <div key={r.k} className="flex gap-4 py-1">
                        <dt className="w-28 flex-shrink-0 text-gray-500">{r.k}</dt>
                        <dd className="min-w-0 break-words">{r.v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-gray-400">{quiet ? (p.sectionsOwned > 0 ? `Nothing recorded ${isPast ? "that week" : "yet"}. Owns ${p.sectionsOwned} unfinished section${p.sectionsOwned === 1 ? "" : "s"}.` : `Nothing recorded ${isPast ? "that week" : "yet"}.`) : ""}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {unattributedEntries > 0 && (
        <p className="text-sm text-gray-500 border-t border-line pt-3">
          {unattributedEntries} journal {unattributedEntries === 1 ? "entry" : "entries"}{unattributedMinutes ? ` (${formatMinutes(unattributedMinutes)})` : ""} {unattributedEntries === 1 ? "has" : "have"} no &ldquo;who did it&rdquo; set, so {unattributedEntries === 1 ? "it isn&rsquo;t" : "they aren&rsquo;t"} counted above. Set the person when you log work.
        </p>
      )}
    </section>
  );
}
