// src/app/api/internal/e2e/mailbox/route.ts — TEST-ONLY: read the Fake delivery mailbox (incl. invitation
// links/tokens). Secret-gated; forbidden outside E2E mode / in production.
import { NextResponse } from "next/server";
import { guardE2E, readE2EMailbox } from "@/lib/pierre/v1/e2e-control-plane";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? undefined;
  const kind = url.searchParams.get("kind") ?? undefined;
  return NextResponse.json({ mail: readE2EMailbox({ to, kind }) });
}
