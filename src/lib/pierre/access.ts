import type { SupabaseClient } from "@supabase/supabase-js";

// Statuses that grant access to Pierre (trial counts as active access).
const PIERRE_ACTIVE_STATUSES = ["active", "trialing"];

export async function hasPierreAccess(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id,status")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .in("status", PIERRE_ACTIVE_STATUSES)
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
