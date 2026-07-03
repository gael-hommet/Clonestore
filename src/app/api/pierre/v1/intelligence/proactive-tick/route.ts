// src/app/api/pierre/v1/intelligence/proactive-tick/route.ts
// PHASE 8.14 (D5) — the scheduler/operator entry point that runs ONE proactive detection tick for the
// caller's tenant: detect over live company state → dedup → prioritize → open governed missions. A cron
// (e.g. vercel.json) or an operator can POST here per tenant. write_costly gate (it can open missions).
import { withProductAccess } from "../../_runtime";
import { apiIntelligenceProactiveTick } from "@/lib/pierre/v1/cognitive-runtime/intelligence-api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withProductAccess(req, "write_costly", (db, ctx) => apiIntelligenceProactiveTick(db, ctx as never));
}
