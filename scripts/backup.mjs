// Dumps every public table, the auth user list (id and email only) and the storage listing to JSON files.
// Usage: SUPABASE_PROJECT_REF=<ref> node scripts/backup.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL("../", import.meta.url));

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) { console.error("Set SUPABASE_PROJECT_REF."); process.exit(2); }
const token = process.env.SUPABASE_ACCESS_TOKEN ?? (fs.existsSync(path.join(root, ".supabase-token")) ? fs.readFileSync(path.join(root, ".supabase-token"), "utf8").trim() : null);
if (!token) { console.error("Provide SUPABASE_ACCESS_TOKEN or a .supabase-token file."); process.exit(2); }

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

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join(root, "backups", ref, stamp);
fs.mkdirSync(out, { recursive: true });

try {
  const manifest = { project: ref, createdAt: new Date().toISOString(), tables: {} };
  const tables = (await query("select tablename from pg_tables where schemaname = 'public' order by tablename")).map((r) => r.tablename);

  for (const t of tables) {
    const quoted = `public."${t.replace(/"/g, '""')}"`;
    const rows = await query(`select * from ${quoted}`);
    const [{ n }] = await query(`select count(*)::int as n from ${quoted}`);
    if (n !== rows.length) throw new Error(`Table ${t}: fetched ${rows.length} of ${n} rows`);
    fs.writeFileSync(path.join(out, `${t}.json`), JSON.stringify(rows, null, 1));
    manifest.tables[t] = rows.length;
  }

  const users = await query("select id, email, created_at from auth.users order by created_at");
  fs.writeFileSync(path.join(out, "auth-users.json"), JSON.stringify(users, null, 1));
  manifest.authUsers = users.length;

  const objects = await query("select bucket_id, name, metadata->>'size' as size, created_at from storage.objects order by bucket_id, name");
  fs.writeFileSync(path.join(out, "storage-objects.json"), JSON.stringify(objects, null, 1));
  manifest.storageObjects = objects.length;

  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  const rowTotal = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
  console.log(`Backed up ${tables.length} tables (${rowTotal} rows), ${users.length} users, ${objects.length} stored files to ${out}`);
} catch (err) {
  console.error(`Backup failed: ${err instanceof Error ? err.message : err}`);
  fs.rmSync(out, { recursive: true, force: true });
  process.exitCode = 1; // not process.exit(1): on Windows it can abort with a libuv assertion (exit 127) while fetch handles close
}
