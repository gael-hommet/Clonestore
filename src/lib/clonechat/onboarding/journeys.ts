// src/lib/clonechat/onboarding/journeys.ts
//
// Catalogue DÉTERMINISTE des parcours d'onboarding. Chaque étape pointe une route RÉELLE (registre)
// et, quand elle existe, une cible Visual Guidance VÉRIFIÉE (BLOC 9). Étapes « porte » = prérequis
// réels (auth / entreprise / Pierre). Aucun bouton/route/étape inventé. Réutilise le contrat de
// cibles visuelles (jamais une nouvelle surcouche).

import type { CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";
import type { OnboardingJourneyId } from "./types";

export interface JourneyStepSpec {
  readonly id: string;
  readonly text: string;
  readonly route: string | null;
  readonly visualTargetId: string | null; // vt_* vérifié (BLOC 9) ou null
  readonly prerequisites?: readonly CloneChatPrerequisite[];
  readonly gate?: boolean;
}
export interface JourneyBlueprint {
  readonly id: OnboardingJourneyId;
  readonly goal: string;
  readonly steps: readonly JourneyStepSpec[];
}

const JOURNEYS: Readonly<Record<OnboardingJourneyId, JourneyBlueprint>> = {
  public_discovery: {
    id: "public_discovery", goal: "Découvrir CloneStore.",
    steps: [
      { id: "home", text: "Bienvenue : l'accueil présente CloneStore (/).", route: "/", visualTargetId: "vt_home" },
      { id: "boutique", text: "La boutique des employés IA se trouve ici (/agents).", route: "/agents", visualTargetId: "vt_boutique" },
      { id: "pierre", text: "Découvrez Pierre, l'employé RH (/agents/pierre).", route: "/agents/pierre", visualTargetId: "vt_pierre_page" },
      { id: "demo", text: "Voyez Pierre à l'œuvre dans la démonstration (/demo/pierre).", route: "/demo/pierre", visualTargetId: "vt_demo" },
      { id: "clonechat", text: "CloneChat vous oriente et vous accompagne (/assistant).", route: "/assistant", visualTargetId: "vt_clonechat_entry" },
    ],
  },
  discover_pierre: {
    id: "discover_pierre", goal: "Comprendre ce que Pierre peut faire.",
    steps: [
      { id: "pierre", text: "La page de Pierre décrit son périmètre RH (/agents/pierre).", route: "/agents/pierre", visualTargetId: "vt_pierre_page" },
      { id: "demo", text: "La démonstration montre Pierre travailler (/demo/pierre).", route: "/demo/pierre", visualTargetId: "vt_demo" },
    ],
  },
  view_demo: {
    id: "view_demo", goal: "Voir la démonstration de Pierre.",
    steps: [{ id: "demo", text: "Ouvrez la démonstration de Pierre (/demo/pierre).", route: "/demo/pierre", visualTargetId: "vt_demo" }],
  },
  signup: {
    id: "signup", goal: "Créer un compte.",
    steps: [{ id: "signup", text: "Créez votre compte (/signup).", route: "/signup", visualTargetId: null, prerequisites: ["authentication"], gate: true }],
  },
  login: {
    id: "login", goal: "Se connecter.",
    steps: [{ id: "login", text: "Connectez-vous à Mon CloneStore (/login).", route: "/login", visualTargetId: "vt_login", prerequisites: ["authentication"], gate: true }],
  },
  resolve_company: {
    id: "resolve_company", goal: "Rattacher une entreprise active.",
    steps: [{ id: "add_company", text: "Ajoutez ou rattachez votre entreprise (/agents/pierre/setup).", route: "/agents/pierre/setup", visualTargetId: null, prerequisites: ["active_company"], gate: true }],
  },
  select_company: {
    id: "select_company", goal: "Sélectionner l'entreprise sur laquelle travailler.",
    steps: [{ id: "select_company", text: "Sélectionnez votre entreprise (/profile).", route: "/profile", visualTargetId: null, prerequisites: ["active_company"], gate: true }],
  },
  understand_pierre_access: {
    id: "understand_pierre_access", goal: "Comprendre et activer l'accès à Pierre.",
    steps: [
      { id: "explain", text: "Pierre est un employé IA à activer ; il prépare, un humain valide.", route: "/agents/pierre", visualTargetId: "vt_pierre_page" },
      { id: "reserve", text: "Activez Pierre pour votre entreprise (/reserver/pierre).", route: "/reserver/pierre", visualTargetId: null, prerequisites: ["pierre_entitlement"], gate: true },
    ],
  },
  reserve_pierre: {
    id: "reserve_pierre", goal: "Réserver / activer Pierre.",
    steps: [{ id: "reserve", text: "Réservez Pierre (/reserver/pierre) et suivez les indications de la page.", route: "/reserver/pierre", visualTargetId: null, prerequisites: ["pierre_entitlement"], gate: true }],
  },
  recover_entitlement: {
    id: "recover_entitlement", goal: "Reprendre après une panne de vérification du droit Pierre.",
    steps: [{ id: "retry", text: "La vérification du droit Pierre est momentanément indisponible ; réessayez dans un instant.", route: null, visualTargetId: null }],
  },
  enter_pierre_space: {
    id: "enter_pierre_space", goal: "Entrer dans l'espace Pierre (accès actif).",
    steps: [{ id: "open_space", text: "Ouvrez votre espace Pierre pour travailler (/agents/pierre/use).", route: "/agents/pierre/use", visualTargetId: null }],
  },
  discover_clonechat: {
    id: "discover_clonechat", goal: "Découvrir CloneChat.",
    steps: [
      { id: "open", text: "CloneChat s'ouvre ici (/assistant).", route: "/assistant", visualTargetId: "vt_clonechat_entry" },
      { id: "write", text: "Écrivez votre première demande dans le champ de CloneChat.", route: "/assistant", visualTargetId: "vt_clonechat_input" },
    ],
  },
  clonechat_limits: {
    id: "clonechat_limits", goal: "Comprendre les limites réelles de CloneChat.",
    steps: [{ id: "limits", text: "CloneChat oriente, prépare et vous guide ; il n'exécute jamais une action à votre place sans validation humaine.", route: "/assistant", visualTargetId: "vt_clonechat_entry" }],
  },
  start_mission_prep: {
    id: "start_mission_prep", goal: "Préparer une première demande de mission.",
    steps: [{ id: "prep", text: "Décrivez votre besoin à CloneChat : objectif et résultat attendu, pour préparer la demande.", route: "/assistant", visualTargetId: "vt_clonechat_input" }],
  },
  contact_support: {
    id: "contact_support", goal: "Contacter le support (état non résolvable sûrement).",
    steps: [{ id: "support", text: "Contactez le support et décrivez votre situation (/questions).", route: "/questions", visualTargetId: null }],
  },
};

export function getJourney(id: OnboardingJourneyId): JourneyBlueprint {
  return JOURNEYS[id];
}
