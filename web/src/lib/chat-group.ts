import type { ChatSummary } from "./api/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight at the start of `d`'s day, in the browser's own timezone. */
function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Which sidebar group a chat belongs in, from the time of its last message.
 *
 * Done here in the browser, not on the server: "Today" depends on the
 * visitor's timezone, and the server runs in UTC (9 pm in Toronto is already
 * tomorrow in UTC). Calendar days, not 24-hour windows: a chat from 11 pm
 * yesterday is "This week", not "Today", even if it was 2 hours ago.
 *
 * Math.round, not Math.floor: a day with a daylight-saving change is 23 or 25
 * hours long, so midnight-to-midnight isn't always exactly DAY_MS.
 */
export function chatGroup(updatedAt: string, now: Date = new Date()): ChatSummary["group"] {
  const then = new Date(updatedAt);
  if (Number.isNaN(then.getTime())) return "Earlier";
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / DAY_MS);
  if (days <= 0) return "Today"; // also a clock a little ahead of ours
  if (days < 7) return "This week";
  return "Earlier";
}
