// src/lib/clonestore/ultimate/p16-master-split.ts
// P16.0 — MASTER SPLIT : classification de tout le travail restant en 5 catégories
//   A. Pierre Ultimate · B. CloneStore Technologies · C. Integration Layer · D. External Blocked · E. Must Not Claim.
// Module PUR (aucune I/O, aucun build). C'est un PLAN + une donnée de classification, pas une implémentation.
// Grounded sur le catalogue P14 (pierre-ultimate-vision-catalog) : les items qui référencent une exigence
// P14 (p14Ref) sont cross-checkés par les tests. DOCTRINE : Pierre = employé IA RH ; les technologies sont
// des capacités CloneStore réutilisables (jamais hardcodées dans Pierre) ; Pierre les consomme par contrats.

export type P16Category = "pierre_ultimate" | "technology" | "integration" | "external_blocked" | "must_not_claim";
export type P16Status = "verified" | "partial" | "architecture_ready" | "not_built" | "external_blocked" | "must_not_claim";
export type P16Owner = "pierre" | "technology" | "integration" | "external";
export type P16LaunchImportance = "critical" | "important" | "nice_to_have" | "future";
export type P16Risk = "low" | "medium" | "high";
export type P16NextPhase = "P16A" | "T1" | "P16C" | "later";

export const P16_CATEGORIES: readonly P16Category[] = ["pierre_ultimate", "technology", "integration", "external_blocked", "must_not_claim"];

export interface P16Item {
  readonly id: string;
  readonly title: string;
  readonly category: P16Category;
  readonly current_status: P16Status;
  readonly owner: P16Owner;
  readonly launch_importance: P16LaunchImportance;
  readonly implementation_risk: P16Risk;
  readonly recommended_next_phase: P16NextPhase;
  readonly reason: string;
  /** Réf. exigence P14 (pour cross-check honnête) si applicable. */
  readonly p14Ref?: string;
  /** Techno hardcodée pour Pierre uniquement ? (interdit sauf justification explicite). */
  readonly pierreOnly?: boolean;
  readonly pierreOnlyJustification?: string;
  /** Repli sûr si la techno n'est pas live (dégradation). */
  readonly safeFallback?: string;
}

// ── A. PIERRE ULTIMATE (profondeur RH — canon P8.13 certifié, gouverné, à approfondir/démontrer) ──
const PIERRE_ULTIMATE: readonly P16Item[] = [
  { id: "pierre.mission_depth", title: "Profondeur du moteur de missions RH", category: "pierre_ultimate", current_status: "verified", owner: "pierre", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "P16A", p14Ref: "mission.engine", reason: "Moteur VERIFIED (P8/P9.6) ; l'ultime = enchaînements/plans plus riches, toujours gouvernés." },
  { id: "pierre.document_depth", title: "Profondeur documentaire RH", category: "pierre_ultimate", current_status: "partial", owner: "pierre", launch_importance: "critical", implementation_risk: "medium", recommended_next_phase: "P16A", p14Ref: "outputs.documents", reason: "Préparation documentaire gouvernée ; approfondir via DocumentTech (contrat), pas de hardcode.", safeFallback: "Document préparé, à relire/valider par un humain." },
  { id: "pierre.dossier_360", title: "Dossier salarié 360", category: "pierre_ultimate", current_status: "partial", owner: "pierre", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "P16A", p14Ref: "dossier.360", reason: "Capacité canon gouvernée ; à démontrer E2E + vue produit." },
  { id: "pierre.onboarding_offboarding", title: "Onboarding / offboarding en profondeur", category: "pierre_ultimate", current_status: "partial", owner: "pierre", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "P16A", p14Ref: "onboarding.preboarding", reason: "Packs onboarding/offboarding gouvernés ; approfondir workflows + WorkflowTech." },
  { id: "pierre.absences_prepayroll", title: "Absences + préparation pré-paie", category: "pierre_ultimate", current_status: "partial", owner: "pierre", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "P16A", p14Ref: "prepayroll.variables", reason: "Éléments variables préparés (jamais moteur de paie) ; approfondir sous validation humaine." },
  { id: "pierre.interview_perf_training", title: "Entretiens / performance / formation", category: "pierre_ultimate", current_status: "partial", owner: "pierre", launch_importance: "nice_to_have", implementation_risk: "medium", recommended_next_phase: "P16A", p14Ref: "interviews.prepare", reason: "Préparation gouvernée ; dépend de CalendarTech pour convocations/planning." },
  { id: "pierre.employee_relations_sensitive", title: "Cas RH sensibles (préparation)", category: "pierre_ultimate", current_status: "partial", owner: "pierre", launch_importance: "important", implementation_risk: "high", recommended_next_phase: "P16A", p14Ref: "relations.prepare", reason: "Préparation seulement ; décisions finales HUMAN_ONLY (jamais automatisées)." },
  { id: "pierre.proactive_followup", title: "Suivi RH proactif", category: "pierre_ultimate", current_status: "partial", owner: "pierre", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "P16A", p14Ref: "proactivity.signals", reason: "Proactivité gouvernée (P8.14) ; dépend de NotificationTech pour les relances." },
  { id: "pierre.monthly_value_report", title: "Rapport de valeur/ROI mensuel", category: "pierre_ultimate", current_status: "architecture_ready", owner: "pierre", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "P16A", p14Ref: "roi.value_report", reason: "analytics.compute existe (métriques brutes) ; le rapport LIVRÉ dépend d'AnalyticsTech." },
  { id: "pierre.sector_adaptation", title: "Adaptation sectorielle RH", category: "pierre_ultimate", current_status: "architecture_ready", owner: "pierre", launch_importance: "future", implementation_risk: "high", recommended_next_phase: "later", p14Ref: "sector.adaptation", reason: "Nécessite du sourcing (jamais inventer le droit) → dépend d'items externes/légaux." },
  { id: "pierre.hr_helpdesk_quality", title: "Qualité du helpdesk RH", category: "pierre_ultimate", current_status: "verified", owner: "pierre", launch_importance: "important", implementation_risk: "low", recommended_next_phase: "P16A", p14Ref: "helpdesk.hr", reason: "Helpdesk VERIFIED (P9.4) ; l'ultime = qualité/couverture des réponses." },
  { id: "pierre.hr_quality_control", title: "Contrôle qualité RH (CloneGuard)", category: "pierre_ultimate", current_status: "partial", owner: "pierre", launch_importance: "important", implementation_risk: "low", recommended_next_phase: "P16A", p14Ref: "guard.risk", reason: "CloneGuard existe ; à approfondir + exposer comme EvidenceTech/quality gate réutilisable." },
];

// ── B. CLONESTORE TECHNOLOGIES (capacités réutilisables — jamais hardcodées Pierre) ──────────────
const TECHNOLOGIES: readonly P16Item[] = [
  { id: "tech.document", title: "DocumentTech", category: "technology", current_status: "partial", owner: "technology", launch_importance: "critical", implementation_risk: "medium", recommended_next_phase: "T1", reason: "Rendu/templates existent (Pierre) ; extraire un contrat réutilisable (préparer/rendre/exporter des documents)." },
  { id: "tech.mail", title: "MailTech", category: "technology", current_status: "partial", owner: "technology", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "T1", reason: "communications.ts + providers orchestrés ; l'envoi LIVE dépend d'un domaine/provider externe.", safeFallback: "Pierre rédige, l'humain envoie manuellement." },
  { id: "tech.calendar", title: "CalendarTech", category: "technology", current_status: "not_built", owner: "technology", launch_importance: "nice_to_have", implementation_risk: "medium", recommended_next_phase: "T1", reason: "Aucune techno calendrier ; préparation d'événements/entretiens.", safeFallback: "Pierre prépare l'événement, l'humain copie/valide." },
  { id: "tech.signature", title: "SignatureTech", category: "technology", current_status: "architecture_ready", owner: "technology", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "T1", reason: "Abstraction provider (fallback/live) déjà cadrée (P15 provider-closure) ; Yousign live bloqué (P8.7.4).", safeFallback: "Document préparé, signature manuelle/externe (aucune revendication live)." },
  { id: "tech.voice", title: "VoiceTech / CloneVoice", category: "technology", current_status: "architecture_ready", owner: "technology", launch_importance: "future", implementation_risk: "high", recommended_next_phase: "later", reason: "Un contrat CloneVoice existe (employee-context-registry) ; implémentation vocale = roadmap.", safeFallback: "L'entrée texte reste la source de vérité." },
  { id: "tech.notification", title: "NotificationTech", category: "technology", current_status: "partial", owner: "technology", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "T1", reason: "Rappels cockpit existent ; push temps réel = roadmap/externe.", safeFallback: "Rappels dans le cockpit uniquement." },
  { id: "tech.connector", title: "ConnectorTech", category: "technology", current_status: "architecture_ready", owner: "technology", launch_importance: "future", implementation_risk: "high", recommended_next_phase: "later", reason: "channels.ts = architecture ; connecteurs SIRH/paie/Slack = externes." },
  { id: "tech.memory", title: "MemoryTech", category: "technology", current_status: "verified", owner: "technology", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "T1", reason: "Mémoire durable pg (P8.14) + CloneADN ; à exposer comme techno réutilisable multi-employés." },
  { id: "tech.evidence", title: "EvidenceTech / TraceTech", category: "technology", current_status: "partial", owner: "technology", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "T1", reason: "Timeline + audit pierre_rt_ existent ; extraire un contrat trace/preuve réutilisable." },
  { id: "tech.workflow", title: "WorkflowTech", category: "technology", current_status: "partial", owner: "technology", launch_importance: "important", implementation_risk: "high", recommended_next_phase: "T1", reason: "Moteur missions + case FSM (Pierre) ; abstraire en moteur de workflow réutilisable (NE PAS créer un 2e cerveau RH)." },
  { id: "tech.analytics", title: "AnalyticsTech / ROI", category: "technology", current_status: "partial", owner: "technology", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "T1", reason: "analytics.compute existe ; techno analytics/ROI réutilisable (rapport de valeur)." },
  { id: "tech.file", title: "FileTech (ingestion)", category: "technology", current_status: "partial", owner: "technology", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "T1", reason: "Ingestion image/capture (P9.4, EXIF) ; élargir + contractualiser l'ingestion de fichiers." },
  { id: "tech.export", title: "ExportTech", category: "technology", current_status: "partial", owner: "technology", launch_importance: "nice_to_have", implementation_risk: "low", recommended_next_phase: "T1", reason: "Exports documentaires ; contrat d'export réutilisable." },
  { id: "tech.permission", title: "PermissionTech / scope engine", category: "technology", current_status: "verified", owner: "technology", launch_importance: "critical", implementation_risk: "medium", recommended_next_phase: "T1", reason: "RLS + requireCompanyUser + write-permission (Pierre) ; exposer comme moteur de permissions/scope réutilisable." },
  { id: "tech.bus", title: "IntegrationBus / TechnologyBus", category: "technology", current_status: "architecture_ready", owner: "technology", launch_importance: "critical", implementation_risk: "high", recommended_next_phase: "T1", reason: "employee-context-registry amorce la couche multi-employés ; formaliser un bus techno consommable par tout employé IA." },
];

// ── C. INTEGRATION LAYER (adaptateurs Pierre→Techno, par contrat, dégradation sûre) ──────────────
const INTEGRATION: readonly P16Item[] = [
  { id: "int.document_adapter", title: "PierreDocumentTechAdapter", category: "integration", current_status: "not_built", owner: "integration", launch_importance: "critical", implementation_risk: "medium", recommended_next_phase: "P16C", reason: "Pierre prépare les documents via DocumentTech (contrat), sous validation.", safeFallback: "Document préparé, validation humaine." },
  { id: "int.mail_adapter", title: "PierreMailTechAdapter", category: "integration", current_status: "not_built", owner: "integration", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "P16C", reason: "Pierre rédige les emails via MailTech ; envoi sous validation.", safeFallback: "Pierre rédige, l'humain envoie manuellement." },
  { id: "int.calendar_adapter", title: "PierreCalendarTechAdapter", category: "integration", current_status: "not_built", owner: "integration", launch_importance: "nice_to_have", implementation_risk: "medium", recommended_next_phase: "P16C", reason: "Pierre prépare entretiens/événements via CalendarTech.", safeFallback: "Pierre prépare, l'humain copie/valide." },
  { id: "int.signature_adapter", title: "PierreSignatureTechAdapter", category: "integration", current_status: "architecture_ready", owner: "integration", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "P16C", reason: "Abstraction fallback/live (jamais de revendication live si fallback).", safeFallback: "Document préparé, signature manuelle." },
  { id: "int.voice_adapter", title: "PierreVoiceTechAdapter", category: "integration", current_status: "not_built", owner: "integration", launch_importance: "future", implementation_risk: "high", recommended_next_phase: "later", reason: "Entrée vocale → mission ; roadmap.", safeFallback: "Entrée texte autoritaire." },
  { id: "int.notification_adapter", title: "PierreNotificationTechAdapter", category: "integration", current_status: "not_built", owner: "integration", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "P16C", reason: "Relances/rappels via NotificationTech.", safeFallback: "Rappels cockpit uniquement." },
  { id: "int.analytics_adapter", title: "PierreAnalyticsTechAdapter", category: "integration", current_status: "not_built", owner: "integration", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "P16C", reason: "Rapport de valeur/ROI via AnalyticsTech.", safeFallback: "Métriques cockpit brutes." },
  { id: "int.evidence_adapter", title: "PierreEvidenceTechAdapter", category: "integration", current_status: "architecture_ready", owner: "integration", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "P16C", reason: "Trace/preuve d'audit via EvidenceTech.", safeFallback: "Timeline V1 existante." },
  { id: "int.workflow_adapter", title: "PierreWorkflowTechAdapter", category: "integration", current_status: "not_built", owner: "integration", launch_importance: "important", implementation_risk: "high", recommended_next_phase: "P16C", reason: "Pierre orchestre ses workflows via WorkflowTech (NE PAS dupliquer le cerveau RH).", safeFallback: "Moteur de missions V1 existant." },
  { id: "int.permission_adapter", title: "PierrePermissionTechAdapter", category: "integration", current_status: "architecture_ready", owner: "integration", launch_importance: "critical", implementation_risk: "medium", recommended_next_phase: "P16C", reason: "Scopes/permissions via PermissionTech.", safeFallback: "RLS + requireCompanyUser existants." },
];

// ── D. EXTERNAL BLOCKED (dépendances externes/live) ──────────────────────────────────────────────
const EXTERNAL_BLOCKED: readonly P16Item[] = [
  { id: "ext.stripe_live", title: "Stripe live", category: "external_blocked", current_status: "external_blocked", owner: "external", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "later", reason: "Compte Stripe live non disponible (P15/P15.1) ; production off." },
  { id: "ext.yousign_live", title: "Yousign / signature live", category: "external_blocked", current_status: "external_blocked", owner: "external", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "later", p14Ref: "signature.esign", reason: "P8.7.4 ouvert ; fallback signature préparée disponible." },
  { id: "ext.email_provider", title: "Domaine / provider email live", category: "external_blocked", current_status: "external_blocked", owner: "external", launch_importance: "important", implementation_risk: "medium", recommended_next_phase: "later", reason: "Envoi email live nécessite domaine/provider externe (MailTech live)." },
  { id: "ext.legal_tax", title: "Validation légale/fiscale externe FR/BE/LU/CH", category: "external_blocked", current_status: "external_blocked", owner: "external", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "later", p14Ref: "compliance.workflow", reason: "Revue avocat/comptable requise (P11/P15) ; jamais VERIFIED sans preuve externe." },
  { id: "ext.sirh_payroll", title: "Provider SIRH / paie live", category: "external_blocked", current_status: "external_blocked", owner: "external", launch_importance: "future", implementation_risk: "high", recommended_next_phase: "later", p14Ref: "integrations.external", reason: "Intégrations externes ; ConnectorTech live." },
  { id: "ext.monitoring_provider", title: "Provider monitoring production", category: "external_blocked", current_status: "external_blocked", owner: "external", launch_importance: "important", implementation_risk: "low", recommended_next_phase: "later", reason: "Health/alerting/rollback à déployer + attester (P15 monitoring)." },
];

// ── E. MUST NOT CLAIM (interdits commerciaux — jamais revendiqués) ───────────────────────────────
const MUST_NOT_CLAIM: readonly P16Item[] = [
  { id: "mnc.legal_compliance", title: "Conformité légale garantie", category: "must_not_claim", current_status: "must_not_claim", owner: "external", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "later", p14Ref: "compliance.country_guarantee", reason: "Jamais de garantie de conformité pays sans revue externe." },
  { id: "mnc.autonomous_drh", title: "DRH autonome", category: "must_not_claim", current_status: "must_not_claim", owner: "external", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "later", p14Ref: "doctrine.no_autonomous_drh", reason: "Pierre reste sous validation humaine ; jamais un DRH autonome." },
  { id: "mnc.payroll_engine", title: "Moteur de paie / DSN complet", category: "must_not_claim", current_status: "must_not_claim", owner: "external", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "later", p14Ref: "prepayroll.full_engine", reason: "Pré-paie préparée uniquement ; jamais un logiciel de paie." },
  { id: "mnc.live_signature_if_fallback", title: "Signature live alors que fallback seulement", category: "must_not_claim", current_status: "must_not_claim", owner: "external", launch_importance: "important", implementation_risk: "low", recommended_next_phase: "later", reason: "Aucune revendication de signature live tant que non vérifiée." },
  { id: "mnc.live_stripe_if_unverified", title: "Stripe live non vérifié", category: "must_not_claim", current_status: "must_not_claim", owner: "external", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "later", reason: "Aucune revendication Stripe live/paiement live tant que non vérifié." },
  { id: "mnc.final_sensitive_decisions", title: "Décisions sensibles finales sans validation humaine", category: "must_not_claim", current_status: "must_not_claim", owner: "external", launch_importance: "critical", implementation_risk: "low", recommended_next_phase: "later", p14Ref: "relations.decisions", reason: "Décisions disciplinaires/salariales finales = HUMAN_ONLY, jamais automatisées." },
];

export const P16_MASTER_SPLIT: readonly P16Item[] = [
  ...PIERRE_ULTIMATE, ...TECHNOLOGIES, ...INTEGRATION, ...EXTERNAL_BLOCKED, ...MUST_NOT_CLAIM,
];

// ── Accès ─────────────────────────────────────────────────────────────────────────
export function getPierreUltimateItems(): P16Item[] { return P16_MASTER_SPLIT.filter((i) => i.category === "pierre_ultimate"); }
export function getTechnologyItems(): P16Item[] { return P16_MASTER_SPLIT.filter((i) => i.category === "technology"); }
export function getIntegrationItems(): P16Item[] { return P16_MASTER_SPLIT.filter((i) => i.category === "integration"); }
export function getExternalBlockedItems(): P16Item[] { return P16_MASTER_SPLIT.filter((i) => i.category === "external_blocked"); }
export function getMustNotClaimItems(): P16Item[] { return P16_MASTER_SPLIT.filter((i) => i.category === "must_not_claim"); }
export function itemById(id: string): P16Item | undefined { return P16_MASTER_SPLIT.find((i) => i.id === id); }

export type SessionRecommendation = "two_sessions_plus_integration_gate" | "one_mega_session";

export interface P16SplitSummary {
  readonly total: number;
  readonly byCategory: Record<P16Category, number>;
  readonly byStatus: Record<string, number>;
  readonly byNextPhase: Record<P16NextPhase, number>;
  readonly hardcodedPierreOnlyTechnologies: string[];   // technos hardcodées Pierre-only SANS justification (interdit)
  readonly buildableBeforeStripe: string[];             // items sûrs avant Stripe live
  readonly sessionRecommendation: SessionRecommendation;
  readonly sessionRationale: string[];
  readonly note: string;
}

/** Résume le master split + recommande la stratégie de session. Pur. */
export function summarizeP16Split(): P16SplitSummary {
  const byCategory = Object.fromEntries(P16_CATEGORIES.map((c) => [c, 0])) as Record<P16Category, number>;
  const byStatus: Record<string, number> = {};
  const byNextPhase = { P16A: 0, T1: 0, P16C: 0, later: 0 } as Record<P16NextPhase, number>;
  for (const i of P16_MASTER_SPLIT) {
    byCategory[i.category]++;
    byStatus[i.current_status] = (byStatus[i.current_status] ?? 0) + 1;
    byNextPhase[i.recommended_next_phase]++;
  }
  // Une techno hardcodée Pierre-only SANS justification est interdite par la doctrine.
  const hardcodedPierreOnlyTechnologies = getTechnologyItems().filter((t) => t.pierreOnly && !t.pierreOnlyJustification).map((t) => t.id);
  // Buildable avant Stripe : tout ce qui n'est pas external_blocked / must_not_claim et pas « later ».
  const buildableBeforeStripe = P16_MASTER_SPLIT
    .filter((i) => i.category !== "external_blocked" && i.category !== "must_not_claim" && i.recommended_next_phase !== "later")
    .map((i) => i.id);

  return {
    total: P16_MASTER_SPLIT.length,
    byCategory, byStatus, byNextPhase,
    hardcodedPierreOnlyTechnologies,
    buildableBeforeStripe,
    sessionRecommendation: "two_sessions_plus_integration_gate",
    sessionRationale: [
      "Plus sûr : deux périmètres séparés (Pierre RH vs technologies réutilisables) limitent le rayon de casse.",
      "Moins de pollution de contexte : chaque session reste focalisée + testable.",
      "Meilleures frontières de test + non-régression indépendante.",
      "Technologies réutilisables : évite le hardcode dans Pierre (les technos doivent servir de futurs employés IA).",
      "Facile d'arrêter une piste si elle crée du risque sans bloquer l'autre.",
      "L'intégration (P16C) reste une porte dédiée qui ne s'ouvre qu'une fois A et B prêts + testés.",
    ],
    note: "P16.0 est un PLAN (aucun build). Doctrine : Pierre = employé IA RH sous validation humaine ; technologies = capacités CloneStore réutilisables (jamais hardcodées Pierre) consommées par contrats ; dégradation sûre si une techno n'est pas live ; production OFF, aucun paiement, rien de déployé.",
  };
}

/** Le master split est-il complet & cohérent ? (5 catégories peuplées, 15 technos, 10 adapters, ids uniques). Pur. */
export function masterSplitComplete(): boolean {
  const ids = new Set(P16_MASTER_SPLIT.map((i) => i.id));
  return (
    ids.size === P16_MASTER_SPLIT.length &&
    getPierreUltimateItems().length >= 10 &&
    getTechnologyItems().length === 15 &&
    getIntegrationItems().length === 10 &&
    getExternalBlockedItems().length >= 5 &&
    getMustNotClaimItems().length >= 5 &&
    P16_MASTER_SPLIT.every((i) => !!i.owner && !!i.recommended_next_phase && !!i.reason)
  );
}
