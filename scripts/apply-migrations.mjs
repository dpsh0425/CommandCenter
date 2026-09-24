// Applies supabase/migrations/*.sql to one project, once each, in order.
// Usage:
//   SUPABASE_PROJECT_REF=<staging-ref> node scripts/apply-migrations.mjs
//   SUPABASE_PROJECT_REF=<prod-ref>    node scripts/apply-migrations.mjs --production
//   SUPABASE_PROJECT_REF=<ref>         node scripts/apply-migrations.mjs --baseline   (record only)
// Flags:
//   --production  required to run against the production project (a guard against running it by mistake)
//   --baseline    record migrations as applied without running them
//   --force       allow --baseline on a project that already has some migrations recorded
//
// Each migration runs in one request wrapped in begin; ... commit; together with its
// record insert, so a failure rolls back both.
// Unsupported inside that wrapper: migrations containing their own begin/commit,
// create index concurrently, or alter type ... add value. Apply those by hand and
// record them with --baseline.
// Plain mode refuses a project that has tables but no migration records: run --baseline first.
import fs from "fs";
import path from "path";
import { wrapMigration, assertSafeToApply, parseArgs, assertTargetAllowed, assertBaselineAllowed } from "./lib/migrations.mjs";

const PRODUCTION_REF = "yzbpaoknnzdtrvowbvum";
const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) { console.error("Set SUPABASE_PROJECT_REF."); process.exit(2); }
console.log(`Target project: ${ref}`);
const token = process.env.SUPABASE_ACCESS_TOKEN ?? (fs.existsSync(".supabase-token") ? fs.readFileSync(".supabase-token", "utf8").trim() : null);
if (!token) { console.error("Provide SUPABASE_ACCESS_TOKEN or a .supabase-token file."); process.exit(2); }
let baseline = false;
let force = false;
let argsOk = false;
try {
  const opts = parseArgs(process.argv.slice(2));
  ({ baseline, force } = opts);
  // Before any query, so a production run by mistake sends nothing.
  assertTargetAllowed({ ref, productionRef: PRODUCTION_REF, production: opts.production });
  argsOk = true;
} catch (e) {
  console.error(e.message);
  process.exitCode = 1; // not process.exit(1): it can crash Node on Windows after network calls
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  // One request: the table exists with row-level security on, never without.
  // No policies, so the app's anon and authenticated roles can never read or write it.
  await query("create table if not exists public._applied_migrations (name text primary key, applied_at timestamptz not null default now()); alter table public._applied_migrations enable row level security;");
  const done = new Set((await query("select name from public._applied_migrations")).map((r) => r.name));
  const tables = await query("select count(*)::int as n from pg_tables where schemaname = 'public' and tablename <> '_applied_migrations'");
  assertBaselineAllowed({ baseline, recordedCount: done.size, force });
  assertSafeToApply({ baseline, recordedCount: done.size, existingTableCount: tables[0].n });

  const dir = "supabase/migrations";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;

  for (const f of files) {
    if (done.has(f)) continue;
    try {
      if (baseline) {
        await query(`insert into public._applied_migrations (name) values ('${f.replace(/'/g, "''")}');`);
        console.log(`recorded  ${f}`);
      } else {
        await query(wrapMigration(fs.readFileSync(path.join(dir, f), "utf8"), f));
        console.log(`applied   ${f}`);
      }
    } catch (e) {
      console.error(`failed ${f}: ${e.message}`);
      process.exitCode = 1;
      return;
    }
    applied++;
  }

  console.log(applied === 0 ? "Nothing to do: all migrations already recorded." : `${baseline ? "Recorded" : "Applied"} ${applied} migration(s) on ${ref}.`);
}

if (argsOk) try { await main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
