// src/lib/clonestore/runtime-integration/controlled-mission-persistence-operator-handbook.ts
// PHASE 5.9 — Controlled Mission Persistence Operator Handbook (pur)
//
// DESIGN-ONLY / DOCUMENTATION. Produit le handbook opérateur de la chaîne P5.1 → P5.8.
// N'ACTIVE RIEN. Aucune route. Aucun GET/POST serveur. Aucun SQL appliqué. Aucune
// exécution. Aucun appel réseau. Aucun moteur Pierre. Aucune IA. localStorage reste
// la seule source active. persistence ≠ execution · restore ≠ execution · sync ≠ execution.

import type {
  ControlledMissionPersistenceOperatorWorkflow,
  ControlledMissionPersistencePlaybook,
  ControlledMissionPersistenceGlossaryItem,
  ControlledMissionPersistenceDecisionMatrixItem,
  ControlledMissionPersistenceEvidenceChecklistItem,
  ControlledMissionPersistenceCommandReferenceItem,
  ControlledMissionPersistenceHandbookInvariant,
  ControlledMissionPersistenceOperatorHandbook,
} from "./controlled-mission-persistence-operator-handbook-types";

// ── Glossary ──────────────────────────────────────────────────────────────────

export function buildControlledMissionPersistenceOperatorGlossary(): ControlledMissionPersistenceGlossaryItem[] {
  const g = (term: string, definition: string, warning: string): ControlledMissionPersistenceGlossaryItem => ({ term, definition, warning });
  return [
    g("Controlled Mission", "Mission contrôlée gouvernée, préparée à partir d'une promotion validée.", "N'est jamais une mission réelle exécutée."),
    g("Local Controlled Mission", "Controlled Mission stockée uniquement en localStorage (P5.1).", "Stockage navigateur uniquement — aucun serveur."),
    g("Review", "Revue et validation humaine LOCALE (P5.2).", "L'approbation locale n'exécute rien."),
    g("Preflight", "Readiness gate locale (P5.3).", "ready = candidate future, jamais exécution."),
    g("Server Persistence Draft", "Design de persistance serveur gouvernée (P5.4).", "SQL non appliqué, flag off, route non créée."),
    g("Manual Activation QA", "QA d'activation manuelle future (P5.5).", "Aucune activation effectuée."),
    g("Server Restore UI", "UI de restauration serveur future (P5.6).", "Aucun GET serveur, localStorage source active."),
    g("Final Gate", "Fermeture de readiness P5.1 → P5.6 (P5.7).", "Jamais production ready / execution ready."),
    g("Transition Plan", "Roadmap T1 → T8 vers le serveur futur (P5.8).", "Prépare la transition, ne l'active pas."),
    g("localStorage source active", "Le navigateur est la seule source de données active.", "Aucune source serveur active."),
    g("persistence ≠ execution", "Persister des données ≠ exécuter une mission.", "Ne jamais confondre persistance et exécution."),
    g("restore ≠ execution", "Restaurer des lignes ≠ exécuter une mission.", "Ne jamais confondre restore et exécution."),
    g("sync ≠ execution", "Synchroniser local ↔ serveur ≠ exécuter.", "Ne jamais confondre sync et exécution."),
    g("runtime execution", "Exécution autonome d'une mission par le runtime.", "Phase séparée — toujours inactive en P5."),
    g("Pierre runtime", "Moteur Pierre autonome.", "Jamais appelé dans P5 (src/lib/pierre intact)."),
    g("CloneTrace future", "Audit immuable des actions, requis lors d'une future activation.", "Conception future uniquement."),
    g("RLS", "Row Level Security Postgres — isolation par user_id/tenant.", "Obligatoire avant toute persistance serveur."),
    g("idempotency", "Garantie qu'une opération répétée n'a pas d'effet de bord.", "Requise pour les futures routes write serveur."),
  ];
}

// ── Operator workflows (W1 → W10) ─────────────────────────────────────────────

function workflow(
  id: string,
  title: string,
  objective: string,
  steps: string[],
  expected_result: string,
  forbidden_actions: string[],
  escalation: string
): ControlledMissionPersistenceOperatorWorkflow {
  return { id, title, objective, steps, expected_result, forbidden_actions, escalation, no_execution_confirmed: true };
}

export function buildControlledMissionPersistenceOperatorWorkflows(): ControlledMissionPersistenceOperatorWorkflow[] {
  const FORBIDDEN = ["Appliquer le SQL", "Activer le flag", "Créer une route", "Exécuter la mission"];
  return [
    workflow("W1", "W1 — Create Local Controlled Mission", "Créer une Controlled Mission locale depuis une promotion validée.", ["Prévisualiser la promotion", "Créer la mission contrôlée locale (localStorage)"], "Mission contrôlée locale créée, non exécutée.", FORBIDDEN, "Gouvernance si données sensibles."),
    workflow("W2", "W2 — Review & Approve Locally", "Relire et approuver localement.", ["Démarrer la revue", "Approuver / demander des changements / bloquer localement"], "Revue locale enregistrée — approbation locale ≠ exécution.", FORBIDDEN, "Revue technique si doute."),
    workflow("W3", "W3 — Run Local Preflight", "Lancer le preflight local.", ["Lancer le preflight", "Lire le rapport readiness"], "Statut ready = candidate future, jamais exécution.", FORBIDDEN, "Gouvernance si blocage guard."),
    workflow("W4", "W4 — Inspect Server Draft Design", "Inspecter le design de persistance serveur (P5.4).", ["Voir le draft serveur", "Voir prérequis serveur"], "Draft serveur lu — serveur toujours désactivé.", FORBIDDEN, "Revue technique avant toute application future."),
    workflow("W5", "W5 — Inspect Manual Activation QA", "Inspecter la QA d'activation manuelle (P5.5).", ["Voir checklist QA", "Voir runbook manuel"], "Checklist lue — aucune activation effectuée.", FORBIDDEN, "Gouvernance avant activation future."),
    workflow("W6", "W6 — Inspect Restore UI", "Inspecter l'UI de restauration future (P5.6).", ["Voir état restore", "Voir parcours futur"], "État restore lu — aucun GET serveur, localStorage source active.", FORBIDDEN, "Revue technique avant route GET future."),
    workflow("W7", "W7 — Inspect Final Gate", "Inspecter le Final Gate (P5.7).", ["Voir final gate", "Voir invariants"], "Verdict go_for_next_design_phase — jamais production.", FORBIDDEN, "Gouvernance pour la phase suivante."),
    workflow("W8", "W8 — Inspect Transition Plan", "Inspecter le plan de transition (P5.8).", ["Voir plan transition", "Voir risques", "Voir rollback"], "Roadmap T1 → T8 lue — aucune activation.", FORBIDDEN, "Gouvernance avant activation manuelle future."),
    workflow("W9", "W9 — Collect Evidence Pack", "Collecter les preuves P5.1 → P5.8.", ["Lancer les checks read-only", "Capturer les sorties de commandes", "Remplir les templates d'evidence"], "Pack de preuves complet — aucune action serveur.", FORBIDDEN, "Gouvernance pour archivage."),
    workflow("W10", "W10 — Decide No-Go / Future Phase", "Décider la suite (design uniquement).", ["Lire le Final Gate", "Lire le Transition Plan", "Décider : continuer en design / ne rien activer"], "Décision design-only — jamais production / execution.", [...FORBIDDEN, "Déclarer production ready", "Lancer en public"], "Gouvernance obligatoire."),
  ];
}

// ── Playbooks ─────────────────────────────────────────────────────────────────

function playbook(
  id: string,
  title: string,
  trigger: string,
  diagnosis_steps: string[],
  safe_actions: string[],
  forbidden_actions: string[],
  rollback_steps: string[],
  evidence_required: string[]
): ControlledMissionPersistencePlaybook {
  return { id, title, trigger, diagnosis_steps, safe_actions, forbidden_actions, rollback_steps, evidence_required, no_execution_confirmed: true };
}

export function buildControlledMissionPersistenceVerificationPlaybooks(): ControlledMissionPersistencePlaybook[] {
  const NO_EXEC = ["Exécuter la mission", "Activer le flag", "Appliquer le SQL"];
  return [
    playbook("V1", "Vérifier que localStorage est la source active", "Routine de vérification.", ["Confirmer que les missions sont en localStorage"], ["Lire l'état local"], NO_EXEC, ["Aucun rollback requis"], ["Capture source localStorage active"]),
    playbook("V2", "Vérifier que le SQL n'est pas appliqué", "Routine de vérification.", ["Ouvrir le SQL P5.4", "Confirmer DO NOT APPLY"], ["Lecture seule du SQL"], NO_EXEC, ["Aucun rollback requis"], ["Capture marqueur DO NOT APPLY"]),
    playbook("V3", "Vérifier que le flag serveur est false", "Routine de vérification.", ["Confirmer default false", "Confirmer .env.local non modifié"], ["Lecture du contrat de flag"], NO_EXEC, ["Aucun rollback requis"], ["Capture flag false"]),
    playbook("V4", "Vérifier l'absence de route serveur", "Routine de vérification.", ["Confirmer qu'aucune route controlled-missions/restore/execute n'existe"], ["Lister les routes API"], NO_EXEC, ["Aucun rollback requis"], ["Capture absence de route"]),
    playbook("V5", "Vérifier l'absence de GET/POST serveur", "Routine de vérification.", ["Confirmer qu'aucun GET/POST serveur n'est effectué"], ["Lecture des modules (purs)"], NO_EXEC, ["Aucun rollback requis"], ["Capture aucun GET/POST serveur"]),
    playbook("V6", "Vérifier l'absence d'exécution", "Routine de vérification.", ["Confirmer runtime execution inactive", "Confirmer tous les *_performed false"], ["Lecture des invariants"], NO_EXEC, ["Aucun rollback requis"], ["Capture invariants no-execution"]),
    playbook("V7", "Vérifier l'absence de Pierre/IA/email/document/CloneVoice", "Routine de vérification.", ["Confirmer pierre/ai/email/document/clonevoice false"], ["Lecture des invariants"], NO_EXEC, ["Aucun rollback requis"], ["Capture invariants Pierre/IA"]),
    playbook("V8", "Vérifier que le lancement public externe n'est pas validé", "Routine de vérification.", ["Confirmer public launch externe non validé"], ["Lecture des avertissements"], NO_EXEC, ["Aucun rollback requis"], ["Capture lancement public externe non validé"]),
    playbook("V9", "Vérifier que le scale 80k n'est pas prouvé", "Routine de vérification.", ["Confirmer scale 80k non prouvé"], ["Lecture des avertissements"], NO_EXEC, ["Aucun rollback requis"], ["Capture scale 80k non prouvé"]),
  ];
}

export function buildControlledMissionPersistenceIncidentPlaybooks(): ControlledMissionPersistencePlaybook[] {
  const ROLLBACK = ["Désactiver le flag serveur (disable flag → false).", "Revenir à localStorage-only.", "Ne jamais déclencher le runtime."];
  return [
    playbook("I1", "Suspicion : SQL appliqué accidentellement", "Le SQL P5.4 aurait été appliqué.", ["Vérifier l'historique de migration", "Confirmer l'état de la table"], ["Documenter, ne rien exécuter"], ["Exécuter la mission", "Write serveur"], ROLLBACK, ["Capture de l'incident SQL appliqué"]),
    playbook("I2", "Suspicion : flag serveur activé", "Le flag serveur serait passé à true.", ["Vérifier .env.local", "Vérifier le contrat de flag"], ["Documenter, remettre le flag à false"], ["Activer le flag", "Exécuter la mission"], ROLLBACK, ["Capture flag activé"]),
    playbook("I3", "Suspicion : route serveur créée", "Une route controlled-missions/restore/execute existerait.", ["Lister les routes", "Identifier la route inattendue"], ["Documenter, désactiver/supprimer la route future"], ["Appeler la route", "Exécuter"], ROLLBACK, ["Capture route créée"]),
    playbook("I4", "Détection : GET/POST serveur", "Un GET/POST serveur aurait été effectué.", ["Vérifier les logs/réseau", "Confirmer la source"], ["Documenter, revenir localStorage-only"], ["POST serveur", "Write serveur", "Exécution"], ROLLBACK, ["Capture GET/POST serveur"]),
    playbook("I5", "Suspicion : mission exécutée", "Une mission aurait été exécutée.", ["Vérifier les invariants *_performed", "Vérifier l'absence d'effet de bord"], ["Documenter, geler la chaîne"], ["Exécuter", "Relancer"], ROLLBACK, ["Capture suspicion d'exécution"]),
    playbook("I6", "Suspicion : moteur Pierre touché", "src/lib/pierre/** aurait été modifié.", ["Vérifier le diff git", "Confirmer l'intégrité du moteur"], ["Documenter, restaurer le moteur intact"], ["Appeler Pierre", "Exécuter"], ROLLBACK, ["Capture diff moteur Pierre"]),
    playbook("I7", "Suspicion : go-live proofs modifiés", "Les go-live proofs auraient changé.", ["Vérifier go-live-proofs.local.json", "Confirmer l'absence de modification"], ["Documenter, restaurer les proofs"], ["Modifier les proofs", "Déclarer GO"], ROLLBACK, ["Capture go-live proofs"]),
  ];
}

export function buildControlledMissionPersistenceRollbackPlaybook(): ControlledMissionPersistencePlaybook {
  return playbook(
    "RB",
    "Rollback global — revenir à localStorage-only",
    "Tout doute sur une activation serveur.",
    ["Identifier l'élément activé (SQL / flag / route)", "Confirmer l'impact"],
    ["Désactiver le flag serveur (disable flag → false).", "Revenir à localStorage-only.", "Ignorer les server rows.", "Vérifier la RLS.", "Lancer les checks P5 read-only."],
    ["Déclencher le runtime", "Exécuter la mission", "Write serveur"],
    ["Désactiver le flag (disable flag → false).", "Revenir à localStorage-only.", "Supprimer/désactiver la route future si nécessaire.", "Ignorer les server rows.", "Vérifier la RLS.", "Ne jamais déclencher le runtime."],
    ["Capture flag false", "Capture localStorage-only", "Capture absence de route"]
  );
}

// ── Evidence checklist / command reference / decision matrix / invariants ──────

export function buildControlledMissionPersistenceEvidenceChecklist(): ControlledMissionPersistenceEvidenceChecklistItem[] {
  const ev = (id: string, label: string, expected: string): ControlledMissionPersistenceEvidenceChecklistItem => ({ id, label, expected, manual_capture_required: true });
  return [
    ev("ev_p51_p58", "Captures / logs P5.1 → P5.8", "Tests + checks verts"),
    ev("ev_commands", "Sorties de commandes", "test:phase5-* et checks PASS"),
    ev("ev_sql", "SQL serveur", "SQL DO NOT APPLY (non appliqué)"),
    ev("ev_flag", "Flag serveur", "flag false, .env.local non modifié"),
    ev("ev_no_route", "Routes serveur", "aucune route controlled-missions/restore/execute"),
    ev("ev_no_execution", "Invariants", "no execution — tous les *_performed/*_active false"),
    ev("ev_docs", "Documentation", "docs P5.1 → P5.9 présentes"),
    ev("ev_public_launch", "Lancement public", "public launch externe non validé"),
    ev("ev_scale", "Scale", "scale 80k non prouvé"),
  ];
}

export function buildControlledMissionPersistenceCommandReference(): ControlledMissionPersistenceCommandReferenceItem[] {
  const cmd = (command: string, expected: string, phase: string): ControlledMissionPersistenceCommandReferenceItem => ({ command, expected, phase });
  return [
    cmd("npm run test:phase5-9", "Handbook tests verts", "5.9"),
    cmd("npm run check:controlled-mission-persistence-operator-handbook", "PASS", "5.9"),
    cmd("npx tsc --noEmit", "0 erreur", "global"),
    cmd("npm run test:phase5-8", "75/75", "5.8"),
    cmd("npm run check:controlled-mission-persistence-transition-plan", "PASS", "5.8"),
    cmd("npm run test:phase5-7", "70/70", "5.7"),
    cmd("npm run check:controlled-mission-server-persistence-final-gate", "PASS", "5.7"),
    cmd("npm run test:phase5-6", "60/60", "5.6"),
    cmd("npm run test:phase5-5", "60/60", "5.5"),
    cmd("npm run test:phase5-4", "66/66", "5.4"),
    cmd("npm run test:phase5-3", "58/58", "5.3"),
    cmd("npm run test:phase5-2", "57/57", "5.2"),
    cmd("npm run test:phase5-1", "62/62", "5.1"),
    cmd("npm run test:phase4-12", "160/160", "4.12"),
    cmd("npm run test:pfinal02", "2525/2525", "global"),
    cmd("npm test", "tous verts", "global"),
    cmd("npm run build", "build propre", "global"),
  ];
}

export function buildControlledMissionPersistenceDecisionMatrix(): ControlledMissionPersistenceDecisionMatrixItem[] {
  return [
    { situation: "SQL non appliqué", allowed_decision: "Continuer en design uniquement", forbidden_decision: "Déclarer le serveur actif", reason: "SQL marqué DO NOT APPLY." },
    { situation: "Flag serveur false", allowed_decision: "Rester local-only", forbidden_decision: "Attendre une persistance serveur", reason: "Flag default false." },
    { situation: "Preflight ready", allowed_decision: "Candidate future", forbidden_decision: "execute", reason: "ready = candidate future, jamais exécution." },
    { situation: "Final gate go_for_next_design_phase", allowed_decision: "Phase de design suivante", forbidden_decision: "production launch", reason: "design-only, jamais production." },
    { situation: "Transition plan ready", allowed_decision: "Préparation documentation/opérateur", forbidden_decision: "Activation", reason: "Plan prépare, n'active pas." },
    { situation: "Lancement public externe non validé", allowed_decision: "Continuer la readiness interne", forbidden_decision: "Lancement public", reason: "public launch externe non validé." },
  ];
}

export function buildControlledMissionPersistenceHandbookInvariants(): ControlledMissionPersistenceHandbookInvariant[] {
  const inv = (id: string, label: string, expected: string): ControlledMissionPersistenceHandbookInvariant => ({ id, label, expected, holds: true });
  return [
    inv("localstorage_source_active", "localStorage source active", "true"),
    inv("server_persistence_inactive", "Persistance serveur inactive", "false"),
    inv("server_restore_inactive", "Restauration serveur inactive", "false"),
    inv("runtime_execution_inactive", "Runtime execution inactive", "false"),
    inv("pierre_runtime_inactive", "Pierre autonomous runtime inactif", "false"),
    inv("sql_not_applied", "SQL non appliqué", "false"),
    inv("flag_off", "Flag serveur off", "false"),
    inv("no_route", "Aucune route serveur", "false"),
    inv("no_get_post", "Aucun GET/POST serveur", "false"),
    inv("no_ai_email_document", "Aucune IA / email / document / CloneVoice", "false"),
    inv("public_launch_external_not_validated", "Lancement public externe non validé", "false"),
    inv("scale_80k_not_proven", "Scale 80k non prouvé", "non prouvé"),
  ];
}

// ── Handbook ──────────────────────────────────────────────────────────────────

export function buildControlledMissionPersistenceOperatorHandbook(
  options?: { now?: string }
): ControlledMissionPersistenceOperatorHandbook {
  const now = options?.now ?? new Date().toISOString();
  return {
    phase: "5.9",
    title: "Handbook opérateur — persistance contrôlée (design-only, P5.1 → P5.8)",
    generated_at: now,
    handbook_status: "documentation_ready",
    audience: ["Opérateur humain", "Gouvernance", "Revue technique"],
    scope: [
      "Comprendre la chaîne Controlled Mission Persistence P5.1 → P5.8.",
      "Exploiter en sécurité sans rien activer.",
      "Vérifier les preuves et savoir rollback.",
    ],
    current_state_summary: [
      "localStorage source active.",
      "Safe apply local actif (P5.1).",
      "Review local actif (P5.2).",
      "Preflight local actif (P5.3).",
      "Server persistence design ready (P5.4).",
      "Manual activation QA ready (P5.5).",
      "Restore UI design ready (P5.6).",
      "Final gate ready (P5.7).",
      "Transition plan ready (P5.8).",
      "Server inactive.",
      "Execution inactive.",
    ],
    active_capabilities: [
      "Créer une Controlled Mission locale.",
      "Review local.",
      "Approval local.",
      "Request changes local.",
      "Preflight local.",
      "Voir server draft design.",
      "Voir manual activation QA.",
      "Voir restore UI design.",
      "Voir final gate.",
      "Voir transition plan.",
    ],
    inactive_capabilities: [
      "Persistance serveur (server persistence).",
      "Restauration serveur (server restore).",
      "Synchronisation serveur (server sync).",
      "Runtime execution.",
      "Pierre execution.",
      "IA execution.",
      "Génération email/document/PDF.",
      "CloneVoice execution.",
    ],
    forbidden_actions: [
      "Appliquer le SQL.",
      "Activer le flag serveur.",
      "Créer une route serveur.",
      "Persister / restaurer / synchroniser serveur.",
      "Exécuter / lancer / envoyer / automatiser.",
      "Déclarer production ready / execution ready.",
    ],
    glossary: buildControlledMissionPersistenceOperatorGlossary(),
    operating_principles: [
      "persistence ≠ execution.",
      "restore ≠ execution.",
      "sync ≠ execution.",
      "localStorage reste la source active jusqu'à activation serveur gouvernée.",
      "Aucune activation sans revue manuelle gouvernée.",
      "Le moteur Pierre n'est jamais appelé dans P5.",
    ],
    operator_workflows: buildControlledMissionPersistenceOperatorWorkflows(),
    verification_playbooks: buildControlledMissionPersistenceVerificationPlaybooks(),
    incident_playbooks: buildControlledMissionPersistenceIncidentPlaybooks(),
    rollback_playbook: buildControlledMissionPersistenceRollbackPlaybook(),
    evidence_checklist: buildControlledMissionPersistenceEvidenceChecklist(),
    command_reference: buildControlledMissionPersistenceCommandReference(),
    decision_matrix: buildControlledMissionPersistenceDecisionMatrix(),
    next_steps: [
      "PHASE 5.10 — Controlled Mission Persistence Phase 5 Closure Report (still no execution).",
      "Conserver le SQL non appliqué et le flag à false.",
      "Aucune route, aucun GET/POST serveur, aucune exécution dans cette phase.",
    ],
    invariants: buildControlledMissionPersistenceHandbookInvariants(),
    documentation_ready: true,
    activation_performed: false,
    server_persistence_active: false,
    server_restore_active: false,
    runtime_execution_active: false,
    pierre_runtime_active: false,
    sql_applied: false,
    env_modified: false,
    route_created: false,
    server_get_performed: false,
    server_post_performed: false,
    server_write_performed: false,
    server_restore_performed: false,
    real_mission_created: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeControlledMissionPersistenceOperatorHandbook(
  handbook: ControlledMissionPersistenceOperatorHandbook
): string {
  return [
    `[Handbook opérateur — PHASE 5.9] statut ${handbook.handbook_status}`,
    `  Workflows : ${handbook.operator_workflows.length} · verification playbooks : ${handbook.verification_playbooks.length} · incident playbooks : ${handbook.incident_playbooks.length}`,
    `  Capacités actives : ${handbook.active_capabilities.length} · inactives : ${handbook.inactive_capabilities.length} · glossaire : ${handbook.glossary.length} termes`,
    `  Handbook opérateur design-only — aucune activation, aucune route, aucun GET/POST serveur, aucune exécution.`,
    `  persistence ≠ execution · restore ≠ execution · sync ≠ execution · localStorage source active.`,
    `  SQL non appliqué · flag off · scale 80k non prouvé · lancement public externe non validé.`,
  ].join("\n");
}
