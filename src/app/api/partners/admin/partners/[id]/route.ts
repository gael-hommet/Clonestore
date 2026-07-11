// GET /api/partners/admin/partners/[id] — détail complet d'UN cabinet.
// Chargé à la demande (jamais avec la liste) : clients apportés paginés, introductions,
// commissions, versements, risques, audit. Aucune donnée bancaire (CloneStore n'en a aucune).

import { NextResponse } from "next/server";
import { resolveFounderAdmin, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";
import { getPartnerDetail } from "@/lib/partner-program/server/admin-analytics";
import { listPartnerCommissions } from "@/lib/partner-program/server/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await resolveFounderAdmin();
  if (!admin.ok) return founderAdminDeniedResponse(admin.reason);

  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, error: "id_required", message: "Identifiant de cabinet invalide." }, { status: 400, headers: NO_STORE });
  }

  const url = new URL(req.url);
  const db = await getPartnerDb();

  const payload = await withService(db, async (tx) => {
    const detail = await getPartnerDetail(tx, id, {
      limit: Number(url.searchParams.get("clientsLimit") ?? 25),
      offset: Number(url.searchParams.get("clientsOffset") ?? 0),
    });
    if (!detail) return null;
    const commissions = await listPartnerCommissions(tx, id, 100);
    const introductions = await tx.query<Record<string, unknown>>(
      `select id, company_name as "companyName", company_domain as "companyDomain", status,
              submitted_at as "submittedAt", protected_until as "protectedUntil"
         from clonestore_pp_introductions where partner_id=$1 order by submitted_at desc limit 50`,
      [id],
    );
    return { ...detail, commissions, introductions: introductions.rows };
  });

  if (!payload) {
    return NextResponse.json({ ok: false, error: "partner_not_found", message: "Cabinet introuvable." }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, ...payload }, { headers: NO_STORE });
}
