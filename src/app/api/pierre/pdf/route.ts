import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/pierre/pdf",
    service: "Pierre PDF API",
    endpoints: {
      generate: "/api/pierre/pdf/generate"
    }
  });
}
