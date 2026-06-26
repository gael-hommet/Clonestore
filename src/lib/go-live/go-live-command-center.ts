// P-FINAL 02 — Go-Live Command Center
// Aggregates proofs, verdict, and next actions into a single report.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: Never expose real secrets in the report.

import type { VerifiedProof } from "./proofs/types";
import type { GoLiveVerdict, GoLiveVerdictStatus } from "./go-live-verdict";
import { buildGoLiveVerdictFromProofs } from "./go-live-verdict";
import { buildMissingProofsReport } from "./proofs/proof-validator";
import { summarizeProofFile } from "./proofs/proof-status";
import { getGoLiveProofRegistry } from "./proofs/proof-registry";

export type NextActionPriority = "critical" | "high" | "medium" | "low";

export interface NextAction {
  action: string;
  category: string;
  proof_ids: string[];
  priority: NextActionPriority;
  estimated_effort: string;
  documentation_ref: string;
}

export interface GoLiveCommandCenterReport {
  verdict: GoLiveVerdict;
  summary: {
    total_proofs_in_registry: number;
    verified: number;
    pending: number;
    failed: number;
    public_launch_coverage_percent: number;
    is_public_launch_go: boolean;
    is_private_pilot_ready: boolean;
  };
  next_actions: NextAction[];
  missing_by_category: Record<string, string[]>;
  flags_required: {
    B48_PUBLIC_LAUNCH_ENABLED: boolean;
    GO_LIVE_ALLOW_PRIVATE_PILOT: boolean;
  };
  evaluated_at: string;
  has_secrets: false; // always false — we never include secrets in this report
}

const CATEGORY_ACTIONS: Record<string, Omit<NextAction, "proof_ids">> = {
  legal: {
    action: "Envoyer le packet juridique au juriste et attendre validation CGU/CGV/DPA/Mentions",
    category: "legal",
    priority: "critical",
    estimated_effort: "1-3 semaines (dépend du juriste)",
    documentation_ref: "docs/PFINAL02_LEGAL_REVIEW_PACKET.md",
  },
  supabase: {
    action: "Appliquer et vérifier les politiques RLS Supabase en staging puis production",
    category: "supabase",
    priority: "critical",
    estimated_effort: "2-4 heures",
    documentation_ref: "docs/PFINAL02_SUPABASE_RLS_REAL_VERIFICATION.md",
  },
  stripe: {
    action: "Configurer Stripe live (clés, produit 449€, webhook) et tester le flux de paiement",
    category: "stripe",
    priority: "critical",
    estimated_effort: "2-4 heures",
    documentation_ref: "docs/PFINAL02_STRIPE_LIVE_VERIFICATION.md",
  },
  email: {
    action: "Vérifier le domaine email et configurer Resend pour la production",
    category: "email",
    priority: "high",
    estimated_effort: "1-2 heures",
    documentation_ref: "docs/PFINAL01_STRIPE_LIVE_SETUP.md",
  },
  demo: {
    action: "Valider manuellement la page /demo/pierre et lancer les tests démo",
    category: "demo",
    priority: "high",
    estimated_effort: "30 minutes",
    documentation_ref: "docs/PFINAL01_DEMO_GUIDE.md",
  },
  paid_customer: {
    action: "Exécuter le flow complet paid customer en production avec un compte de test",
    category: "paid_customer",
    priority: "critical",
    estimated_effort: "2-3 heures",
    documentation_ref: "docs/PFINAL02_PAID_CUSTOMER_PRODUCTION_E2E.md",
  },
  copy: {
    action: "Lancer npm run check:go-live pour scanner le contenu public",
    category: "copy",
    priority: "high",
    estimated_effort: "15 minutes",
    documentation_ref: "docs/PFINAL02_GO_LIVE_MANUAL_PROOFS.md",
  },
  build: {
    action: "Lancer npm test && npm run build pour valider le build production",
    category: "build",
    priority: "critical",
    estimated_effort: "10 minutes",
    documentation_ref: "docs/PFINAL02_GO_LIVE_MANUAL_PROOFS.md",
  },
};

export function getNextManualActions(proofs: VerifiedProof[]): NextAction[] {
  const missing = buildMissingProofsReport(proofs);
  const actions: NextAction[] = [];

  // Group missing proof IDs by category
  const byCategory: Record<string, string[]> = {};
  for (const m of missing.public_launch_missing) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m.id);
  }

  for (const [category, proofIds] of Object.entries(byCategory)) {
    const template = CATEGORY_ACTIONS[category];
    if (template) {
      actions.push({ ...template, proof_ids: proofIds });
    } else {
      actions.push({
        action: `Vérifier les preuves de la catégorie ${category}`,
        category,
        proof_ids: proofIds,
        priority: "medium",
        estimated_effort: "Variable",
        documentation_ref: "docs/PFINAL02_FINAL_GAEL_CHECKLIST.md",
      });
    }
  }

  // Sort: critical first, then high, medium, low
  const priorityOrder: Record<NextActionPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return actions;
}

export function buildGoLiveCommandCenterReport(
  proofs: VerifiedProof[]
): GoLiveCommandCenterReport {
  const verdict = buildGoLiveVerdictFromProofs(proofs);
  const proofSummary = summarizeProofFile(proofs);
  const next_actions = getNextManualActions(proofs);
  const missing = buildMissingProofsReport(proofs);

  const missing_by_category: Record<string, string[]> = {};
  for (const m of missing.public_launch_missing) {
    if (!missing_by_category[m.category]) missing_by_category[m.category] = [];
    missing_by_category[m.category].push(m.id);
  }

  const registry = getGoLiveProofRegistry();

  return {
    verdict,
    summary: {
      total_proofs_in_registry: registry.length,
      verified: proofSummary.verified,
      pending: proofSummary.pending,
      failed: proofSummary.failed,
      public_launch_coverage_percent: verdict.coverage_percent,
      is_public_launch_go: verdict.is_public_launch_go,
      is_private_pilot_ready: verdict.is_private_pilot_ready,
    },
    next_actions,
    missing_by_category,
    flags_required: {
      // These flags should NEVER be set to true by code — only by the human after verified proofs
      B48_PUBLIC_LAUNCH_ENABLED: false,
      GO_LIVE_ALLOW_PRIVATE_PILOT: verdict.is_private_pilot_ready,
    },
    evaluated_at: new Date().toISOString(),
    has_secrets: false,
  };
}

// Human-readable summary of the verdict for display
export function formatVerdictStatus(status: GoLiveVerdictStatus): string {
  const labels: Record<GoLiveVerdictStatus, string> = {
    go: "✅ GO — Lancement public approuvé",
    private_pilot_only: "🔶 PILOT ONLY — Pilote privé possible, lancement public bloqué",
    legal_blocked: "🔴 BLOQUÉ — Validation juridique manquante",
    security_blocked: "🔴 BLOQUÉ — RLS Supabase non vérifié en production",
    billing_blocked: "🔴 BLOQUÉ — Stripe live non configuré ou non testé",
    demo_blocked: "🔴 BLOQUÉ — Démo publique non validée",
    copy_blocked: "🔴 BLOQUÉ — Violations de copy sur les pages publiques",
    paid_flow_blocked: "🔴 BLOQUÉ — Flow paid customer production non testé",
    build_blocked: "🔴 BLOQUÉ — Build/tests non validés",
    no_go: "🔴 NO-GO — Plusieurs catégories de preuves manquantes",
  };
  return labels[status] ?? "❓ INCONNU";
}
