import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";
import { DOC_KINDS } from "@/lib/resume";
import { hasFinalStatement, limitState, statementKindLabel } from "@/lib/statements";
import { todayString } from "@/lib/app-date";

export const metadata = { title: "Materials" };

const kindLabel = (k: string) => DOC_KINDS.find((x) => x.key === k)?.label ?? k;
const shortDate = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3";
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  final: { label: "Final", cls: "bg-blue-100 text-blue-800" },
  sent: { label: "Sent", cls: "bg-emerald-50 text-emerald-700" },
};

export default async function MaterialsOverviewPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: docs }, { data: resumes }, { data: statements }, { data: letters }, { data: schools }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("documents").select("id, title, kind, is_current, school_id, created_at").is("project_id", null).order("created_at", { ascending: false }),
    supabase.from("resumes").select("id, name, updated_at").order("updated_at", { ascending: false }),
    supabase.from("statements").select("id, title, kind, status, school_id, words, word_limit, updated_at").order("updated_at", { ascending: false }),
    supabase.from("letter_requests").select("school_id, status"),
    supabase.from("schools").select("id, name, deadline_date, letters_required").eq("applying", true).order("deadline_date", { ascending: true, nullsFirst: false }),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Materials are only available to the workspace owner.</main>;
  }
  const today = todayString();
  const docList = docs ?? [], resumeList = resumes ?? [], stList = statements ?? [], letterList = letters ?? [], applying = schools ?? [];

  const current = (kinds: string[]) => docList.filter((d) => d.is_current && kinds.includes(d.kind)).length;
  const core = [
    { label: "Resume or CV", files: current(["resume", "cv"]), extra: resumeList.length, extraLabel: "in the builder", href: "/materials/resume" },
    { label: "Transcript", files: current(["transcript"]), extra: 0, extraLabel: "", href: "/materials/documents" },
    { label: "Test scores", files: current(["scores"]), extra: 0, extraLabel: "", href: "/materials/documents" },
    { label: "Writing sample", files: current(["writing_sample"]), extra: 0, extraLabel: "", href: "/materials/documents" },
  ].map((c) => ({ ...c, done: c.files + c.extra > 0 }));
  const coreDone = core.filter((c) => c.done).length;

  const rows = applying.map((s) => {
    const mine = stList.filter((st) => st.school_id === s.id);
    const sop = mine.find((st) => st.kind === "statement_of_purpose") ?? mine[0] ?? null;
    const ls = letterList.filter((l) => l.school_id === s.id);
    const needed = Math.max(s.letters_required ?? 0, ls.length);
    return {
      s, sop, ready: hasFinalStatement(mine),
      lettersIn: ls.filter((l) => l.status === "submitted").length, needed,
      files: docList.filter((d) => d.school_id === s.id).length,
      days: s.deadline_date ? daysBetween(today, s.deadline_date) : null,
    };
  });
  const statementsReady = rows.filter((r) => r.ready).length;
  const lettersIn = letterList.filter((l) => l.status === "submitted").length;
  const edited = [
    ...stList.map((st) => ({ id: st.id, title: st.title, what: statementKindLabel(st.kind), at: st.updated_at as string, href: `/materials/statements/${st.id}` })),
    ...resumeList.map((r) => ({ id: r.id, title: r.name, what: "Resume", at: r.updated_at as string, href: `/materials/resume/${r.id}` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  const missing = core.filter((c) => !c.done).map((c) => c.label.toLowerCase());

  const tiles: Array<{ label: string; value: string; sub: string; tone?: string }> = [
    { label: "Core documents", value: `${coreDone} of ${core.length}`, sub: missing.length ? `${missing.join(", ")} missing` : "all in place", tone: coreDone === core.length ? "text-emerald-700" : undefined },
    { label: "Statements ready", value: applying.length ? `${statementsReady} of ${applying.length}` : "—", sub: applying.length ? "final or sent, per school" : "no schools marked applying" , tone: applying.length && statementsReady ? "text-blue-700" : undefined },
    { label: "Letters in", value: letterList.length ? `${lettersIn} of ${letterList.length}` : "—", sub: letterList.length ? "submitted" : "none requested yet", tone: lettersIn ? "text-emerald-700" : undefined },
    { label: "Resume versions", value: String(resumeList.length), sub: resumeList[0] ? `last edited ${shortDate(resumeList[0].updated_at)}` : "none yet" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Work" title="Materials" subtitle="What every application needs, and what is still missing." />
        <SubNav items={MATERIALS_TABS} current="/materials" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={`${card} px-4 py-3`}>
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t.label}</p>
            <p className={`text-[22px] font-semibold tabular-nums ${t.tone ?? "text-slate-900"}`}>{t.value}</p>
            <p className="truncate text-xs text-slate-500">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className={card}>
          <div className={cardHead}><h2 className="text-[15px] font-semibold text-slate-900">Core documents</h2></div>
          <ul className="px-5 py-1.5 text-sm">
            {core.map((c) => (
              <li key={c.label} className="flex items-center gap-2.5 border-b border-slate-100 py-2.5 last:border-0">
                <span aria-hidden className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[10px] ${c.done ? "bg-blue-600 text-white" : "border-[1.5px] border-dashed border-slate-400"}`}>{c.done ? "✓" : ""}</span>
                <span className="flex-1 text-slate-900">{c.label}<span className="sr-only">{c.done ? " (in place)" : " (missing)"}</span></span>
                {c.done ? (
                  <span className="text-xs text-slate-500">
                    {[c.extra ? `${c.extra} ${c.extraLabel}` : null, c.files ? `${c.files} file${c.files === 1 ? "" : "s"}` : null].filter(Boolean).join(" + ")}
                  </span>
                ) : (
                  <Link href={c.href} className="text-xs font-medium text-blue-600 hover:text-blue-700">{c.label === "Resume or CV" ? "Build or upload" : "Upload"}</Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} overflow-hidden`}>
          <div className={cardHead}>
            <h2 className="text-[15px] font-semibold text-slate-900">Per school<span className="ml-1 font-normal text-slate-500">· schools you are applying to</span></h2>
            <Link href="/readiness" className="text-[13px] font-medium text-blue-600 hover:text-blue-700">Readiness</Link>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-slate-500">No schools marked as applying yet. Open a school&apos;s Application tab and choose &ldquo;I&apos;m applying here&rdquo;.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-5 py-2.5 font-medium">School</th>
                    <th className="px-2 py-2.5 font-medium">Deadline</th>
                    <th className="px-2 py-2.5 font-medium">Statement</th>
                    <th className="px-2 py-2.5 font-medium">Letters</th>
                    <th className="px-5 py-2.5 font-medium">Files</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const badge = r.sop ? STATUS_BADGE[r.sop.status] ?? STATUS_BADGE.draft : null;
                    const over = r.sop && limitState(r.sop.words, r.sop.word_limit) === "over" ? r.sop.words - (r.sop.word_limit ?? 0) : 0;
                    return (
                      <tr key={r.s.id} className="border-t border-slate-100">
                        <td className="px-5 py-3"><Link href={`/schools/${r.s.id}?tab=application`} className="font-semibold text-slate-900 hover:text-blue-700">{r.s.name}</Link></td>
                        <td className={`whitespace-nowrap px-2 py-3 ${r.days != null && r.days <= 30 ? "font-medium text-red-700" : "text-slate-600"}`}>
                          {r.s.deadline_date ? `${shortDate(r.s.deadline_date)}${r.days != null && r.days >= 0 && r.days <= 30 ? ` · ${r.days}d` : r.days != null && r.days < 0 ? " · passed" : ""}` : "—"}
                        </td>
                        <td className="px-2 py-3">
                          {r.sop && badge ? (
                            <Link href={`/materials/statements/${r.sop.id}`} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                              {badge.label}{over > 0 ? ` · ${over} over` : ""}
                            </Link>
                          ) : <span className="text-xs text-slate-400">Not started</span>}
                        </td>
                        <td className="px-2 py-3">
                          {r.needed > 0 ? (
                            <span className="flex items-center gap-2 text-slate-600">
                              <span aria-hidden className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                                <span className={`block h-full rounded-full ${r.lettersIn >= r.needed ? "bg-emerald-600" : "bg-blue-600"}`} style={{ width: `${Math.round((r.lettersIn / r.needed) * 100)}%` }} />
                              </span>
                              <span className="tabular-nums">{r.lettersIn} of {r.needed}</span>
                            </span>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-slate-600">{r.files}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <div className={cardHead}>
            <h2 className="text-[15px] font-semibold text-slate-900">Recently uploaded</h2>
            <Link href="/materials/documents" className="text-[13px] font-medium text-blue-600 hover:text-blue-700">All documents</Link>
          </div>
          {docList.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-slate-500">Nothing uploaded yet. Add your transcript and score reports on the <Link href="/materials/documents" className="font-medium text-blue-600 hover:text-blue-700">Documents</Link> tab.</p>
          ) : (
            <ul className="px-5 py-1 text-[13px]">
              {docList.slice(0, 4).map((d) => (
                <li key={d.id} className="flex justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
                  <span className="truncate font-medium text-slate-900">{d.title}</span>
                  <span className="whitespace-nowrap text-slate-500">{kindLabel(d.kind)} · {shortDate(d.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={card}>
          <div className={cardHead}><h2 className="text-[15px] font-semibold text-slate-900">Recently edited</h2></div>
          {edited.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-slate-500">No statements or resumes yet.</p>
          ) : (
            <ul className="px-5 py-1 text-[13px]">
              {edited.map((e) => (
                <li key={e.id} className="flex justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
                  <Link href={e.href} className="truncate font-medium text-slate-900 hover:text-blue-700">{e.title}</Link>
                  <span className="whitespace-nowrap text-slate-500">{e.what} · {shortDate(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
