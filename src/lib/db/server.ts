import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database.types";

export async function createClient() {
  // Supabase reads the clock (Date.now) to check whether the session token has
  // expired. With cacheComponents + partialPrefetching, Next may prerender a page
  // with cookies available but forbids reading the time, so mark every
  // DB access as request-time first.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie writes may not be allowed in Server Components.
            // Handle session refresh through a Proxy if needed.
          }
        },
      },
    }
  );
}