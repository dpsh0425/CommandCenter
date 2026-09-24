import { DeleteNoteButton } from "./school-controls";
import { RichHtml } from "@/components/rich-view";

type Activity = {
  id: string; type: string; content: string;
  email_snippet: string | null; occurred_at: string; is_win?: boolean; html?: string;
};

const TONE: Record<string, string> = {
  note: "border-l-brass", status_change: "border-l-line", email_reply: "border-l-teal-600", comment: "border-l-violet-600",
};

export function ActivityTimeline({ items, schoolId }: { items: Activity[]; schoolId?: string }) {
  if (!items.length) return <p className="text-sm text-gray-500">No activity yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((a) => (
        <li key={a.id} className={`border border-l-4 ${a.is_win ? "border-l-teal-600" : TONE[a.type] ?? "border-l-line"} rounded p-2.5 text-sm`}>
          <div className="flex justify-between gap-2 text-xs text-gray-500 mb-0.5">
            <span className="uppercase">{a.is_win ? "win · " : ""}{a.type.replace("_", " ")}</span>
            <span className="flex items-center gap-2">
              {new Date(a.occurred_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {schoolId && a.type === "note" && <DeleteNoteButton schoolId={schoolId} activityId={a.id} />}
            </span>
          </div>
          {a.type === "note" && a.html ? <RichHtml html={a.html} className="text-sm" /> : <p className="whitespace-pre-line">{a.content}</p>}
          {a.email_snippet && <p className="text-gray-500 italic mt-1">&ldquo;{a.email_snippet}&rdquo;</p>}
        </li>
      ))}
    </ul>
  );
}
