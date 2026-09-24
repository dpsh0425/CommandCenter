// Runs supabase/tests/*.sql against one Supabase project through the Management API.
// Each file must return rows shaped { name, ok }.
// Usage: SUPABASE_PROJECT_REF=<ref> node scripts/db-test.mjs
import fs from "fs";
import path from "path";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) {
  console.error("Set SUPABASE_PROJECT_REF to the project to test.");
  process.exit(2);
}
const token = process.env.SUPABASE_ACCESS_TOKEN ?? (fs.existsSync(".supabase-token") ? fs.readFileSync(".supabase-token", "utf8").trim() : null);
if (!token) {
  console.error("Provide SUPABASE_ACCESS_TOKEN or a .supabase-token file.");
  process.exit(2);
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

const dir = "supabase/tests";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
if (files.length === 0) {
  console.error(`No test files found in ${dir}. A run with nothing to check counts as a failure.`);
  process.exit(1);
}
let total = 0;
let failed = 0;

for (const f of files) {
  let rows;
  try {
    rows = await query(fs.readFileSync(path.join(dir, f), "utf8"));
  } catch (e) {
    total++; failed++;
    console.log(`ERROR ${f}: ${e.message}`);
    continue;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    total++; failed++;
    console.log(`FAIL  ${f}: returned no rows (a test must return at least one { name, ok } row)`);
    continue;
  }
  for (const r of rows) {
    total++;
    if (r.ok === true) console.log(`PASS  ${f} ${r.name}`);
    else { failed++; console.log(`FAIL  ${f} ${r.name}`); }
  }
}

console.log(`\n${total - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
