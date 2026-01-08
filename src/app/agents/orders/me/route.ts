import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ active: [], past_due: [], cancelled: [] }, { status: 200 });
  }

  const { data: rows, error } = await supabase
    .from("orders")
    .select("agent_slug,status")
    .eq("user_id", userData.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const active = rows?.filter(r => r.status === "active").map(r => r.agent_slug) ?? [];
  const past_due = rows?.filter(r => r.status === "past_due").map(r => r.agent_slug) ?? [];
  const cancelled = rows?.filter(r => r.status === "cancelled").map(r => r.agent_slug) ?? [];

  return NextResponse.json({ active, past_due, cancelled }, { status: 200 });
}
