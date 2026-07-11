// GET /api/partners/click?partner=<slug>&code=<code> — enregistre un referral touch
// CÔTÉ SERVEUR au clic, pose le cookie signé (touch_key), puis redirige vers Pierre.
// Le partenaire doit être actif ; sinon redirection simple sans attribution.

import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { getClientIp, hashIp } from "@/lib/founder-access/request-utils";
import { summarizeUserAgent } from "@/lib/founder-access/validation";
import { isPartnerProgramEnabled } from "@/lib/partner-program/flags";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";
import { resolvePartnerForClick, recordReferralTouch } from "@/lib/partner-program/server/attribution";
import { buildReferralCookie } from "@/lib/partner-program/server/referral-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("partner");
  const code = url.searchParams.get("code");
  const dest = new URL("/agents/pierre", getBaseUrl());

  if (!isPartnerProgramEnabled() || (!slug && !code)) {
    return NextResponse.redirect(dest);
  }

  try {
    const db = await getPartnerDb();
    const result = await withService(db, async (tx) => {
      const partner = await resolvePartnerForClick(tx, { slug, code });
      if (!partner || partner.status !== "active") return null;
      return recordReferralTouch(tx, {
        partner,
        source: slug ? "link" : "code",
        campaign: url.searchParams.get("utm_campaign"),
        landingPage: "/agents/pierre",
        ipHash: (() => { const ip = getClientIp(req); return ip ? hashIp(ip) : null; })(),
        uaSummary: summarizeUserAgent(req.headers.get("user-agent")),
      });
    });

    const res = NextResponse.redirect(dest);
    if (result?.touchKey) {
      const cookie = buildReferralCookie(result.touchKey);
      if (cookie) res.headers.append("set-cookie", cookie);
    }
    return res;
  } catch {
    return NextResponse.redirect(dest);
  }
}
