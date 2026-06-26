// src/lib/clonestore/enterprise-footprint/enterprise-footprint-readwrite-qa.ts
// PHASE 3.8 — Empreinte Entreprise Read/Write QA — Module QA
//
// Module pur — aucun appel réseau, aucun Supabase, aucun write.
// Checklist QA read/write de l'Empreinte Entreprise.

import type {
  EnterpriseFootprintReadWriteQaStep,
  EnterpriseFootprintReadWriteQaStepId,
  EnterpriseFootprintReadWriteQaStepStatus,
  EnterpriseFootprintReadWriteQaVerdict,
} from "./enterprise-footprint-types";

// ── Types étendus ─────────────────────────────────────────────────────────────

export type EnterpriseFootprintReadWriteQaChecklist = {
  steps: EnterpriseFootprintReadWriteQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.8";
};

export type EnterpriseFootprintReadWriteQaSummary = {
  verdict: EnterpriseFootprintReadWriteQaVerdict;
  blocking_steps: EnterpriseFootprintReadWriteQaStepId[];
  passed_steps: EnterpriseFootprintReadWriteQaStepId[];
  pending_steps: EnterpriseFootprintReadWriteQaStepId[];
  message: string;
  qa_safe: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintReadWriteQaChecklist(): EnterpriseFootprintReadWriteQaChecklist {
  const steps: EnterpriseFootprintReadWriteQaStep[] = [
    {
      id: "onboarding_draft_available",
      label: "Draft onboarding disponible",
      description:
        "Un GlobalOnboardingDraft existe en localStorage ou en DB.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "DevTools → Application → Local Storage → clonestore.globalOnboarding.draft.v1",
      expected_result: "Payload JSON présent avec company.company_name.",
    },
    {
      id: "onboarding_maps_to_footprint",
      label: "Mapping draft → Empreinte",
      description:
        "mapGlobalOnboardingDraftToEnterpriseFootprint(draft) retourne un EnterpriseFootprint valide.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Dans la console DevTools ou via tests : import { mapGlobalOnboardingDraftToEnterpriseFootprint } from enterprise-footprint",
      expected_result: "EnterpriseFootprint avec company, humans, approval_rules, coverage_score.",
    },
    {
      id: "footprint_maps_to_cloneadn",
      label: "Mapping Empreinte → CloneADN",
      description:
        "mapEnterpriseFootprintToGlobalEnterpriseMemory(footprint) retourne un GlobalEnterpriseMemory valide.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Vérifier que coverage_score > 0 après mapping.",
      expected_result: "GlobalEnterpriseMemory avec identity, humans, documents, rules.",
    },
    {
      id: "cloneadn_maps_back_to_footprint",
      label: "Mapping CloneADN → Empreinte (retour)",
      description:
        "mapGlobalEnterpriseMemoryToEnterpriseFootprint(memory) retourne un EnterpriseFootprint.",
      severity: "warning",
      status: "pending",
      how_to_verify:
        "Vérifier la cohérence des données après aller-retour.",
      expected_result: "Company name, humans et rules identiques (ou equivalents).",
    },
    {
      id: "validation_passes_or_warns",
      label: "Validation passes ou avertissements",
      description:
        "validateEnterpriseFootprint(footprint) passe (valid=true) ou émet des warnings.",
      severity: "warning",
      status: "pending",
      how_to_verify:
        "Appeler validateEnterpriseFootprint et vérifier le rapport.",
      expected_result: "valid=true ou issues de severity warning uniquement.",
    },
    {
      id: "localstorage_snapshot_saved",
      label: "Snapshot localStorage sauvegardé",
      description:
        "saveEnterpriseFootprintToLocalStorage(footprint) écrit le snapshot.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "DevTools → Application → Local Storage → clonestore.enterpriseFootprint.snapshot.v1",
      expected_result: "Payload JSON présent.",
    },
    {
      id: "localstorage_snapshot_restored",
      label: "Snapshot localStorage restauré",
      description:
        "loadEnterpriseFootprintFromLocalStorage() retourne le snapshot sauvegardé.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "F5 → vérifier que l'aperçu Empreinte Entreprise est toujours visible.",
      expected_result: "Snapshot restauré avec données identiques.",
    },
    {
      id: "server_write_not_forced",
      label: "Write serveur non forcé",
      description:
        "Aucun write DB depuis l'UI sauf si feature flag activé.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Vérifier que NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED n'est pas 'true'.",
      expected_result: "Flag absent ou false → localStorage uniquement.",
    },
    {
      id: "server_flag_default_false",
      label: "Feature flag défaut false",
      description:
        "isEnterpriseFootprintServerPersistenceEnabled() retourne false par défaut.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Vérifier enterprise-footprint-flags.ts : pas de 'return true' hardcodé.",
      expected_result: "false si NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED n'est pas 'true'.",
    },
    {
      id: "no_sensitive_leak",
      label: "Pas de fuite de données sensibles",
      description:
        "assertEnterpriseFootprintNoSensitiveLeak(footprint) retourne true.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Vérifier que le JSON sérialisé ne contient pas sk_live_, whsec_, OPENAI_API_KEY, etc.",
      expected_result: "Pas de secret détecté.",
    },
    {
      id: "cockpit_preview_available",
      label: "Aperçu cockpit disponible",
      description:
        "Un aperçu read-only de l'Empreinte Entreprise est visible dans /profile/onboarding.",
      severity: "warning",
      status: "pending",
      how_to_verify:
        "Aller sur /profile/onboarding → vérifier section 'Empreinte Entreprise'.",
      expected_result: "Coverage score, readiness score, missing items affichés.",
    },
    {
      id: "rollback_localstorage_available",
      label: "Rollback localStorage disponible",
      description:
        "Si la persistence serveur est désactivée ou échoue, localStorage prend le relais.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Désactiver le flag → vérifier que l'aperçu reste visible depuis localStorage.",
      expected_result: "Snapshot toujours accessible après rollback.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.8",
  };
}

// ── Verdict ───────────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintReadWriteQaVerdict(
  steps: EnterpriseFootprintReadWriteQaStep[]
): EnterpriseFootprintReadWriteQaSummary {
  const blockingFailed = steps.filter(
    (s) => s.severity === "blocking" && s.status === "failed"
  );
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter(
    (s) => s.status === "pending" || s.status === "skipped"
  );

  let verdict: EnterpriseFootprintReadWriteQaVerdict;
  if (blockingFailed.length > 0) {
    verdict = "blocked";
  } else if (pending.length === 0) {
    verdict = "passed";
  } else if (pending.length === steps.length) {
    verdict = "ready_for_qa";
  } else {
    verdict = "needs_review";
  }

  const qaSafe = verdict === "passed" || (verdict === "needs_review" && blockingFailed.length === 0);

  const summary: EnterpriseFootprintReadWriteQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    qa_safe: qaSafe,
  };

  summary.message = summarizeEnterpriseFootprintReadWriteQaVerdict(summary);
  return summary;
}

export function getEnterpriseFootprintReadWriteBlockingSteps(): EnterpriseFootprintReadWriteQaStep[] {
  return buildEnterpriseFootprintReadWriteQaChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function summarizeEnterpriseFootprintReadWriteQaVerdict(
  summary: EnterpriseFootprintReadWriteQaSummary
): string {
  const { verdict, blocking_steps, passed_steps, pending_steps } = summary;
  const lines = [
    `[QA PHASE 3.8 Empreinte] Verdict : ${verdict.toUpperCase()}`,
    `  Étapes réussies : ${passed_steps.length}`,
    `  Étapes en attente : ${pending_steps.length}`,
    `  Étapes bloquantes échouées : ${blocking_steps.length}`,
  ];
  if (blocking_steps.length > 0) {
    lines.push(`  Bloquants : ${blocking_steps.join(", ")}`);
  }
  if (verdict === "passed") {
    lines.push("  → QA Empreinte Entreprise validée.");
  } else if (verdict === "ready_for_qa") {
    lines.push("  → Prêt pour QA manuelle — lancer les vérifications.");
  }
  return lines.join("\n");
}
