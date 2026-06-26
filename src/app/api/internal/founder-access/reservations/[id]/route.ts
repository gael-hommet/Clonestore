// Phase E.2 — GET + PATCH /api/internal/founder-access/reservations/:id (admin only, audité).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { getReservationDetail, updateReservationAdmin, recordAdminAudit, type AdminReservationPatch } from "@/lib/founder-access/store";
import { ReservationTransitionError } from "@/lib/founder-access/state-machine";
import { RESERVATION_STATUSES, CONTACT_STATUSES, type ReservationStatus, type ContactStatus } from "@/lib/founder-access/types";
import { readJsonBounded } from "@/lib/founder-access/request-utils";

function parseFollowup(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string" || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  const db = await getRuntimeDb();
  const detail = await getReservationDetail(db, id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Ouverture d'un détail (donnée sensible) → audit.
  await recordAdminAudit(db, { actor_email: auth.email, action: "reservation.detail.open", target: id });
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (body === null) return NextResponse.json({ error: "payload" }, { status: 413 });

  const patch: AdminReservationPatch = {};
  if (typeof body.status === "string" && (RESERVATION_STATUSES as readonly string[]).includes(body.status)) patch.status = body.status as ReservationStatus;
  if (typeof body.strong_intent === "boolean") patch.strong_intent = body.strong_intent;
  if (typeof body.internal_notes === "string") patch.internal_notes = body.internal_notes.slice(0, 4000);
  // Relation commerciale persistée (§3.5)
  if (typeof body.contact_status === "string" && (CONTACT_STATUSES as readonly string[]).includes(body.contact_status)) patch.contact_status = body.contact_status as ContactStatus;
  if (body.contacted === true) patch.contacted = true;
  if (typeof body.last_contact_note === "string") patch.last_contact_note = body.last_contact_note.slice(0, 2000);
  const followup = parseFollowup(body.next_followup_at);
  if (followup !== undefined) patch.next_followup_at = followup;

  const db = await getRuntimeDb();
  try {
    // actorEmail horodate qui a contacté (contacted_by).
    const res = await updateReservationAdmin(db, id, patch, auth.email);
    if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAdminAudit(db, {
      actor_email: auth.email,
      action: "reservation.update",
      target: id,
      result: "ok",
      context_safe: {
        status: patch.status ?? null, strong_intent: patch.strong_intent ?? null,
        contact_status: patch.contact_status ?? (patch.contacted ? "contacted" : null),
        followup_set: patch.next_followup_at !== undefined, note: typeof patch.internal_notes === "string",
      },
    });
    return NextResponse.json({ ok: true, status: res.status, contact_status: res.contact_status });
  } catch (e) {
    if (e instanceof ReservationTransitionError) {
      await recordAdminAudit(db, { actor_email: auth.email, action: "reservation.update", target: id, result: "illegal_transition" });
      return NextResponse.json({ error: "illegal_transition", from: e.from, to: e.to }, { status: 409 });
    }
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
