// src/lib/clonestore/founder-acceptance/founder-acceptance-scenarios.ts
// P13 §3 — Les WALKTHROUGHS fondateur exacts (A–G). Module PUR : décrit chaque parcours, le
// RESSENTI attendu, les éléments qui doivent être présents, la route, et une fonction de décision
// « ce scénario passe-t-il ? » à partir de signaux observés (preuve navigateur / revue de code).
// Aucun build, aucune I/O. Sert de source de vérité à la preuve navigateur + au scorecard.

import { FounderPillarId } from "./founder-vision-contract";

export type ScenarioId = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type Viewport = "mobile-390" | "tablet-768" | "laptop-1280" | "large-1600";

export interface FounderScenario {
  readonly id: ScenarioId;
  readonly title: string;
  readonly route: string;                 // route principale du parcours
  readonly expectedFeeling: string;       // ce que le fondateur doit ressentir
  readonly mustShow: readonly string[];   // éléments requis (signal keys, cf. checks)
  readonly passIf: readonly string[];     // conditions de réussite (lecture humaine)
  readonly viewports: readonly Viewport[];
  readonly pillars: readonly FounderPillarId[];
}

export const FOUNDER_SCENARIOS: readonly FounderScenario[] = [
  {
    id: "A",
    title: "Première connexion en client prêt",
    route: "/cockpit",
    expectedFeeling: "J'arrive DANS CloneOS, pas sur un site marketing.",
    mustShow: ["cloneos_first", "composer_visible", "suggestions_visible", "context_visible", "no_page_scroll", "mobile_bottom_nav"],
    passIf: ["CloneOS ressemble à un centre de commande", "aucune homepage marketing", "aucun scroll de cartes SaaS", "la route est évidente (/cockpit)"],
    viewports: ["laptop-1280", "mobile-390"],
    pillars: ["os_not_saas", "cloneos_command_shell", "simple_no_chaos"],
  },
  {
    id: "B",
    title: "Le dirigeant ouvre le Global Cockpit",
    route: "/cockpit",
    expectedFeeling: "Je sais ce qui se passe dans mon entreprise IA maintenant.",
    mustShow: ["workforce", "pierre", "missions", "validations", "risks_blockers", "recent_results", "health_status", "quick_actions"],
    passIf: ["La main-d'œuvre IA est visible", "l'état opérationnel (missions/validations/risques) est visible", "un résultat récent + la santé système sont visibles"],
    viewports: ["laptop-1280", "large-1600"],
    pillars: ["global_cockpit_dirigeant"],
  },
  {
    id: "C",
    title: "L'utilisateur ouvre Pierre",
    route: "/cockpit/pierre",
    expectedFeeling: "Pierre est mon employé RH.",
    mustShow: ["pierre_title", "employe_ia_rh_framing", "hr_missions", "validations", "documents", "evidence", "autonomy", "activity", "mission_composer", "no_assistant_framing"],
    passIf: ["Le cadrage « Employé IA RH » est présent", "le bureau RH réel est présent (missions/validations/documents/preuves/autonomie/activité/composer)", "aucun cadrage assistant/chatbot/copilote"],
    viewports: ["laptop-1280", "mobile-390"],
    pillars: ["pierre_is_employee", "pierre_cockpit_hr_desk", "bought_an_employee_feeling"],
  },
  {
    id: "D",
    title: "L'utilisateur utilise CloneRoom",
    route: "/cockpit/room",
    expectedFeeling: "Je suis dans le salon de mon entreprise IA.",
    mustShow: ["cloneos", "pierre", "empreinte_entreprise", "technologies", "company_memory", "human_team", "one_composer", "content_carrying_extraction", "message_to_mission"],
    passIf: ["Les participants (CloneOS/Pierre/empreinte/techs/mémoire/humains) sont visibles", "un seul composer simple", "un message peut devenir une mission Pierre en transportant son contenu"],
    viewports: ["laptop-1280", "mobile-390"],
    pillars: ["cloneroom_company_salon"],
  },
  {
    id: "E",
    title: "L'utilisateur ouvre Mon CloneStore",
    route: "/mon-clonestore",
    expectedFeeling: "C'est ici que je gère mon compte, pas où je travaille.",
    mustShow: ["company", "billing", "subscription", "country_pricing", "users", "permissions", "purchased_ai_employees", "footprint", "security", "support", "link_back_to_cockpit"],
    passIf: ["Sections d'administration présentes (compte/facturation/abonnement/pays/utilisateurs/…)", "surface distincte (pas cos-root)", "lien clair de retour vers le cockpit"],
    viewports: ["laptop-1280", "mobile-390"],
    pillars: ["mon_clonestore_admin_not_work"],
  },
  {
    id: "F",
    title: "Test fondateur mobile",
    route: "/cockpit",
    expectedFeeling: "Je peux vraiment utiliser ça sur mon téléphone.",
    mustShow: ["no_h_overflow", "no_page_scroll", "bottom_nav", "composer_reachable", "context_reachable", "pierre_in_1_2_taps", "validations_in_1_2_taps"],
    passIf: ["aucun débordement horizontal", "aucun scroll de page dans le cockpit", "bottom-nav + composer + contexte atteignables", "Pierre et validations en 1–2 taps"],
    viewports: ["mobile-390"],
    pillars: ["responsive_all_screens", "simple_no_chaos"],
  },
  {
    id: "G",
    title: "Test fondateur grand écran",
    route: "/cockpit",
    expectedFeeling: "C'est un vrai centre de commande.",
    mustShow: ["three_pane_console", "no_wasted_space", "useful_context_pane", "centered_command_surface", "rail_navigation", "switch_global_pierre_cloneroom"],
    passIf: ["console 3 panneaux", "pas d'espace vide inutile", "panneau contexte utile", "surface de commande centrée", "navigation par rail", "bascule facile Global/Pierre/CloneRoom"],
    viewports: ["large-1600", "laptop-1280"],
    pillars: ["global_cockpit_dirigeant", "cloneos_command_shell"],
  },
];

export interface ScenarioEvaluation {
  readonly id: ScenarioId;
  readonly passed: boolean;
  readonly missing: string[];
}

/** Évalue un scénario : passe si TOUS ses `mustShow` sont vrais dans les signaux observés. Pur. */
export function evaluateScenario(id: ScenarioId, signals: Partial<Record<string, boolean>>): ScenarioEvaluation {
  const sc = FOUNDER_SCENARIOS.find((s) => s.id === id);
  if (!sc) return { id, passed: false, missing: ["scénario inconnu"] };
  const missing = sc.mustShow.filter((k) => signals[k] !== true);
  return { id, passed: missing.length === 0, missing };
}

/** Évalue tous les scénarios A–G. Pur. */
export function evaluateAllScenarios(signals: Partial<Record<string, boolean>>): {
  readonly results: ScenarioEvaluation[];
  readonly passedCount: number;
  readonly total: number;
  readonly allPassed: boolean;
} {
  const results = FOUNDER_SCENARIOS.map((s) => evaluateScenario(s.id, signals));
  const passedCount = results.filter((r) => r.passed).length;
  return { results, passedCount, total: results.length, allPassed: passedCount === results.length };
}

/** Le jeu de scénarios est-il complet ? (A–G, routes non vides). Pur. */
export function scenariosComplete(): boolean {
  const ids = FOUNDER_SCENARIOS.map((s) => s.id).join("");
  return ids === "ABCDEFG" && FOUNDER_SCENARIOS.every((s) => s.route.startsWith("/") && s.mustShow.length > 0);
}
