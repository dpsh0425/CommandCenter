import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { LettersBoard } from "@/components/letters-board";
import { LettersMatrix } from "@/components/letters-matrix";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";
import { loadLetters } from "@/lib/letters-data";
import { letterFlags, openLetterCount } from "@/lib/letters";
import { todayString } from "@/lib/app-date";

export const metadata = { title: "Letters" };

export default async function LettersPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Letters are only available to the workspace owner.</main>;
  }
  const [letters, { data: people }, { data: schools }] = await Promise.all([
    loadLetters(supabase),
    supabase.from("people").select("id, name, email").order("name"),
    supabase.from("schools").select("id, name, deadline_date, applying").order("name"),
  ]);
  const today = todayString();
  const flagged = (f: "overdue" | "needs_reminder") => letters.filter((l) => letterFlags(l, today).includes(f)).length;
  const open = openLetterCount(letters);
  const reminders = flagged("needs_reminder");
  const overdue = flagged("overdue");
  const submitted = letters.length - open;
  const tiles: Array<{ label: string; value: number; sub: string; tone?: string }> = [
    { label: "Open letters", value: open, sub: `of ${letters.length} requested` },
    { label: "Need a reminder", value: reminders, sub: "quiet 10+ days or due soon", tone: reminders ? "text-blue-700" : undefined },
    { label: "Overdue", value: overdue, sub: "past the deadline", tone: overdue ? "text-red-700" : undefined },
    { label: "Submitted", value: submitted, sub: submitted ? "thank-you drafts ready" : "none yet", tone: submitted ? "text-emerald-700" : undefined },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Materials" title="Letters" subtitle="Your recommenders: who has been asked, who needs a nudge, and the emails to send." />
        <SubNav items={MATERIALS_TABS} current="/materials/letters" />
      </div>
      {letters.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t.label}</p>
              <p className={`text-[22px] font-semibold tabular-nums ${t.tone ?? "text-slate-900"}`}>{t.value}</p>
              <p className="text-xs text-slate-500">{t.sub}</p>
            </div>
          ))}
        </div>
      )}
      <LettersMatrix letters={letters} today={today} />
      <LettersBoard letters={letters} people={people ?? []} schools={schools ?? []} today={today} focus={focus} />
    </main>
  );
}
