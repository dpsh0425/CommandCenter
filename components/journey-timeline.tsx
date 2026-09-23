type Marker = { label: string; date: string; kind: "school" | "milestone" };

export function JourneyTimeline({ markers }: { markers: Marker[] }) {
  if (!markers.length) return <p className="text-sm text-gray-500">No confirmed dates yet.</p>;
  const dates = markers.map((m) => new Date(m.date).getTime());
  const min = Math.min(...dates, Date.now());
  const max = Math.max(...dates);
  const pct = (t: number) => ((t - min) / (max - min || 1)) * 100;

  return (
    <div className="relative h-32 border-b mt-8">
      <div className="absolute bottom-0 h-px bg-black" style={{ left: `${pct(Date.now())}%`, width: 2, height: "100%" }} title="today" />
      {markers.map((m, i) => (
        <div key={i} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${pct(new Date(m.date).getTime())}%` }}>
          <div className={`w-2 h-2 rounded-full mb-1 ${m.kind === "school" ? "bg-teal-600" : "bg-violet-600"}`} />
          <div className="text-[10px] text-gray-500 rotate-45 origin-top-left whitespace-nowrap mt-1">{m.label} — {m.date}</div>
        </div>
      ))}
    </div>
  );
}
