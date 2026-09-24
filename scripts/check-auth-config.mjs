// Checks (and with --fix, repairs) the Supabase Auth settings that keep the app invite-only.
// Usage:
//   SUPABASE_PROJECT_REF=<ref> node scripts/check-auth-config.mjs
//   SUPABASE_PROJECT_REF=<ref> node scripts/check-auth-config.mjs --fix
//   SUPABASE_PROJECT_REF=<ref> node scripts/check-auth-config.mjs --production
import fs from "fs";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) { console.error("Set SUPABASE_PROJECT_REF."); process.exit(2); }
const token = process.env.SUPABASE_ACCESS_TOKEN ?? (fs.existsSync(".supabase-token") ? fs.readFileSync(".supabase-token", "utf8").trim() : null);
if (!token) { console.error("Provide SUPABASE_ACCESS_TOKEN or a .supabase-token file."); process.exit(2); }
const fix = process.argv.includes("--fix");
const production = process.argv.includes("--production");

const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// Read the body as text first so a non-JSON error page still reports its HTTP status.
const parseBody = (text) => {
  try { return JSON.parse(text); } catch { return undefined; }
};
const get = async () => {
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
  const body = parseBody(text);
  if (body === undefined || body === null || typeof body !== "object") {
    throw new Error(`${res.status} response was not a JSON object: ${text.slice(0, 200)}`);
  }
  return body;
};

async function main() {
  let cfg = await get();

  if (fix && cfg.disable_signup !== true) {
    const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify({ disable_signup: true }) });
    if (!res.ok) {
      console.error(`Could not update: ${res.status} ${(await res.text()).slice(0, 500)}`);
      process.exitCode = 1;
      return;
    }
    console.log("Set disable_signup to true.");
    cfg = await get();
  }

  const checks = [
    { name: "public sign-up is disabled (invite-only)", ok: cfg.disable_signup === true },
    { name: "custom SMTP is configured", ok: !!cfg.smtp_host },
    ...(production ? [{ name: "site URL is not localhost", ok: !!cfg.site_url && !/localhost|127\.0\.0\.1/.test(cfg.site_url) }] : []),
  ];

  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  console.log(`site_url: ${cfg.site_url}`);
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
}

main().catch((err) => {
  console.error(`Auth config check failed: ${err.message}`);
  process.exitCode = 1;
});
