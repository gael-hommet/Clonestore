// src/lib/go-live/final-launch-gate/final-launch-verdict.ts
// GO-LIVE 10 — Final launch gate verdict function.
// Pure: no Stripe, no Supabase, no OpenAI, no Anthropic, no email, no side effects.
// NEVER returns public_ready in the current state.
// NEVER sets public_launch_allowed=true while external blockers are unresolved.

import type { FinalLaunchGateVerdict } from "./final-launch-gate-types";
import {
  FINAL_LAUNCH_BLOCKERS,
  getPublicLaunchBlockers,
} from "./final-launch-blockers";

export function getFinalLaunchGateVerdict(): FinalLaunchGateVerdict {
  const blockers = FINAL_LAUNCH_BLOCKERS;

  const readyCount = blockers.filter((b) => b.status === "ready").length;
  const partialCount = blockers.filter((b) => b.status === "partial_ready").length;
  const pendingCount = blockers.filter((b) => b.status === "pending").length;
  const blockedCount = blockers.filter((b) => b.status === "blocked").length;

  const publicLaunchBlockers = getPublicLaunchBlockers();
  const public_launch_allowed = publicLaunchBlockers.length === 0;

  // Private demo is allowed when product + site are ready, regardless of legal/stripe/rls
  const productCoreReady = blockers.find((b) => b.id === "product_core")?.status === "ready";
  const publicSiteReady = blockers.find((b) => b.id === "public_site")?.status === "ready";
  const private_demo_allowed = productCoreReady && publicSiteReady;

  // Paid customer requires at minimum: Stripe live + legal entity + legal review + production RLS
  const stripeBlocked = blockers.find((b) => b.id === "stripe_live")?.status === "blocked";
  const entityBlocked = blockers.find((b) => b.id === "legal_entity")?.status === "blocked";
  const paid_customer_allowed = !stripeBlocked && !entityBlocked;

  const critical_blockers = publicLaunchBlockers.map((b) => b.human_label);

  const next_actions = blockers
    .filter((b) => b.can_be_done_now)
    .map((b) => b.next_action)
    .concat(
      blockers
        .filter((b) => b.status === "blocked" && !b.can_be_done_now)
        .slice(0, 3)
        .map((b) => b.next_action)
    );

  const global_status = public_launch_allowed
    ? "public_ready"
    : private_demo_allowed
    ? "private_demo_ready"
    : "public_no_go";

  return {
    global_status,
    public_launch_allowed,
    private_demo_allowed,
    paid_customer_allowed,
    blockers_count: blockedCount + pendingCount,
    pending_count: pendingCount + partialCount,
    ready_count: readyCount,
    critical_blockers,
    next_actions,
    summary: public_launch_allowed
      ? "Toutes les conditions de lancement public sont remplies."
      : `Lancement public NO-GO. ${publicLaunchBlockers.length} blockers externes non levés: societe, Stripe live, revue juridique, RLS production, E2E live.`,
    safe_message:
      "Pierre n'est pas avocat, juriste ni logiciel de paie officiel. La conformite juridique finale necessite une revue humaine par un professionnel qualifie.",
  };
}
