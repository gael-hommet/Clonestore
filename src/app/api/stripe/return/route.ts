import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const base = getBaseUrl();
  const url = new URL("/profile/agents", base);
  return NextResponse.redirect(url);
}

