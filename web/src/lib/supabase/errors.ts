import { NextResponse } from "next/server";

/**
 * A safe error response for route handlers.
 * 
 * The real error (which can mention hostnames, SQL or keys) is logged on the 
 * server, where only we can see it in Vercel's logs. The visitor gets a short 
 * message. The frontend's http() helper reads `error` from the JSON body.
 */
export function apiError(message: string, status: number, detail?: unknown) {
    if (detail !== undefined) console.error(`[api] ${message}`, detail);
    return NextResponse.json({ error: message }, { status });
}

   /** The limit messages our database triggers raise (safe to show visitors). */
   const LIMIT_MESSAGES = ["A demo can hold 100 chats.", "This chat is full. Start a new chat."];

   /**
    * Turn a Postgres error from a write into the right response.
    *
    * - 23514 check_violation with one of OUR limit messages → 409 Conflict,
    *   showing that message. (Other 23514s are constraint names; never shown.)
    * - 42501 insufficient_privilege: RLS or a GRANT said no → 403.
    * - Anything else -> 500 with the fallback message.
    * The full error is always logged server-side by apiError().
    */
   export function dbError(error: { code?: string; message?: string }, fallback: string) {
     if (error.code === "23514" && error.message && LIMIT_MESSAGES.includes(error.message)) {
       return apiError(error.message, 409, error);
     }
     if (error.code === "42501") return apiError("You can't change that.", 403, error);
     return apiError(fallback, 500, error);
   }