// P-FINAL 02 — Go-Live Verdict
// Computes the go/no-go verdict from a set of verified proofs.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: public launch can NEVER be "go" without all required proofs verified.

import type { VerifiedProof } from "./proofs/types";
import {
  getRequiredPublicLaunchProofs,
  getRequiredPrivatePilotProofs,
  getProofsByCategory,
} from "./proofs/proof-registry";

export type GoLiveVerdictStatus =
  | "go"                  // all required proofs verified — public launch approved
  | "private_pilot_only" // private pilot subset ready — not enough for public launch
  | "legal_blocked"       // only legal proofs missing
  | "security_blocked"    // only Supabase/RLS proofs missing
  | "billing_blocked"     // only Stripe proofs missing
  | "demo_blocked"        // demo proofs missing
  | "copy_blocked"        // public copy violations detected
  | "paid_flow_blocked"   // paid customer E2E missing
  | "build_blocked"       // build/test proofs missing
  | "no_go";              // multiple categories missing or no proofs at all

export interface GoLiveVerdict {
  status: GoLiveVerdictStatus;
  is_public_launch_go: boolean;
  is_private_pilot_ready: boolean;
  missing_for_public_launch: string[];
  missing_for_private_pilot: string[];
  verified_public_count: number;
  required_public_count: number;
  coverage_percent: number;
  blockers_by_category: Record<string, string[]>;
  evaluated_at: string;
}

export function buildGoLiveVerdictFromProofs(proofs: VerifiedProof[]): GoLiveVerdict {
  const verifiedSet = new Set(
    proofs.filter((p) => p.status === "verified").map((p) => p.proof_id)
  );

  const publicProofs = getRequiredPublicLaunchProofs();
  const pilotProofs = getRequiredPrivatePilotProofs();

  const missing_for_public_launch = publicProofs
    .filter((p) => !verifiedSet.has(p.id))
    .map((p) => p.id);

  const missing_for_private_pilot = pilotProofs
    .filter((p) => !verifiedSet.has(p.id))
    .map((p) => p.id);

  const is_public_launch_go = missing_for_public_launch.length === 0;
  const is_private_pilot_ready = missing_for_private_pilot.length === 0;

  const verified_public_count = publicProofs.filter((p) => verifiedSet.has(p.id)).length;
  const required_public_count = publicProofs.length;
  const coverage_percent =
    required_public_count === 0 ? 100 : Math.round((verified_public_count / required_public_count) * 100);

  // Group blockers by category
  const blockers_by_category: Record<string, string[]> = {};
  for (const id of missing_for_public_launch) {
    const proof = publicProofs.find((p) => p.id === id);
    if (proof) {
      const cat = proof.category;
      if (!blockers_by_category[cat]) blockers_by_category[cat] = [];
      blockers_by_category[cat].push(id);
    }
  }

  // Determine status
  let status: GoLiveVerdictStatus;

  if (is_public_launch_go) {
    status = "go";
  } else if (missing_for_public_launch.length === 0) {
    status = "go";
  } else {
    const missingCategories = Object.keys(blockers_by_category);

    if (missingCategories.length === 0) {
      status = "go";
    } else if (is_private_pilot_ready && missingCategories.every((c) => c !== "build")) {
      // Private pilot ready but not public launch
      if (missingCategories.length === 1) {
        const cat = missingCategories[0];
        if (cat === "legal") status = "legal_blocked";
        else if (cat === "supabase") status = "security_blocked";
        else if (cat === "stripe") status = "billing_blocked";
        else if (cat === "demo") status = "demo_blocked";
        else if (cat === "copy") status = "copy_blocked";
        else if (cat === "paid_customer") status = "paid_flow_blocked";
        else if (cat === "build") status = "build_blocked";
        else status = "private_pilot_only";
      } else {
        status = "private_pilot_only";
      }
    } else if (missingCategories.length === 1) {
      const cat = missingCategories[0];
      if (cat === "legal") status = "legal_blocked";
      else if (cat === "supabase") status = "security_blocked";
      else if (cat === "stripe") status = "billing_blocked";
      else if (cat === "demo") status = "demo_blocked";
      else if (cat === "copy") status = "copy_blocked";
      else if (cat === "paid_customer") status = "paid_flow_blocked";
      else if (cat === "build") status = "build_blocked";
      else status = "no_go";
    } else {
      status = "no_go";
    }
  }

  return {
    status,
    is_public_launch_go,
    is_private_pilot_ready,
    missing_for_public_launch,
    missing_for_private_pilot,
    verified_public_count,
    required_public_count,
    coverage_percent,
    blockers_by_category,
    evaluated_at: new Date().toISOString(),
  };
}

export function canEnablePublicLaunch(proofs: VerifiedProof[]): boolean {
  const verdict = buildGoLiveVerdictFromProofs(proofs);
  return verdict.is_public_launch_go;
}

export function isPrivatePilotReady(proofs: VerifiedProof[]): boolean {
  const verdict = buildGoLiveVerdictFromProofs(proofs);
  return verdict.is_private_pilot_ready;
}
