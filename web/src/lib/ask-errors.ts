import { ApiError } from "./api";

/** Every 401 means the same thing to a visitor, whichever check said no. */
export const SESSION_ENDED = "Your demo session has ended. Start a new one from the home page.";

/**
 * What the Ask page says when a real ask fails. null = the generic
 * "Recall couldn't reach the course's documents just now." line.
 *
 * The server's messages for 400/429/502/503/504 are written for visitors
 * (see /api/ask and FastAPI's main.py), so they're shown as they are:
 * question too long, too many questions in a minute, token budget used up,
 * the monthly AI budget reached, took too long. 401s come in three wordings
 * ("No demo session.", "Unauthorized.", "…has expired…") so they get one.
 * Anything else (404 chat gone, 500) isn't the visitor's to act on.
 */
export function askErrorText(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null; // offline, DNS, CORS…
  if (e.status === 401) return SESSION_ENDED;
  if ([400, 429, 502, 503, 504].includes(e.status)) return e.message;
  return null;
}
