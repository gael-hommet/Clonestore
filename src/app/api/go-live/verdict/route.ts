// P-FINAL 02 — Go-Live Verdict API Route
// GET /api/go-live/verdict
// No-store: always fresh. No secrets in response. No Supabase required.
// Returns: verdict + missing proofs + next actions. Never returns real evidence_ref.

import { NextResponse } from "next/server";
import { buildGoLiveCommandCenterReport } from "@/lib/go-live/go-live-command-center";
import type { VerifiedProof } from "@/lib/go-live/proofs/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  try {
    // In production, this would read from go-live-proofs.local.json (local, server-side only)
    // In this implementation, we always return the no-proofs state for safety
    // The real proof file is NEVER committed and NEVER exposed via API
    const proofs: VerifiedProof[] = [];

    const report = buildGoLiveCommandCenterReport(proofs);

    // Safety check: ensure no secrets leak
    // report.has_secrets is always false by design

    const safeResponse = {
      verdict_status: report.verdict.status,
      is_public_launch_go: report.verdict.is_public_launch_go,
      is_private_pilot_ready: report.verdict.is_private_pilot_ready,
      coverage_percent: report.verdict.coverage_percent,
      verified_count: report.summary.verified,
      required_count: report.summary.total_proofs_in_registry,
      missing_for_public_launch: report.verdict.missing_for_public_launch,
      missing_for_private_pilot: report.verdict.missing_for_private_pilot,
      next_actions: report.next_actions.map((a) => ({
        action: a.action,
        category: a.category,
        priority: a.priority,
        proof_ids: a.proof_ids,
        documentation_ref: a.documentation_ref,
        // No estimated_effort — internal only
      })),
      flags: {
        // Never expose real env flags — only the logical state
        B48_PUBLIC_LAUNCH_ENABLED: false,
        note: "Ce flag ne doit jamais être passé à true sans preuves réelles complètes",
      },
      evaluated_at: report.evaluated_at,
      has_secrets: false,
    };

    return NextResponse.json(safeResponse, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Go-Live-Status": report.verdict.status,
      },
    });
  } catch (_e) {
    return NextResponse.json(
      { error: "go_live_verdict_error", verdict_status: "no_go" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
