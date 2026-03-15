// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __clonestore_supabase_browser__: SupabaseClient | undefined;
}

type PublicSupabaseEnv = {
  url: string;
  anon: string;
};

/**
 * Lit les variables publiques Supabase.
 * Ne throw pas pour éviter de casser tout le front si l'env manque.
 */
function readPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return null;
  }

  return { url, anon };
}

/**
 * Client navigateur singleton.
 * Une seule instance par onglet/browser.
 * À utiliser uniquement côté client.
 */
export function supabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (globalThis.__clonestore_supabase_browser__) {
    return globalThis.__clonestore_supabase_browser__;
  }

  const env = readPublicSupabaseEnv();
  if (!env) {
    return null;
  }

  globalThis.__clonestore_supabase_browser__ = createClient(env.url, env.anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return globalThis.__clonestore_supabase_browser__;
}

/**
 * Alias de compatibilité pour l'ancien code.
 */
export function getSupabase(): SupabaseClient | null {
  return supabaseBrowser();
}

/**
 * Permet de savoir si Supabase public est configuré.
 */
export function isSupabaseConfigured(): boolean {
  return readPublicSupabaseEnv() !== null;
}