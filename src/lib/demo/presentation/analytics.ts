// /demo — Helper analytics interne léger
//
// Aucun fournisseur externe n'existe dans le repo : on implémente donc un
// émetteur d'événements interne, non intrusif et compatible avec un futur
// branchement (window.cloneDemoAnalytics ou CustomEvent). Aucune donnée
// personnelle n'est collectée — uniquement le nom de l'événement, un horodatage
// relatif et, le cas échéant, une variante commerciale non identifiante.
//
// Sûr en SSR : toutes les écritures sont gardées par `typeof window`.

export const DEMO_EVENTS = {
  viewed: "clone_demo_viewed",
  started: "clone_demo_started",
  directPierreClicked: "clone_demo_direct_pierre_clicked",
  reservationClicked: "clone_demo_reservation_clicked",
  problemSectionViewed: "clone_demo_problem_section_viewed",
  categorySectionViewed: "clone_demo_category_section_viewed",
  systemSectionViewed: "clone_demo_system_section_viewed",
  footprintSectionViewed: "clone_demo_footprint_section_viewed",
  scaleSectionViewed: "clone_demo_scale_section_viewed",
  trustSectionViewed: "clone_demo_trust_section_viewed",
  // Acte 6 — Le coût de continuer comme avant. Aucune donnée saisie par le
  // visiteur (coûts, effectifs, résultats) n'est jamais attachée à ces
  // événements : seul le fait qu'une interaction a eu lieu est enregistré.
  costSectionViewed: "clone_demo_cost_section_viewed",
  costScenarioSelected: "clone_demo_cost_scenario_selected",
  costCalculatorAdjusted: "clone_demo_cost_calculator_adjusted",
  // Clôture — architecture de décision. On mesure la DÉCISION, jamais son contenu :
  // aucune question libre, aucun coût, aucun effectif, aucune donnée d'entreprise.
  firstMissionSelected: "clone_demo_first_mission_selected",
  cloneChatCtaClicked: "clone_demo_clonechat_cta_clicked",
  pierreScopeSectionViewed: "clone_demo_pierre_scope_section_viewed",
  organizationSectionViewed: "clone_demo_organization_section_viewed",
  completionViewed: "clone_demo_completion_viewed",
  pierreCtaVisible: "clone_demo_pierre_cta_visible",
  pierreCtaClicked: "clone_demo_pierre_cta_clicked",
  directReservationClicked: "clone_demo_direct_reservation_clicked",
  completed: "clone_demo_completed",
} as const;

export type DemoEventName = (typeof DEMO_EVENTS)[keyof typeof DEMO_EVENTS];

/** Métadonnées non identifiantes attachables à un événement. */
export interface DemoEventMeta {
  /** Profondeur de scroll [0..1] au moment de l'événement. */
  scrollDepth?: number;
  /** Clé de scène (E2.x) atteinte. */
  scene?: string;
  /** Variante commerciale (before_launch | launched). */
  commercialPhase?: string;
  /** Provenance éventuelle (ex. campagne LeadForge) — non identifiante. */
  source?: string;
}

export interface DemoEventRecord {
  name: DemoEventName;
  meta: DemoEventMeta;
  /** Millisecondes écoulées depuis le premier événement de la session. */
  t: number;
}

type DemoAnalyticsSink = (record: DemoEventRecord) => void;

interface DemoAnalyticsWindow {
  /** File d'attente locale (debug / inspection / futur branchement). */
  __cloneDemoAnalytics?: DemoEventRecord[];
  /** Hook futur : un fournisseur peut définir cette fonction pour recevoir les events. */
  cloneDemoAnalytics?: DemoAnalyticsSink;
}

function w(): (Window & DemoAnalyticsWindow) | null {
  return typeof window === "undefined"
    ? null
    : (window as Window & DemoAnalyticsWindow);
}

let sessionStart = 0;
const sentOnce = new Set<DemoEventName>();

/**
 * Émet un événement de mesure /demo. Idempotent par défaut côté UI : on
 * laisse l'appelant décider via `once`. N'effectue aucune requête réseau.
 */
export function emitDemoEvent(
  name: DemoEventName,
  meta: DemoEventMeta = {},
  options: { once?: boolean } = {},
): void {
  const win = w();
  if (!win) return;

  if (options.once) {
    if (sentOnce.has(name)) return;
    sentOnce.add(name);
  }

  const now = Date.now();
  if (sessionStart === 0) sessionStart = now;

  const record: DemoEventRecord = {
    name,
    meta,
    t: now - sessionStart,
  };

  // 1) File locale inspectable (jamais envoyée nulle part par défaut).
  if (!win.__cloneDemoAnalytics) win.__cloneDemoAnalytics = [];
  win.__cloneDemoAnalytics.push(record);

  // 2) Hook futur, optionnel — branchement d'un fournisseur sans modifier ce fichier.
  try {
    win.cloneDemoAnalytics?.(record);
  } catch {
    /* un sink défaillant ne doit jamais casser la présentation */
  }

  // 3) CustomEvent passif pour un éventuel listener global.
  try {
    win.dispatchEvent(
      new CustomEvent("clone-demo-analytics", { detail: record }),
    );
  } catch {
    /* noop */
  }
}

/** Réinitialise l'état de session (utile pour les tests / re-montage). */
export function resetDemoAnalyticsSession(): void {
  sessionStart = 0;
  sentOnce.clear();
}
