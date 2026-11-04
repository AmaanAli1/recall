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