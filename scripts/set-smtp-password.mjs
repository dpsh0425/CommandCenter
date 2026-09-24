// Points Supabase's outgoing mail (magic links, password resets, invites) at Resend with a working key.
// Dry run by default: it tests the key against Resend and shows what it would change. Nothing changes without --apply.
// Usage (PowerShell, from the project folder):
//   $env:SUPABASE_PROJECT_REF="<ref>"; node scripts/set-smtp-password.mjs            (check only)
//   $env:SUPABASE_PROJECT_REF="<ref>"; node scripts/set-smtp-password.mjs --apply    (change it)
// The key is read from SMTP_KEY, else RESEND_API_KEY in .env.local. Use a key made just for Supabase mail, so rotating
// the app's digest key later cannot break login emails.
import fs from "fs";
import tls from "tls";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) { console.error("Set SUPABASE_PROJECT_REF."); process.exitCode = 2; }
const token = process.env.SUPABASE_ACCESS_TOKEN ?? (fs.existsSync(".supabase-token") ? fs.readFileSync(".supabase-token", "utf8").trim() : null);
if (!token) { console.error("Provide SUPABASE_ACCESS_TOKEN or a .supabase-token file."); process.exitCode = 2; }
const apply = process.argv.includes("--apply");

function readKey() {
  if (process.env.SMTP_KEY) return process.env.SMTP_KEY.trim();
  if (!fs.existsSync(".env.local")) return null;
  const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith("RESEND_API_KEY="));
  return line ? line.slice("RESEND_API_KEY=".length).replace(/^"|"$/g, "").trim() : null;
}

// Logs in to Resend's mail server with the key. No mail is sent.
function smtpLogin(pass) {
  return new Promise((resolve) => {
    const s = tls.connect(465, "smtp.resend.com", { servername: "smtp.resend.com" });
    let buf = "";
    let step = 0;
    const finish = (r) => { clearTimeout(timer); try { s.end(); } catch { /* closing */ } resolve(r); };
    const timer = setTimeout(() => finish({ ok: false, detail: "timed out" }), 15000);
    const send = (x) => s.write(x + "\r\n");
    s.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] ?? "";
      if (!buf.endsWith("\n") || /^\d{3}-/.test(last)) return;
      buf = "";
      if (step === 0) { send("EHLO set-smtp-password"); step = 1; }
      else if (step === 1) { send("AUTH LOGIN"); step = 2; }
      else if (step === 2) { send(Buffer.from("resend").toString("base64")); step = 3; }
      else if (step === 3) { send(Buffer.from(pass).toString("base64")); step = 4; }
      else { finish({ ok: last.startsWith("235"), detail: last.slice(0, 60) }); }
    });
    s.on("error", (e) => finish({ ok: false, detail: e.message }));
  });
}

async function main() {
  if (!ref || !token) return;
  const key = readKey();
  if (!key || !key.startsWith("re_")) { console.error("No Resend key found. Set SMTP_KEY to a key that starts with re_."); { process.exitCode = 2; return; } }

  const login = await smtpLogin(key);
  console.log(`Resend accepts this key: ${login.ok ? "YES" : "NO"} (${login.detail})`);
  if (!login.ok) { console.error("Not changing anything: this key does not work. Create a new key in Resend (Sending access) and set SMTP_KEY."); { process.exitCode = 1; return; } }

  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const cur = await (await fetch(url, { headers })).json();
  console.log(`Supabase mail settings now: host ${cur.smtp_host}, port ${cur.smtp_port}, user ${cur.smtp_user}, from ${cur.smtp_admin_email}`);
  console.log("Will set: host smtp.resend.com, port 465, user resend, and the password to the key above.");

  if (!apply) { console.log("Dry run only. Run again with --apply to make the change."); { process.exitCode = 0; return; } }

  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ smtp_host: "smtp.resend.com", smtp_port: "465", smtp_user: "resend", smtp_pass: key, smtp_admin_email: cur.smtp_admin_email || "kcc@kacof.tech", smtp_sender_name: cur.smtp_sender_name || "Command Center" }),
  });
  if (!res.ok) { console.error(`Could not update: ${res.status} ${(await res.text()).slice(0, 300)}`); { process.exitCode = 1; return; } }
  console.log("Updated. Now try the magic link or forgot-password again.");
}

main().catch((e) => { console.error(`Failed: ${e.message}`); process.exitCode = 1; });
