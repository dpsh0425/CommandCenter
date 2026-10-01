import { StatementsList } from "@/components/statements-list";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";

export const metadata = { title: "Statements" };

export default function StatementsPage() {
  const mockStatements = [
    {
      id: "1",
      kind: "sop",
      title: "Personal statement: Stanford University",
      status: "Sent",
      words: 650,
      word_limit: 1000,
      school_id: "sch_1",
      updated_at: new Date().toISOString(),
    },
    {
      id: "2",
      kind: "sop",
      title: "Statement of purpose (general draft)",
      status: "Draft",
      words: 420,
      word_limit: 800,
      school_id: null,
      updated_at: new Date().toISOString(),
    },
  ];

  const mockSchools = [
    { id: "sch_1", name: "Stanford University" },
    { id: "sch_2", name: "MIT" },
    { id: "sch_3", name: "Harvard University" },
  ];

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Materials"
          subtitle="Draft personal statements and SOPs tailored to each school."
        />
        <SubNav items={MATERIALS_TABS} current="/materials/statements" />
      </div>
      <StatementsList
        statements={mockStatements}
        schools={mockSchools}
      />
    </main>
  );
}