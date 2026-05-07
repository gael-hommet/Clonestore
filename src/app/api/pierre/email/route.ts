import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/pierre/email",
    service: "Pierre Email API",
    endpoints: {
      draft: "/api/pierre/email/draft",
      send: "/api/pierre/email/send"
    }
  });
}
