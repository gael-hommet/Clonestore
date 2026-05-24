// CloneStore Technologies Foundation — Registry (Bloc 18)
// Pure module: no Supabase, no Next, no async, no side effects.
// Defines all 12 CloneStore technology definitions and registry functions.

import type {
  TechnologySlug,
  TechnologyDefinition,
  TechnologyCompanySetting,
  TechnologyRuntimeState,
  TechnologyRegistry,
  TechnologyRegistrySummary,
  TechnologyOperationalStatus,
  TechnologyAutonomyLevel,
  TechnologyRiskMode,
  TechnologyConfigurationStatus,
} from "./contracts";

// ── Internal helpers ─────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  return null;
}

const VALID_SLUGS = new Set<TechnologySlug>([
  "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonecontinuum",
  "clonetrust", "clonereview", "clonesignals", "clonelearn",
  "clonevoice", "clonechat", "clonebrief",
]);

function isTechnologySlug(v: unknown): v is TechnologySlug {
  return typeof v === "string" && VALID_SLUGS.has(v as TechnologySlug);
}

const VALID_STATUSES = new Set<TechnologyOperationalStatus>([
  "enabled", "disabled", "degraded", "maintenance", "not_configured",
]);
const VALID_AUTONOMY = new Set<TechnologyAutonomyLevel>([
  "off", "suggest_only", "supervised", "semi_autonomous", "autonomous",
]);
const VALID_RISK_MODES = new Set<TechnologyRiskMode>([
  "normal", "guarded", "strict", "locked",
]);
const VALID_CONFIG_STATUSES = new Set<TechnologyConfigurationStatus>([
  "missing", "partial", "configured", "optimized",
]);

function validStatus(v: unknown, fallback: TechnologyOperationalStatus): TechnologyOperationalStatus {
  return typeof v === "string" && VALID_STATUSES.has(v as TechnologyOperationalStatus) ? (v as TechnologyOperationalStatus) : fallback;
}
function validAutonomy(v: unknown, fallback: TechnologyAutonomyLevel): TechnologyAutonomyLevel {
  return typeof v === "string" && VALID_AUTONOMY.has(v as TechnologyAutonomyLevel) ? (v as TechnologyAutonomyLevel) : fallback;
}
function validRiskMode(v: unknown, fallback: TechnologyRiskMode): TechnologyRiskMode {
  return typeof v === "string" && VALID_RISK_MODES.has(v as TechnologyRiskMode) ? (v as TechnologyRiskMode) : fallback;
}
function validConfigStatus(v: unknown, fallback: TechnologyConfigurationStatus): TechnologyConfigurationStatus {
  return typeof v === "string" && VALID_CONFIG_STATUSES.has(v as TechnologyConfigurationStatus) ? (v as TechnologyConfigurationStatus) : fallback;
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

// ── Technology Definitions ───────────────────────────────────────────────────

const TECHNOLOGY_DEFINITIONS: TechnologyDefinition[] = [
  // ── CloneOS ──────────────────────────────────────────────
  {
    slug: "cloneos",
    name: "CloneOS",
    short_name: "OS",
    public_label: "Système Opérationnel IA",
    one_liner: "Le système d'exploitation des employés IA CloneStore.",
    description: "CloneOS orchestre le cycle de vie complet des missions et tâches. Il gère la planification, l'exécution, les reprises et l'état opérationnel de chaque employé IA — sans jamais présupposer un employé spécifique.",
    visibility: "public",
    scopes: ["platform", "company", "employee", "mission", "task"],
    default_status: "enabled",
    default_autonomy: "supervised",
    default_risk_mode: "normal",
    capabilities: [
      { id: "task_orchestration", label: "Orchestration des tâches", description: "Planification et exécution séquencée des tâches par priorité.", scopes: ["task"], required: true, configurable: false, default_enabled: true },
      { id: "mission_lifecycle", label: "Cycle de vie des missions", description: "Création, suivi, reprise et clôture des missions.", scopes: ["mission"], required: true, configurable: false, default_enabled: true },
      { id: "workflow_engine", label: "Moteur de workflow", description: "Analyse des demandes et structuration en plans d'action.", scopes: ["mission", "task"], required: true, configurable: false, default_enabled: true },
      { id: "context_management", label: "Gestion du contexte", description: "Maintien et transmission du contexte entre les étapes d'exécution.", scopes: ["mission", "task", "employee"], required: false, configurable: true, default_enabled: true },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: true,
    is_customer_configurable: false,
    requires_human_validation: false,
    created_for: "all",
  },
  // ── CloneADN ─────────────────────────────────────────────
  {
    slug: "cloneadn",
    name: "CloneADN",
    short_name: "ADN",
    public_label: "Mémoire Génétique Entreprise",
    one_liner: "La mémoire persistante et configurable de votre entreprise.",
    description: "CloneADN stocke le contexte, les préférences, l'identité et les règles propres à l'entreprise. Il permet à chaque employé IA de connaître la culture, le ton et les conventions de l'entreprise sans répétition.",
    visibility: "public",
    scopes: ["company", "employee"],
    default_status: "enabled",
    default_autonomy: "supervised",
    default_risk_mode: "normal",
    capabilities: [
      { id: "company_memory", label: "Mémoire entreprise", description: "Stockage des préférences, règles et contexte de l'entreprise.", scopes: ["company"], required: true, configurable: true, default_enabled: true },
      { id: "preferences_management", label: "Gestion des préférences", description: "Ton, langue, signatures, contacts fréquents.", scopes: ["company", "employee"], required: false, configurable: true, default_enabled: true },
      { id: "identity_persistence", label: "Persistance de l'identité", description: "Maintien de la cohérence identitaire entre les sessions.", scopes: ["employee"], required: false, configurable: true, default_enabled: true },
      { id: "context_learning", label: "Apprentissage contextuel", description: "Enrichissement progressif du contexte à partir des interactions.", scopes: ["company", "employee"], required: false, configurable: true, default_enabled: false },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: false,
    is_customer_configurable: true,
    requires_human_validation: false,
    created_for: "all",
  },
  // ── CloneGuard ───────────────────────────────────────────
  {
    slug: "cloneguard",
    name: "CloneGuard",
    short_name: "Guard",
    public_label: "Gouvernance et Protection",
    one_liner: "Le système de gouvernance, risque et protection des employés IA.",
    description: "CloneGuard évalue chaque action avant exécution. Il bloque, approuve ou surveille selon les règles de gouvernance configurées. Toute action sensible ou risquée passe obligatoirement par CloneGuard.",
    visibility: "public",
    scopes: ["platform", "company", "employee", "mission", "task"],
    default_status: "enabled",
    default_autonomy: "supervised",
    default_risk_mode: "guarded",
    capabilities: [
      { id: "risk_assessment", label: "Évaluation du risque", description: "Classement de chaque action par niveau de risque (green/orange/red/black).", scopes: ["task", "mission"], required: true, configurable: false, default_enabled: true },
      { id: "governance_evaluation", label: "Évaluation gouvernance", description: "Pipeline CloneGuard → ClonePolicy → CloneTrust → décision finale.", scopes: ["platform", "task"], required: true, configurable: false, default_enabled: true },
      { id: "action_blocking", label: "Blocage d'actions", description: "Interruption d'actions hors-périmètre ou dangereuses.", scopes: ["task", "mission"], required: true, configurable: false, default_enabled: true },
      { id: "approval_routing", label: "Routage vers approbation", description: "Redirection automatique vers validation humaine si requis.", scopes: ["task", "mission", "employee"], required: false, configurable: true, default_enabled: true },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: true,
    is_customer_configurable: true,
    requires_human_validation: false,
    created_for: "all",
  },
  // ── CloneTrace ───────────────────────────────────────────
  {
    slug: "clonetrace",
    name: "CloneTrace",
    short_name: "Trace",
    public_label: "Traçabilité & Audit",
    one_liner: "Le système d'audit trail et d'observabilité de toutes les actions IA.",
    description: "CloneTrace enregistre chaque événement significatif — création, exécution, blocage, validation — pour garantir une traçabilité complète et un audit forensique disponible à tout moment.",
    visibility: "public",
    scopes: ["platform", "company", "employee", "mission", "task", "document"],
    default_status: "enabled",
    default_autonomy: "autonomous",
    default_risk_mode: "normal",
    capabilities: [
      { id: "event_logging", label: "Journal d'événements", description: "Enregistrement structuré de tous les événements avec event_type/message/meta_json.", scopes: ["platform", "task", "mission"], required: true, configurable: false, default_enabled: true },
      { id: "audit_trail", label: "Piste d'audit", description: "Reconstruction chronologique de la vie d'une mission ou tâche.", scopes: ["mission", "task", "employee"], required: true, configurable: false, default_enabled: true },
      { id: "compliance_reporting", label: "Reporting conformité", description: "Alertes, diagnostics et score de santé de l'audit trail.", scopes: ["company", "platform"], required: false, configurable: true, default_enabled: true },
      { id: "timeline_reconstruction", label: "Reconstruction de timeline", description: "Vue chronologique des événements par mission/employé.", scopes: ["mission", "employee"], required: false, configurable: true, default_enabled: true },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: true,
    is_customer_configurable: false,
    requires_human_validation: false,
    created_for: "all",
  },
  // ── CloneContinuum ───────────────────────────────────────
  {
    slug: "clonecontinuum",
    name: "CloneContinuum",
    short_name: "Continuum",
    public_label: "Continuité & Persistance",
    one_liner: "Le moteur de continuité qui reprend les missions là où elles s'arrêtent.",
    description: "CloneContinuum gère la persistance des missions, détecte les états bloqués, lance les reprises et garantit qu'aucune tâche planifiée n'est oubliée, quelle que soit la session.",
    visibility: "public",
    scopes: ["platform", "mission", "task"],
    default_status: "enabled",
    default_autonomy: "semi_autonomous",
    default_risk_mode: "guarded",
    capabilities: [
      { id: "mission_continuity", label: "Continuité des missions", description: "Reprise automatique des missions actives entre les sessions.", scopes: ["mission"], required: true, configurable: false, default_enabled: true },
      { id: "stalled_detection", label: "Détection d'états bloqués", description: "Identification des missions/tâches en attente depuis trop longtemps.", scopes: ["mission", "task"], required: true, configurable: false, default_enabled: true },
      { id: "task_recovery", label: "Récupération de tâches", description: "Relance sécurisée des tâches en erreur ou bloquées.", scopes: ["task"], required: false, configurable: true, default_enabled: true },
      { id: "auto_resume", label: "Reprise automatique", description: "Proposition de plan de reprise contextuel pour les missions inactives.", scopes: ["mission"], required: false, configurable: true, default_enabled: true },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: true,
    is_customer_configurable: false,
    requires_human_validation: false,
    created_for: "all",
  },
  // ── CloneTrust ───────────────────────────────────────────
  {
    slug: "clonetrust",
    name: "CloneTrust",
    short_name: "Trust",
    public_label: "Autonomie & Confiance",
    one_liner: "Le système de calibration de l'autonomie graduelle des employés IA.",
    description: "CloneTrust calcule un score de confiance dynamique pour chaque action et calibre le niveau d'autonomie autorisé. Plus l'historique est fiable, plus l'autonomie peut être étendue — de façon gouvernée.",
    visibility: "public",
    scopes: ["platform", "company", "employee"],
    default_status: "enabled",
    default_autonomy: "supervised",
    default_risk_mode: "guarded",
    capabilities: [
      { id: "trust_scoring", label: "Score de confiance", description: "Calcul dynamique du niveau de confiance basé sur l'historique d'exécution.", scopes: ["employee", "task"], required: true, configurable: false, default_enabled: true },
      { id: "autonomy_calibration", label: "Calibration de l'autonomie", description: "Ajustement progressif du niveau d'autonomie autorisé.", scopes: ["employee", "company"], required: true, configurable: true, default_enabled: true },
      { id: "supervised_execution", label: "Exécution supervisée", description: "Mode intermédiaire : l'IA agit mais notifie systématiquement.", scopes: ["task", "mission"], required: false, configurable: true, default_enabled: true },
      { id: "human_escalation", label: "Escalade humaine", description: "Transfert automatique vers validation humaine quand le score est insuffisant.", scopes: ["task", "company"], required: false, configurable: true, default_enabled: true },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: false,
    is_customer_configurable: true,
    requires_human_validation: false,
    created_for: "all",
  },
  // ── CloneReview ──────────────────────────────────────────
  {
    slug: "clonereview",
    name: "CloneReview",
    short_name: "Review",
    public_label: "Qualité & Revue",
    one_liner: "Le système de contrôle qualité des livrables produits par les employés IA.",
    description: "CloneReview soumet les documents, emails et communications à une validation qualité avant livraison. Il peut être activé par type de livrable, par employé ou par domaine.",
    visibility: "public",
    scopes: ["document", "communication", "task"],
    default_status: "enabled",
    default_autonomy: "supervised",
    default_risk_mode: "guarded",
    capabilities: [
      { id: "document_review", label: "Revue de documents", description: "Validation qualité et cohérence des documents générés.", scopes: ["document"], required: false, configurable: true, default_enabled: true },
      { id: "output_quality", label: "Qualité des livrables", description: "Score de qualité et détection d'anomalies dans les sorties.", scopes: ["document", "communication"], required: false, configurable: true, default_enabled: false },
      { id: "style_validation", label: "Validation du style", description: "Vérification de conformité au ton et style de l'entreprise.", scopes: ["document", "communication"], required: false, configurable: true, default_enabled: false },
      { id: "accuracy_check", label: "Vérification de précision", description: "Détection des incohérences factuelles dans les livrables.", scopes: ["document"], required: false, configurable: true, default_enabled: false },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: false,
    is_customer_configurable: true,
    requires_human_validation: true,
    created_for: "all",
  },
  // ── CloneSignals ─────────────────────────────────────────
  {
    slug: "clonesignals",
    name: "CloneSignals",
    short_name: "Signals",
    public_label: "Signaux & Déclencheurs",
    one_liner: "Le moteur de détection de signaux et d'actions proactives.",
    description: "CloneSignals surveille les événements, seuils et patterns pour déclencher des alertes ou actions automatiques. Il permet aux employés IA d'être proactifs sans être intrusifs.",
    visibility: "public",
    scopes: ["company", "employee", "mission"],
    default_status: "enabled",
    default_autonomy: "suggest_only",
    default_risk_mode: "guarded",
    capabilities: [
      { id: "signal_detection", label: "Détection de signaux", description: "Identification de patterns d'événements significatifs.", scopes: ["mission", "employee"], required: false, configurable: true, default_enabled: true },
      { id: "threshold_alerts", label: "Alertes à seuil", description: "Déclenchement d'alertes quand des métriques franchissent un seuil.", scopes: ["company", "mission"], required: false, configurable: true, default_enabled: true },
      { id: "proactive_actions", label: "Actions proactives", description: "Suggestion d'actions basées sur les signaux détectés.", scopes: ["employee", "mission"], required: false, configurable: true, default_enabled: false },
      { id: "event_routing", label: "Routage d'événements", description: "Transmission des signaux vers les bons employés IA.", scopes: ["company"], required: false, configurable: true, default_enabled: false },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: false,
    is_customer_configurable: true,
    requires_human_validation: false,
    created_for: "all",
  },
  // ── CloneLearn ───────────────────────────────────────────
  {
    slug: "clonelearn",
    name: "CloneLearn",
    short_name: "Learn",
    public_label: "Apprentissage Gouverné",
    one_liner: "L'apprentissage continu et gouverné des employés IA.",
    description: "CloneLearn ingère les retours humains et les patterns d'usage pour améliorer progressivement les réponses. Tout apprentissage passe par une validation gouvernée pour éviter la dérive.",
    visibility: "public",
    scopes: ["company", "employee"],
    default_status: "enabled",
    default_autonomy: "suggest_only",
    default_risk_mode: "strict",
    capabilities: [
      { id: "feedback_ingestion", label: "Ingestion de retours", description: "Collecte structurée des retours humains sur les livrables.", scopes: ["employee", "company"], required: false, configurable: true, default_enabled: true },
      { id: "pattern_learning", label: "Apprentissage de patterns", description: "Identification de patterns récurrents pour optimiser les réponses.", scopes: ["employee"], required: false, configurable: true, default_enabled: false },
      { id: "knowledge_update", label: "Mise à jour des connaissances", description: "Enrichissement gouverné de la base de connaissance.", scopes: ["company"], required: false, configurable: true, default_enabled: false },
      { id: "drift_detection", label: "Détection de dérive", description: "Surveillance pour prévenir toute dérive comportementale.", scopes: ["platform", "company"], required: true, configurable: false, default_enabled: true },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: false,
    is_customer_configurable: true,
    requires_human_validation: true,
    created_for: "all",
  },
  // ── CloneVoice ───────────────────────────────────────────
  {
    slug: "clonevoice",
    name: "CloneVoice",
    short_name: "Voice",
    public_label: "Interface Vocale",
    one_liner: "L'interface vocale premium pour les employés IA CloneStore.",
    description: "CloneVoice permet des interactions vocales bidirectionnelles avec les employés IA — dictée de missions, retours oraux, notifications audio. Disponible en option premium.",
    visibility: "beta",
    scopes: ["communication", "voice", "employee"],
    default_status: "disabled",
    default_autonomy: "supervised",
    default_risk_mode: "normal",
    capabilities: [
      { id: "voice_input", label: "Entrée vocale", description: "Dictée et transcription de missions en temps réel.", scopes: ["voice"], required: false, configurable: true, default_enabled: false },
      { id: "voice_output", label: "Synthèse vocale", description: "Restitution audio des réponses et briefings.", scopes: ["voice", "communication"], required: false, configurable: true, default_enabled: false },
      { id: "speech_to_action", label: "Voix vers action", description: "Conversion directe de commandes vocales en missions/tâches.", scopes: ["voice", "mission"], required: false, configurable: true, default_enabled: false },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: false,
    is_customer_configurable: true,
    requires_human_validation: false,
    created_for: "all",
  },
  // ── CloneChat ────────────────────────────────────────────
  {
    slug: "clonechat",
    name: "CloneChat",
    short_name: "Chat",
    public_label: "Interface Conversationnelle",
    one_liner: "L'interface de messagerie multimodale pour tous les employés IA.",
    description: "CloneChat fournit une interface de conversation unifiée — texte, pièces jointes, historique — pour interagir avec n'importe quel employé IA CloneStore.",
    visibility: "public",
    scopes: ["communication", "support", "employee"],
    default_status: "enabled",
    default_autonomy: "supervised",
    default_risk_mode: "normal",
    capabilities: [
      { id: "chat_interface", label: "Interface de chat", description: "Conversation multi-tours avec mémoire de session.", scopes: ["communication", "employee"], required: true, configurable: false, default_enabled: true },
      { id: "multi_modal", label: "Multimodal", description: "Support texte, fichiers, images dans la conversation.", scopes: ["communication"], required: false, configurable: true, default_enabled: false },
      { id: "conversation_history", label: "Historique de conversation", description: "Accès à l'historique complet des échanges.", scopes: ["employee", "support"], required: false, configurable: true, default_enabled: true },
      { id: "context_threading", label: "Fil contextuel", description: "Maintien du contexte entre plusieurs sessions de chat.", scopes: ["employee"], required: false, configurable: true, default_enabled: true },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: false,
    is_customer_configurable: true,
    requires_human_validation: false,
    created_for: "all",
  },
  // ── CloneBrief ───────────────────────────────────────────
  {
    slug: "clonebrief",
    name: "CloneBrief",
    short_name: "Brief",
    public_label: "Briefings Automatiques",
    one_liner: "Les synthèses périodiques intelligentes de l'activité IA.",
    description: "CloneBrief génère des briefings automatiques — quotidiens, hebdomadaires, à la demande — résumant l'activité, les alertes et les actions recommandées pour chaque employé IA.",
    visibility: "public",
    scopes: ["company", "mission", "employee"],
    default_status: "enabled",
    default_autonomy: "supervised",
    default_risk_mode: "normal",
    capabilities: [
      { id: "digest_generation", label: "Génération de digest", description: "Résumé opérationnel de l'état de toutes les missions actives.", scopes: ["mission", "company"], required: false, configurable: true, default_enabled: true },
      { id: "periodic_summaries", label: "Synthèses périodiques", description: "Briefings quotidiens/hebdomadaires selon le planning configuré.", scopes: ["company", "employee"], required: false, configurable: true, default_enabled: false },
      { id: "executive_briefing", label: "Briefing exécutif", description: "Synthèse premium pour les décideurs avec métriques clés.", scopes: ["company"], required: false, configurable: true, default_enabled: false },
      { id: "alert_synthesis", label: "Synthèse des alertes", description: "Agrégation intelligente des alertes et points d'attention.", scopes: ["mission", "employee"], required: false, configurable: true, default_enabled: true },
    ],
    applies_to_employee_slugs: [],
    is_platform_core: false,
    is_customer_configurable: true,
    requires_human_validation: false,
    created_for: "all",
  },
];

// ── Exported functions ───────────────────────────────────────────────────────

export function getCloneStoreTechnologyDefinitions(): TechnologyDefinition[] {
  return TECHNOLOGY_DEFINITIONS;
}

export function getTechnologyDefinition(slug: string): TechnologyDefinition | null {
  if (!isTechnologySlug(slug)) return null;
  return TECHNOLOGY_DEFINITIONS.find((d) => d.slug === slug) ?? null;
}

export function buildDefaultTechnologyCompanySettings(
  definitions: TechnologyDefinition[],
  now?: Date,
): TechnologyCompanySetting[] {
  const ts = (now ?? new Date()).toISOString();
  return definitions.map((def) => ({
    technology_slug: def.slug,
    status: def.default_status,
    autonomy_level: def.default_autonomy,
    risk_mode: def.default_risk_mode,
    configuration_status: "missing" as TechnologyConfigurationStatus,
    enabled_for_employee_slugs: [],
    disabled_for_employee_slugs: [],
    custom_rules: {},
    validation_rules: {},
    notification_rules: {},
    memory_rules: {},
    created_at: ts,
    updated_at: ts,
  }));
}

export function normalizeTechnologyCompanySetting(
  raw: unknown,
  definition: TechnologyDefinition,
  now?: Date,
): TechnologyCompanySetting {
  const ts = (now ?? new Date()).toISOString();
  if (!isObject(raw)) {
    return {
      technology_slug: definition.slug,
      status: definition.default_status,
      autonomy_level: definition.default_autonomy,
      risk_mode: definition.default_risk_mode,
      configuration_status: "missing",
      enabled_for_employee_slugs: [],
      disabled_for_employee_slugs: [],
      custom_rules: {},
      validation_rules: {},
      notification_rules: {},
      memory_rules: {},
      created_at: ts,
      updated_at: ts,
    };
  }
  return {
    technology_slug: isTechnologySlug(raw.technology_slug) ? raw.technology_slug : definition.slug,
    status: validStatus(raw.status, definition.default_status),
    autonomy_level: validAutonomy(raw.autonomy_level, definition.default_autonomy),
    risk_mode: validRiskMode(raw.risk_mode, definition.default_risk_mode),
    configuration_status: validConfigStatus(raw.configuration_status, "partial"),
    enabled_for_employee_slugs: strArray(raw.enabled_for_employee_slugs),
    disabled_for_employee_slugs: strArray(raw.disabled_for_employee_slugs),
    custom_rules: isObject(raw.custom_rules) ? raw.custom_rules : {},
    validation_rules: isObject(raw.validation_rules) ? raw.validation_rules : {},
    notification_rules: isObject(raw.notification_rules) ? raw.notification_rules : {},
    memory_rules: isObject(raw.memory_rules) ? raw.memory_rules : {},
    created_at: asStr(raw.created_at) ?? ts,
    updated_at: asStr(raw.updated_at) ?? ts,
  };
}

export function buildTechnologyRegistry(params: {
  definitions: TechnologyDefinition[];
  rawSettings: TechnologyCompanySetting[];
  runtimeEvents?: Record<string, unknown>[];
  now?: Date;
}): TechnologyRegistry {
  const { definitions, rawSettings, runtimeEvents = [], now = new Date() } = params;

  const settingsBySlug = new Map<string, TechnologyCompanySetting>();
  for (const s of rawSettings) {
    settingsBySlug.set(s.technology_slug, s);
  }

  const settings: TechnologyCompanySetting[] = definitions.map((def) => {
    const existing = settingsBySlug.get(def.slug);
    if (existing) return existing;
    return normalizeTechnologyCompanySetting(null, def, now);
  });

  const eventsBySlug = new Map<string, Record<string, unknown>[]>();
  for (const ev of runtimeEvents) {
    if (!isObject(ev)) continue;
    const slug = asStr(ev.technology_slug);
    if (!slug) continue;
    if (!eventsBySlug.has(slug)) eventsBySlug.set(slug, []);
    eventsBySlug.get(slug)!.push(ev);
  }

  const runtime_states: TechnologyRuntimeState[] = definitions.map((def) => {
    const setting = settings.find((s) => s.technology_slug === def.slug)!;
    const events = eventsBySlug.get(def.slug) ?? [];
    const lastEvent = events.length > 0 ? events[0] : null;
    const lastEventAt = lastEvent ? (asStr(lastEvent.created_at) ?? null) : null;
    const warnings: string[] = [];
    const blockers: string[] = [];
    if (setting.status === "degraded") warnings.push("Technologie en état dégradé.");
    if (setting.status === "not_configured") blockers.push("Configuration requise avant activation.");
    if (setting.status === "maintenance") warnings.push("Technologie en maintenance.");
    const configured = setting.configuration_status === "configured" || setting.configuration_status === "optimized";
    const activeFor = computeActiveForSlugs(setting);
    const healthScore = computeHealthScore(setting, events.length);
    return {
      technology_slug: def.slug,
      status: setting.status,
      health_score: healthScore,
      last_event_at: lastEventAt,
      warnings,
      blockers,
      configured,
      active_for_employee_slugs: activeFor,
    };
  });

  const partial_registry = { definitions, settings, runtime_states, summary: { total: 0, enabled: 0, disabled: 0, degraded: 0, not_configured: 0, customer_configurable: 0, platform_core: 0 } };
  const summary = computeTechnologyRegistrySummary(partial_registry);
  return { definitions, settings, runtime_states, summary };
}

function computeActiveForSlugs(setting: TechnologyCompanySetting): string[] {
  if (setting.status === "disabled") return [];
  const disabled = new Set(setting.disabled_for_employee_slugs);
  if (setting.enabled_for_employee_slugs.length > 0) {
    return setting.enabled_for_employee_slugs.filter((s) => !disabled.has(s));
  }
  return [];
}

function computeHealthScore(setting: TechnologyCompanySetting, eventCount: number): number {
  if (setting.status === "disabled") return 0;
  if (setting.status === "not_configured") return 10;
  if (setting.status === "maintenance") return 30;
  if (setting.status === "degraded") return 50;
  let score = 80;
  if (setting.configuration_status === "configured") score = 90;
  if (setting.configuration_status === "optimized") score = 100;
  if (eventCount > 0 && score < 100) score = Math.min(score + 5, 100);
  return score;
}

export function computeTechnologyRegistrySummary(registry: Pick<TechnologyRegistry, "definitions" | "settings">): TechnologyRegistrySummary {
  const { definitions, settings } = registry;
  const settingsBySlug = new Map(settings.map((s) => [s.technology_slug, s]));
  let enabled = 0, disabled = 0, degraded = 0, not_configured = 0;
  for (const def of definitions) {
    const s = settingsBySlug.get(def.slug);
    const status = s?.status ?? def.default_status;
    if (status === "enabled") enabled++;
    else if (status === "disabled") disabled++;
    else if (status === "degraded") degraded++;
    else if (status === "not_configured") not_configured++;
  }
  return {
    total: definitions.length,
    enabled,
    disabled,
    degraded,
    not_configured,
    customer_configurable: definitions.filter((d) => d.is_customer_configurable).length,
    platform_core: definitions.filter((d) => d.is_platform_core).length,
  };
}

export function resolveTechnologyForEmployee(
  registry: TechnologyRegistry,
  employeeSlug: string,
): TechnologyDefinition[] {
  const result: TechnologyDefinition[] = [];
  for (const def of registry.definitions) {
    if (isTechnologyEnabledForEmployee(registry, def.slug, employeeSlug)) {
      result.push(def);
    }
  }
  return result;
}

export function isTechnologyEnabledForEmployee(
  registry: TechnologyRegistry,
  technologySlug: string,
  employeeSlug: string,
): boolean {
  if (!isTechnologySlug(technologySlug)) return false;
  const setting = registry.settings.find((s) => s.technology_slug === technologySlug);
  if (!setting) {
    const def = registry.definitions.find((d) => d.slug === technologySlug);
    return def ? def.default_status === "enabled" : false;
  }
  if (setting.status === "disabled" || setting.status === "not_configured") return false;
  if (setting.disabled_for_employee_slugs.includes(employeeSlug)) return false;
  if (setting.enabled_for_employee_slugs.length > 0) {
    return setting.enabled_for_employee_slugs.includes(employeeSlug);
  }
  return true;
}

export function buildTechnologyPublicDigest(registry: TechnologyRegistry): string {
  const { summary } = registry;
  const lines: string[] = [];
  lines.push(`CloneStore Technologies — ${summary.total} technologies disponibles.`);
  if (summary.enabled > 0) lines.push(`${summary.enabled} activ${summary.enabled > 1 ? "es" : "e"}.`);
  if (summary.disabled > 0) lines.push(`${summary.disabled} désactiv${summary.disabled > 1 ? "ées" : "ée"}.`);
  if (summary.degraded > 0) lines.push(`${summary.degraded} en état dégradé — attention requise.`);
  if (summary.not_configured > 0) lines.push(`${summary.not_configured} à configurer.`);
  const coreOk = registry.definitions.filter((d) => d.is_platform_core).every((def) => {
    const s = registry.settings.find((s) => s.technology_slug === def.slug);
    return (s?.status ?? def.default_status) === "enabled";
  });
  if (coreOk) lines.push("Noyau plateforme opérationnel.");
  else lines.push("Attention : un composant noyau est inactif.");
  return lines.join(" ");
}
