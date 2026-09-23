// Builds the branded Supabase Auth email templates into supabase/email-templates/
// and, with --apply, pushes them (plus subjects) to the project via the Management API.
//   node scripts/email-templates.mjs          -> write HTML files only
//   node scripts/email-templates.mjs --apply  -> also PATCH the project's auth config
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "yzbpaoknnzdtrvowbvum";

const C = {
  bg: "#12151c", card: "#1a1f29", raised: "#212836", line: "#313a4a",
  cream: "#e9e7de", muted: "#9aa2b1", dim: "#6f7686", brass: "#c98a3e", ink: "#12151c",
};

// {{ .RedirectTo }} is the origin we pass from the app; SiteURL is the fallback.
const BASE = `{{ if .RedirectTo }}{{ .RedirectTo }}{{ else }}{{ .SiteURL }}/auth/confirm{{ end }}`;
const link = (type) => `${BASE}?token_hash={{ .TokenHash }}&type=${type}`;

function layout({ preheader, eyebrow, title, body, cta, ctaHref, note }) {
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td style="background:${C.brass};border-radius:6px">
         <a href="${ctaHref}" style="display:inline-block;padding:13px 26px;font:600 15px 'Helvetica Neue',Arial,sans-serif;color:${C.ink};text-decoration:none">${cta}</a>
       </td></tr></table>
       <p style="margin:12px 0 0;font:12px/1.6 'Helvetica Neue',Arial,sans-serif;color:${C.dim}">Button not working? Paste this link into your browser:<br>
         <a href="${ctaHref}" style="color:${C.brass};word-break:break-all">${ctaHref}</a></p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg}">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
    <tr><td style="padding:0 4px 20px">
      <span style="font:italic 26px Georgia,'Times New Roman',serif;color:${C.cream}">Command Center</span>
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${C.brass};margin-left:6px;vertical-align:middle"></span>
    </td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:36px 32px">
      <p style="margin:0 0 10px;font:11px 'Courier New',monospace;letter-spacing:.2em;text-transform:uppercase;color:${C.brass}">${eyebrow}</p>
      <h1 style="margin:0 0 16px;font:normal 28px/1.25 Georgia,'Times New Roman',serif;color:${C.cream}">${title}</h1>
      <div style="font:15px/1.7 'Helvetica Neue',Arial,sans-serif;color:${C.muted}">${body}</div>
      ${button}
      ${note ? `<hr style="border:0;border-top:1px solid ${C.line};margin:28px 0 16px"><p style="margin:0;font:12px/1.6 'Helvetica Neue',Arial,sans-serif;color:${C.dim}">${note}</p>` : ""}
    </td></tr>
    <tr><td style="padding:20px 4px 0;font:12px/1.6 'Helvetica Neue',Arial,sans-serif;color:${C.dim}">
      Your grad-school application workspace &middot; sent by KACOF<br>
      This is an automated message, please don't reply.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

const ignore = "If you didn't expect this email, you can safely ignore it &mdash; nothing will change.";

const templates = {
  invite: {
    field: "invite", subject: "You're invited to Command Center",
    html: layout({
      preheader: "Accept your invitation and set a password.",
      eyebrow: "Welcome aboard", title: "You've been invited",
      body: `<p style="margin:0 0 12px">You now have access to <strong style="color:${C.cream}">Command Center</strong>, where you'll see the tasks assigned to you and can log progress, notes and focus sessions.</p>
             <p style="margin:0">Accept the invitation to get started. You'll be asked to choose a password so you can sign in any time.</p>`,
      cta: "Accept invitation", ctaHref: link("invite"),
      note: `This invitation link is single-use and expires soon. ${ignore}`,
    }),
  },
  magic_link: {
    field: "magic_link", subject: "Your Command Center sign-in link",
    html: layout({
      preheader: "One click to sign in. No password needed.",
      eyebrow: "Sign in", title: "Your sign-in link",
      body: `<p style="margin:0">Use the button below to sign in to Command Center. The link works once and expires shortly.</p>`,
      cta: "Sign in", ctaHref: link("magiclink"),
      note: `Requested for {{ .Email }}. ${ignore}`,
    }),
  },
  recovery: {
    field: "recovery", subject: "Reset your Command Center password",
    html: layout({
      preheader: "Choose a new password for your account.",
      eyebrow: "Password reset", title: "Reset your password",
      body: `<p style="margin:0">We received a request to reset the password for <strong style="color:${C.cream}">{{ .Email }}</strong>. Use the button below to choose a new one.</p>`,
      cta: "Choose a new password", ctaHref: link("recovery"),
      note: `The link works once and expires shortly. If you didn't ask for this, your password is unchanged and you can ignore this email.`,
    }),
  },
  confirmation: {
    field: "confirmation", subject: "Confirm your Command Center account",
    html: layout({
      preheader: "Confirm your email to finish setting up.",
      eyebrow: "Welcome", title: "Confirm your email",
      body: `<p style="margin:0">Thanks for joining Command Center. Confirm <strong style="color:${C.cream}">{{ .Email }}</strong> to finish setting up your account.</p>`,
      cta: "Confirm email", ctaHref: link("signup"),
      note: ignore,
    }),
  },
  email_change: {
    field: "email_change", subject: "Confirm your new email address",
    html: layout({
      preheader: "Confirm the change to your sign-in email.",
      eyebrow: "Account", title: "Confirm your new email",
      body: `<p style="margin:0">You asked to change your sign-in email from <strong style="color:${C.cream}">{{ .Email }}</strong> to <strong style="color:${C.cream}">{{ .NewEmail }}</strong>. Confirm to complete the change.</p>`,
      cta: "Confirm change", ctaHref: link("email_change"),
      note: `If you didn't request this, don't click the button and consider changing your password.`,
    }),
  },
  reauthentication: {
    field: "reauthentication", subject: "Your Command Center verification code",
    html: layout({
      preheader: "Your one-time verification code.",
      eyebrow: "Security check", title: "Verify it's you",
      body: `<p style="margin:0 0 16px">Enter this code to confirm a sensitive change to your account:</p>
             <p style="margin:0;font:600 34px 'Courier New',monospace;letter-spacing:.35em;color:${C.brass};background:${C.raised};border:1px solid ${C.line};border-radius:8px;padding:14px 0;text-align:center">{{ .Token }}</p>`,
      note: `The code expires shortly. If you didn't request it, someone may be trying to change your account &mdash; consider updating your password.`,
    }),
  },
  password_changed_notification: {
    field: "password_changed_notification", subject: "Your Command Center password was changed",
    html: layout({
      preheader: "Security notice: your password was just changed.",
      eyebrow: "Security notice", title: "Your password was changed",
      body: `<p style="margin:0">The password for <strong style="color:${C.cream}">{{ .Email }}</strong> was just changed.</p>`,
      note: `If this was you, no action is needed. If it wasn't, reset your password immediately from the sign-in page and contact the workspace owner.`,
    }),
  },
  email_changed_notification: {
    field: "email_changed_notification", subject: "Your Command Center email was changed",
    html: layout({
      preheader: "Security notice: your sign-in email was changed.",
      eyebrow: "Security notice", title: "Your email was changed",
      body: `<p style="margin:0">The sign-in email for your account was changed from <strong style="color:${C.cream}">{{ .OldEmail }}</strong> to <strong style="color:${C.cream}">{{ .Email }}</strong>.</p>`,
      note: `If this wasn't you, contact the workspace owner right away.`,
    }),
  },
};

const outDir = join(root, "supabase", "email-templates");
mkdirSync(outDir, { recursive: true });
for (const [name, t] of Object.entries(templates)) writeFileSync(join(outDir, `${name}.html`), t.html);
console.log(`wrote ${Object.keys(templates).length} templates to supabase/email-templates/`);

if (process.argv.includes("--apply")) {
  const token = readFileSync(join(root, ".supabase-token"), "utf8").trim();
  const body = {
    mailer_notifications_password_changed_enabled: true,
    mailer_notifications_email_changed_enabled: true,
  };
  for (const t of Object.values(templates)) {
    body[`mailer_subjects_${t.field}`] = t.subject;
    body[`mailer_templates_${t.field}_content`] = t.html;
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("apply failed:", res.status, await res.text());
    process.exit(1);
  }
  console.log("applied to Supabase project", PROJECT_REF);
}
