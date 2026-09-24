import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { LettersBoard } from "@/components/letters-board";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";
import { loadLetters } from "@/lib/letters-data";
import { todayString } from "@/lib/digest";

export const metadata = { title: "Letters" };

export default async function LettersPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Letters are only available to the workspace owner.</main>;
  }
  const letters = await loadLetters(supabase);
  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader title="Materials" subtitle="Your recommenders: who has been asked, who needs a nudge, and the emails to send." />
        <SubNav items={MATERIALS_TABS} current="/materials/letters" />
      </div>
      <LettersBoard letters={letters} today={todayString()} focus={focus} />
    </main>
  );
}
