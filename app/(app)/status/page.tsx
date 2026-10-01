import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OWNER_USER_ID } from "@/lib/owner";
import { PageHeader } from "@/components/ui";
import { OPTIONAL_ENV, REQUIRED_ENV, missingEnv } from "@/lib/env";
import vercelConfig from "@/vercel.json";

export const metadata = { title: "Status" };
export const dynamic = "force-dynamic";

// What each optional setting switches on, so a gap explains itself.
const OPTIONAL_EFFECT: Record<string, string> = {
  RESEND_API_KEY: "email off", DIGEST_FROM: "email off", CRON_SECRET: "scheduled email off", APP_URL: "email links fall back", APP_TIMEZONE: "dates use the server clock",
};
// The tables shown under "Your data", with the column that says when a row last changed.
const TABLES: Array<{ area: string; table: string; at: string }> = [
  { area: "Schools", table: "schools", at: "updated_at" },
  { area: "Activity", table: "activity_log", at: "occurred_at" },
  { area: "Tasks", table: "tasks", at: "updated_at" },
  { area: "People", table: "people", at: "created_at" },
  { area: "Letters", table: "letter_requests", at: "updated_at" },
  { area: "Professors", table: "professors", at: "created_at" },
  { area: "Funding", table: "fundings", at: "created_at" },
  { area: "Statements", table: "statements", at: "updated_at" },
  { area: "Documents", table: "documents", at: "created_at" },
  { area: "Resumes", table: "resumes", at: "updated_at" },
  { area: "Research milestones", table: "research_milestones", at: "created_at" },
  { area: "Links", table: "links", at: "created_at" },
];
const DAY = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3";
const ok = "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700";
const off = "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600";
const bad = "rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700";

/** "15 1 * * 1" (UTC) → "Mondays at 07:00 (Asia/Kathmandu)". Only the simple weekly/daily shapes are described. */
function describeCron(expr: string, timeZone: string | undefined) {
  const [min, hour, dom, mon, dow] = expr.trim().split(/\s+/);
  if (!/^\d+$/.test(min) || !/^\d+$/.test(hour) || dom !== "*" || mon !== "*") return `${expr} (UTC)`;
  const ref = new Date(Date.UTC(2026, 0, 4 + (/^\d$/.test(dow) ? Number(dow) : 0), Number(hour), Number(min))); // 2026-01-04 is a Sunday
  try {
    const time = ref.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
    const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(ref);
    const when = dow === "*" ? "Every day" : `${day}s`;
    return `${when} at ${time}${timeZone ? ` (${timeZone})` : " (UTC)"}`;
  } catch {
    return `${dow === "*" ? "Every day" : DAY[Number(dow)] ?? expr} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`;
  }
}

const stamp = (iso: string, timeZone: string | undefined) => {
  try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }); }
  catch { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
};

export default async function StatusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Status is only available to the workspace owner.</main>;
  }
  const timeZone = process.env.APP_TIMEZONE || undefined;

  // Same check as /api/health: required settings present, then one small query with the server key.
  const missingRequired = missingEnv(REQUIRED_ENV);
  const missingOptional = missingEnv(OPTIONAL_ENV);
  let db = false;
  let ms: number | null = null;
  if (missingRequired.length === 0) {
    const t0 = Date.now();
    try {
      const { error } = await createAdminClient().from("schools").select("id").limit(1);
      db = !error;
    } catch {
      db = false;
    }
    ms = Date.now() - t0;
  }

  // Row counts and the latest change, read as you (row-level security applies), so they show only what you can see.
  const rows = await Promise.all(
    TABLES.map(async (t) => {
      const [{ count, error }, { data: latest }] = await Promise.all([
        supabase.from(t.table).select("*", { count: "exact", head: true }),
        supabase.from(t.table).select(t.at).order(t.at, { ascending: false }).limit(1),
      ]);
      const at = (latest?.[0] as Record<string, string> | undefined)?.[t.at] ?? null;
      return { ...t, count: error ? null : count ?? 0, latest: at };
    }),
  );
  const crons = ((vercelConfig as { crons?: Array<{ path: string; schedule: string }> }).crons ?? []);

  const checks = [
    {
      title: "Database reachable", good: db, warn: false,
      sub: missingRequired.length ? "not checked: required settings missing" : db ? `answered in ${ms} ms` : "no answer to a test query",
    },
    { title: "Required settings", good: missingRequired.length === 0, warn: false, sub: `${REQUIRED_ENV.length - missingRequired.length} of ${REQUIRED_ENV.length} present` },
    {
      title: "Optional settings", good: missingOptional.length === 0, warn: missingOptional.length > 0,
      sub: `${OPTIONAL_ENV.length - missingOptional.length} of ${OPTIONAL_ENV.length} present${missingOptional.some((n) => OPTIONAL_EFFECT[n] === "email off") ? " · email sending off" : ""}`,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow="Settings" title="Status" subtitle="Checked when you open this page. Only you can see it." />

      <div className="grid gap-3 sm:grid-cols-3">
        {checks.map((c) => (
          <div key={c.title} className={`${card} flex items-center gap-3 px-4 py-3.5`}>
            <span
              aria-hidden
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                c.good ? "bg-emerald-50 text-emerald-700" : c.warn ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
              }`}
            >
              {c.good ? "✓" : "!"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{c.title}<span className="sr-only">{c.good ? ": OK" : ": needs attention"}</span></p>
              <p className="truncate text-xs text-slate-500">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className={card}>
            <div className={cardHead}><h2 className="text-[15px] font-semibold text-slate-900">Settings</h2><span className="text-xs text-slate-500">Names only</span></div>
            <ul className="px-5 py-1.5 text-[13px]">
              {REQUIRED_ENV.map((n) => (
                <li key={n} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
                  <code className="truncate font-mono text-xs text-slate-800">{n}</code>
                  <span className={missingRequired.includes(n) ? bad : ok}>{missingRequired.includes(n) ? "Missing" : "Set"}</span>
                </li>
              ))}
              <li className="pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Optional</li>
              {OPTIONAL_ENV.map((n) => (
                <li key={n} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <code className="truncate font-mono text-xs text-slate-800">{n}</code>
                  {missingOptional.includes(n)
                    ? <span className={off}>Not set · {OPTIONAL_EFFECT[n] ?? "off"}</span>
                    : <span className={ok}>{n === "APP_TIMEZONE" ? process.env.APP_TIMEZONE : "Set"}</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <div className={cardHead}><h2 className="text-[15px] font-semibold text-slate-900">Scheduled jobs</h2></div>
            {crons.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-slate-500">No scheduled jobs are configured.</p>
            ) : (
              <ul className="px-5 py-2 text-[13px]">
                {crons.map((c) => (
                  <li key={c.path + c.schedule} className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0">
                    <span className="flex flex-wrap justify-between gap-2">
                      <span className="font-semibold text-slate-900">{c.path === "/api/digest" ? "Monday email" : c.path}</span>
                      <span className="text-slate-600">{describeCron(c.schedule, timeZone)}</span>
                    </span>
                    <span className="text-xs text-slate-500">As configured in vercel.json. Runs aren&apos;t logged, so the last run time isn&apos;t known.</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className={`${card} overflow-hidden`}>
          <div className={cardHead}>
            <h2 className="text-[15px] font-semibold text-slate-900">Your data</h2>
            <span className="text-xs text-slate-500">Rows you can see · latest change</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Area</th>
                  <th className="px-2 py-2.5 font-medium">Table</th>
                  <th className="px-2 py-2.5 text-right font-medium">Rows</th>
                  <th className="px-5 py-2.5 text-right font-medium">Latest</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.table} className="border-t border-slate-100">
                    <td className="px-5 py-2.5 font-medium text-slate-900">{r.area}</td>
                    <td className="px-2 py-2.5"><code className="font-mono text-xs text-slate-600">{r.table}</code></td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{r.count == null ? <span className="text-xs font-medium text-red-700">couldn&apos;t read</span> : r.count.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right text-slate-500">{r.latest ? stamp(r.latest, timeZone) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
