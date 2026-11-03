import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for server code: route handlers in app/api/.
 * 
 * - Uses the PUBLISHABLE (anon) key, never the secret key, so every query 
 *   runs as the visitor and row-level security applies.
 * - The visitor's session lives in httpOnly cookies. Supabase reads them 
 *   (getAll) to know who is asking, and writes them (setAll) when it signs 
 *   someone in, refreshes their token, or signs them out.
 * - Create a new client per request. Never share one between requests, or 
 *   one visitor's session could leak into another's.
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => 
                            cookieStore.set(name, value, options), 
                        );
                    } catch {
                        // Server Components can't set cookies. Route handlers can, and 
                        // the proxy (src/proxy.ts) refreshes tokens on every API request, 
                        // so it's safe to ignore here.
                    }
                },
            },
        },
    );
}