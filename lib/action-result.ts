// The result every server action returns to the browser. Production builds hide the message of a thrown error, so
// expected problems travel as a result instead. Inside an action, throw UserError for a problem the user can act on.
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; message: string };

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export function isFailure(r: unknown): r is { ok: false; message: string } {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === false && typeof (r as { message?: unknown }).message === "string";
}
