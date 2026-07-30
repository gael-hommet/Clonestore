// src/lib/clonechat/guide/catalog.ts
//
// Catalogue DÉTERMINISTE des parcours CloneGuide. Chaque plan (blueprint) = objectif + étapes
// ordonnées avec un texte précis, une route RÉELLE (validée contre le registre) et des conditions
// observables. Aucune UI inventée : on décrit la route et l'intention de l'écran, jamais un bouton
// ou un champ précis (le guidage visuel appartient au BLOC 9). Les routes qui n'existent pas dans
// le registre sont ramenées à null (jamais de lien mort).

import { getRouteEntry } from "@/lib/nav/route-registry";
import type { CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";
import type { GuideId } from "./types";

/** Spécification d'une étape avant indexation. */
export interface StepSpec {
  readonly id: string;
  readonly text: string;
  readonly route: string | null;
  /** Étape « porte » : satisfaite dès que ses prérequis sont vérifiés dans le contexte. */
  readonly gate?: boolean;
  readonly prerequisites?: readonly CloneChatPrerequisite[];
  readonly success: string;
  readonly blocked: string;
  readonly recovery: string;
}

export interface GuideBlueprint {
  readonly id: GuideId;
  readonly goal: string;
  readonly startRoute: string | null;
  readonly steps: readonly StepSpec[];
  readonly requiresConfirmation?: boolean;
}

/** Route RÉELLE (registre) ou null — jamais un lien mort. */
export function realRoute(path: string | null | undefined): string | null {
  return path && getRouteEntry(path) ? path : null;
}

// ── Parcours d'INTENTION ──────────────────────────────────────────────────────

export function reservePierreBlueprint(): GuideBlueprint {
  return {
    id: "reserve_pierre",
    goal: "Réserver Pierre.",
    startRoute: realRoute("/reserver/pierre"),
    requiresConfirmation: true,
    steps: [
      {
        id: "open_reserve", text: "Ouvrez la page « Réserver Pierre » (/reserver/pierre) : c'est là que la réservation se fait.",
        route: realRoute("/reserver/pierre"),
        success: "La page de réservation s'affiche.",
        blocked: "La réservation est fermée pour la phase de lancement en cours.",
        recovery: "Consultez la démo (/demo/pierre) en attendant l'ouverture, ou revenez à la date d'ouverture.",
      },
      {
        id: "fill_reserve", text: "Suivez les indications de la page pour renseigner votre demande de réservation.",
        route: realRoute("/reserver/pierre"),
        success: "La page accepte les informations demandées.",
        blocked: "Une information requise manque ou est refusée par la page.",
        recovery: "Complétez l'information signalée par la page, puis reprenez.",
      },
      {
        id: "confirm_reserve", text: "Validez votre réservation lorsque la page vous le propose.",
        route: realRoute("/reserver/pierre"),
        success: "Une confirmation de réservation s'affiche sur la page.",
        blocked: "La validation de la réservation échoue.",
        recovery: "Réessayez ; si l'échec persiste, contactez le support (/questions).",
      },
    ],
  };
}

export function viewDemoBlueprint(): GuideBlueprint {
  return {
    id: "view_demo",
    goal: "Voir la démonstration de Pierre.",
    startRoute: realRoute("/demo/pierre"),
    steps: [
      {
        id: "open_demo", text: "Ouvrez la démonstration de Pierre (/demo/pierre).",
        route: realRoute("/demo/pierre"),
        success: "La démonstration se lance.",
        blocked: "La page de démonstration ne se charge pas.",
        recovery: "Rechargez la page ; si le problème persiste, réessayez plus tard.",
      },
      {
        id: "browse_demo", text: "Parcourez la démonstration présentée à l'écran.",
        route: realRoute("/demo/pierre"),
        success: "Vous avez parcouru la démonstration.",
        blocked: "La démonstration s'interrompt.",
        recovery: "Rechargez la page, ou contactez le support (/questions).",
      },
    ],
  };
}

export function checkoutBlueprint(): GuideBlueprint {
  return {
    id: "checkout",
    goal: "Finaliser le paiement.",
    startRoute: realRoute("/checkout"),
    requiresConfirmation: true,
    steps: [
      {
        id: "open_checkout", text: "Ouvrez la page de paiement (/checkout).",
        route: realRoute("/checkout"),
        success: "La page de paiement s'affiche.",
        blocked: "La page de paiement est verrouillée (aucune commande en cours ou session absente).",
        recovery: "Assurez-vous d'avoir une commande en cours : réservez d'abord Pierre (/reserver/pierre).",
      },
      {
        id: "pay", text: "Suivez les indications de paiement de la page.",
        route: realRoute("/checkout"),
        success: "Le paiement est accepté par la page.",
        blocked: "Le paiement est refusé.",
        recovery: "Vérifiez les informations demandées par la page ; en cas d'échec, reprenez le paiement ou contactez le support (/questions).",
      },
      {
        id: "confirm_checkout", text: "Confirmez la finalisation de la commande lorsque la page vous le propose.",
        route: realRoute("/checkout"),
        success: "Une confirmation de commande s'affiche.",
        blocked: "La finalisation échoue.",
        recovery: "Réessayez le paiement ; si le refus persiste, contactez le support (/questions).",
      },
    ],
  };
}

export function loginBlueprint(): GuideBlueprint {
  return {
    id: "login",
    goal: "Se connecter.",
    startRoute: realRoute("/login"),
    steps: [
      {
        id: "open_login", text: "Ouvrez la page de connexion (/login) et connectez-vous.",
        route: realRoute("/login"), gate: true, prerequisites: ["authentication"],
        success: "Vous êtes connecté.",
        blocked: "La connexion échoue.",
        recovery: "Vérifiez vos identifiants, ou créez un compte (/signup).",
      },
    ],
  };
}

export function signupBlueprint(): GuideBlueprint {
  return {
    id: "signup",
    goal: "Créer un compte.",
    startRoute: realRoute("/signup"),
    steps: [
      {
        id: "open_signup", text: "Ouvrez la page de création de compte (/signup) et créez votre compte.",
        route: realRoute("/signup"), gate: true, prerequisites: ["authentication"],
        success: "Votre compte est créé et vous êtes connecté.",
        blocked: "La création de compte échoue.",
        recovery: "Vérifiez les informations demandées, ou connectez-vous si vous avez déjà un compte (/login).",
      },
    ],
  };
}

// ── Parcours de RÉSOLUTION (dérivés d'un diagnostic) ──────────────────────────

export function resolveNoCompanyBlueprint(route: string | null): GuideBlueprint {
  return {
    id: "resolve_no_company",
    goal: "Rattacher une entreprise active à votre compte.",
    startRoute: route,
    steps: [
      {
        id: "add_company", text: `Ajoutez ou rattachez votre entreprise${route ? ` (${route})` : ""}.`,
        route, gate: true, prerequisites: ["active_company"],
        success: "Une entreprise active est disponible sur votre compte.",
        blocked: "Aucune entreprise n'est disponible ou le rattachement échoue.",
        recovery: "Créez votre entreprise, ou demandez une invitation à son administrateur ; sinon contactez le support (/questions).",
      },
    ],
  };
}

export function selectCompanyBlueprint(route: string | null): GuideBlueprint {
  return {
    id: "select_company",
    goal: "Sélectionner l'entreprise sur laquelle travailler.",
    startRoute: route,
    steps: [
      {
        id: "select_company", text: `Sélectionnez l'entreprise sur laquelle travailler${route ? ` (${route})` : ""}.`,
        route, gate: true, prerequisites: ["active_company"],
        success: "Une entreprise est sélectionnée.",
        blocked: "La sélection n'est pas enregistrée.",
        recovery: "Réessayez la sélection, ou contactez le support (/questions).",
      },
    ],
  };
}

export function resolveNoPierreBlueprint(route: string | null): GuideBlueprint {
  return {
    id: "resolve_no_pierre",
    goal: "Activer le droit d'utilisation de Pierre.",
    startRoute: route,
    steps: [
      {
        id: "activate_pierre", text: `Activez Pierre${route ? ` (${route})` : ""}.`,
        route, gate: true, prerequisites: ["pierre_entitlement"],
        success: "Le droit Pierre est actif.",
        blocked: "L'activation de Pierre n'aboutit pas.",
        recovery: "Finalisez le paiement (/checkout) si nécessaire, ou contactez le support (/questions).",
      },
    ],
  };
}

export function recoverBlueprint(variant: "entitlement" | "provider"): GuideBlueprint {
  const isEnt = variant === "entitlement";
  return {
    id: "recover_entitlement_lookup",
    goal: isEnt ? "Reprendre après une panne de vérification du droit Pierre." : "Reprendre après une indisponibilité momentanée du service.",
    startRoute: null,
    steps: [
      {
        id: "retry", text: isEnt
          ? "La vérification de votre droit Pierre est momentanément indisponible. Réessayez votre demande dans un instant."
          : "Le service est momentanément indisponible. Réessayez votre demande dans un instant.",
        route: null,
        success: "La vérification aboutit et votre demande reprend normalement.",
        blocked: "Le problème persiste après plusieurs tentatives.",
        recovery: "Patientez quelques instants et réessayez ; si le problème persiste, contactez le support (/questions).",
      },
    ],
  };
}

export function contactSupportBlueprint(): GuideBlueprint {
  return {
    id: "contact_support",
    goal: "Contacter le support.",
    startRoute: realRoute("/questions"),
    steps: [
      {
        id: "open_support", text: "Ouvrez la page support (/questions) et décrivez précisément votre problème.",
        route: realRoute("/questions"),
        success: "Votre demande est transmise au support.",
        blocked: "La page support ne se charge pas.",
        recovery: "Réessayez plus tard, ou depuis un autre appareil/navigateur.",
      },
    ],
  };
}

export function unknownRouteBlueprint(currentPath: string | null): GuideBlueprint {
  return {
    id: "unknown_route",
    goal: "Rejoindre une page valide du produit.",
    startRoute: realRoute("/"),
    steps: [
      {
        id: "back_home", text: `La page indiquée${currentPath ? ` (${currentPath})` : ""} n'existe pas dans le produit. Revenez à l'accueil (/).`,
        route: realRoute("/"),
        success: "Vous êtes sur une page valide du produit.",
        blocked: "L'accueil ne se charge pas.",
        recovery: "Réessayez, ou contactez le support (/questions).",
      },
      {
        id: "clarify_target", text: "Précisez la page que vous cherchiez pour être orienté vers la bonne route réelle.",
        route: null,
        success: "La page recherchée est identifiée.",
        blocked: "La page recherchée reste indéterminée.",
        recovery: "Décrivez ce que vous vouliez faire (réserver, payer, démo, support).",
      },
    ],
  };
}

export function afterPaymentBlueprint(route: string | null, confirmed: boolean): GuideBlueprint {
  const steps: StepSpec[] = [
    {
      id: "retry_payment", text: `Reprenez le paiement${route ? ` (${route})` : ""}.`,
      route,
      success: "Le paiement est accepté par la page.",
      blocked: "Le paiement est de nouveau refusé.",
      recovery: "Vérifiez le moyen de paiement demandé par la page ; si le refus persiste, contactez le support (/questions).",
    },
  ];
  if (!confirmed) {
    steps.push({
      id: "provide_error", text: "Indiquez le message d'erreur exact affiché pour cibler la cause précise.",
      route: null,
      success: "Le message d'erreur exact est fourni.",
      blocked: "Le message d'erreur reste indéterminé.",
      recovery: "Notez le texte affiché à l'écran, puis reprenez.",
    });
  }
  return { id: "after_payment_diagnosis", goal: "Débloquer et finaliser le paiement.", startRoute: route, steps };
}

export function tenantOrPermissionBlueprint(variant: "tenant_suspended" | "tenant_unavailable" | "permission"): GuideBlueprint {
  if (variant === "permission") {
    return {
      id: "resolve_tenant_or_permission",
      goal: "Formuler une demande conforme à la gouvernance.",
      startRoute: null,
      steps: [
        {
          id: "reformulate", text: "Cette demande est refusée : elle contournerait la validation obligatoire. Reformulez une demande conforme — Pierre prépare, un humain valide.",
          route: null,
          success: "Vous formulez une demande autorisée.",
          blocked: "La demande reste non conforme.",
          recovery: "Demandez uniquement des actions autorisées ; aucune action ne contourne la validation humaine.",
        },
      ],
    };
  }
  const suspended = variant === "tenant_suspended";
  return {
    id: "resolve_tenant_or_permission",
    goal: "Rétablir l'accès à votre entreprise.",
    startRoute: realRoute("/questions"),
    steps: [
      {
        id: "restore_access", text: suspended
          ? "L'accès à votre entreprise est suspendu (sécurité). Contactez le support (/questions) pour demander le rétablissement."
          : "L'accès à votre entreprise est momentanément indisponible. Réessayez dans un instant ; si le problème persiste, contactez le support (/questions).",
        route: realRoute("/questions"),
        success: "L'accès à l'entreprise est rétabli.",
        blocked: "L'accès reste fermé.",
        recovery: "Fournissez au support l'identifiant de votre entreprise et la date du blocage.",
      },
    ],
  };
}

export function clarifyRequestBlueprint(): GuideBlueprint {
  return {
    id: "clarify_request",
    goal: "Préciser la demande pour permettre un accompagnement fiable.",
    startRoute: null,
    steps: [
      {
        id: "provide_details", text: "Indiquez l'action précise que vous tentez et le message d'erreur exact que vous voyez.",
        route: null,
        success: "L'action précise et l'erreur exacte sont fournies.",
        blocked: "L'information nécessaire reste manquante.",
        recovery: "Décrivez l'écran où vous êtes et ce qui échoue, puis reprenez.",
      },
    ],
  };
}
