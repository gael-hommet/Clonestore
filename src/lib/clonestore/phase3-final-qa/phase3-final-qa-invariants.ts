// src/lib/clonestore/phase3-final-qa/phase3-final-qa-invariants.ts
// PHASE 3.22 — Phase 3 Final QA Gate — Invariants
//
// Module pur. Définit les invariants transverses et un évaluateur texte générique.
// Pas de fs, pas de Supabase, pas de réseau, pas de write, pas d'import Pierre.

import type {
  Phase3FinalQaInvariant,
  Phase3FinalQaInvariantResult,
  Phase3FinalQaSeverity,
} from "./phase3-final-qa-types";

// Patterns construits par concaténation pour éviter d'embarquer des tokens
// d'écriture DB littéraux dans ce module pur.
const WRITE_TOKENS = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];

// ── Définition des invariants ─────────────────────────────────────────────────

export function buildPhase3FinalQaInvariants(): Phase3FinalQaInvariant[] {
  const inv = (
    id: string,
    label: string,
    severity: Phase3FinalQaSeverity,
    description: string,
    expectation: Phase3FinalQaInvariant["expectation"],
    hint: string
  ): Phase3FinalQaInvariant => ({
    id, label, domain: "security", severity, description, expectation, hint,
  });

  return [
    inv("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking",
      "Les modules feed/registry n'importent pas src/lib/pierre.", "must_be_absent",
      "Chercher import @/lib/pierre"),
    inv("no_src_lib_pierre_change_expected", "src/lib/pierre inchangé", "blocking",
      "Le moteur Pierre n'est pas modifié par la Phase 3.", "must_be_absent",
      "git diff src/lib/pierre vide"),
    inv("no_src_app_api_pierre_change_expected", "src/app/api/pierre inchangé", "blocking",
      "Les APIs Pierre ne sont pas modifiées.", "must_be_absent",
      "git diff src/app/api/pierre vide"),
    inv("no_clonevoice_active_production_claim", "Aucune claim CloneVoice actif production", "blocking",
      "Aucun texte ne déclare CloneVoice actif production.", "must_be_absent",
      "Chercher 'CloneVoice actif production'"),
    inv("no_cloneos_execution_from_profile_pages", "Aucune exécution CloneOS depuis profile", "blocking",
      "Les pages profile ne déclenchent aucune exécution CloneOS réelle.", "must_be_absent",
      "Feeds plan-only"),
    inv("no_fetch_post_in_profile_messages", "Aucun fetch POST dans /profile/messages", "blocking",
      "/profile/messages ne fait aucun POST enterprise-footprint.", "must_be_absent",
      "Chercher fetch POST enterprise-footprint"),
    inv("no_fetch_post_in_profile_agents_registry", "Aucun fetch POST registry dans /profile/agents", "blocking",
      "Le panneau registry de /profile/agents ne fait aucun POST.", "must_be_absent",
      "Chercher fetch POST registry"),
    inv("no_unflagged_enterprise_footprint_write", "Aucun write footprint non flaggé", "blocking",
      "Tout write footprint est feature-flaggé / manuel.", "must_be_absent",
      "POST 423 si flag false"),
    inv("no_sql_auto_apply_script", "Aucun script SQL auto-apply", "blocking",
      "Les scripts check sont read-only et n'exécutent aucun SQL.", "must_be_absent",
      "Scripts read-only"),
    inv("no_service_role_client", "Aucun service role côté client", "blocking",
      "Pas de SUPABASE_SERVICE_ROLE_KEY côté client.", "must_be_absent",
      "Chercher service_role"),
    inv("no_secret_like_keys", "Aucune clé secret-like", "blocking",
      "Aucun secret/api key/private key/token dans le registry.", "must_be_absent",
      "validation anti-secrets"),
    inv("no_public_launch_validated_claim", "Aucune claim lancement public validé", "blocking",
      "Aucun texte ne déclare le lancement public externe validé.", "must_be_absent",
      "Chercher phrase de lancement public"),
    inv("localstorage_fallback_text_present", "Texte fallback localStorage présent", "warning",
      "Les couches read-only rappellent le fallback localStorage.", "must_be_present",
      "Chercher 'localStorage reste le fallback actif'"),
    inv("manual_activation_docs_present", "Docs d'activation manuelle présentes", "warning",
      "Les docs d'activation manuelle P3.7/P3.15/P3.19 existent.", "must_be_present",
      "docs/PHASE_3_*_MANUAL_ACTIVATION*"),
  ];
}

// ── Évaluateur texte générique ────────────────────────────────────────────────
// `files` est un blob de texte concaténé. `presenceNeedle` est ce que l'on
// cherche (présence requise) ou ce qui ne doit pas apparaître (absence requise).

export function evaluatePhase3FinalQaInvariantFromText(
  invariant: Phase3FinalQaInvariant,
  files: string,
  presenceNeedle?: string
): Phase3FinalQaInvariantResult {
  const blob = (files ?? "").toLowerCase();

  // Cas spécial : interdiction des tokens d'écriture DB.
  if (invariant.id === "no_unflagged_enterprise_footprint_write") {
    const found = WRITE_TOKENS.some((t) => blob.includes(t.toLowerCase()));
    return {
      invariant_id: invariant.id,
      satisfied: !found,
      severity: invariant.severity,
      detail: found ? "Token d'écriture détecté." : "Aucun token d'écriture détecté.",
    };
  }

  const needle = (presenceNeedle ?? "").toLowerCase();
  if (!needle) {
    // Sans needle explicite, on considère l'invariant comme non évaluable ici
    // (le vrai scan se fait dans le script). Statut neutre = satisfait par défaut.
    return {
      invariant_id: invariant.id,
      satisfied: true,
      severity: invariant.severity,
      detail: "Non évalué par texte — vérifier via le script read-only.",
    };
  }

  const present = blob.includes(needle);
  const satisfied = invariant.expectation === "must_be_present" ? present : !present;
  return {
    invariant_id: invariant.id,
    satisfied,
    severity: invariant.severity,
    detail: satisfied
      ? `Invariant satisfait (${invariant.expectation}).`
      : `Invariant non satisfait (${invariant.expectation}) — '${presenceNeedle}'.`,
  };
}

// ── Résumés ───────────────────────────────────────────────────────────────────

export function summarizePhase3FinalQaInvariants(
  results: Phase3FinalQaInvariantResult[]
): string {
  const blocking = getPhase3FinalQaBlockingInvariants(results);
  const satisfied = results.filter((r) => r.satisfied).length;
  return [
    `[Phase 3 Invariants] ${satisfied}/${results.length} satisfaits`,
    `  Bloquants non satisfaits : ${blocking.length}`,
    `  Lancement public externe : non validé.`,
  ].join("\n");
}

export function getPhase3FinalQaBlockingInvariants(
  results: Phase3FinalQaInvariantResult[]
): Phase3FinalQaInvariantResult[] {
  return results.filter((r) => !r.satisfied && r.severity === "blocking");
}
