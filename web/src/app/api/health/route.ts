// Files named router.ts under src/app/api/... become API endpoints.
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

        // Connection/query failed - return the error instead of crashing
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    } finally {

        // Always close the connection, success or failure
        await client.end();
    }
}