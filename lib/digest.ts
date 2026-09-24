import type { SupabaseClient } from "@supabase/supabase-js";
import { loadReadiness } from "@/lib/readiness-data";
import { RISK_LABEL } from "@/lib/readiness";
import { loadResearchWeek, summarizeProjectWeek } from "@/lib/research-week";
import { projectStatusLabel } from "@/lib/research";
import { FLAG_LABEL, lettersToChase, type ChaseInput } from "@/lib/letters";

type Row = { primary: string; secondary?: string; right?: string; href?: string };
export type DigestSection = { title: string; note?: string; rows: Row[]; kv?: Array<{ k: string; v: string }> };
export type Digest = { subject: string; preheader: string; dateLabel: string; sections: DigestSection[]; html: string; text: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (from: string, to: string) => Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const rel = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d === -1 ? "yesterday" : d < 0 ? `${-d} days overdue` : `in ${d} days`);
const shortDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Today's date in the owner's timezone (APP_TIMEZONE, e.g. "Asia/Kathmandu"); falls back to the server's.
export function todayString(now = new Date()) {
  const tz = process.env.APP_TIMEZONE;
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz || undefined }).format(now); } catch { return ymd(now); }
}
const mondayOf = (s: string) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };

export async function buildDigest(supabase: SupabaseClient, appUrl: string): Promise<Digest> {
  const today = todayString();
  const weekEnd = addDays(today, 7);
  const in14 = addDays(today, 14);
  const tenDaysAgo = addDays(today, -10);
  const lastMonday = addDays(mondayOf(today), -7);
  const link = (p: string) => (appUrl ? `${appUrl.replace(/\/$/, "")}${p}` : undefined);

  const [readiness, research, { data: tasks }, { data: schools }, { data: letters }, { data: funds }, { data: profs }, { data: milestones }, { data: allLetters }] = await Promise.all([
    loadReadiness(supabase, today),
    loadResearchWeek(supabase, lastMonday, today),
    supabase.from("tasks").select("id, title, due_date, priority, schools(name), research_milestones(title)").not("due_date", "is", null).not("status", "in", "(done,cancelled)"),
    supabase.from("schools").select("id, name, deadline_date, status").not("deadline_date", "is", null).gte("deadline_date", today).lte("deadline_date", in14),
    supabase.from("letter_requests").select("school_id, status, letter_deadline, people(name), schools(name)").neq("status", "submitted").not("letter_deadline", "is", null).lte("letter_deadline", in14),
    supabase.from("fundings").select("school_id, name, deadline_date, schools(name)").not("deadline_date", "is", null).gte("deadline_date", today).lte("deadline_date", in14).neq("status", "not_eligible"),
    supabase.from("professors").select("id, name, outreach, last_contacted_on, schools(name)"),
    supabase.from("research_milestones").select("id, title, target_date").not("target_date", "is", null).neq("status", "done").lte("target_date", weekEnd),
    supabase.from("letter_requests").select("id, school_id, recommender_id, status, letter_deadline, asked_on, last_reminded_on, people(name), schools(name)"),
  ]);

  const sections: DigestSection[] = [];

  // 1. Applications at risk
  const atRisk = readiness.filter((r) => r.risk === "overdue" || r.risk === "urgent" || r.risk === "watch");
  if (atRisk.length > 0) {
    sections.push({
      title: "Needs attention",
      rows: atRisk.slice(0, 5).map((r) => ({
        primary: r.school.name,
        secondary: `Still to do: ${r.pending.map((p) => p.label.replace(/ \(.*\)$/, "").toLowerCase()).join(", ")}`,
        right: `${RISK_LABEL[r.risk]}${r.days != null ? `, ${rel(r.days)}` : ""}`,
        href: link(`/schools/${r.school.id}?tab=application`),
      })),
    });
  }

  // 2. Dates in the next two weeks
  const dated: Array<{ date: string; primary: string; secondary: string; href?: string }> = [
    ...((schools ?? []) as any[]).map((s) => ({ date: s.deadline_date, primary: `${s.name} application deadline`, secondary: "School application", href: link(`/schools/${s.id}?tab=application`) })),
    ...((letters ?? []) as any[]).map((l) => ({ date: l.letter_deadline, primary: `${l.people?.name ?? "Recommender"}'s letter for ${l.schools?.name}`, secondary: `Letter, ${String(l.status).replace("_", " ")}`, href: link(`/schools/${l.school_id}?tab=application`) })),
    ...((funds ?? []) as any[]).map((f) => ({ date: f.deadline_date, primary: `${f.name} (${f.schools?.name})`, secondary: "Funding", href: link(`/schools/${f.school_id}?tab=funding`) })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length > 0) {
    sections.push({ title: "Deadlines in the next two weeks", rows: dated.slice(0, 8).map((d) => ({ primary: d.primary, secondary: d.secondary, right: `${shortDate(d.date)}, ${rel(daysBetween(today, d.date))}`, href: d.href })) });
  }

  // 2b. Recommenders to chase
  const chase = lettersToChase(
    ((allLetters ?? []) as any[]).map((l): ChaseInput => ({
      id: l.id, school_id: l.school_id, school_name: l.schools?.name ?? "School", recommender_id: l.recommender_id,
      recommender_name: l.people?.name ?? "Recommender", status: l.status, letter_deadline: l.letter_deadline,
      asked_on: l.asked_on, last_reminded_on: l.last_reminded_on,
    })),
    today,
  );
  if (chase.length > 0) {
    sections.push({
      title: "Recommenders to chase",
      note: chase.length > 6 ? `${chase.length} letters need action in total.` : undefined,
      rows: chase.slice(0, 6).map(({ letter, flag, reason }) => ({
        primary: `${letter.recommender_name}: ${letter.school_name}`, secondary: reason, right: FLAG_LABEL[flag],
        href: link(`/materials/letters${letter.recommender_id ? `?focus=${letter.recommender_id}` : ""}`),
      })),
    });
  }

  // 3. Tasks and research milestones
  const T = (tasks ?? []) as any[];
  const overdue = T.filter((t) => t.due_date < today);
  const thisWeek = T.filter((t) => t.due_date >= today && t.due_date <= weekEnd).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const ms = ((milestones ?? []) as any[]).sort((a, b) => a.target_date.localeCompare(b.target_date));
  const taskRows: Row[] = [
    ...overdue.slice(0, 4).map((t) => ({ primary: t.title, secondary: [t.schools?.name, t.research_milestones?.title].filter(Boolean).join(", ") || undefined, right: rel(daysBetween(today, t.due_date)), href: link(`/tasks/${t.id}`) })),
    ...thisWeek.slice(0, 6).map((t) => ({ primary: t.title, secondary: [t.schools?.name, t.research_milestones?.title].filter(Boolean).join(", ") || undefined, right: `${shortDate(t.due_date)}, ${rel(daysBetween(today, t.due_date))}`, href: link(`/tasks/${t.id}`) })),
    ...ms.slice(0, 5).map((m) => ({ primary: m.title, secondary: "Research milestone", right: m.target_date < today ? rel(daysBetween(today, m.target_date)) : `${shortDate(m.target_date)}, ${rel(daysBetween(today, m.target_date))}`, href: link(`/research/${m.id}`) })),
  ];
  if (taskRows.length > 0) {
    sections.push({ title: "Tasks and milestones", note: overdue.length > 4 ? `${overdue.length} tasks are overdue in total.` : undefined, rows: taskRows });
  }

  // 4. Outreach
  const P = (profs ?? []) as any[];
  const followUps = P.filter((p) => (p.outreach === "contacted" || p.outreach === "no_response") && p.last_contacted_on && p.last_contacted_on <= tenDaysAgo).sort((a, b) => a.last_contacted_on.localeCompare(b.last_contacted_on)).slice(0, 5);
  const talking = P.filter((p) => p.outreach === "replied" || p.outreach === "meeting").slice(0, 4);
  const outreachRows: Row[] = [
    ...followUps.map((p) => ({ primary: `Follow up with ${p.name}`, secondary: p.schools?.name, right: `contacted ${daysBetween(p.last_contacted_on, today)} days ago`, href: link("/outreach") })),
    ...talking.map((p) => ({ primary: `Keep talking with ${p.name}`, secondary: p.schools?.name, right: String(p.outreach).replace("_", " "), href: link("/outreach") })),
  ];
  if (outreachRows.length > 0) sections.push({ title: "Professors", rows: outreachRows });

  // 5. Research, last week
  for (const r of research) {
    const lines = summarizeProjectWeek(r, true);
    const next = r.upcoming.slice(0, 4).map((u) => `${u.label} (${u.days < 0 ? `${-u.days}d overdue` : u.days === 0 ? "today" : `in ${u.days}d`})`).join("; ");
    const kv = [...lines, ...(next ? [{ k: "Coming up", v: next }] : [])];
    sections.push({ title: `Research: ${r.title}`, note: `${projectStatusLabel(r.status)}. Last week, ${shortDate(lastMonday)} to ${shortDate(addDays(lastMonday, 6))}.`, rows: [], kv: kv.length ? kv : [{ k: "Last week", v: "Nothing recorded." }] });
  }

  const urgent = atRisk.filter((r) => r.risk !== "watch").length;
  const dueCount = overdue.length + thisWeek.length;
  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const bits = [urgent && `${urgent} application${urgent === 1 ? "" : "s"} at risk`, dated.length && `${dated.length} deadline${dated.length === 1 ? "" : "s"} soon`, chase.length && `${chase.length} letter${chase.length === 1 ? "" : "s"} to chase`,dueCount && `${dueCount} task${dueCount === 1 ? "" : "s"} due`].filter(Boolean) as string[];
  const subject = bits.length ? `Your week: ${bits.join(", ")}` : `Your week ahead, ${shortDate(today)}`;
  const preheader = sections.length ? "Applications, deadlines, tasks, professors and last week's research, in one place." : "A quiet week: nothing urgent is due.";

  return { subject, preheader, dateLabel, sections, html: renderHtml({ subject, preheader, dateLabel, sections, appUrl }), text: renderText({ dateLabel, sections, appUrl }) };
}

function renderText(d: { dateLabel: string; sections: DigestSection[]; appUrl: string }) {
  const out = [`Your week ahead, ${d.dateLabel}`, ""];
  if (d.sections.length === 0) out.push("Nothing urgent is due. A good week to move an application forward.", "");
  for (const s of d.sections) {
    out.push(s.title.toUpperCase());
    if (s.note) out.push(s.note);
    s.rows.forEach((r) => out.push(`- ${r.primary}${r.right ? ` (${r.right})` : ""}${r.secondary ? `: ${r.secondary}` : ""}${r.href ? `\n  ${r.href}` : ""}`));
    s.kv?.forEach((x) => out.push(`- ${x.k}: ${x.v}`));
    out.push("");
  }
  if (d.appUrl) out.push(`Open Command Center: ${d.appUrl}`);
  return out.join("\n").trim();
}

function renderHtml(d: { subject: string; preheader: string; dateLabel: string; sections: DigestSection[]; appUrl: string }) {
  const font = "font-family:'Helvetica Neue',Arial,sans-serif;";
  const rowHtml = (r: Row) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #ece9df;${font}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="${font}font-size:15px;color:#1c1f26;line-height:1.35;">${r.href ? `<a href="${esc(r.href)}" style="color:#1c1f26;text-decoration:none;font-weight:600;">${esc(r.primary)}</a>` : `<span style="font-weight:600;">${esc(r.primary)}</span>`}${r.secondary ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">${esc(r.secondary)}</div>` : ""}</td>
        ${r.right ? `<td align="right" style="${font}font-size:13px;color:#a8691f;white-space:nowrap;padding-left:12px;vertical-align:top;">${esc(r.right)}</td>` : ""}
      </tr></table>
    </td></tr>`;
  const kvHtml = (x: { k: string; v: string }) => `
    <tr><td style="padding:7px 0;border-bottom:1px solid #ece9df;${font}font-size:14px;color:#1c1f26;line-height:1.4;"><span style="color:#6b7280;display:inline-block;min-width:130px;">${esc(x.k)}</span> ${esc(x.v)}</td></tr>`;
  const sectionHtml = (s: DigestSection) => `
    <tr><td style="padding:26px 0 6px;${font}"><div style="font-size:17px;font-weight:700;color:#1c1f26;border-bottom:2px solid #c98a3e;padding-bottom:6px;">${esc(s.title)}</div>${s.note ? `<div style="font-size:13px;color:#6b7280;margin-top:6px;">${esc(s.note)}</div>` : ""}</td></tr>
    <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.rows.map(rowHtml).join("")}${(s.kv ?? []).map(kvHtml).join("")}</table></td></tr>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f3ec;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(d.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ec;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;padding:28px 30px;">
    <tr><td style="${font}font-size:13px;color:#6b7280;">${esc(d.dateLabel)}</td></tr>
    <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;color:#1c1f26;padding-top:4px;">Your week ahead</td></tr>
    ${d.sections.length === 0 ? `<tr><td style="${font}font-size:15px;color:#1c1f26;padding-top:18px;">Nothing urgent is due. A good week to move an application forward.</td></tr>` : d.sections.map(sectionHtml).join("")}
    ${d.appUrl ? `<tr><td style="padding-top:28px;${font}"><a href="${esc(d.appUrl)}" style="background:#c98a3e;color:#1c1f26;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:6px;display:inline-block;">Open Command Center</a></td></tr>` : ""}
    <tr><td style="${font}font-size:12px;color:#9aa0aa;padding-top:26px;">Sent every Monday from your own Command Center.</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
