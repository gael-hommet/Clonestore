// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __clonestore_supabase__: SupabaseClient | undefined;
}

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) return null;

  // ✅ Singleton (évite "Multiple GoTrueClient instances...")
  if (!globalThis.__clonestore_supabase__) {
    globalThis.__clonestore_supabase__ = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "clonestore-auth", // important : clé stable et unique
      },
    });
  }

  return globalThis.__clonestore_supabase__;
}






