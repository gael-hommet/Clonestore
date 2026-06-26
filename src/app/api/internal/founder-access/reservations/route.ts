// Phase E.2 — GET /api/internal/founder-access/reservations (admin only, paginé).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { listReservations, type ReservationListFilters } from "@/lib/founder-access/store";
import { RESERVATION_STATUSES, COMPANY_SIZES, CONTACT_STATUSES, type ReservationStatus, type CompanySize, type ContactStatus } from "@/lib/founder-access/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);

  const url = new URL(req.url);
  const q = url.searchParams;
  const status = q.get("status");
  const size = q.get("company_size");
  const confirmed = q.get("confirmed");
  const contact = q.get("contact_requested");
  const contactStatus = q.get("contact_status");

  const filters: ReservationListFilters = {
    search: q.get("search")?.slice(0, 120) || undefined,
    status: status && (RESERVATION_STATUSES as readonly string[]).includes(status) ? (status as ReservationStatus) : undefined,
    company_size: size && (COMPANY_SIZES as readonly string[]).includes(size) ? (size as CompanySize) : undefined,
    contact_status: contactStatus && (CONTACT_STATUSES as readonly string[]).includes(contactStatus) ? (contactStatus as ContactStatus) : undefined,
    confirmed: confirmed === "true" ? true : confirmed === "false" ? false : undefined,
    contact_requested: contact === "true" ? true : contact === "false" ? false : undefined,
    exclude_active_client: q.get("exclude_active_client") === "true" || undefined,
  };
  const page = Math.max(1, Number(q.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize")) || 25));

  const db = await getRuntimeDb();
  const result = await listReservations(db, filters, page, pageSize);
  return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
}
