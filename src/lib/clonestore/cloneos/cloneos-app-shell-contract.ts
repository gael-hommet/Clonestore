// src/lib/clonestore/cloneos/cloneos-app-shell-contract.ts
// P12 — CONTRAT canonique de l'App Shell CloneOS. Source de vérité (pure, testable) de
// l'architecture produit connectée : zones, routes, surfaces du shell, invariant « pas de scroll
// de page », modes responsive, rôles de chaque zone, confusions produit INTERDITES, règles de copy,
// et contrat de redirection. Aucune logique métier, aucun rendu — juste la définition vérifiable.
//
// PRINCIPE : CloneOS = coquille/console/routeur/orchestration. Pierre = employé IA RH (exécute la
// logique RH). CloneOS NE réimplémente PAS la logique RH (pas de 2e cerveau RH).

// ── Zones produit ─────────────────────────────────────────────────────────────
export type AppAreaId =
  | "public_site"       // marketing / pricing / conversion (visiteurs, non-clients)
  | "mon_clonestore"    // compte / entreprise / abonnement / facturation / permissions / employés achetés / empreinte / réglages
  | "global_cockpit"    // centre de commande de la main-d'œuvre IA (dirigeant) + surface CloneOS
  | "employee_cockpit"  // cockpit opérationnel d'un employé IA (ex. Pierre RH)
  | "cloneroom";        // salon : conversation groupe avec CloneOS + employés IA + empreinte + mémoire

export interface AppArea {
  readonly id: AppAreaId;
  readonly label: string;
  readonly route: string;
  readonly role: string;         // ce que la zone EST
  readonly isCockpitSurface: boolean; // soumis à l'invariant « pas de scroll de page »
  readonly forWho: string;
}

export const APP_AREAS: readonly AppArea[] = [
  { id: "public_site", label: "Site public", route: "/", role: "Marketing, tarifs, explication, conversion.", isCockpitSurface: false, forWho: "Visiteurs, prospects, non-clients." },
  { id: "mon_clonestore", label: "Mon CloneStore", route: "/mon-clonestore", role: "Administration du CloneStore : compte, entreprise, abonnement, facturation, permissions, employés IA achetés, empreinte, sécurité, réglages, support.", isCockpitSurface: false, forWho: "Titulaire du compte / admin (gérer, pas travailler)." },
  { id: "global_cockpit", label: "Global Cockpit", route: "/cockpit", role: "Centre de commande de la main-d'œuvre IA de l'entreprise + surface CloneOS. « Que se passe-t-il dans mon entreprise IA maintenant ? »", isCockpitSurface: true, forWho: "Dirigeants / managers." },
  { id: "employee_cockpit", label: "Pierre Cockpit", route: "/cockpit/pierre", role: "Cockpit opérationnel de l'employé IA RH (Pierre) : missions RH, validations, documents, preuves, activité, autonomie.", isCockpitSurface: true, forWho: "Responsable RH / dirigeant." },
  { id: "cloneroom", label: "CloneRoom", route: "/cockpit/room", role: "Salon de l'entreprise : conversation type groupe (premium) avec CloneOS, employés IA, technologies, empreinte, mémoire. Simple, opérationnel — jamais un dashboard chaotique.", isCockpitSurface: true, forWho: "Toute l'équipe (humains + IA)." },
];

// ── Routes canoniques ───────────────────────────────────────────────────────────
export const CLONEOS_ROUTES = {
  public: "/",
  purchase: "/agents/pierre",              // offre + tarif pays (P10) pour un non-client
  monClonestore: "/mon-clonestore",
  monClonestoreSetup: "/mon-clonestore/setup",
  cockpit: "/cockpit",                     // Global Cockpit (CloneOS first screen)
  cloneRoom: "/cockpit/room",
  pierre: "/cockpit/pierre",
  pierreMissions: "/cockpit/pierre/missions",
  pierreValidations: "/cockpit/pierre/validations",
  pierreDocuments: "/cockpit/pierre/documents",
  pierreEvidence: "/cockpit/pierre/evidence",
  pierreSettings: "/cockpit/pierre/settings",
} as const;

// ── Surfaces du shell ─────────────────────────────────────────────────────────
export type ShellSurfaceId = "top_bar" | "left_rail" | "bottom_nav" | "main_work" | "context_pane";
export interface ShellSurface { readonly id: ShellSurfaceId; readonly label: string; readonly desktop: boolean; readonly tablet: boolean; readonly mobile: boolean; readonly note: string }
export const SHELL_SURFACES: readonly ShellSurface[] = [
  { id: "top_bar", label: "Barre supérieure (CloneOS / entreprise / recherche / commande rapide / user)", desktop: true, tablet: true, mobile: true, note: "Compacte sur mobile." },
  { id: "left_rail", label: "Rail de navigation gauche", desktop: true, tablet: true, mobile: false, note: "Icônes seulement sur tablette ; remplacé par la bottom nav sur mobile." },
  { id: "bottom_nav", label: "Navigation basse (mobile)", desktop: false, tablet: false, mobile: true, note: "CloneOS / Missions / Validations / Employés / Mon CloneStore en 1–2 taps." },
  { id: "main_work", label: "Zone de travail centrale (CloneOS chat / mission / vue sélectionnée)", desktop: true, tablet: true, mobile: true, note: "Une surface primaire à la fois sur mobile." },
  { id: "context_pane", label: "Panneau de contexte droit (détails, preuves, validations, activité)", desktop: true, tablet: false, mobile: false, note: "Tiroir/bottom-sheet sur tablette et mobile." },
];

// ── Invariant « pas de scroll de page » ────────────────────────────────────────
export const NO_PAGE_SCROLL = {
  rootLayout: "100dvh / hauteur de viewport — la coquille cockpit NE défile PAS en page.",
  allowedInternalScroll: ["listes de messages", "listes de missions", "logs", "documents", "tiroirs", "panneaux de détail"],
  forbidden: [
    "page cockpit principale nécessitant un long défilement vertical",
    "dizaines de cartes de dashboard empilées",
    "cockpit façon page d'accueil",
    "sections marketing dans le cockpit",
    "« scroller pour trouver la chose utile »",
  ],
} as const;

// ── Modes responsive ───────────────────────────────────────────────────────────
export type ResponsiveModeId = "mobile" | "tablet" | "laptop" | "large";
export interface ResponsiveMode { readonly id: ResponsiveModeId; readonly minWidth: number; readonly layout: string }
export const RESPONSIVE_MODES: readonly ResponsiveMode[] = [
  { id: "mobile", minWidth: 0, layout: "Bottom nav + header compact + une surface à la fois + contexte en bottom-sheet + composer collant ; aucun débordement horizontal." },
  { id: "tablet", minWidth: 768, layout: "Rail gauche en icônes + zone principale + panneau contexte en tiroir ; chat central visible." },
  { id: "laptop", minWidth: 1280, layout: "Rail gauche compact + panneau contexte repliable + chat central ; pas de cartes serrées." },
  { id: "large", minWidth: 1600, layout: "Console 3 panneaux : rail gauche + zone centrale + panneau contexte visibles." },
];

// ── Rôles / distinctions ────────────────────────────────────────────────────────
export const AREA_ROLES = {
  mon_clonestore: "GÉRER le CloneStore (compte/admin) — PAS l'espace de travail quotidien.",
  global_cockpit: "TRAVAILLER / PILOTER toute la main-d'œuvre IA (company-wide) — n'est PAS le cockpit de Pierre.",
  employee_cockpit: "TRAVAILLER le RH avec Pierre — focalisé sur un seul employé IA.",
  cloneroom: "CONVERSER (salon) avec CloneOS + employés IA + empreinte — n'est PAS le Global Cockpit.",
  cloneos: "COORDONNER : router, résumer, faire remonter, appeler un employé. NE réimplémente PAS la logique RH.",
} as const;

// ── Confusions produit INTERDITES (testables) ───────────────────────────────────
export const FORBIDDEN_CONFUSIONS: readonly string[] = [
  "CloneOS n'est PAS Pierre (CloneOS oriente/coordonne ; Pierre exécute le RH).",
  "CloneOS n'est PAS un 2e cerveau RH (la logique RH reste dans Pierre/P8).",
  "CloneRoom n'est PAS le Global Cockpit (CloneRoom = salon de conversation ; le cockpit = commande).",
  "Mon CloneStore n'est PAS le Cockpit (Mon CloneStore = gérer ; Cockpit = travailler).",
  "Le Global Cockpit n'est PAS le cockpit de Pierre (company-wide vs mono-employé).",
  "Pierre n'est PAS un assistant / chatbot / copilote (c'est un employé IA RH).",
  "Le cockpit n'est PAS une page d'accueil marketing qui défile.",
];

// ── Règles de copy ───────────────────────────────────────────────────────────────
export const COPY_RULES = {
  pierreFraming: ["employé IA RH", "équipe RH opérationnelle", "poste RH"],
  pierreForbidden: ["assistant RH", "assistant", "chatbot", "copilote", "cobot", "copilot"],
  cloneosFraming: "CloneOS — pilotez votre entreprise IA (coordonne, route, résume).",
  cloneosForbidden: ["CloneOS exécute le RH", "CloneOS remplace Pierre"],
} as const;

// ── Surface de commande CloneOS (premier écran) ─────────────────────────────────
export const CLONEOS_WELCOME = {
  title: "CloneOS",
  subtitle: "Pilotez votre entreprise IA.",
  prompt: "Demandez une mission, ouvrez un dossier, validez une action ou appelez un employé IA.",
} as const;
export const CLONEOS_SUGGESTED_COMMANDS: readonly string[] = [
  "Montre-moi ce qui bloque aujourd'hui.",
  "Ouvre Pierre.",
  "Quelles validations m'attendent ?",
  "Résume l'activité de mes employés IA.",
  "Crée une mission RH avec Pierre.",
  "Ouvre CloneRoom.",
];

// ── Participants CloneRoom (conceptuels) ─────────────────────────────────────────
export type RoomParticipantKind = "cloneos" | "employee_ai" | "footprint" | "technology" | "company_memory" | "human";
export interface RoomParticipant { readonly kind: RoomParticipantKind; readonly label: string }
export const CLONEROOM_PARTICIPANTS: readonly RoomParticipant[] = [
  { kind: "cloneos", label: "CloneOS" },
  { kind: "employee_ai", label: "Pierre — employé IA RH" },
  { kind: "footprint", label: "Empreinte Entreprise" },
  { kind: "technology", label: "Technologies / outils" },
  { kind: "company_memory", label: "Mémoire de l'entreprise" },
  { kind: "human", label: "Vous / votre équipe" },
];

// ── Contrat de redirection (§2) ─────────────────────────────────────────────────
export interface ClientReadiness {
  readonly connected: boolean;
  readonly isClient: boolean;          // possède au moins un employé IA actif (accès Pierre)
  readonly onboardingComplete: boolean;
}
export type LandingTarget =
  | { readonly kind: "public"; readonly route: string }
  | { readonly kind: "purchase"; readonly route: string }
  | { readonly kind: "setup"; readonly route: string }
  | { readonly kind: "cockpit"; readonly route: string };

/**
 * Résout la route d'atterrissage après login. PUR. Ne connecte, ni ne déconnecte, ni n'affaiblit
 * l'auth — décrit seulement OÙ envoyer un utilisateur selon un état déjà résolu côté serveur.
 * A: non connecté → public. B: connecté non-client → achat. C: client onboarding incomplet →
 * setup. D: client prêt → cockpit. E: un client connecté n'est jamais renvoyé au site marketing.
 */
export function resolveLandingRoute(state: ClientReadiness): LandingTarget {
  if (!state.connected) return { kind: "public", route: CLONEOS_ROUTES.public };
  if (!state.isClient) return { kind: "purchase", route: CLONEOS_ROUTES.purchase };
  if (!state.onboardingComplete) return { kind: "setup", route: CLONEOS_ROUTES.monClonestoreSetup };
  return { kind: "cockpit", route: CLONEOS_ROUTES.cockpit };
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
export function areaForRoute(route: string): AppArea | null {
  // Correspondance par préfixe la plus spécifique (les routes cockpit sont plus longues).
  const sorted = [...APP_AREAS].sort((a, b) => b.route.length - a.route.length);
  return sorted.find((a) => route === a.route || route.startsWith(a.route + "/")) ?? (route === "/" ? APP_AREAS.find((a) => a.id === "public_site")! : null);
}
export function isCockpitSurfaceRoute(route: string): boolean {
  return !!areaForRoute(route)?.isCockpitSurface;
}
/** Le contrat est-il complet et cohérent ? (5 zones distinctes, routes uniques, invariant présent). */
export function contractComplete(): boolean {
  const ids = new Set(APP_AREAS.map((a) => a.id));
  const routes = new Set(APP_AREAS.map((a) => a.route));
  return ids.size === 5 && routes.size === 5 && FORBIDDEN_CONFUSIONS.length >= 6 && SHELL_SURFACES.length === 5 && RESPONSIVE_MODES.length === 4;
}
