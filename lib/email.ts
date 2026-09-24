// Sends email through Resend's HTTP API. The key lives only in the server environment (RESEND_API_KEY).
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export const DEFAULT_FROM = "Command Center <kcc@kacof.tech>";

export async function sendEmail(input: { to: string; subject: string; html: string; text: string }): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email sending isn't set up. Add RESEND_API_KEY to the server environment." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.DIGEST_FROM || DEFAULT_FROM, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
      signal: AbortSignal.timeout(15000),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body?.message ? `Resend: ${body.message}` : `Resend returned ${res.status}` };
    return { ok: true, id: body?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach Resend." };
  }
}
