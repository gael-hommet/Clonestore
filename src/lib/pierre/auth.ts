import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { safeString } from "@/lib/pierre/utils";

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function makePierreServerSupabase(): SupabaseClient {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRole) {
    throw new Error("Supabase serveur non configuré.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getBearerTokenFromRequest(req: Request) {
  const auth =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";

  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice("Bearer ".length).trim();
}

export async function getAuthenticatedPierreUser(
  req: Request,
  supabase: SupabaseClient
): Promise<{ error: string | null; user: User | null }> {
  const token = safeString(getBearerTokenFromRequest(req));

  if (!token) {
    return { error: "Token manquant.", user: null };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      error: error?.message || "Utilisateur non authentifié.",
      user: null,
    };
  }

  return { error: null, user: data.user };
}