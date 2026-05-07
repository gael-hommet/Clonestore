import type { SupabaseClient } from "@supabase/supabase-js";

export async function hasPierreAccess(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id,status")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: Boolean(data),
    error: null as string | null,
  };
}