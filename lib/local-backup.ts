export type Backup = { html: string; savedAt: number; version: number };

export const backupKey = (kind: string, id: string) => `draft:${kind}:${id}`;

export function parseBackup(raw: string | null): Backup | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.html === "string" && typeof v.savedAt === "number" && typeof v.version === "number") return { html: v.html, savedAt: v.savedAt, version: v.version };
  } catch { /* damaged backup: ignore it */ }
  return null;
}

// A backup is offered only when it was made against the version now on the server, so it can never overwrite newer work.
export function shouldOfferRestore(b: Backup | null, server: { html: string; version: number }): boolean {
  return !!b && b.version === server.version && b.html !== server.html;
}
