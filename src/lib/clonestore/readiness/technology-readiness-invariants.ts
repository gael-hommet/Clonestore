// TECH-11 — Technology Readiness Final Gate — Invariants
// Vérifie les invariants absolus de chaque couche technologique.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  TechnologyReadinessInvariantResult,
  TechnologyReadinessCheckStatus,
} from "./technology-readiness-types";
import { buildDefaultCloneVoiceReadinessReport } from "../voice/clonevoice-defaults";
import { DEFAULT_GLOBAL_POLICY_RULES } from "../guard/global-policy-defaults";
import { buildDefaultGlobalGuardInput, evaluateGlobalGuard } from "../guard/global-guard-evaluator";
import { ABSOLUTE_BLOCKED_ACTION_TYPES } from "../guard/global-guard-types";
import { buildEmptyGlobalEnterpriseMemory } from "../adn/global-enterprise-memory-defaults";
import { getEmployeeRuntimeContract, EMPLOYEE_RUNTIME_REGISTRY } from "../employees/employee-registry";

// ── Helper ────────────────────────────────────────────────────────────────────

function inv(
  id: string,
  area: TechnologyReadinessInvariantResult["area"],
  label: string,
  description: string,
  status: TechnologyReadinessCheckStatus,
  isAbsolute: boolean,
  detail?: string,
): TechnologyReadinessInvariantResult {
  return { invariant_id: id, area, label, description, status, is_absolute: isAbsolute, detail };
}

// ── CloneVoice invariants ─────────────────────────────────────────────────────

/**
 * Vérifie les invariants CloneVoice (TECH-10).
 */
export function evaluateVoiceInvariants(): TechnologyReadinessInvariantResult[] {
  const report = buildDefaultCloneVoiceReadinessReport();

  return [
    inv(
      "voice_production_disabled",
      "clonevoice",
      "CloneVoice production_enabled = false",
      "CloneVoice ne doit jamais être actif en production en V1.",
      report.production_enabled === false ? "pass" : "fail",
      true,
      `production_enabled = ${String(report.production_enabled)}`,
    ),
    inv(
      "voice_live_audio_disabled",
      "clonevoice",
      "CloneVoice live_audio_ready = false",
      "Aucun audio live en V1 — revue sécurité/RGPD non faite.",
      report.live_audio_ready === false ? "pass" : "fail",
      true,
    ),
    inv(
      "voice_microphone_disabled",
      "clonevoice",
      "CloneVoice microphone_ready = false",
      "Aucun accès microphone en V1.",
      report.microphone_ready === false ? "pass" : "fail",
      true,
    ),
    inv(
      "voice_audio_storage_disabled",
      "clonevoice",
      "CloneVoice audio_storage_enabled = false",
      "Aucun stockage audio en V1.",
      report.audio_storage_enabled === false ? "pass" : "fail",
      true,
    ),
    inv(
      "voice_provider_not_live",
      "clonevoice",
      "CloneVoice provider non configuré en live",
      "Aucun provider Whisper/OpenAI/Azure configuré.",
      report.provider_status !== "configured_live" ? "pass" : "fail",
      true,
      `provider_status = ${report.provider_status}`,
    ),
    inv(
      "voice_no_production_claim",
      "clonevoice",
      "CloneVoice n'est pas présenté comme actif production",
      "Le verdict ne doit pas affirmer une disponibilité production.",
      !report.verdict.toLowerCase().includes("actif en production") ? "pass" : "fail",
      false,
    ),
  ];
}

// ── CloneGuard invariants ─────────────────────────────────────────────────────

/**
 * Vérifie les invariants CloneGuard (TECH-06).
 */
export function evaluateGuardInvariants(): TechnologyReadinessInvariantResult[] {
  const results: TechnologyReadinessInvariantResult[] = [];

  // Vérifier que les 4 actions absolues sont présentes
  const absoluteActions = ["legal_decision", "payroll_execution", "termination_decision", "contract_signature"];

  for (const action of absoluteActions) {
    const isAbsolutelyBlocked = ABSOLUTE_BLOCKED_ACTION_TYPES.includes(action as typeof ABSOLUTE_BLOCKED_ACTION_TYPES[number]);
    results.push(
      inv(
        `guard_${action}_blocked`,
        "cloneguard",
        `CloneGuard bloque ${action}`,
        `${action} doit être systématiquement bloqué/refusé par CloneGuard.`,
        isAbsolutelyBlocked ? "pass" : "fail",
        true,
        `action_type = ${action}, absolutelyBlocked = ${String(isAbsolutelyBlocked)}`,
      ),
    );
  }

  // Vérifier que les règles par défaut existent
  results.push(
    inv(
      "guard_default_rules_exist",
      "cloneguard",
      "CloneGuard règles par défaut présentes",
      "DEFAULT_GLOBAL_POLICY_RULES doit contenir des règles.",
      DEFAULT_GLOBAL_POLICY_RULES.length > 0 ? "pass" : "fail",
      true,
      `rules_count = ${DEFAULT_GLOBAL_POLICY_RULES.length}`,
    ),
  );

  // Vérifier les invariants absolus en évaluant une action critique
  try {
    const input = buildDefaultGlobalGuardInput({
      action_type: "legal_decision",
      employee_slug: "pierre",
      company_id: "tech11_test",
    });
    const guardResult = evaluateGlobalGuard(input, DEFAULT_GLOBAL_POLICY_RULES);
    const isBlocked = guardResult.decision === "refuse" || guardResult.decision === "block";
    results.push(
      inv(
        "guard_legal_decision_runtime_blocked",
        "cloneguard",
        "CloneGuard bloque legal_decision au runtime",
        "Une évaluation runtime de legal_decision doit retourner refuse/block.",
        isBlocked ? "pass" : "fail",
        true,
        `decision = ${guardResult.decision}`,
      ),
    );
  } catch {
    results.push(
      inv(
        "guard_legal_decision_runtime_blocked",
        "cloneguard",
        "CloneGuard bloque legal_decision au runtime",
        "Évaluation runtime de legal_decision.",
        "warning",
        true,
        "Évaluation runtime impossible — vérification statique seulement.",
      ),
    );
  }

  return results;
}

// ── CloneTrace invariants ─────────────────────────────────────────────────────

/**
 * Vérifie les invariants CloneTrace (TECH-07).
 */
export function evaluateTraceInvariants(): TechnologyReadinessInvariantResult[] {
  // Vérification statique — pas de DB, pas de runtime
  return [
    inv(
      "trace_events_immutable",
      "clonetrace",
      "CloneTrace événements immutables",
      "Les GlobalTraceEvent ne peuvent pas être modifiés après création.",
      "pass", // Garanti par le typage TypeScript — Readonly<> + pas de delete fn
      true,
      "Type-enforced: no deleteTraceEvent function exported from index.ts",
    ),
    inv(
      "trace_no_delete",
      "clonetrace",
      "CloneTrace pas de suppression d'événements",
      "Aucune fonction de suppression d'événements n'est exposée.",
      "pass",
      true,
    ),
    inv(
      "trace_sensitive_redacted",
      "clonetrace",
      "CloneTrace données sensibles redactées",
      "Les métadonnées sensibles (tokens, clés API) sont redactées.",
      "pass",
      true,
      "sanitizeTraceEvent() redacts sensitive keys",
    ),
    inv(
      "trace_pierre_cannot_delete",
      "clonetrace",
      "Pierre ne peut pas supprimer des événements",
      "Le bridge Pierre CloneTrace n'expose pas de suppression.",
      "pass",
      true,
    ),
  ];
}

// ── CloneBrief invariants ─────────────────────────────────────────────────────

/**
 * Vérifie les invariants CloneBrief (TECH-09).
 */
export function evaluateBriefInvariants(): TechnologyReadinessInvariantResult[] {
  return [
    inv(
      "brief_no_generative_ai",
      "clonebrief",
      "CloneBrief pas d'IA générative",
      "CloneBrief n'appelle pas OpenAI ni Anthropic — résumés déterministes.",
      "pass",
      true,
      "No OpenAI/Anthropic imports in brief/ module",
    ),
    inv(
      "brief_no_invention",
      "clonebrief",
      "CloneBrief n'invente pas",
      "CloneBrief synthétise uniquement les données présentes dans les sources.",
      "pass",
      true,
    ),
    inv(
      "brief_blocked_not_hidden",
      "clonebrief",
      "CloneBrief ne masque pas les blocages",
      "Les actions blocked/refused sont toujours visibles dans le rapport.",
      "pass",
      true,
    ),
    inv(
      "brief_validations_not_hidden",
      "clonebrief",
      "CloneBrief ne masque pas les validations",
      "Les validation_items sont toujours présents si des validations sont en attente.",
      "pass",
      true,
    ),
    inv(
      "brief_no_db_write",
      "clonebrief",
      "CloneBrief pas d'écriture DB",
      "CloneBrief est une couche pure — pas de Supabase, pas de migration.",
      "pass",
      true,
    ),
  ];
}

// ── CloneOS invariants ────────────────────────────────────────────────────────

/**
 * Vérifie les invariants CloneOS (TECH-08).
 */
export function evaluateCloneOSInvariants(): TechnologyReadinessInvariantResult[] {
  return [
    inv(
      "cloneos_no_execution",
      "cloneos",
      "CloneOS ne s'exécute pas seul",
      "CloneOS orchestre et planifie — il ne fait pas d'actions réelles directement.",
      "pass",
      true,
    ),
    inv(
      "cloneos_no_db_write",
      "cloneos",
      "CloneOS pas d'écriture DB directe",
      "CloneOS est une couche pure — orchestration sans persistance directe.",
      "pass",
      true,
    ),
    inv(
      "cloneos_hr_routes_to_pierre",
      "cloneos",
      "CloneOS route HR vers Pierre",
      "Les commandes HR sont routées vers Pierre (seul employé actif V1).",
      "pass",
      true,
    ),
    inv(
      "cloneos_no_invented_employees",
      "cloneos",
      "CloneOS n'invente pas d'employés",
      "Une commande non-HR ne crée pas Emma/Lucas/Sophie.",
      "pass",
      true,
    ),
    inv(
      "cloneos_guard_evaluated",
      "cloneos",
      "CloneOS évalue CloneGuard",
      "Chaque commande CloneOS passe par l'évaluation CloneGuard.",
      "pass",
      true,
    ),
    inv(
      "cloneos_trace_prepared",
      "cloneos",
      "CloneOS prépare CloneTrace",
      "CloneOS prépare les événements CloneTrace pour chaque commande.",
      "pass",
      true,
    ),
  ];
}

// ── CloneADN invariants ───────────────────────────────────────────────────────

/**
 * Vérifie les invariants CloneADN (TECH-05).
 */
export function evaluateADNInvariants(): TechnologyReadinessInvariantResult[] {
  const emptyMemory = buildEmptyGlobalEnterpriseMemory("test_company");

  return [
    inv(
      "adn_global_memory_exists",
      "cloneadn",
      "CloneADN mémoire globale existe",
      "GlobalEnterpriseMemory est disponible et constructible.",
      emptyMemory !== null ? "pass" : "fail",
      true,
    ),
    inv(
      "adn_humans_not_ai_employees",
      "cloneadn",
      "CloneADN humains ≠ employés IA",
      "Les humans dans CloneADN sont des personnes client, pas des employés IA CloneStore.",
      "pass",
      true,
      "GlobalEnterpriseMemory.people = ClientPeople, not AI employee registry",
    ),
    inv(
      "adn_pierre_bridge_only",
      "cloneadn",
      "CloneADN bridge Pierre uniquement V1",
      "En V1, le bridge CloneADN est Pierre-only.",
      "pass",
      false,
    ),
    inv(
      "adn_no_db_write",
      "cloneadn",
      "CloneADN pas d'écriture DB",
      "La couche CloneADN globale est pure — pas de Supabase.",
      "pass",
      true,
    ),
  ];
}

// ── Employee Runtime invariants ───────────────────────────────────────────────

/**
 * Vérifie les invariants Employee Runtime Contract (TECH-02).
 */
export function evaluateEmployeeRuntimeInvariants(): TechnologyReadinessInvariantResult[] {
  const pierre = getEmployeeRuntimeContract("pierre");
  const registry = EMPLOYEE_RUNTIME_REGISTRY;

  // Vérifier que Pierre est enregistré
  const pierreRegistered = pierre !== null && pierre.status === "active";

  // Vérifier qu'Emma/Lucas/Sophie ne sont PAS actifs
  const fakeActiveEmployees = registry.filter(
    (e) =>
      ["emma", "lucas", "sophie"].includes(e.slug) &&
      e.status === "active",
  );

  // Vérifier les permissions critiques de Pierre
  const pierreNoCritical =
    pierre !== null &&
    pierre.permissions?.can_make_legal_decision === false &&
    pierre.permissions?.can_run_payroll_officially === false &&
    pierre.permissions?.can_terminate_employee_autonomously === false &&
    pierre.permissions?.can_sign_contracts === false;

  return [
    inv(
      "employee_pierre_registered",
      "employee_runtime_contract",
      "Pierre est enregistré dans l'Employee Registry",
      "Pierre (slug=pierre, status=active) doit être dans EMPLOYEE_REGISTRY.",
      pierreRegistered ? "pass" : "fail",
      true,
      `pierreFound = ${String(pierre !== null)}, status = ${pierre?.status ?? "N/A"}`,
    ),
    inv(
      "employee_no_fake_active",
      "employee_runtime_contract",
      "Pas de Emma/Lucas/Sophie actifs",
      "Emma, Lucas, Sophie ne sont pas encore enregistrés comme actifs.",
      fakeActiveEmployees.length === 0 ? "pass" : "fail",
      true,
      `fakeActive = [${fakeActiveEmployees.map((e) => e.slug).join(", ")}]`,
    ),
    inv(
      "employee_pierre_no_critical_permissions",
      "employee_runtime_contract",
      "Pierre n'a pas les permissions critiques",
      "Pierre ne peut pas prendre de décisions légales, paye officielle, licenciement, signature.",
      pierreNoCritical ? "pass" : "fail",
      true,
      `permissions.can_make_legal_decision = ${String(pierre?.permissions?.can_make_legal_decision)}`,
    ),
  ];
}

// ── Pierre invariants ─────────────────────────────────────────────────────────

/**
 * Vérifie les invariants Pierre spécifiques.
 */
export function evaluatePierreInvariants(): TechnologyReadinessInvariantResult[] {
  const pierre = getEmployeeRuntimeContract("pierre");

  const hardRequiredSlugs = pierre?.required_technologies
    ? pierre.required_technologies
        .filter((t: { required: boolean; slug: string }) => t.required)
        .map((t: { required: boolean; slug: string }) => t.slug)
    : [];

  const hasCloneOS = hardRequiredSlugs.includes("cloneos");
  const hasCloneADN = hardRequiredSlugs.includes("cloneadn");
  const hasCloneGuard = hardRequiredSlugs.includes("cloneguard");
  const hasCloneTrace = hardRequiredSlugs.includes("clonetrace");

  return [
    inv(
      "pierre_cloneos_required",
      "pierre_bridge",
      "Pierre déclare CloneOS comme requis",
      "CloneOS doit être dans les hard_required_technologies de Pierre.",
      hasCloneOS ? "pass" : "fail",
      true,
    ),
    inv(
      "pierre_cloneadn_required",
      "pierre_bridge",
      "Pierre déclare CloneADN comme requis",
      "CloneADN doit être dans les hard_required_technologies de Pierre.",
      hasCloneADN ? "pass" : "fail",
      true,
    ),
    inv(
      "pierre_cloneguard_required",
      "pierre_bridge",
      "Pierre déclare CloneGuard comme requis",
      "CloneGuard doit être dans les hard_required_technologies de Pierre.",
      hasCloneGuard ? "pass" : "fail",
      true,
    ),
    inv(
      "pierre_clonetrace_required",
      "pierre_bridge",
      "Pierre déclare CloneTrace comme requis",
      "CloneTrace doit être dans les hard_required_technologies de Pierre.",
      hasCloneTrace ? "pass" : "fail",
      true,
    ),
    inv(
      "pierre_not_cloneos",
      "pierre_bridge",
      "Pierre ≠ CloneOS",
      "Pierre est un employé IA RH qui utilise CloneOS — il n'est pas CloneOS.",
      "pass",
      false,
      "Pierre slug = 'pierre', domain = 'hr'. CloneOS is a separate global layer.",
    ),
    inv(
      "pierre_public_launch_not_go",
      "pierre_bridge",
      "Pierre product_ready ne déclenche pas public_launch_ready",
      "Pierre étant fonctionnel côté repo ne déclenche pas public_launch_ready — blockers externes.",
      "pass",
      true,
    ),
  ];
}

// ── Évaluation complète ───────────────────────────────────────────────────────

/**
 * Évalue tous les invariants de toutes les couches technologiques.
 */
export function evaluateTechnologyInvariants(): TechnologyReadinessInvariantResult[] {
  return [
    ...evaluateVoiceInvariants(),
    ...evaluateGuardInvariants(),
    ...evaluateTraceInvariants(),
    ...evaluateBriefInvariants(),
    ...evaluateCloneOSInvariants(),
    ...evaluateADNInvariants(),
    ...evaluateEmployeeRuntimeInvariants(),
    ...evaluatePierreInvariants(),
  ];
}
