import { DeleteNoteButton } from "./school-controls";
import { RichHtml } from "@/components/rich-view";
import { ChevronRightIcon, FileTextIcon, SendIcon, TrophyIcon, type IconComponent } from "@/components/icons";

type Activity = {
  id: string; type: string; content: string;
  email_snippet: string | null; occurred_at: string; is_win?: boolean; html?: string;
};

const KIND: Record<string, { label: string; Icon: IconComponent }> = {
  note: { label: "Note", Icon: FileTextIcon },
  status_change: { label: "Status change", Icon: ChevronRightIcon },
  email_reply: { label: "Email reply", Icon: SendIcon },
  comment: { label: "Comment", Icon: FileTextIcon },
};

export function ActivityTimeline({ items, schoolId }: { items: Activity[]; schoolId?: string }) {
  if (!items.length) return <p className="text-sm text-slate-500">No activity yet.</p>;
  const timeZone = process.env.APP_TIMEZONE || undefined;
  const when = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
    } catch {
      return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
  };
  return (
    <ol className="flex flex-col">
      {items.map((a) => {
        const kind = KIND[a.type] ?? { label: a.type.replace(/_/g, " "), Icon: FileTextIcon };
        const Icon = a.is_win ? TrophyIcon : kind.Icon;
        return (
          <li key={a.id} className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
            <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${a.is_win ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={a.is_win ? "font-medium text-blue-700" : "text-slate-500"}>
                  {a.is_win ? "Win · " : ""}{kind.label} · {when(a.occurred_at)}
                </span>
                {schoolId && a.type === "note" && <DeleteNoteButton schoolId={schoolId} activityId={a.id} />}
              </div>
              {a.type === "note" && a.html ? (
                <RichHtml html={a.html} className="text-sm" />
              ) : (
                <p className={`whitespace-pre-line text-sm ${a.type === "status_change" ? "text-slate-600" : "text-slate-900"}`}>{a.content}</p>
              )}
              {a.email_snippet && <p className="text-[13px] italic text-slate-500">&ldquo;{a.email_snippet}&rdquo;</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
