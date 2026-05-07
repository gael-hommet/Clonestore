// src/lib/supabase.ts

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function readPublicSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false as const,
      error:
        "Variables Supabase manquantes. VÃ©rifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }

  if (!supabaseUrl.startsWith("https://") || !supabaseUrl.includes(".supabase.co")) {
    return {
      ok: false as const,
      error:
        "NEXT_PUBLIC_SUPABASE_URL semble invalide. Elle doit ressembler Ã  https://xxxx.supabase.co.",
    };
  }

  return {
    ok: true as const,
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient;

  const env = readPublicSupabaseEnv();

  if (!env.ok) {
    throw new Error(env.error);
  }

  browserClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  return browserClient;
}