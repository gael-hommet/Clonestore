// src/lib/supabase-server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseServer() {
  const cookieStore = cookies() as any;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        // Next cookies() a bien getAll(), mais TS peut râler -> any
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: any[]) {
        // En Server Components, set peut échouer selon le contexte -> try/catch
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // ok
        }
      },
    },
  });
}     