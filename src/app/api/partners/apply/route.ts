// POST /api/partners/apply — candidature publique d'un cabinet (persistée réellement).
// Flag fail-closed, rate-limit distribué, honeypot, validation serveur, réponse neutre.

import { NextResponse } from "next/server";
import { getClientIp, hashIp, rateLimit, readJsonBounded } from "@/lib/founder-access/request-utils";
import { summarizeUserAgent } from "@/lib/founder-access/validation";
import { isPartnerProgramEnabled } from "@/lib/partner-program/flags";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";
import { createApplication } from "@/lib/partner-program/server/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

const ok = (extra?: Record<string, unknown>) => NextResponse.json({ ok: true, ...extra }, { headers: NO_STORE });
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function POST(req: Request) {
  if (!isPartnerProgramEnabled()) return fail(503, "partner_program_disabled");

  const ip = getClientIp(req);
  if (!rateLimit(`pp-apply:${ip ?? "anon"}`, 6, 60_000).ok) return ok(); // réponse neutre

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (!body) return fail(400, "bad_request");

  // Honeypot : champ invisible rempli → faux succès silencieux.
  if (typeof body.website_hp === "string" && body.website_hp.trim() !== "") return ok();

  const cabinetName = str(body.cabinetName);
  const firstName = str(body.firstName);
  const lastName = str(body.lastName);
  const email = str(body.email);
  const country = str(body.country);
  const cabinetType = str(body.cabinetType);
  if (!cabinetName || !firstName || !lastName) return fail(422, "identity_required");
  if (!email || !email.includes("@")) return fail(422, "email_required");
  if (!country) return fail(422, "country_required");
  if (!cabinetType) return fail(422, "cabinet_type_required");
  if (body.consentContact !== true || body.consentPrivacy !== true) return fail(422, "consent_required");

  const services = Array.isArray(body.services) ? body.services.filter((s) => typeof s === "string") as string[] : [];

  try {
    const db = await getPartnerDb();
    const res = await withService(db, (tx) =>
      createApplication(tx, {
        cabinetName, firstName, lastName, email, country, cabinetType,
        roleTitle: str(body.roleTitle), phone: str(body.phone), website: str(body.website),
        clientsCountBucket: str(body.clientsCountBucket), services, message: str(body.message),
        consentContact: true, consentPrivacy: true,
        ipHash: ip ? hashIp(ip) : null, uaSummary: summarizeUserAgent(req.headers.get("user-agent")),
      }),
    );
    if (!res.ok) {
      if (res.error === "program_closed") return fail(503, "program_closed");
      return fail(422, res.error);
    }
    // Réponse neutre : ne révèle jamais si une candidature existait déjà, ni les signaux
    // de risque. On indique seulement si l'espace partenaire est immédiatement accessible
    // (admission automatique) ou si une vérification complémentaire est en cours.
    const admitted = "admitted" in res ? res.admitted : null;
    return ok({
      admitted: admitted === "auto" ? "auto" : admitted === "manual_review" ? "review" : "received",
      spaceReady: admitted === "auto",
    });
  } catch {
    return fail(503, "unavailable");
  }
}
