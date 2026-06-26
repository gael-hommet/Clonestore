// src/lib/clonestore/runtime-integration/external-go-live-proofs-gate.ts
// PHASE 7.1 — External Go-Live Proofs Gate (pur)
//
// Prépare/vérifie les preuves externes réelles (Stripe live, Supabase prod/RLS, domaine/email,
// premier client réel) AVANT tout lancement public. Aucune preuve inventée : par défaut rien
// n'est vérifié, public launch reste BLOCKED. Aucun paiement live, aucun email réel, aucun
// runtime, aucune modification d'environnement ni des go-live proofs.

import type {
  ExternalProofMatrixRow,
  ExternalProofClassification,
  ExternalProofItemStatus,
  ExternalManualStep,
  ExternalRollbackStep,
  ExternalGoLiveProofsReport,
} from "./external-go-live-proofs-gate-types";

// ── Helper ────────────────────────────────────────────────────────────────────

function row(
  id: string,
  label: string,
  classification: ExternalProofClassification,
  expected_proof: string,
  evidence_location: string,
  status: ExternalProofItemStatus,
  blocking_before_public_launch: boolean
): ExternalProofMatrixRow {
  return { id, label, classification, expected_proof, evidence_location, status, blocking_before_public_launch, verified: false };
}

// ── A. Stripe live readiness / proof path ──────────────────────────────────────

export function buildStripeLiveMatrix(): ExternalProofMatrixRow[] {
  return [
    row("stripe_readiness", "Stripe live readiness documentée", "readiness_documented", "Référence Go-Live 02 Stripe live readiness (existant, lecture seule)", "Go-Live Command Center (existant)", "documented", false),
    row("stripe_live_keys", "Clés live configurées", "manual_proof_required", "Clés live présentes côté plateforme (jamais commit)", "Stripe Dashboard (live mode)", "manual_required", true),
    row("stripe_live_webhook", "Webhook live vérifié", "manual_proof_required", "Endpoint live + signature vérifiée + événement reçu", "Stripe Dashboard → Developers → Events", "manual_required", true),
    row("stripe_live_product", "Produit / prix live créés", "manual_proof_required", "Produit Pierre 449€/mois en live mode", "Stripe Dashboard → Products", "manual_required", false),
    row("stripe_live_transaction", "Transaction live réelle puis remboursée", "blocking_public_launch", "Paiement live réel de faible montant, capturé puis remboursé, preuve datée", "Stripe Dashboard → Payments", "blocked", true),
    row("stripe_live_portal", "Portail client live", "manual_proof_required", "Customer portal live testé (annulation / mise à jour)", "Stripe Dashboard → Billing", "manual_required", false),
  ];
}

// ── B. Supabase production / RLS proof path ────────────────────────────────────

export function buildSupabaseProdRlsMatrix(): ExternalProofMatrixRow[] {
  return [
    row("supa_readiness", "RLS readiness documentée", "readiness_documented", "Référence Go-Live 01 RLS proofs (existant, lecture seule)", "Go-Live Command Center (existant)", "documented", false),
    row("supa_prod_project", "Projet production provisionné", "manual_proof_required", "Projet prod séparé, variables prod hors repo", "Supabase Dashboard → Project", "manual_required", true),
    row("supa_rls_enabled", "RLS activé sur toutes les tables tenant", "blocking_public_launch", "RLS ON sur chaque table multi-tenant, vérifié", "Supabase Dashboard → Auth → Policies", "blocked", true),
    row("supa_rls_tested", "Policies RLS testées avec auth réelle", "blocking_public_launch", "Tests d'isolation tenant (deux comptes), aucune fuite", "Sortie de tests RLS datée", "blocked", true),
    row("supa_service_role", "Usage service role audité", "manual_proof_required", "Service role jamais exposé côté client, usages tracés", "Audit code + logs", "manual_required", true),
    row("supa_backups", "Backups / PITR configurés", "manual_proof_required", "Sauvegardes et point-in-time recovery activés", "Supabase Dashboard → Database → Backups", "manual_required", false),
  ];
}

// ── C. Domain + email production readiness ─────────────────────────────────────

export function buildDomainEmailMatrix(): ExternalProofMatrixRow[] {
  return [
    row("dom_purchased", "Domaine acheté + DNS pointant", "manual_proof_required", "Domaine possédé, enregistrements DNS actifs", "Registrar / zone DNS", "manual_required", true),
    row("dom_spf_dkim_dmarc", "SPF / DKIM / DMARC configurés", "blocking_public_launch", "Enregistrements SPF, DKIM, DMARC valides et vérifiés", "Zone DNS + outil de vérification", "blocked", true),
    row("email_sender_verified", "Domaine expéditeur vérifié", "manual_proof_required", "Domaine d'envoi vérifié chez le fournisseur email", "Console fournisseur email", "manual_required", true),
    row("email_deliverability", "Délivrabilité testée", "manual_proof_required", "Email test envoyé manuellement, en-têtes / inbox vérifiés", "Boîte de réception test + en-têtes", "manual_required", false),
    row("contact_support_live", "Adresse contact / support active", "manual_proof_required", "Adresse support opérationnelle et surveillée", "Boîte support", "manual_required", false),
  ];
}

// ── D. First live customer evidence path ───────────────────────────────────────

export function buildFirstLiveCustomerMatrix(): ExternalProofMatrixRow[] {
  return [
    row("flc_candidate", "Premier client candidat identifié", "readiness_documented", "Client contrôlé adapté identifié (qualifié)", "CRM / notes opérateur", "documented", false),
    row("flc_contract", "Contrat / CGV contrôlés signés", "manual_proof_required", "Contrat avec limites claires signé avant activation", "Contrat signé", "manual_required", true),
    row("flc_activation", "Activation réelle sous contrôle", "manual_proof_required", "Activation encadrée (paiement contrôlé ou offre), tracée", "Logs activation + Stripe live", "manual_required", true),
    row("flc_first_value", "Première valeur livrée + validée humainement", "manual_proof_required", "Premier livrable RH validé par l'humain", "Livrable + trace CloneTrace", "manual_required", true),
    row("flc_evidence", "Evidence capturée", "manual_proof_required", "Captures, logs, trace, feedback client collectés", "Dossier evidence", "manual_required", false),
    row("flc_no_autonomous", "Aucune exécution autonome", "readiness_documented", "Pierre prépare, l'humain valide ; aucun runtime autonome", "Politique produit (invariant)", "documented", false),
  ];
}

// ── Evidence required / collected ──────────────────────────────────────────────

export function buildExternalEvidenceRequired(): string[] {
  return [
    "Captures Stripe Dashboard (live mode) : clés, webhook, transaction live remboursée.",
    "Logs d'événements webhook live signés.",
    "Sorties de tests RLS prod (isolation tenant, deux comptes).",
    "Enregistrements DNS (SPF / DKIM / DMARC) et rapport de vérification.",
    "En-têtes d'un email test délivré.",
    "Contrat / CGV contrôlés signés.",
    "Logs d'activation du premier client réel.",
    "Premier livrable RH validé humainement + trace CloneTrace.",
    "Feedback du premier client.",
  ];
}

export function buildExternalEvidenceCollected(): string[] {
  // Aucune preuve réelle fournie dans ce gate : rien n'est inventé.
  return [];
}

// ── Blockers (classification D) ────────────────────────────────────────────────

export function buildExternalBlockers(): string[] {
  return [
    "Transaction Stripe live réelle non prouvée.",
    "RLS prod non activé / non testé sur toutes les tables tenant.",
    "SPF / DKIM / DMARC non configurés / non vérifiés.",
    "Premier paiement client E2E live non prouvé.",
    "Scale 80k non prouvé.",
  ];
}

// ── Manual steps (preuve manuelle requise) ─────────────────────────────────────

function manualStep(order: number, id: string, step: string, description: string): ExternalManualStep {
  return { id, order, step, description, requires_human_action: true, auto_applied: false };
}

export function buildExternalManualSteps(): ExternalManualStep[] {
  return [
    manualStep(1, "ms_stripe_keys", "Configurer Stripe live", "Renseigner les clés live hors repo (action volontaire documentée), jamais commit."),
    manualStep(2, "ms_stripe_webhook", "Vérifier le webhook live", "Configurer l'endpoint live, vérifier la signature, capturer un événement."),
    manualStep(3, "ms_stripe_transaction", "Effectuer une transaction live de test", "Paiement live réel de faible montant, capturé puis remboursé, preuve datée."),
    manualStep(4, "ms_supa_prod", "Provisionner Supabase prod", "Créer le projet prod, variables hors repo, aucune écriture auto."),
    manualStep(5, "ms_supa_rls", "Activer et tester RLS prod", "Activer RLS sur toutes les tables tenant, tester l'isolation avec auth réelle."),
    manualStep(6, "ms_dns_email", "Configurer domaine + email", "Pointer le DNS, configurer SPF/DKIM/DMARC, vérifier le domaine expéditeur."),
    manualStep(7, "ms_email_test", "Tester la délivrabilité email", "Envoyer manuellement un email test, vérifier en-têtes et réception."),
    manualStep(8, "ms_first_customer", "Préparer le premier client réel", "Signer le contrat/CGV contrôlés, planifier une activation encadrée."),
    manualStep(9, "ms_collect_evidence", "Collecter l'evidence", "Rassembler captures, logs, trace, feedback dans un dossier evidence."),
    manualStep(10, "ms_update_go_live", "Mettre à jour les go-live proofs MANUELLEMENT", "Mettre à jour les preuves go-live seulement avec preuve réelle, jamais automatiquement."),
  ];
}

// ── Rollback plan ───────────────────────────────────────────────────────────────

function rollback(id: string, step: string, description: string): ExternalRollbackStep {
  return { id, step, description };
}

export function buildExternalRollbackPlan(): ExternalRollbackStep[] {
  return [
    rollback("rb_stripe", "Revenir en test mode Stripe", "Désactiver / retirer les clés live, repasser en test mode."),
    rollback("rb_webhook", "Désactiver le webhook live", "Suspendre l'endpoint live jusqu'à correction."),
    rollback("rb_customer", "Mettre le client en pause", "Suspendre l'activation du premier client si une preuve échoue."),
    rollback("rb_supabase", "Restaurer depuis backup", "Utiliser PITR / backup si une donnée prod est compromise."),
    rollback("rb_dns", "Revenir aux enregistrements DNS précédents", "Restaurer la zone DNS antérieure si l'email échoue."),
    rollback("rb_communicate", "Communiquer et documenter", "Informer le client, documenter l'incident, ne déclarer aucun lancement public."),
  ];
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildExternalGoLiveProofsReport(
  options?: { now?: string }
): ExternalGoLiveProofsReport {
  const now = options?.now ?? new Date().toISOString();
  return {
    phase: "7.1",
    title: "External Go-Live Proofs — Stripe Live / Supabase Prod RLS / Domain Email / First Live Customer",
    generated_at: now,
    proof_status: "manual_proof_required",
    stripe_live_matrix: buildStripeLiveMatrix(),
    supabase_prod_rls_matrix: buildSupabaseProdRlsMatrix(),
    domain_email_matrix: buildDomainEmailMatrix(),
    first_live_customer_matrix: buildFirstLiveCustomerMatrix(),
    evidence_required: buildExternalEvidenceRequired(),
    evidence_collected: buildExternalEvidenceCollected(),
    blockers: buildExternalBlockers(),
    manual_steps: buildExternalManualSteps(),
    rollback_plan: buildExternalRollbackPlan(),
    public_launch_verdict: "BLOCKED",
    first_live_customer_ready: "conditional",
    go_live_proofs_reference:
      "go-live-proofs.local.json existant — référencé en lecture seule, jamais modifié automatiquement par ce gate.",
    next_phase_recommendation:
      "FIRST LIVE CUSTOMER CONTROLLED RUN — vendre / activer / accompagner le premier client réel avec preuves.",
    final_note:
      "Readiness documentée et étapes manuelles prêtes. Aucune preuve live fournie : rien n'est vérifié, public launch reste BLOCKED. Ne jamais déclarer public launch ready sans preuve réelle.",
    ready_for_first_live_customer_controlled_run: true,
    external_go_live_proofs_ready: false,
    public_launch_ready: false,
    stripe_live_verified: false,
    supabase_prod_rls_verified: false,
    domain_email_verified: false,
    first_live_customer_verified: false,
    scale_80k_proven: false,
    real_payment_performed: false,
    real_email_sent: false,
    runtime_execution_active: false,
    env_modified: false,
    go_live_proofs_modified: false,
    ai_call_performed: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeExternalGoLiveProofsReport(
  report: ExternalGoLiveProofsReport
): string {
  const totalRows =
    report.stripe_live_matrix.length +
    report.supabase_prod_rls_matrix.length +
    report.domain_email_matrix.length +
    report.first_live_customer_matrix.length;
  return [
    `[External Go-Live Proofs — PHASE 7.1] statut ${report.proof_status} · verdict public launch ${report.public_launch_verdict}`,
    `  Matrices : ${totalRows} preuves (Stripe live / Supabase prod-RLS / domaine-email / premier client réel)`,
    `  Evidence requise : ${report.evidence_required.length} · collectée : ${report.evidence_collected.length} · blockers : ${report.blockers.length}`,
    `  ${report.final_note}`,
    `  Aucun paiement live · aucun email réel · aucun runtime · aucune preuve inventée · go-live proofs non modifiés.`,
    `  Premier client réel : ${report.first_live_customer_ready} · public launch : ${report.public_launch_verdict} · scale 80k non prouvé.`,
    `  Prochaine phase : First Live Customer Controlled Run.`,
  ].join("\n");
}
