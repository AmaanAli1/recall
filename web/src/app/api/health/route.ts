// Files named route.ts under src/app/api/... become API endpoints.
// This one lives at /api/health


import { NextResponse } from 'next/server';
import { Client } from 'pg';

// GET handles GET requests to /api/health
export async function GET() {
    // Connect using the DATABASE_URL from .env.local (or Vercel's env vars in prod)
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();

        // Simply query just to prove the DB actually responds
        const result = await client.query('SELECT NOW()');
        return NextResponse.json({ ok: true, time: result.rows[0].now });
        } catch (error) {
        // Log the real error where only we can see it (Vercel's logs). The
        // public response stays generic: error text can reveal hostnames or
        // connection details. Still a 500, so the keepalive's curl --fail
        // turns red when the database is down.
        console.error("[api/health] database check failed", error);
        return NextResponse.json({ ok: false }, { status: 500 });
    } finally {

        // Always close the connection, success or failure
        await client.end();
    }
}