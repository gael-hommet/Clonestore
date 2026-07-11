// GET /api/partners/admin/partners — liste PAGINÉE des cabinets avec tous leurs agrégats.
// Les agrégats sont calculés par PostgreSQL (jamais reconstruits côté navigateur) et la page
// est bornée : on ne charge JAMAIS tous les partenaires et tous leurs clients d'un coup.
// Aucune donnée bancaire n'est exposée — CloneStore n'en détient aucune.

import { NextResponse } from "next/server";
import { resolveFounderAdmin, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";
import { listPartnersWithAnalytics, type PartnerListSort } from "@/lib/partner-program/server/admin-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

const SORTS = new Set<PartnerListSort>(["recent", "active_clients", "client_mrr", "commission_mrr", "available"]);
const CONNECT = new Set(["ready", "incomplete", "none"]);

export async function GET(req: Request) {
  const admin = await resolveFounderAdmin();
  if (!admin.ok) return founderAdminDeniedResponse(admin.reason);

  const url = new URL(req.url);
  const sortRaw = url.searchParams.get("sort") as PartnerListSort | null;
  const connectRaw = url.searchParams.get("connect");

  const db = await getPartnerDb();
  const page = await withService(db, (tx) =>
    listPartnersWithAnalytics(tx, {
      search: url.searchParams.get("search"),
      status: url.searchParams.get("status"),
      country: url.searchParams.get("country"),
      connect: connectRaw && CONNECT.has(connectRaw) ? (connectRaw as "ready" | "incomplete" | "none") : null,
      sort: sortRaw && SORTS.has(sortRaw) ? sortRaw : "recent",
      limit: Number(url.searchParams.get("limit") ?? 25),
      offset: Number(url.searchParams.get("offset") ?? 0),
    }),
  );

  return NextResponse.json({ ok: true, ...page }, { headers: NO_STORE });
}
