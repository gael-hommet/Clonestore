"use client";

/**
 * Hook adaptateur DOM ↔ logique PURE (src/lib/pwa/detect.ts).
 * Toute la décision « faut-il proposer » vit dans la lib pure testable ; ici on ne fait
 * que brancher les API navigateur (beforeinstallprompt, standalone, service worker).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  parseUserAgent,
  computeStandalone,
  evaluateInstallInvite,
  evaluateOnboarding,
  describeDevice,
  type UserAgentInfo,
  type InstallInviteDecision,
} from "@/lib/pwa/detect";
import {
  PWA_STORAGE,
  PWA_VERSION,
  SW_URL,
} from "@/lib/pwa/constants";

/** Événement non standardisé (Chromium). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type PromptResult = "accepted" | "dismissed" | "unavailable";

function readNum(key: string): number {
  try {
    const v = localStorage.getItem(key);
    return v ? Number(v) || 0 : 0;
  } catch {
    return 0;
  }
}
function readTs(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    return v ? Number(v) || null : null;
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : dégradation silencieuse */
  }
}

export interface UsePwa {
  mounted: boolean;
  info: UserAgentInfo;
  deviceLabel: string;
  isStandalone: boolean;
  isInstalled: boolean;
  canPromptNative: boolean;
  /** Décision automatique non sollicitée (respecte engagement + cooldown). */
  autoInvite: InstallInviteDecision;
  /** Décision d'une demande manuelle (bouton), court-circuite l'engagement. */
  manualInvite: InstallInviteDecision;
  /** Mini-onboarding : décision automatique (ignoré si déjà vu). */
  onboardingInvite: InstallInviteDecision;
  /** Mini-onboarding : décision en réouverture volontaire (depuis /installer). */
  onboardingReopen: InstallInviteDecision;
  /** Le mini-onboarding a-t-il déjà été vu ? */
  onboardingSeen: boolean;
  /** Marque le mini-onboarding comme vu (persisté). */
  markOnboardingSeen: () => void;
  promptInstall: () => Promise<PromptResult>;
  dismissInvite: () => void;
  version: string;
  updateAvailable: boolean;
  applyUpdate: () => void;
}

export function usePwa(): UsePwa {
  const [mounted, setMounted] = useState(false);
  const [info, setInfo] = useState<UserAgentInfo>({
    platform: "other",
    isIos: false,
    isAndroid: false,
    isIosSafari: false,
  });
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [promptEvt, setPromptEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visitCount, setVisitCount] = useState(0);
  const [dismissedAtMs, setDismissedAtMs] = useState<number | null>(null);
  const [onboardingSeen, setOnboardingSeen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorker = useRef<ServiceWorker | null>(null);
  // Armé UNIQUEMENT quand l'utilisateur consent à la mise à jour. Sans lui, le
  // `controllerchange` de la toute première installation (controller null → contrôlé)
  // rechargerait la page sans raison.
  const wantsReloadRef = useRef(false);

  // 1) Détection plateforme / standalone + compteur de visite.
  useEffect(() => {
    setMounted(true);

    const ua = navigator.userAgent;
    const mtp = navigator.maxTouchPoints ?? 0;
    setInfo(parseUserAgent(ua, mtp));

    const dm = window.matchMedia?.("(display-mode: standalone)");
    const navStandalone = (navigator as unknown as { standalone?: boolean }).standalone;
    const standalone = computeStandalone(Boolean(dm?.matches), navStandalone);
    setIsStandalone(standalone);
    if (standalone) write(PWA_STORAGE.installedFlag, "1");
    setIsInstalled(standalone || readNum(PWA_STORAGE.installedFlag) === 1);

    setDismissedAtMs(readTs(PWA_STORAGE.dismissedAt));
    setOnboardingSeen(readNum(PWA_STORAGE.onboardingSeen) === 1);

    // Compteur de visite : +1 une seule fois par session (garde sessionStorage).
    let count = readNum(PWA_STORAGE.visitCount);
    try {
      if (!sessionStorage.getItem("cs.pwa.counted")) {
        count += 1;
        write(PWA_STORAGE.visitCount, String(count));
        sessionStorage.setItem("cs.pwa.counted", "1");
      }
    } catch {
      /* ignore */
    }
    setVisitCount(count);

    const onDisplayChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    dm?.addEventListener?.("change", onDisplayChange);
    return () => dm?.removeEventListener?.("change", onDisplayChange);
  }, []);

  // 2) beforeinstallprompt + appinstalled.
  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setPromptEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setPromptEvt(null);
      write(PWA_STORAGE.installedFlag, "1");
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // 3) Service worker : enregistrement + détection de mise à jour.
  //    Uniquement en production : en dev on n'interfère pas avec le HMR / les sessions voisines.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | undefined;
    const onControllerChange = () => {
      // On ne recharge QUE si l'utilisateur a explicitement demandé la mise à jour.
      // (La première installation déclenche aussi controllerchange : à ignorer.)
      if (wantsReloadRef.current) window.location.reload();
    };

    navigator.serviceWorker
      .register(SW_URL)
      .then((registration) => {
        reg = registration;
        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorker.current = registration.waiting;
          setUpdateAvailable(true);
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              waitingWorker.current = registration.waiting ?? installing;
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(() => {
        /* enregistrement impossible : l'app fonctionne normalement, sans PWA */
      });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      void reg;
    };
  }, []);

  const now = Date.now();
  const canPromptNative = promptEvt !== null;

  const autoInvite = useMemo(
    () =>
      evaluateInstallInvite({
        platform: info.platform,
        isStandalone,
        isInstalled,
        promptAvailable: canPromptNative,
        visitCount,
        dismissedAtMs,
        nowMs: now,
      }),
    // now change à chaque render ; on le fige au montage via mounted pour éviter le bruit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [info.platform, isStandalone, isInstalled, canPromptNative, visitCount, dismissedAtMs, mounted],
  );

  const manualInvite = useMemo(
    () =>
      evaluateInstallInvite({
        platform: info.platform,
        isStandalone,
        isInstalled,
        promptAvailable: canPromptNative,
        visitCount,
        dismissedAtMs,
        nowMs: now,
        manual: true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [info.platform, isStandalone, isInstalled, canPromptNative, visitCount, dismissedAtMs, mounted],
  );

  /** Mini-onboarding : affiché une fois, ignoré ensuite (clé `onboardingSeen`). */
  const onboardingInvite = useMemo(
    () =>
      evaluateOnboarding({
        platform: info.platform,
        seen: onboardingSeen,
        isStandalone,
        isInstalled,
      }),
    [info.platform, onboardingSeen, isStandalone, isInstalled],
  );

  /** Réouverture volontaire depuis /installer (« paramètres ») — ignore le « déjà vu ». */
  const onboardingReopen = useMemo(
    () =>
      evaluateOnboarding({
        platform: info.platform,
        seen: onboardingSeen,
        isStandalone,
        isInstalled,
        manual: true,
      }),
    [info.platform, onboardingSeen, isStandalone, isInstalled],
  );

  const markOnboardingSeen = useCallback(() => {
    write(PWA_STORAGE.onboardingSeen, "1");
    setOnboardingSeen(true);
  }, []);

  const promptInstall = useCallback(async (): Promise<PromptResult> => {
    if (!promptEvt) return "unavailable";
    try {
      await promptEvt.prompt();
      const choice = await promptEvt.userChoice;
      setPromptEvt(null);
      if (choice.outcome === "accepted") {
        write(PWA_STORAGE.installedFlag, "1");
        setIsInstalled(true);
        return "accepted";
      }
      // Refus : on enregistre le cooldown.
      const ts = Date.now();
      write(PWA_STORAGE.dismissedAt, String(ts));
      setDismissedAtMs(ts);
      return "dismissed";
    } catch {
      return "unavailable";
    }
  }, [promptEvt]);

  const dismissInvite = useCallback(() => {
    const ts = Date.now();
    write(PWA_STORAGE.dismissedAt, String(ts));
    setDismissedAtMs(ts);
  }, []);

  const applyUpdate = useCallback(() => {
    const w = waitingWorker.current;
    if (!w) {
      // Pas de worker en attente : simple rechargement sûr.
      window.location.reload();
      return;
    }
    wantsReloadRef.current = true;
    w.postMessage({ type: "SKIP_WAITING" });
    // controllerchange déclenchera le reload (car wantsReloadRef est armé).
  }, []);

  return {
    mounted,
    info,
    deviceLabel: describeDevice(info),
    isStandalone,
    isInstalled,
    canPromptNative,
    autoInvite,
    manualInvite,
    onboardingInvite,
    onboardingReopen,
    onboardingSeen,
    markOnboardingSeen,
    promptInstall,
    dismissInvite,
    version: PWA_VERSION,
    updateAvailable,
    applyUpdate,
  };
}
