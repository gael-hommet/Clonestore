/**
 * Détection & décision PWA — logique PURE (sans DOM, testable en environnement node).
 *
 * Aucune de ces fonctions ne lit `window`/`navigator` directement : les entrées sont
 * passées explicitement (user-agent, flags, horodatage) afin d'être testables et
 * déterministes. Les adaptateurs DOM vivent dans les composants `use client`.
 */

import {
  PWA_DISMISS_COOLDOWN_MS,
  PWA_MIN_VISITS_FOR_INVITE,
} from "./constants";

export type PwaPlatform = "ios" | "android" | "desktop" | "other";

export type InstallInviteKind = "native" | "ios-instructions" | "none";

export interface UserAgentInfo {
  platform: PwaPlatform;
  isIos: boolean;
  isAndroid: boolean;
  /** Navigateur iOS pouvant réellement ajouter à l'écran d'accueil (Safari). */
  isIosSafari: boolean;
}

/**
 * Détermine la plateforme à partir du user-agent (et du nombre de points tactiles,
 * pour distinguer l'iPad iOS 13+ qui se présente comme un Mac).
 */
export function parseUserAgent(ua: string, maxTouchPoints = 0): UserAgentInfo {
  const s = (ua || "").toLowerCase();

  const isIphone = /iphone|ipod/.test(s);
  const isIpadClassic = /ipad/.test(s);
  // iPadOS 13+ : UA « Macintosh » mais écran tactile.
  const isIpadDesktopClass = /macintosh/.test(s) && maxTouchPoints > 1;
  const isIos = isIphone || isIpadClassic || isIpadDesktopClass;

  const isAndroid = /android/.test(s);

  let platform: PwaPlatform;
  if (isIos) platform = "ios";
  else if (isAndroid) platform = "android";
  else if (/windows|macintosh|linux|cros/.test(s)) platform = "desktop";
  else platform = "other";

  // Sur iOS, tous les navigateurs sont WebKit ; seul Safari expose un flux fiable
  // « Sur l'écran d'accueil ». On exclut les WebViews d'autres navigateurs.
  const isIosOtherBrowser = /crios|fxios|edgios|opios|mercury/.test(s);
  const isIosSafari = isIos && /safari/.test(s) && !isIosOtherBrowser;

  return { platform, isIos, isAndroid, isIosSafari };
}

/**
 * L'app tourne-t-elle déjà en mode installé (standalone) ?
 * `displayModeStandalone` = résultat de matchMedia('(display-mode: standalone)').
 * `navigatorStandalone`  = navigator.standalone (iOS Safari installé).
 */
export function computeStandalone(
  displayModeStandalone: boolean,
  navigatorStandalone: boolean | undefined,
): boolean {
  return Boolean(displayModeStandalone) || navigatorStandalone === true;
}

export interface InstallInviteState {
  platform: PwaPlatform;
  /** Lancé en tant qu'app installée (standalone). */
  isStandalone: boolean;
  /** Installation connue (appinstalled déjà reçu ou standalone). */
  isInstalled: boolean;
  /** Un événement beforeinstallprompt est disponible (Android/desktop Chromium). */
  promptAvailable: boolean;
  /** Nombre de visites enregistrées. */
  visitCount: number;
  /** Horodatage (ms) du dernier refus, ou null. */
  dismissedAtMs: number | null;
  /** Horodatage courant (ms). */
  nowMs: number;
  /** Déclencheur : proposition sollicitée par l'utilisateur ou non. */
  manual?: boolean;
  cooldownMs?: number;
  minVisits?: number;
}

export interface InstallInviteDecision {
  show: boolean;
  kind: InstallInviteKind;
  reason: string;
}

/**
 * Décide s'il faut proposer l'installation, et sous quelle forme.
 * Jamais agressif : respecte le refus (cooldown), l'engagement (visites), l'état installé.
 * Une demande MANUELLE (bouton dans /installer ou paramètres) court-circuite l'engagement
 * mais respecte toujours l'état « déjà installé ».
 */
export function evaluateInstallInvite(state: InstallInviteState): InstallInviteDecision {
  const cooldownMs = state.cooldownMs ?? PWA_DISMISS_COOLDOWN_MS;
  const minVisits = state.minVisits ?? PWA_MIN_VISITS_FOR_INVITE;
  const manual = state.manual === true;

  // 1) Déjà installé / lancé en standalone → jamais de proposition.
  if (state.isStandalone || state.isInstalled) {
    return { show: false, kind: "none", reason: "already-installed" };
  }

  // 2) Plateforme non supportée pour l'installation.
  if (state.platform === "other") {
    return { show: false, kind: "none", reason: "unsupported-platform" };
  }

  // 3) Cooldown après refus (ignoré si demande manuelle explicite).
  if (!manual && state.dismissedAtMs !== null) {
    const elapsed = state.nowMs - state.dismissedAtMs;
    if (elapsed < cooldownMs) {
      return { show: false, kind: "none", reason: "in-cooldown" };
    }
  }

  // 4) Engagement minimal (ignoré si demande manuelle).
  if (!manual && state.visitCount < minVisits) {
    return { show: false, kind: "none", reason: "not-engaged-yet" };
  }

  // 5) iOS : pas de prompt natif — on montre les instructions Partager.
  if (state.platform === "ios") {
    return { show: true, kind: "ios-instructions", reason: "ios-manual-instructions" };
  }

  // 6) Android / desktop : proposition native seulement si l'événement est prêt.
  if (state.promptAvailable) {
    return { show: true, kind: "native", reason: "native-prompt-ready" };
  }

  // Le navigateur n'a pas (encore) émis beforeinstallprompt : pas éligible.
  // En demande manuelle, on l'indique explicitement plutôt que de mentir.
  return {
    show: false,
    kind: "none",
    reason: manual ? "native-prompt-unavailable" : "native-prompt-not-ready",
  };
}

export interface OnboardingState {
  platform: PwaPlatform;
  /** Le guide a-t-il déjà été vu (localStorage) ? */
  seen: boolean;
  isStandalone: boolean;
  isInstalled: boolean;
  /** Réouverture volontaire depuis /installer (« paramètres »). */
  manual?: boolean;
}

/**
 * Mini-onboarding d'installation : affiché UNE fois, ignoré ensuite, toujours réouvrable
 * volontairement. Non bloquant : ce n'est qu'une décision d'affichage.
 * NB : il ne remplace pas l'onboarding métier/entreprise (géré par d'autres blocs).
 */
export function evaluateOnboarding(state: OnboardingState): InstallInviteDecision {
  // Déjà installé / lancé en app ⇒ le guide n'a plus d'objet, même en réouverture.
  if (state.isStandalone || state.isInstalled) {
    return { show: false, kind: "none", reason: "already-installed" };
  }
  if (state.platform === "other") {
    return { show: false, kind: "none", reason: "unsupported-platform" };
  }
  // Réouverture volontaire : on montre, même si déjà vu.
  if (state.manual === true) {
    return {
      show: true,
      kind: state.platform === "ios" ? "ios-instructions" : "native",
      reason: "manual-reopen",
    };
  }
  // Ignoré si déjà vu.
  if (state.seen) {
    return { show: false, kind: "none", reason: "already-seen" };
  }
  return {
    show: true,
    kind: state.platform === "ios" ? "ios-instructions" : "native",
    reason: "first-time",
  };
}

/**
 * Surfaces PRODUIT où une proposition d'installation NON SOLLICITÉE est pertinente :
 * l'utilisateur se sert réellement de CloneStore, l'installer sur l'écran d'accueil a
 * un sens. Doctrine : LISTE BLANCHE (fail-closed).
 *
 * Le funnel commercial public (« / », « /demo », « /demo/pierre », « /agents/<slug> »,
 * « /reserver », « /checkout », « /paiement »…) en est volontairement absent : le
 * visiteur y JUGE le produit. Une carte flottante qui recouvre un CTA, les contrôles
 * du cockpit de démonstration ou le bas d'une scène mobile dégraderait la démonstration
 * commerciale — et se déclencherait sans intention de sa part.
 */
export const PWA_PRODUCT_PREFIXES = [
  "/cockpit",
  "/mon-clonestore",
  "/profile",
  "/assistant",
  "/agents/pierre/use",
  "/agents/pierre/setup",
  "/agents/pierre/employees",
] as const;

/**
 * La proposition AUTOMATIQUE est-elle autorisée sur ce chemin ?
 *
 * « /installer » est exclu : la page porte déjà sa propre UX d'installation.
 * Une demande MANUELLE (bouton) reste possible partout : elle procède d'une intention
 * explicite de l'utilisateur — c'est `manualInvite`, pas cette règle.
 */
export function isPwaAutoInvitePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = (pathname.split("?")[0] || "").replace(/\/+$/, "") || "/";
  if (p === "/installer") return false;
  return PWA_PRODUCT_PREFIXES.some((base) => p === base || p.startsWith(`${base}/`));
}

/** Un refus est-il encore « frais » (dans le cooldown) ? */
export function isDismissalActive(
  dismissedAtMs: number | null,
  nowMs: number,
  cooldownMs = PWA_DISMISS_COOLDOWN_MS,
): boolean {
  if (dismissedAtMs === null) return false;
  return nowMs - dismissedAtMs < cooldownMs;
}

/** Libellé lisible de l'appareil détecté (affiché dans /installer). */
export function describeDevice(info: UserAgentInfo): string {
  switch (info.platform) {
    case "ios":
      return info.isIosSafari ? "iPhone / iPad (Safari)" : "iPhone / iPad";
    case "android":
      return "Android";
    case "desktop":
      return "Ordinateur";
    default:
      return "Appareil non reconnu";
  }
}
