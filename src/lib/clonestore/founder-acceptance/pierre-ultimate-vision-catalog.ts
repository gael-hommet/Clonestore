// src/lib/clonestore/founder-acceptance/pierre-ultimate-vision-catalog.ts
// P14 §2 — Catalogue STRUCTURÉ de la « vision ultime » de Pierre (doc fondateur de mai) convertie en
// exigences testables. Module PUR (aucune I/O). Chaque exigence porte les MÊMES drapeaux de preuve
// que ceux réellement observés dans P8–P13 + le code (honnête, pas optimiste). L'ÉVALUATEUR
// (pierre-ultimate-coverage-evaluator.ts) applique les règles à ces drapeaux pour dériver un statut.
//
// Interdits P14 (encodés) : ne JAMAIS marquer conformité légale/pays VERIFIED sans preuve externe ;
// ne JAMAIS marquer le remplacement paie complet VERIFIED ; ne JAMAIS automatiser les décisions
// finales disciplinaires/légales/managériales ; ne JAMAIS prétendre remplacer TOUTE la RH humaine.

// ── 50 groupes de la vision ─────────────────────────────────────────────────────
export const PIERRE_ULTIMATE_GROUPS = [
  "identity_positioning", "mission_engine", "request_analysis", "task_system", "employee_dossier_360",
  "recruitment_operations", "hiring_contracts_amendments", "signature_documents", "preboarding_onboarding",
  "personnel_administration", "absences_leave", "pre_payroll_variables", "planning_impact",
  "internal_hr_communications", "hr_helpdesk", "employee_relations_sensitive", "interviews",
  "performance_operations", "training_operations", "compensation_benefits", "hr_compliance_workflow",
  "reporting", "offboarding", "multi_site_franchise", "sector_adaptation", "clonevoice_voice",
  "inputs_files", "outputs_documents_exports", "cloneadn_footprint", "email_identity", "controlled_autonomy",
  "cloneguard_risk", "clonetrace_audit", "anti_hallucination_source_of_truth", "memory",
  "continuity_multi_day", "demo_scenarios", "seven_day_value_pack", "mobile_notifications",
  "quality_control", "error_handling", "integrations", "roles_permissions", "proactivity",
  "roi_value_report", "other_ai_employees_cloneos", "commercial_positioning", "legal_responsibility_doctrine",
  "ai_act_sensitive_governance", "launch_v1_vs_ultimate",
] as const;
export type UltimateGroup = (typeof PIERRE_ULTIMATE_GROUPS)[number];

export const CLAIM_LEVELS = ["can_claim_now", "can_claim_with_caution", "cannot_claim_yet", "must_not_claim"] as const;
export type ClaimLevel = (typeof CLAIM_LEVELS)[number];

export const LAUNCH_IMPORTANCES = ["launch_critical", "important", "roadmap", "future_enterprise"] as const;
export type LaunchImportance = (typeof LAUNCH_IMPORTANCES)[number];

export const EVIDENCE_KINDS = ["code", "test", "browser", "report", "external", "legal", "provider"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

// Statuts de couverture (partagés avec l'évaluateur).
export const COVERAGE_STATUSES = [
  "VERIFIED", "PARTIAL", "ARCHITECTURE_READY", "FUTURE_ROADMAP",
  "EXTERNAL_BLOCKED", "LEGAL_BLOCKED", "PROVIDER_BLOCKED", "NOT_FOUND", "MUST_NOT_CLAIM",
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

/** Drapeaux de preuve RÉELLEMENT présents (honnêtes) pour une exigence. */
export interface EvidencePresent {
  readonly code?: boolean;      // implémentation réelle existe
  readonly test?: boolean;      // test unitaire/itest existe
  readonly browser?: boolean;   // preuve navigateur E2E existe
  readonly report?: boolean;    // un rapport de phase le prouve
  readonly external?: boolean;  // preuve externe présente (par défaut false)
  readonly legal?: boolean;     // validation légale externe présente (par défaut false)
  readonly provider?: boolean;  // provider live vérifié (par défaut false)
}

export interface UltimateRequirement {
  readonly id: string;
  readonly group: UltimateGroup;
  readonly title: string;
  readonly requirement: string;
  readonly launch_importance: LaunchImportance;
  readonly claim_level: ClaimLevel;
  readonly evidence_required: readonly EvidenceKind[];
  readonly sensitive: boolean;
  readonly evidence: EvidencePresent;      // ce qui existe RÉELLEMENT (grounded P8–P13 + code)
  readonly provenBy: readonly string[];    // pointeurs de preuve lisibles
}

// Raccourcis de preuve.
const P8 = "P8 runtime (hr-canon closed 0-open: 77 verified_existing + 89 implemented_governed)";
const P8_13 = "P8.13 DIM A functional CERTIFIED 215/215 (207 scenarios real runtime)";
const P8_14 = "P8.14 cognitive-runtime (interpret→plan→real compileMissionPlan→execute→continue→remember→proact→analytics.compute)";
const P9_6 = "P9.6 end-to-end journey browser (real UI Confirmer→real V1 mission)";
const P12 = "P12 CloneOS shell + cockpits (browser P12_SHELL_OK)";
const P13 = "P13 founder acceptance (browser P13_FOUNDER_FEEL_OK 33/36)";
const P10 = "P10 country pricing verified (FR/BE/LU 449 EUR, CH 499 CHF)";
const P11_LEGAL = "P11 legal/tax readiness = false without external attestation";
const P11_PROV = "P11 provider readiness = false (Yousign P8.7.4, signature not live)";

export const PIERRE_ULTIMATE_VISION_REQUIREMENTS: readonly UltimateRequirement[] = [
  // 1 identity
  { id: "identity.employee_not_assistant", group: "identity_positioning", title: "Pierre = employé IA RH, pas un assistant", requirement: "Pierre est cadré comme un employé IA RH / département RH opérationnel, jamais assistant/chatbot/copilote.", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "browser", "report"], sensitive: false, evidence: { code: true, test: true, browser: true, report: true }, provenBy: [P12, P13, "framing 'Employé IA RH' proven all viewports"] },
  // 2 mission engine
  { id: "mission.engine", group: "mission_engine", title: "Moteur de missions réel", requirement: "Pierre transforme une demande en mission gouvernée via le vrai compileMissionPlan/createMissionV1.", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, browser: true, report: true }, provenBy: [P8, P9_6, "real V1 mission created via browser Confirmer"] },
  // 3 request analysis
  { id: "request.analysis", group: "request_analysis", title: "Analyse de demande", requirement: "Pierre interprète une demande en langage naturel et propose un plan (cognitive-runtime + CloneChat propose→govern→confirm).", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, browser: true, report: true }, provenBy: [P8_14, "P9.4 CloneChat governed pipeline (real OpenAI)"] },
  // 4 task system
  { id: "task.system", group: "task_system", title: "Système de tâches", requirement: "Une mission se décompose en tâches/plan cognitif exécutables et suivis.", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "test", "browser"], sensitive: false, evidence: { code: true, test: true, browser: true, report: true }, provenBy: [P8_14, P9_6, "'Plan cognitif: N tâche(s)' in cockpit"] },
  // 5 dossier 360
  { id: "dossier.360", group: "employee_dossier_360", title: "Dossier salarié 360", requirement: "Pierre structure et maintient un dossier salarié (capabilités canon), avec traçabilité.", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true, browser: false }, provenBy: [P8, "hr-canon capability-registry (employee dossier caps governed)"] },
  // 6 recruitment
  { id: "recruitment.operations", group: "recruitment_operations", title: "Opérations de recrutement", requirement: "Pierre prépare offres, tri, relances, structuration candidats (préparation, pas décision d'embauche).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true, browser: false }, provenBy: [P8, "hr-canon recruitment caps (governed, prep-level)"] },
  // 7 hiring/contracts prep
  { id: "contracts.preparation", group: "hiring_contracts_amendments", title: "Préparation contrats/avenants", requirement: "Pierre PRÉPARE des projets de contrats/avenants à faire valider — jamais un contrat juridiquement garanti.", launch_importance: "launch_critical", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report"], sensitive: true, evidence: { code: true, test: true, report: true, browser: true }, provenBy: [P8, P9_6, "document preparation governed; legal validity NOT claimed"] },
  { id: "contracts.legal_validity", group: "hiring_contracts_amendments", title: "Validité juridique des contrats", requirement: "La conformité juridique finale des contrats par pays.", launch_importance: "launch_critical", claim_level: "cannot_claim_yet", evidence_required: ["legal", "external"], sensitive: true, evidence: { code: true, legal: false }, provenBy: [P11_LEGAL, "P8.12 country execution fail-closed, 0 VERIFIED rules"] },
  // 8 signature
  { id: "signature.esign", group: "signature_documents", title: "Signature électronique", requirement: "Signature électronique live (Yousign) des documents RH.", launch_importance: "important", claim_level: "cannot_claim_yet", evidence_required: ["provider", "external"], sensitive: false, evidence: { code: true, provider: false }, provenBy: [P11_PROV] },
  // 9 onboarding
  { id: "onboarding.preboarding", group: "preboarding_onboarding", title: "Pré-boarding / onboarding", requirement: "Pierre orchestre checklists et étapes d'onboarding (préparation + suivi gouvernés).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true, browser: false }, provenBy: [P8, "hr-mission-packs onboarding pack"] },
  // 10 personnel admin
  { id: "admin.personnel", group: "personnel_administration", title: "Administration du personnel", requirement: "Pierre structure l'admin RH courante (attestations, courriers, mises à jour dossier).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P8, "hr-canon admin caps"] },
  // 11 absences
  { id: "absences.leave", group: "absences_leave", title: "Absences / congés / retards", requirement: "Pierre suit demandes de congés, absences, retards, justificatifs (préparation/suivi, pas décision finale).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P8, "hr-canon absence caps"] },
  // 12 pre-payroll
  { id: "prepayroll.variables", group: "pre_payroll_variables", title: "Pré-paie / éléments variables", requirement: "Pierre prépare et structure les éléments variables de PRÉ-paie à transmettre à la paie (jamais le calcul de paie).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: true, evidence: { code: true, test: true, report: true, browser: false }, provenBy: [P8, "hr-canon pre-payroll caps (prep, not payroll engine)"] },
  { id: "prepayroll.full_engine", group: "pre_payroll_variables", title: "Moteur de paie / DSN complet", requirement: "Remplacer un logiciel de paie officiel / génération de bulletins / DSN.", launch_importance: "future_enterprise", claim_level: "must_not_claim", evidence_required: ["external"], sensitive: true, evidence: {}, provenBy: ["explicitly excluded (legal cgv §8), MUST NOT claim"] },
  // 13 planning
  { id: "planning.impact", group: "planning_impact", title: "Impact planning", requirement: "Pierre reflète l'impact des absences/événements sur un planning.", launch_importance: "roadmap", claim_level: "cannot_claim_yet", evidence_required: ["code", "test"], sensitive: false, evidence: { code: true }, provenBy: ["architecture only (canon caps), no dedicated planning engine"] },
  // 14 internal comms
  { id: "comms.internal", group: "internal_hr_communications", title: "Communications RH internes", requirement: "Pierre rédige et structure les communications RH internes (l'ENVOI live dépend d'un provider externe — hors périmètre de cette exigence).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true, browser: false }, provenBy: [P8, "communications.ts + providers orchestrated; live send external-pending (see email.identity)"] },
  // 15 helpdesk
  { id: "helpdesk.hr", group: "hr_helpdesk", title: "Helpdesk RH", requirement: "Pierre répond aux questions RH courantes des salariés (front CloneChat).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "browser"], sensitive: false, evidence: { code: true, test: true, browser: true, report: true }, provenBy: ["P9.4 CloneChat public orientation + authenticated operational"] },
  // 16 relations sensitive
  { id: "relations.prepare", group: "employee_relations_sensitive", title: "Cas sensibles — préparation", requirement: "Pierre prépare la structuration de cas sensibles (dossier, historique) — la décision reste humaine.", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "report", "browser"], sensitive: true, evidence: { code: true, test: true, report: true }, provenBy: [P8, "fail-closed + HUMAN_ONLY for sensitive decisions"] },
  { id: "relations.decisions", group: "employee_relations_sensitive", title: "Décisions disciplinaires finales", requirement: "Décider seul d'une sanction/licenciement/mesure disciplinaire.", launch_importance: "future_enterprise", claim_level: "must_not_claim", evidence_required: ["legal"], sensitive: true, evidence: {}, provenBy: ["9 HUMAN_ONLY caps; MUST NOT automate final disciplinary decisions"] },
  // 17 interviews
  { id: "interviews.prepare", group: "interviews", title: "Entretiens — préparation", requirement: "Pierre prépare trames, convocations, comptes-rendus d'entretiens.", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P8, "hr-canon interview caps"] },
  // 18 performance
  { id: "performance.operations", group: "performance_operations", title: "Opérations de performance", requirement: "Pierre structure campagnes d'évaluation, suivis d'objectifs (préparation, pas notation décisionnelle).", launch_importance: "roadmap", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "browser"], sensitive: true, evidence: { code: true, test: true, report: true }, provenBy: [P8, "hr-canon performance caps (governed)"] },
  // 19 training
  { id: "training.operations", group: "training_operations", title: "Opérations de formation", requirement: "Pierre structure plans de formation, convocations, suivis.", launch_importance: "roadmap", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "browser"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P8, "hr-canon training caps"] },
  // 20 compensation
  { id: "compensation.prepare", group: "compensation_benefits", title: "Rémunération/avantages — préparation", requirement: "Pierre structure les données de rémunération/avantages ; les décisions salariales restent humaines.", launch_importance: "roadmap", claim_level: "can_claim_with_caution", evidence_required: ["code", "report", "browser"], sensitive: true, evidence: { code: true, test: true, report: true }, provenBy: [P8, "sensitive → human-governed"] },
  { id: "compensation.decisions", group: "compensation_benefits", title: "Décisions salariales/promotions finales", requirement: "Décider seul d'augmentations, primes sensibles, promotions.", launch_importance: "future_enterprise", claim_level: "must_not_claim", evidence_required: ["legal"], sensitive: true, evidence: {}, provenBy: ["MUST NOT automate final compensation decisions"] },
  // 21 compliance
  { id: "compliance.workflow", group: "hr_compliance_workflow", title: "Workflow de conformité RH", requirement: "Pierre prépare des paquets de revue conformité — la validation légale par pays reste externe.", launch_importance: "launch_critical", claim_level: "cannot_claim_yet", evidence_required: ["legal", "external"], sensitive: true, evidence: { code: true, legal: false }, provenBy: ["P8.12 review packets fail-closed; 0 positive legal verdict"] },
  // 22 reporting
  { id: "reporting.operational", group: "reporting", title: "Reporting opérationnel", requirement: "Pierre calcule des indicateurs RH opérationnels sur ses propres données (analytics.compute → artefacts persistés).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true, browser: false }, provenBy: [P8_14 + " analytics.compute (RLS SQL over pierre_rt_ → persisted artifacts)"] },
  // 23 offboarding
  { id: "offboarding.operations", group: "offboarding", title: "Offboarding", requirement: "Pierre prépare checklists de départ, courriers, suivi (préparation gouvernée).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: true, evidence: { code: true, test: true, report: true }, provenBy: [P8, "hr-canon offboarding caps + proposers"] },
  // 24 multi-site
  { id: "multisite.franchise", group: "multi_site_franchise", title: "Multi-site / franchise", requirement: "Pierre gère plusieurs sites/entités isolés (multi-tenant company-scoped).", launch_importance: "future_enterprise", claim_level: "cannot_claim_yet", evidence_required: ["code", "test", "browser"], sensitive: false, evidence: { code: true, test: true, browser: false }, provenBy: ["P8.9 multi-tenant ISOLATION substrate proven+tested (100k tenants); multi-site management product feature = roadmap (no dedicated UX/E2E)"] },
  // 25 sector
  { id: "sector.adaptation", group: "sector_adaptation", title: "Adaptation sectorielle", requirement: "Pierre adapte au secteur (conventions, spécificités métier).", launch_importance: "future_enterprise", claim_level: "cannot_claim_yet", evidence_required: ["code", "legal"], sensitive: true, evidence: { code: true }, provenBy: ["canon country-pack architecture; sector rules require sourcing (never invent)"] },
  // 26 voice
  { id: "voice.clonevoice", group: "clonevoice_voice", title: "CloneVoice / entrée vocale", requirement: "Saisie vocale / dictée pour créer des missions.", launch_importance: "future_enterprise", claim_level: "cannot_claim_yet", evidence_required: ["code", "browser"], sensitive: false, evidence: {}, provenBy: ["no dedicated CloneVoice implementation found → roadmap"] },
  // 27 inputs
  { id: "inputs.files", group: "inputs_files", title: "Entrées / fichiers", requirement: "Pierre accepte des entrées (texte, capture d'écran) et les intègre à une demande.", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "browser"], sensitive: false, evidence: { code: true, test: true, browser: true, report: true }, provenBy: ["P9.4 multimodal screenshot (openai_vision, EXIF-stripped)"] },
  // 28 outputs
  { id: "outputs.documents", group: "outputs_documents_exports", title: "Sorties / documents / exports", requirement: "Pierre produit des documents/livrables exportables (préparés, à valider).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P8, "document renderer + document-types"] },
  // 29 cloneADN
  { id: "adn.footprint", group: "cloneadn_footprint", title: "CloneADN / empreinte entreprise", requirement: "Pierre s'appuie sur l'empreinte/mémoire d'entreprise (CloneADN) pour contextualiser.", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: ["src/lib/clonestore/adn/** (global-enterprise-memory, pierre-adn-bridge)"] },
  // 30 email identity
  { id: "email.identity", group: "email_identity", title: "Identité email", requirement: "Pierre dispose d'une identité d'envoi email ; l'envoi live dépend d'un domaine/provider externe.", launch_importance: "roadmap", claim_level: "cannot_claim_yet", evidence_required: ["code", "external"], sensitive: false, evidence: { code: true, external: false }, provenBy: ["communication-provider email; live domain/email external-pending"] },
  // 31 autonomy
  { id: "autonomy.controlled", group: "controlled_autonomy", title: "Autonomie contrôlée", requirement: "Pierre expose 5 modes produit → 4 AutonomyModes P8 réels ; les actes sensibles ne s'exécutent jamais seuls.", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "test", "browser", "report"], sensitive: false, evidence: { code: true, test: true, browser: true, report: true }, provenBy: ["P9.5 autonomy (real decideValidation, hard floors) + " + P13] },
  // 32 cloneguard
  { id: "guard.risk", group: "cloneguard_risk", title: "CloneGuard / risque", requirement: "Pierre évalue le risque/qualité d'une sortie avant diffusion (CloneGuard).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "browser"], sensitive: false, evidence: { code: true, test: true }, provenBy: ["src/lib/pierre/v1/cloneguard.ts + cloneos/ai/live-validation"] },
  // 33 clonetrace
  { id: "trace.audit", group: "clonetrace_audit", title: "CloneTrace / audit", requirement: "Pierre conserve trace, historique et preuves de ses actions (timeline, pierre_rt_ audit).", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "test", "report"], sensitive: false, evidence: { code: true, test: true, report: true, browser: true }, provenBy: [P8, "timeline + durable audit; cockpit shows history"] },
  // 34 anti-hallucination
  { id: "truth.source_of_truth", group: "anti_hallucination_source_of_truth", title: "Anti-hallucination / source de vérité", requirement: "Pierre ne fabrique pas le droit ni les faits ; citations/knowledge validées serveur ; SOURCE_REQUIRED.", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "test", "report"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: ["P8.10 SOURCE_REQUIRED never-invent-law; P9.4.1 server-validated citations"] },
  // 35 memory
  { id: "memory.durable", group: "memory", title: "Mémoire durable", requirement: "Pierre mémorise durablement (migration pg, mémoire d'entreprise scoping company).", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "test", "report"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P8_14 + " durable pg memory (pierre_v27 RLS) + company-scoped learning"] },
  // 36 continuity
  { id: "continuity.multi_day", group: "continuity_multi_day", title: "Continuité multi-jours", requirement: "Pierre poursuit des workflows sur plusieurs jours (continuation réelle, case FSM).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P8_14 + " real continuation; hr-operations case FSM"] },
  // 37 demo
  { id: "demo.scenarios", group: "demo_scenarios", title: "Scénarios de démo", requirement: "Des scénarios de démonstration présentent Pierre de bout en bout.", launch_importance: "important", claim_level: "can_claim_now", evidence_required: ["code", "browser"], sensitive: false, evidence: { code: true, test: true, browser: true, report: true }, provenBy: ["/demo route + P9.6 journey"] },
  // 38 7-day pack
  { id: "value.seven_day_pack", group: "seven_day_value_pack", title: "Pack de valeur 7 jours", requirement: "Un parcours structuré « valeur en 7 jours » packagé.", launch_importance: "roadmap", claim_level: "cannot_claim_yet", evidence_required: ["code", "report"], sensitive: false, evidence: {}, provenBy: ["no dedicated 7-day value pack module → roadmap"] },
  // 39 mobile/notifs
  { id: "mobile.usable", group: "mobile_notifications", title: "Mobile utilisable", requirement: "Le cockpit est utilisable sur mobile (bottom-nav, composer atteignable).", launch_importance: "important", claim_level: "can_claim_now", evidence_required: ["browser"], sensitive: false, evidence: { code: true, browser: true, report: true }, provenBy: [P12, P13, "mobile 390 proven"] },
  { id: "mobile.push_notifications", group: "mobile_notifications", title: "Notifications push", requirement: "Notifications push/mobiles temps réel.", launch_importance: "roadmap", claim_level: "cannot_claim_yet", evidence_required: ["code"], sensitive: false, evidence: {}, provenBy: ["no push-notification delivery implementation → roadmap"] },
  // 40 quality control
  { id: "quality.control", group: "quality_control", title: "Contrôle qualité", requirement: "Pierre applique gouvernance/validation avant effet (qualité contrôlée).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "browser"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P8, "governance + validation gates"] },
  // 41 error handling
  { id: "error.handling", group: "error_handling", title: "Gestion d'erreur", requirement: "Pierre gère les états incertains/erreurs sans double effet (idempotence, fail-closed).", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "test"], sensitive: false, evidence: { code: true, test: true, report: true, browser: true }, provenBy: ["P9.4 idempotency + uncertain-state; fail-closed everywhere"] },
  // 42 integrations
  { id: "integrations.external", group: "integrations", title: "Intégrations externes (SIRH/Slack/…)", requirement: "Connecteurs vers SIRH/paie/Slack/Teams/Google Workspace.", launch_importance: "future_enterprise", claim_level: "cannot_claim_yet", evidence_required: ["code", "external"], sensitive: false, evidence: { code: true, external: false }, provenBy: ["channels architecture only; no live external integration"] },
  // 43 roles
  { id: "roles.permissions", group: "roles_permissions", title: "Rôles / permissions", requirement: "Pierre respecte rôles/permissions (RLS, requireCompanyUser, write-permission 403).", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "test"], sensitive: false, evidence: { code: true, test: true, report: true, browser: true }, provenBy: ["RLS + requireCompanyUser; P9.5 forged writes 403"] },
  // 44 proactivity
  { id: "proactivity.signals", group: "proactivity", title: "Proactivité", requirement: "Pierre ouvre des missions proactives à partir de signaux (governed).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "test", "report", "browser"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P8_14 + " proactive opens real missions; hr-proactive signals"] },
  // 45 ROI report
  { id: "roi.value_report", group: "roi_value_report", title: "Rapport de valeur / ROI mensuel", requirement: "Un rapport mensuel de valeur/ROI livré (heures absorbées, missions, gains).", launch_importance: "roadmap", claim_level: "cannot_claim_yet", evidence_required: ["code", "test", "report"], sensitive: false, evidence: { code: true }, provenBy: ["analytics.compute exists (raw metrics) but no delivered ROI-report artifact → partial/roadmap"] },
  // 46 other AI employees / CloneOS
  { id: "cloneos.orchestration", group: "other_ai_employees_cloneos", title: "CloneOS orchestration", requirement: "CloneOS coordonne/oriente ; Pierre exécute le RH (aujourd'hui Pierre est le seul employé IA).", launch_importance: "important", claim_level: "can_claim_with_caution", evidence_required: ["code", "browser", "report"], sensitive: false, evidence: { code: true, test: true, browser: true, report: true }, provenBy: [P12, "CloneOS routes/coordinates; 2nd employee = roadmap"] },
  // 47 commercial positioning
  { id: "commercial.positioning", group: "commercial_positioning", title: "Positionnement commercial", requirement: "Cadrage commercial honnête : remplace la charge RH opérationnelle quotidienne, pas toute la RH.", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "report"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: [P13, "P14 commercial-truth-matrix (this phase)"] },
  // 48 legal doctrine
  { id: "doctrine.responsibility", group: "legal_responsibility_doctrine", title: "Doctrine de responsabilité", requirement: "Pierre ne remplace jamais la responsabilité finale humaine/légale/disciplinaire/managériale.", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["code", "report"], sensitive: true, evidence: { code: true, test: true, report: true }, provenBy: ["disclaimers (cgu/cgv), human-validation floors, P11/P13"] },
  // 49 AI Act
  { id: "aiact.sensitive_governance", group: "ai_act_sensitive_governance", title: "Gouvernance sensible / AI Act", requirement: "Conformité AI Act / gouvernance RH sensible complète.", launch_importance: "important", claim_level: "cannot_claim_yet", evidence_required: ["legal", "external"], sensitive: true, evidence: { code: true, legal: false }, provenBy: ["fail-closed + HUMAN_ONLY design present; formal AI-Act compliance = external legal"] },
  // 50 launch vs ultimate
  { id: "meta.launch_vs_ultimate", group: "launch_v1_vs_ultimate", title: "Launch V1 vs ambition ultime", requirement: "P14 distingue honnêtement ce qui est livrable au lancement de l'ambition ultime (roadmap disclosed).", launch_importance: "launch_critical", claim_level: "can_claim_now", evidence_required: ["report"], sensitive: false, evidence: { code: true, test: true, report: true }, provenBy: ["this P14 truth matrix"] },
  // Extra hard MUST-NOT (cross-cutting)
  { id: "doctrine.no_full_hr_replacement", group: "legal_responsibility_doctrine", title: "Remplacement total de la RH humaine", requirement: "Prétendre que Pierre remplace TOUTE la RH humaine.", launch_importance: "future_enterprise", claim_level: "must_not_claim", evidence_required: ["legal"], sensitive: true, evidence: {}, provenBy: ["MUST NOT claim full human HR replacement"] },
  { id: "doctrine.no_autonomous_drh", group: "legal_responsibility_doctrine", title: "DRH autonome", requirement: "Prétendre que Pierre est un DRH autonome juridiquement conforme.", launch_importance: "future_enterprise", claim_level: "must_not_claim", evidence_required: ["legal"], sensitive: true, evidence: {}, provenBy: ["MUST NOT claim autonomous compliant DRH"] },
  { id: "compliance.country_guarantee", group: "hr_compliance_workflow", title: "Garantie de conformité pays", requirement: "Garantir la conformité au droit FR/BE/LU/CH.", launch_importance: "launch_critical", claim_level: "must_not_claim", evidence_required: ["legal", "external"], sensitive: true, evidence: { legal: false }, provenBy: ["MUST NOT guarantee country legal compliance without external review"] },
];

// ── Accès ───────────────────────────────────────────────────────────────────────
export function requirementById(id: string): UltimateRequirement | undefined {
  return PIERRE_ULTIMATE_VISION_REQUIREMENTS.find((r) => r.id === id);
}
export function requirementsByGroup(group: UltimateGroup): UltimateRequirement[] {
  return PIERRE_ULTIMATE_VISION_REQUIREMENTS.filter((r) => r.group === group);
}
/** Le catalogue est-il complet & cohérent ? (≥50 exigences, 50 groupes, ids uniques). Pur. */
export function catalogComplete(): boolean {
  const ids = new Set(PIERRE_ULTIMATE_VISION_REQUIREMENTS.map((r) => r.id));
  const groups = new Set(PIERRE_ULTIMATE_VISION_REQUIREMENTS.map((r) => r.group));
  return (
    PIERRE_ULTIMATE_VISION_REQUIREMENTS.length >= 50 &&
    ids.size === PIERRE_ULTIMATE_VISION_REQUIREMENTS.length &&
    PIERRE_ULTIMATE_GROUPS.length === 50 &&
    groups.size >= 45 && // la grande majorité des 50 groupes est représentée
    PIERRE_ULTIMATE_VISION_REQUIREMENTS.every((r) => !!r.claim_level && !!r.launch_importance)
  );
}
