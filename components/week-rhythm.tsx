// Seven dots for the current week. A dot fills when something moved forward that day
// (a task finished, a win logged, a professor contacted). It is a nudge, not a score.
export function WeekRhythm({ days }: { days: Array<{ label: string; date: string; active: boolean; isToday: boolean; future: boolean }> }) {
  const activeCount = days.filter((d) => d.active).length;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="flex gap-2" role="img" aria-label={`${activeCount} active days this week`}>
        {days.map((d) => (
          <div key={d.date} className="flex flex-col items-center gap-1.5" title={d.date}>
            <span
              className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] transition-colors ${
                d.active ? "bg-blue-600 border-blue-600 text-white font-medium" : d.future ? "border-slate-200/60 text-slate-400" : "border-slate-200 text-slate-400"
              } ${d.isToday ? "ring-2 ring-blue-600/40 ring-offset-2 ring-offset-white" : ""}`}
            >
              {d.active ? "✓" : ""}
            </span>
            <span className={`text-[10px] uppercase tracking-wider ${d.isToday ? "text-slate-900" : "text-slate-400"}`}>{d.label}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        {activeCount === 0 ? "A fresh week. One small step today starts the rhythm." : `${activeCount} day${activeCount === 1 ? "" : "s"} moving forward this week.`}
      </p>
    </div>
  );
}
