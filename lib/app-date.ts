// Date helpers that follow the owner's timezone (APP_TIMEZONE, e.g. "Asia/Kathmandu").
// The server runs in UTC, so "today" and "midnight" must be worked out in the owner's zone.
import { todayString } from "@/lib/digest";

export { todayString };

/** The instant (as an ISO string) when the given "YYYY-MM-DD" day starts in APP_TIMEZONE. */
export function zonedMidnightISO(ymd: string): string {
  const timeZone = process.env.APP_TIMEZONE || undefined;
  const guess = new Date(ymd + "T00:00:00Z");
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(guess);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    const offset = asIfUtc - guess.getTime();
    return new Date(guess.getTime() - offset).toISOString();
  } catch {
    return new Date(ymd + "T00:00:00").toISOString();
  }
}

/** The calendar day of an instant in APP_TIMEZONE, as "YYYY-MM-DD". */
export const zonedDay = (iso: string | Date) => todayString(new Date(iso));

/** Time of day of an instant in APP_TIMEZONE, e.g. "3:30 PM". */
export function zonedTime(iso: string) {
  const timeZone = process.env.APP_TIMEZONE || undefined;
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
}
