import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { formatMinutes, kindLabel } from "@/lib/research";
import type { PersonWeek } from "@/lib/team-week";

const list = (items: string[], max = 3) => (items.length <= max ? items.join("; ") : `${items.slice(0, max).join("; ")} and ${items.length - max} more`);
const navBtn = "inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50";

export function TeamWeek({
  projectId, people, unattributedMinutes, unattributedEntries, offset, label, isPast,
}: { projectId: string; people: PersonWeek[]; unattributedMinutes: number; unattributedEntries: number; offset: number; label: string; isPast: boolean }) {
  const base = `/research/projects/${projectId}?tab=team`;
  const maxMinutes = Math.max(1, ...people.map((p) => p.minutes), unattributedMinutes);
  const total = people.reduce((n, p) => n + p.minutes, 0) + unattributedMinutes;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-slate-900">
          {offset === 0 ? "This week" : offset === -1 ? "Last week" : offset === 1 ? "Next week" : "Week of"}{" "}
          <span className="font-normal text-slate-500">{label}{total > 0 && ` · ${formatMinutes(total)} logged`}</span>
        </h2>
        <nav className="flex gap-1.5" aria-label="Choose week">
          <Link href={`${base}&w=${offset - 1}`} scroll={false} className={navBtn}>← Previous</Link>
          {offset !== 0 && <Link href={base} scroll={false} className={navBtn}>This week</Link>}
          {offset < 4 && <Link href={`${base}&w=${offset + 1}`} scroll={false} className={navBtn}>Next →</Link>}
        </nav>
      </div>

      {people.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-[13px] text-slate-500">
          No one is on this project yet, and nobody has been credited with any work. Add people below, then set &ldquo;who did it&rdquo; when you log work or assign tasks.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
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
              <li key={p.id ?? p.name} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-[18px] py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} color={p.color} size={36} />
                  <div className="min-w-0 flex-1">
                    {p.id ? (
                      <Link href={`/people/${p.id}`} className="block truncate text-[15px] font-semibold text-slate-900 hover:text-blue-700">{p.name}</Link>
                    ) : (
                      <span className="block truncate text-[15px] font-semibold text-slate-900">{p.name}</span>
                    )}
                    <span className="text-xs text-slate-500">{[p.role, p.onTeam ? null : "not on the team"].filter(Boolean).join(" · ") || "team member"}</span>
                  </div>
                  <div className="whitespace-nowrap text-right text-xs text-slate-600">
                    <div>{p.tasksOpen} open task{p.tasksOpen === 1 ? "" : "s"}</div>
                    {p.tasksOverdue > 0 && <div className="font-medium text-red-700">{p.tasksOverdue} overdue</div>}
                    {!isPast && p.tasksDueThisWeek > 0 && <div>{p.tasksDueThisWeek} due this week</div>}
                  </div>
                </div>
                {p.minutes > 0 && (
                  <div className="flex items-center gap-2.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.round((p.minutes / maxMinutes) * 100)}%` }} /></span>
                    <span className="text-[13px] font-semibold tabular-nums text-slate-900">{formatMinutes(p.minutes)}</span>
                  </div>
                )}
                {rows.length > 0 ? (
                  <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                    {rows.map((r) => (
                      <div key={r.k} className="contents">
                        <dt className="text-slate-500">{r.k}</dt>
                        <dd className="break-words text-slate-800">{r.v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[13px] text-slate-500">{quiet ? (p.sectionsOwned > 0 ? `Nothing recorded ${isPast ? "that week" : "yet"}. Owns ${p.sectionsOwned} unfinished section${p.sectionsOwned === 1 ? "" : "s"}.` : `Nothing recorded ${isPast ? "that week" : "yet"}.`) : ""}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {unattributedEntries > 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-[13px] text-slate-600">
          {unattributedEntries} journal {unattributedEntries === 1 ? "entry" : "entries"}{unattributedMinutes ? ` (${formatMinutes(unattributedMinutes)})` : ""} {unattributedEntries === 1 ? "has" : "have"} no &ldquo;who did it&rdquo; set, so {unattributedEntries === 1 ? "it isn’t" : "they aren’t"} counted above. Set the person when you log work.
        </p>
      )}
    </section>
  );
}
