// src/lib/clonestore/onboarding/global-onboarding-activation-qa.ts
// PHASE 3.7 — Global Onboarding Manual Activation QA — Checklist Module
//
// Module pur — aucun appel réseau, aucune écriture, aucun import Supabase.
// Centralise la checklist d'activation manuelle de la persistence onboarding.
// Utilisé pour guider Gael dans l'activation et la vérification QA.
//
// INVARIANTS ABSOLUS :
//   - Module pur : pas de Supabase, pas de fetch, pas d'I/O
//   - Pas de createClient, pas de insert/update/delete/upsert
//   - Pas de service role
//   - Pas de write
//   - Données statiques uniquement

// ── Types ─────────────────────────────────────────────────────────────────────

export type GlobalOnboardingManualQaStepId =
  // ── SQL / Base de données ──
  | "sql_table_exists"
  | "rls_enabled"
  | "select_policy_exists"
  | "insert_policy_exists"
  | "update_policy_exists"
  | "no_delete_policy"
  // ── Pré-activation ──
  | "env_flag_disabled_before_test"
  | "check_script_passes_readonly"
  | "env_flag_enabled_for_test_only"
  | "app_restarted"
  // ── Cycle UI ──
  | "authenticated_user_available"
  | "onboarding_save_updates_localstorage"
  | "onboarding_save_attempts_server"
  | "supabase_row_created"
  | "refresh_restores_draft"
  // ── Rollback ──
  | "rollback_flag_disabled"
  | "localstorage_still_works_after_rollback";

export type GlobalOnboardingManualQaStepStatus =
  | "pending"          // pas encore vérifié
  | "passed"           // vérifié OK
  | "failed"           // vérifié KO
  | "skipped"          // skippé (non applicable)
  | "needs_manual";    // nécessite vérification manuelle

export type GlobalOnboardingManualQaSeverity =
  | "blocking"         // bloque l'activation si KO
  | "warning"          // avertissement — non bloquant
  | "info";            // informatif

export type GlobalOnboardingManualQaStep = {
  id: GlobalOnboardingManualQaStepId;
  label: string;
  description: string;
  severity: GlobalOnboardingManualQaSeverity;
  status: GlobalOnboardingManualQaStepStatus;
  how_to_verify: string;
  expected_result: string;
  rollback_note?: string;
};

export type GlobalOnboardingManualQaChecklist = {
  steps: GlobalOnboardingManualQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.7";
};

export type GlobalOnboardingManualQaVerdict =
  | "ready_for_manual_qa"   // tout est prêt, Gael peut tester
  | "blocked"               // des étapes bloquantes sont en échec
  | "passed"                // toutes les étapes passées
  | "needs_review";         // certaines étapes nécessitent attention

export type GlobalOnboardingManualQaEvidence = {
  step_id: GlobalOnboardingManualQaStepId;
  evidence: string;        // description de la preuve observée
  observed_at: string;
};

export type GlobalOnboardingManualQaSummary = {
  verdict: GlobalOnboardingManualQaVerdict;
  blocking_steps: GlobalOnboardingManualQaStepId[];
  passed_steps: GlobalOnboardingManualQaStepId[];
  pending_steps: GlobalOnboardingManualQaStepId[];
  message: string;
  activation_safe: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildGlobalOnboardingManualQaChecklist(): GlobalOnboardingManualQaChecklist {
  const steps: GlobalOnboardingManualQaStep[] = [
    // ── SQL / Base de données ──
    {
      id: "sql_table_exists",
      label: "Table SQL créée",
      description: "La table clonestore_global_onboarding_drafts existe dans Supabase.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Dans Supabase Dashboard → Table Editor : rechercher clonestore_global_onboarding_drafts.\n" +
        "Ou SQL Editor : SELECT tablename FROM pg_tables WHERE tablename = 'clonestore_global_onboarding_drafts';",
      expected_result: "La table apparaît dans la liste des tables.",
    },
    {
      id: "rls_enabled",
      label: "RLS activée",
      description: "Row Level Security est activée sur clonestore_global_onboarding_drafts.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "SQL Editor : SELECT rowsecurity FROM pg_tables WHERE tablename = 'clonestore_global_onboarding_drafts';",
      expected_result: "rowsecurity = true",
    },
    {
      id: "select_policy_exists",
      label: "Policy SELECT own définie",
      description: "La politique select_own_global_onboarding existe avec auth.uid() = user_id.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "SQL Editor : SELECT policyname, cmd FROM pg_policies WHERE tablename = 'clonestore_global_onboarding_drafts';",
      expected_result: "select_own_global_onboarding (SELECT) apparaît dans la liste.",
    },
    {
      id: "insert_policy_exists",
      label: "Policy INSERT own définie",
      description: "La politique insert_own_global_onboarding existe.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Même requête que select_policy_exists.",
      expected_result: "insert_own_global_onboarding (INSERT) apparaît.",
    },
    {
      id: "update_policy_exists",
      label: "Policy UPDATE own définie",
      description: "La politique update_own_global_onboarding existe.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Même requête que select_policy_exists.",
      expected_result: "update_own_global_onboarding (UPDATE) apparaît.",
    },
    {
      id: "no_delete_policy",
      label: "Pas de policy DELETE",
      description: "Aucune politique DELETE n'existe — les brouillons ne sont pas supprimables.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Même requête que select_policy_exists.",
      expected_result: "Aucune ligne DELETE dans pg_policies pour cette table.",
    },
    // ── Pré-activation ──
    {
      id: "env_flag_disabled_before_test",
      label: "Flag désactivé avant test",
      description:
        "NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED n'est pas dans .env.local avant d'activer.",
      severity: "warning",
      status: "pending",
      how_to_verify: "Vérifier .env.local : grep GLOBAL_ONBOARDING .env.local",
      expected_result: "Variable absente ou commentée.",
    },
    {
      id: "check_script_passes_readonly",
      label: "Script check-readiness passe",
      description: "npm run check:global-onboarding-readiness passe sans erreur bloquante.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "npm run check:global-onboarding-readiness",
      expected_result: "Table accessible, env vars présentes.",
    },
    {
      id: "env_flag_enabled_for_test_only",
      label: "Flag activé pour test uniquement",
      description:
        "Ajouter NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true dans .env.local pour le test.",
      severity: "info",
      status: "pending",
      how_to_verify: "cat .env.local | grep GLOBAL_ONBOARDING",
      expected_result: "NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true",
      rollback_note: "Retirer la ligne de .env.local pour revenir en mode localStorage uniquement.",
    },
    {
      id: "app_restarted",
      label: "App redémarrée",
      description: "npm run dev relancé après ajout du flag.",
      severity: "info",
      status: "pending",
      how_to_verify: "Vérifier que l'app redémarre sans erreur.",
      expected_result: "Page /profile/onboarding accessible.",
    },
    // ── Cycle UI ──
    {
      id: "authenticated_user_available",
      label: "Utilisateur connecté",
      description: "Un compte Supabase est connecté sur /profile/onboarding.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Se connecter via /login puis aller sur /profile/onboarding.",
      expected_result: "Page chargée, userId non null.",
    },
    {
      id: "onboarding_save_updates_localstorage",
      label: "LocalStorage mis à jour à chaque saisie",
      description: "Remplir l'entreprise — localStorage est mis à jour immédiatement.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "DevTools → Application → Local Storage → clonestore.globalOnboarding.draft.v1 — vérifier que company.company_name est présent.",
      expected_result: "Le payload JSON est visible et contient le nom saisi.",
    },
    {
      id: "onboarding_save_attempts_server",
      label: "Tentative write serveur",
      description:
        "Avec flag activé + auth, le runtime bridge tente d'écrire en DB. Badge = 'Brouillon local + serveur' ou 'Fallback localStorage'.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Observer le badge de persistence dans /profile/onboarding. DevTools → Network → vérifier requête Supabase.",
      expected_result: "Badge indique 'Brouillon local + serveur' ou 'Sauvegarde serveur active'.",
    },
    {
      id: "supabase_row_created",
      label: "Ligne créée dans Supabase",
      description: "Une ligne existe dans clonestore_global_onboarding_drafts pour ce user_id.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "SQL Editor : SELECT id, company_id, current_step, completion_score, updated_at FROM clonestore_global_onboarding_drafts WHERE user_id = '<votre_user_id>' LIMIT 1;",
      expected_result: "Une ligne apparaît avec les données saisies.",
    },
    {
      id: "refresh_restores_draft",
      label: "Refresh restaure le brouillon",
      description:
        "Après F5, le brouillon est restauré (depuis localStorage immédiatement, serveur si flag actif).",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Saisir données → F5 → vérifier que l'entreprise est pré-remplie.",
      expected_result: "Les données saisies réapparaissent sans ressaisie.",
    },
    // ── Rollback ──
    {
      id: "rollback_flag_disabled",
      label: "Rollback : flag retiré",
      description: "Retirer NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED de .env.local.",
      severity: "info",
      status: "pending",
      how_to_verify: "Modifier .env.local → retirer la ligne → redémarrer npm run dev.",
      expected_result: "App redémarre sans erreur.",
      rollback_note: "Rollback immédiat — aucune donnée perdue.",
    },
    {
      id: "localstorage_still_works_after_rollback",
      label: "LocalStorage fonctionne après rollback",
      description:
        "Après rollback, /profile/onboarding restaure le brouillon depuis localStorage uniquement.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Après rollback + redémarrage → aller sur /profile/onboarding → vérifier que les données sont toujours présentes.",
      expected_result:
        "Données toujours visibles — badge = 'Brouillon local' — aucune mention serveur.",
      rollback_note: "localStorage est toujours la source de vérité locale.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.7",
  };
}

// ── Verdict ───────────────────────────────────────────────────────────────────

export function buildGlobalOnboardingManualQaVerdict(
  steps: GlobalOnboardingManualQaStep[]
): GlobalOnboardingManualQaSummary {
  const blockingFailed = steps.filter(
    (s) => s.severity === "blocking" && s.status === "failed"
  );
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "needs_manual");

  let verdict: GlobalOnboardingManualQaVerdict;
  if (blockingFailed.length > 0) {
    verdict = "blocked";
  } else if (pending.length === 0) {
    verdict = "passed";
  } else if (pending.length === steps.length) {
    verdict = "ready_for_manual_qa";
  } else {
    verdict = "needs_review";
  }

  const activationSafe =
    verdict === "passed" ||
    (verdict === "needs_review" && blockingFailed.length === 0);

  return {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: summarizeGlobalOnboardingManualQaVerdict({
      verdict,
      blocking_steps: blockingFailed.map((s) => s.id),
      passed_steps: passed.map((s) => s.id),
      pending_steps: pending.map((s) => s.id),
      message: "",
      activation_safe: activationSafe,
    }),
    activation_safe: activationSafe,
  };
}

export function getGlobalOnboardingManualQaBlockingSteps(): GlobalOnboardingManualQaStep[] {
  const checklist = buildGlobalOnboardingManualQaChecklist();
  return checklist.steps.filter((s) => s.severity === "blocking");
}

export function summarizeGlobalOnboardingManualQaVerdict(
  summary: GlobalOnboardingManualQaSummary
): string {
  const { verdict, blocking_steps, passed_steps, pending_steps } = summary;
  const lines: string[] = [
    `[QA PHASE 3.7] Verdict : ${verdict.toUpperCase()}`,
    `  Étapes réussies : ${passed_steps.length}`,
    `  Étapes en attente : ${pending_steps.length}`,
    `  Étapes bloquantes échouées : ${blocking_steps.length}`,
  ];
  if (blocking_steps.length > 0) {
    lines.push(`  Bloquants : ${blocking_steps.join(", ")}`);
  }
  if (verdict === "blocked") {
    lines.push("  → Résoudre les étapes bloquantes avant activation.");
  } else if (verdict === "passed") {
    lines.push("  → Activation serveur validée pour cet environnement.");
  } else if (verdict === "ready_for_manual_qa") {
    lines.push("  → Checklist prête — lancer la QA manuelle.");
  } else {
    lines.push("  → Réviser les étapes en attente.");
  }
  return lines.join("\n");
}
