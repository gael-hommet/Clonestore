// TECH-04 — Profile Technologies UI Data Layer
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// Derives UI display data from GlobalTechnologyConfig (TECH-03).
// Consumed by src/app/profile/technologies/page.tsx.
//
// Critical corrections applied here (these were wrong in the pre-TECH-04 page):
//   [FIX-1] CloneVoice: mode=disabled/partial — NOT "Actif". Shows "Désactivé".
//   [FIX-2] CloneTrust: "autonomie graduelle" — progressive trust calibration, not access-control.
//   [FIX-3] ClonePolicy: active internal engine — NOT a roadmap "Bientôt" item.

import type { GlobalTechnologyKey, GlobalTechnologyConfig } from "./global-tech-config";
import { DEFAULT_GLOBAL_TECH_CONFIGS } from "./global-tech-defaults";
import { getPublicTechnologyEntry, type PublicTechnologyOwnership } from "./canonical/public-technology-projection";
import { buildTenantConfiguredTechnologies } from "./canonical/tenant-configuration-adapter";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TechUIStatusVariant =
  | "active"    // status=active, not internal
  | "partial"   // status=partial
  | "disabled"  // mode=disabled
  | "roadmap"   // status=roadmap
  | "internal"; // control_level=internal_only

export type TechUIBadgeVariant =
  | "active"           // "Actif" — green
  | "partial"          // "En cours" — amber
  | "coming_soon"      // "Bientôt" — amber light
  | "protected"        // "Protégé" — violet
  | "visibility_client" // "Visible client" — blue
  | "internal_engine"; // "Moteur interne" — stone

export type TechUIBadge = {
  label: string;
  variant: TechUIBadgeVariant;
};

/** Mirrors the canonical adapter's TenantConfigurationState:
 *  - "configured": a real, P20-owned TECH-03 tenant config exists (12 technologies today);
 *  - "not_configurable_yet": public per the canonical authority, no config yet (CloneCall/CloneRoom);
 *  - "external_workstream_metadata_only": live but owned by the CloneChat workstream — P20 shows
 *    metadata and never claims its readiness/guardrails/autonomy.
 *  For the last two, readiness_score is a non-measurement sentinel (0), never a fabricated value. */
export type TechUIConfigState = "configured" | "not_configurable_yet" | "external_workstream_metadata_only";

export type TechUICardData = {
  key: string;
  display_name: string;
  category_label: string;
  description: string;
  impact: string;
  active_now: string | undefined;
  roadmap_note: string | undefined;
  planned: string | undefined;
  status_variant: TechUIStatusVariant;
  status_label: string;
  readiness_score: number;
  badges: TechUIBadge[];
  is_locked: boolean;
  is_required: boolean;
  is_internal: boolean;
  icon_key: string;
  accent: string;
  /** From the P20 canonical public projection — never decided locally. */
  ownership: PublicTechnologyOwnership;
  configState: TechUIConfigState;
};

export type TechUISectionId =
  | "essential"       // 4 core techs required for employee runtime
  | "complementary"   // 3 partial/visible techs (including disabled clonevoice)
  | "development"     // 5 roadmap/partial techs coming next
  | "internal_engines"; // 1 internal engine (clonepolicy)

export type TechUISection = {
  id: TechUISectionId;
  title: string;
  subtitle: string;
  count: number;
  cards: TechUICardData[];
};

export type TechUIPageData = {
  sections: TechUISection[];
  total: number;
  active_count: number;
  partial_count: number;
  roadmap_count: number;
  essential_score: number; // avg readiness of the 4 essential techs
  essential_ok: boolean;   // all 4 essential techs readiness >= 60
};

// ── Section assignment ────────────────────────────────────────────────────────
// Hard assignment — not derived dynamically, intentional for UI clarity.

const SECTION_ASSIGNMENT: Record<string, TechUISectionId> = {
  cloneos:       "essential",
  cloneadn:      "essential",
  cloneguard:    "essential",
  clonetrace:    "essential",
  clonechat:     "complementary",
  clonecontinuum: "complementary",
  clonevoice:    "complementary",   // [FIX-1] shown as disabled, not "Actif"
  clonepolicy:   "internal_engines", // [FIX-3] active internal engine, not roadmap
  clonetrust:    "development",      // [FIX-2] autonomie graduelle, not zero-trust
  clonereview:   "development",
  clonesignals:  "development",
  clonelearn:    "development",
  clonebrief:    "development",
  // P20 convergence: CloneCall/CloneRoom are public (canonical projection) but have no TECH-03
  // tenant config yet — "À venir" at launch, so they belong in the roadmap/development bucket.
  clonecall:     "development",
  cloneroom:     "development",
};

// ── UI-only display metadata ──────────────────────────────────────────────────
// These are UI descriptions — richer and more human than GlobalTechnologyConfig.short_description.
// They live here, not in GlobalTechnologyConfig, because they are presentation concerns.

type TechUIMeta = {
  category_label: string;
  visibility_label: "Visible client" | "Moteur interne";
  impact: string;
  active_now: string | undefined;
  roadmap_note: string | undefined;
  planned: string | undefined;
  icon_key: string;
  accent: string;
};

const TECH_UI_META: Record<string, TechUIMeta> = {
  cloneos: {
    category_label: "Orchestration",
    visibility_label: "Moteur interne",
    impact: "Comprend vos demandes, planifie les missions, coordonne vos employés IA.",
    active_now: "Planification, routage, coordination multi-employés, command center.",
    roadmap_note: "Orchestration proactive, anticipation des missions récurrentes.",
    planned: undefined,
    icon_key: "cpu",
    accent: "#1A56DB",
  },
  cloneadn: {
    category_label: "Mémoire",
    visibility_label: "Moteur interne",
    impact: "Aligne tous vos employés IA avec les habitudes, le style et les règles de votre entreprise.",
    active_now: "Contexte entreprise, style de communication, règles permanentes.",
    roadmap_note: "Apprentissage continu, détection automatique d'écarts stylistiques.",
    planned: undefined,
    icon_key: "dna",
    accent: "#7C3AED",
  },
  cloneguard: {
    category_label: "Gouvernance",
    visibility_label: "Moteur interne",
    impact: "Protège chaque action sensible — validation humaine obligatoire avant toute exécution externe.",
    active_now: "Blocage d'actions risquées, garde-fous automatiques, validation humaine.",
    roadmap_note: "Audit de conformité avancé, reporting gouvernance automatique.",
    planned: undefined,
    icon_key: "shield",
    accent: "#059669",
  },
  clonetrace: {
    category_label: "Traçabilité",
    visibility_label: "Moteur interne",
    impact: "Prouve et historise chaque action — piste d'audit complète, exportable.",
    active_now: "Journal des actions, export des décisions, audit trail temps réel.",
    roadmap_note: "Rapports automatiques, détection d'anomalies de traçabilité.",
    planned: undefined,
    icon_key: "activity",
    accent: "#D97706",
  },
  clonechat: {
    category_label: "Interface",
    visibility_label: "Visible client",
    impact: "Dialoguez en temps réel avec tous vos employés IA dans une interface unifiée.",
    active_now: "Salon conversationnel, insertion de contextes, commandes multi-employés.",
    roadmap_note: "Recherche intelligente, historique structuré, résumés automatiques.",
    planned: undefined,
    icon_key: "message-circle",
    accent: "#0F766E",
  },
  clonecontinuum: {
    category_label: "Continuité",
    visibility_label: "Moteur interne",
    impact: "Reprend exactement là où la session précédente s'est arrêtée — zéro perte de contexte entre sessions.",
    active_now: undefined,
    roadmap_note: "Mémoire long terme, missions sans rupture inter-sessions, persistance de la progression.",
    planned: "Q3 2026",
    icon_key: "dna",
    accent: "#8B5CF6",
  },
  // [FIX-1] CloneVoice: status=partial, mode=disabled — NOT active.
  // active_now is undefined (not operational). No "Actif" badge will be generated.
  clonevoice: {
    category_label: "Interface",
    visibility_label: "Visible client",
    impact: "Dictez vos instructions à voix haute — CloneOS comprend et exécute sans clavier.",
    active_now: undefined, // mode=disabled — not yet operational
    roadmap_note: "Entrée vocale en interface web, retours oraux, mode mains-libres complet.",
    planned: "Q3 2026",
    icon_key: "mic",
    accent: "#0284C7",
  },
  // [FIX-3] ClonePolicy: active in production, internal_only.
  // Already running as the policy engine inside CloneGuard pipeline.
  // NOT a roadmap technology. NOT "Bientôt".
  clonepolicy: {
    category_label: "Gouvernance interne",
    visibility_label: "Moteur interne",
    impact: "Évalue et applique les règles d'entreprise dans le pipeline CloneGuard → ClonePolicy → CloneTrust.",
    active_now: "Pipeline de gouvernance actif — intégré en production dans le moteur CloneGuard.",
    roadmap_note: "Règles configurables par organisation, gestion des exceptions et escalades automatiques.",
    planned: undefined, // already active
    icon_key: "shield",
    accent: "#6366F1",
  },
  // [FIX-2] CloneTrust: autonomie graduelle — progressive trust calibration.
  // trust_model = "gradual_autonomy". The AI earns autonomy progressively via validated behaviors.
  clonetrust: {
    category_label: "Autonomie",
    visibility_label: "Moteur interne",
    impact: "Calibration progressive de l'autonomie IA — la confiance est accordée par degrés, basée sur les validations humaines.",
    active_now: undefined,
    roadmap_note: "Autonomie graduelle : l'IA gagne en indépendance au fur et à mesure que la confiance est démontrée et vérifiée.",
    planned: "Q4 2026",
    icon_key: "shield",
    accent: "#0F766E",
  },
  clonereview: {
    category_label: "Qualité",
    visibility_label: "Visible client",
    impact: "Chaque document préparé par Pierre passe par un scoring qualité avant validation humaine.",
    active_now: undefined,
    roadmap_note: "Revue documentaire, scoring qualité, suggestions d'amélioration automatiques.",
    planned: "Q4 2026",
    icon_key: "activity",
    accent: "#B45309",
  },
  clonesignals: {
    category_label: "Observabilité",
    visibility_label: "Moteur interne",
    impact: "Détecte anomalies, tensions et risques opérationnels avant qu'ils deviennent des blocages.",
    active_now: undefined,
    roadmap_note: "Alertes automatiques, signaux faibles RH, monitoring continu de santé opérationnelle.",
    planned: "Q1 2027",
    icon_key: "activity",
    accent: "#1D4ED8",
  },
  clonelearn: {
    category_label: "Apprentissage",
    visibility_label: "Moteur interne",
    impact: "Pierre s'améliore à chaque document validé ou corrigé — dans les limites strictes de la gouvernance.",
    active_now: undefined,
    roadmap_note: "Apprentissage gouverné sur corrections humaines validées — jamais autonome sans validation.",
    planned: "Q1 2027",
    icon_key: "cpu",
    accent: "#7C3AED",
  },
  clonebrief: {
    category_label: "Direction",
    visibility_label: "Visible client",
    impact: "Génère des synthèses et briefings structurés pour la direction, à partir des données RH.",
    active_now: undefined,
    roadmap_note: "Briefings périodiques automatiques, synthèses décisionnelles, tableaux de bord exécutifs.",
    planned: "Q2 2027",
    icon_key: "cpu",
    accent: "#9333EA",
  },
  // P20 convergence: public per the canonical projection (launchStatus="À venir"), no TECH-03
  // tenant config exists yet — configState will be "not_configurable_yet", readiness_score=0
  // (non-measurement sentinel, never a fabricated score).
  clonecall: {
    category_label: "Communication",
    visibility_label: "Visible client",
    impact: "Ligne d'appel directe entre l'entreprise et ses employés IA — à venir.",
    active_now: undefined,
    roadmap_note: "Session d'appel encadrée : transcript, intentions, mission proposée, sortant bloqué.",
    planned: undefined,
    icon_key: "message-circle",
    accent: "#0F766E",
  },
  cloneroom: {
    category_label: "Communication",
    visibility_label: "Visible client",
    impact: "Salon de travail partagé entre employés IA — à venir.",
    active_now: undefined,
    roadmap_note: "Coordination multi-employés IA, routage via CloneOS, aucun pair-à-pair direct.",
    planned: undefined,
    icon_key: "cpu",
    accent: "#6366F1",
  },
};

// ── Status helpers ────────────────────────────────────────────────────────────

export function getTechUIStatusVariant(config: GlobalTechnologyConfig): TechUIStatusVariant {
  if (config.control_level === "internal_only") return "internal";
  if (config.mode === "disabled" || config.runtime_status === "not_implemented") {
    if (config.status === "roadmap") return "roadmap";
    return "disabled";
  }
  switch (config.status) {
    case "active": return "active";
    case "partial": return "partial";
    case "disabled": return "disabled";
    case "roadmap": return "roadmap";
    case "locked": return "active";
    default: return "disabled";
  }
}

export function getTechUIStatusLabel(config: GlobalTechnologyConfig): string {
  if (config.control_level === "internal_only") return "Interne";
  if (config.status === "roadmap") return "Bientôt";
  if (config.mode === "disabled") return "Désactivé";
  if (config.runtime_status === "not_implemented") return "Non implémenté";
  switch (config.status) {
    case "active":  return "Actif";
    case "partial": return "En cours";
    case "disabled": return "Désactivé";
    case "locked":  return "Actif";
    default: return "Inconnu";
  }
}

// ── Badge builder ─────────────────────────────────────────────────────────────
// Key rule: "Actif" badge ONLY for status=active AND control_level≠internal_only AND mode≠disabled.
// CloneVoice (partial, mode=disabled) → NO "Actif" badge. [FIX-1]

export function buildTechUIBadges(
  config: GlobalTechnologyConfig,
  meta: TechUIMeta,
): TechUIBadge[] {
  const badges: TechUIBadge[] = [];

  // Visibility badge
  if (meta.visibility_label === "Visible client") {
    badges.push({ label: "Visible client", variant: "visibility_client" });
  } else {
    badges.push({ label: "Moteur interne", variant: "internal_engine" });
  }

  // Status badge — ONLY "Actif" when genuinely active (not disabled, not roadmap, not internal)
  const variant = getTechUIStatusVariant(config);
  if (variant === "active") {
    // internal_only engines don't get the "Actif" public badge
    if (config.control_level !== "internal_only") {
      badges.push({ label: "Actif", variant: "active" });
    }
  } else if (variant === "partial") {
    badges.push({ label: "En cours", variant: "partial" });
  } else if (variant === "roadmap") {
    badges.push({ label: "Bientôt", variant: "coming_soon" });
  }
  // disabled and internal: no extra status badge (the card status_label already shows this)

  // Protected badge — platform-locked technologies
  if (config.locked_by_platform) {
    badges.push({ label: "Protégé", variant: "protected" });
  }

  return badges;
}

// ── Card data builder ─────────────────────────────────────────────────────────

/** Static, honest display names for public technologies with no P20-owned TECH-03 config. */
const UNCONFIGURED_DISPLAY_NAME: Record<string, string> = {
  clonecall: "CloneCall",
  cloneroom: "CloneRoom",
  clonechat: "CloneChat",
};

export function buildTechUICardData(
  key: string,
  config: GlobalTechnologyConfig | undefined,
  ownership: PublicTechnologyOwnership,
): TechUICardData {
  const meta = TECH_UI_META[key];
  const isExternal = ownership === "EXTERNAL_CLONECHAT_WORKSTREAM";
  // An externally-owned technology is NEVER given a P20 configuration card, even if a TECH-03
  // row happens to exist for it: P20 does not own or certify its readiness/guardrails/autonomy.
  const resolvedConfig = isExternal
    ? undefined
    : config ?? DEFAULT_GLOBAL_TECH_CONFIGS[key as GlobalTechnologyKey];

  if (!resolvedConfig) {
    // Two honest no-configuration cases, deliberately NOT collapsed into one:
    //   - external (CloneChat): live and available, but owned by another workstream;
    //   - not_configurable_yet (CloneCall/CloneRoom): genuinely upcoming.
    // Neither gets a fabricated readiness: readiness_score 0 here is a non-measurement sentinel,
    // and the external card is never labelled "Bientôt" (that would misstate a live technology).
    return {
      key,
      display_name: UNCONFIGURED_DISPLAY_NAME[key] ?? key,
      category_label: meta.category_label,
      description: meta.impact,
      impact: meta.impact,
      active_now: undefined,
      roadmap_note: meta.roadmap_note,
      planned: isExternal ? undefined : meta.planned,
      status_variant: isExternal ? "internal" : "roadmap",
      status_label: isExternal ? "Chantier externe" : "Bientôt",
      readiness_score: 0,
      badges: isExternal
        ? [{ label: "Visible client", variant: "visibility_client" }]
        : [{ label: "Bientôt", variant: "coming_soon" }],
      is_locked: false,
      is_required: false,
      is_internal: false,
      icon_key: meta.icon_key,
      accent: meta.accent,
      ownership,
      configState: isExternal ? "external_workstream_metadata_only" : "not_configurable_yet",
    };
  }

  return {
    key,
    display_name: resolvedConfig.display_name,
    category_label: meta.category_label,
    description: resolvedConfig.short_description,
    impact: meta.impact,
    active_now: meta.active_now,
    roadmap_note: meta.roadmap_note,
    planned: meta.planned,
    status_variant: getTechUIStatusVariant(resolvedConfig),
    status_label: getTechUIStatusLabel(resolvedConfig),
    readiness_score: resolvedConfig.readiness_score,
    badges: buildTechUIBadges(resolvedConfig, meta),
    is_locked: resolvedConfig.locked_by_platform,
    is_required: resolvedConfig.required_for_employee_runtime,
    is_internal: resolvedConfig.control_level === "internal_only",
    icon_key: meta.icon_key,
    accent: meta.accent,
    ownership,
    configState: "configured",
  };
}

// ── Section definitions ───────────────────────────────────────────────────────

const SECTION_DEFS: Record<TechUISectionId, { title: string; subtitle: string }> = {
  essential: {
    title: "Systèmes essentiels",
    subtitle: "Ces 4 technologies sont requises pour que Pierre fonctionne. Elles ne peuvent pas être désactivées.",
  },
  complementary: {
    title: "Interfaces et continuité",
    subtitle: "Ces technologies enrichissent l'expérience client et l'interface de commande.",
  },
  development: {
    title: "En développement",
    subtitle: "Ces systèmes sont en construction. Ils viendront enrichir CloneStore progressivement.",
  },
  internal_engines: {
    title: "Moteurs internes",
    subtitle: "Ces composants fonctionnent en coulisse — ils ne sont pas exposés directement au client.",
  },
};

// ── Sections builder ──────────────────────────────────────────────────────────

export function buildTechUISections(
  configs?: Partial<Record<GlobalTechnologyKey, GlobalTechnologyConfig>>,
): TechUISection[] {
  const sectionMap: Record<TechUISectionId, TechUICardData[]> = {
    essential: [],
    complementary: [],
    development: [],
    internal_engines: [],
  };

  // Single source of membership: the canonical public authority, joined to TECH-03 config via the
  // official adapter. TECH-04 never reads DEFAULT_GLOBAL_TECH_CONFIGS to decide WHAT exists.
  for (const entry of buildTenantConfiguredTechnologies(configs)) {
    const sectionId = SECTION_ASSIGNMENT[entry.id] ?? "development";
    sectionMap[sectionId].push(buildTechUICardData(entry.id, entry.config ?? undefined, entry.ownership));
  }

  const sectionOrder: TechUISectionId[] = ["essential", "complementary", "development", "internal_engines"];

  return sectionOrder.map((id) => ({
    id,
    title: SECTION_DEFS[id].title,
    subtitle: SECTION_DEFS[id].subtitle,
    count: sectionMap[id].length,
    cards: sectionMap[id],
  }));
}

// ── Page data builder ─────────────────────────────────────────────────────────

export function buildProfileTechPageData(
  configs?: Partial<Record<GlobalTechnologyKey, GlobalTechnologyConfig>>,
): TechUIPageData {
  const sections = buildTechUISections(configs);
  const allCards = sections.flatMap((s) => s.cards);

  const essentialCards = sections.find((s) => s.id === "essential")?.cards ?? [];
  const essentialScore =
    essentialCards.length > 0
      ? Math.round(essentialCards.reduce((a, c) => a + c.readiness_score, 0) / essentialCards.length)
      : 0;
  const essentialOk = essentialCards.every((c) => c.readiness_score >= 60);

  return {
    sections,
    total: allCards.length,
    active_count: allCards.filter((c) => c.status_variant === "active").length,
    partial_count: allCards.filter((c) => c.status_variant === "partial").length,
    roadmap_count: allCards.filter((c) => c.status_variant === "roadmap").length,
    essential_score: essentialScore,
    essential_ok: essentialOk,
  };
}

// ── Quick getters ──────────────────────────────────────────────────────────────

export function getTechUICardByKey(
  key: string,
  configs?: Partial<Record<GlobalTechnologyKey, GlobalTechnologyConfig>>,
): TechUICardData {
  const entry = getPublicTechnologyEntry(key);
  const ownership = entry?.ownership ?? "P20_INTERNAL";
  return buildTechUICardData(key, configs?.[key as GlobalTechnologyKey], ownership);
}

export function getTechUIBadgeLabel(variant: TechUIBadgeVariant): string {
  switch (variant) {
    case "active":            return "Actif";
    case "partial":           return "En cours";
    case "coming_soon":       return "Bientôt";
    case "protected":         return "Protégé";
    case "visibility_client": return "Visible client";
    case "internal_engine":   return "Moteur interne";
    default:                  return "";
  }
}
