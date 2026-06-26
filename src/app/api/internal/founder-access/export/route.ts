// Phase E.2 — GET /api/internal/founder-access/export (admin only, audité, CSV).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { streamReservationsCsv, recordAdminAudit, type ReservationListFilters } from "@/lib/founder-access/store";
import { RESERVATION_STATUSES, COMPANY_SIZES, CONTACT_STATUSES, type ReservationStatus, type CompanySize, type ContactStatus } from "@/lib/founder-access/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);

  const q = new URL(req.url).searchParams;
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
  };

  const db = await getRuntimeDb();
  await recordAdminAudit(db, { actor_email: auth.email, action: "reservations.export", result: "ok", context_safe: { filters } });

  // Streaming keyset : aucune charge complète en mémoire, aucun plafond silencieux.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode("﻿")); // BOM UTF-8
      try {
        for await (const chunk of streamReservationsCsv(db, filters)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        controller.error(e);
        return;
      }
      controller.close();
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(stream, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="founder-reservations-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
