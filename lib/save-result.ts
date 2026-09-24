export type SaveResult = { ok: true; words: number; version: number } | { ok: false; reason: "stale" | "error"; message: string };
