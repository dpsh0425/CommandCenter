type Activity = {
  id: string; type: string; content: string;
  email_snippet: string | null; occurred_at: string;
};

export function ActivityTimeline({ items }: { items: Activity[] }) {
  if (!items.length) return <p className="text-sm text-gray-500">No activity yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((a) => (
        <li key={a.id} className="border rounded p-3 text-sm">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="uppercase">{a.type.replace("_", " ")}</span>
            <span>{new Date(a.occurred_at).toLocaleString()}</span>
          </div>
          <p>{a.content}</p>
          {a.email_snippet && <p className="text-gray-500 italic mt-1">"{a.email_snippet}"</p>}
        </li>
      ))}
    </ul>
  );
}
