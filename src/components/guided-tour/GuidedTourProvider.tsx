"use client";

// GuidedTourProvider (P9.1) — orchestrateur du moteur de découverte guidée.
//
// Monté une seule fois dans le layout racine, il enveloppe {children} (le rendu
// serveur des pages reste intact) et porte TOUTE l'UI du tour dans un portail
// vers <body>. Quand aucun tour n'est actif et qu'aucune invitation n'est due,
// RIEN n'est monté : la page reste visuellement identique, aucun écouteur global
// n'est attaché, aucun style/attribut du site n'est modifié.
//
// Corrections P9.1 :
//  - parcours MULTI-PAGE réel (router.push + attente de la cible sur la nouvelle
//    page) ;
//  - IDENTITÉ DE RÉSOLUTION (anti stale-step) : la géométrie est stockée avec la
//    clé exacte de l'étape (tour+version+index). L'UI n'est rendue QUE si
//    resolution.key === clé de l'étape courante → la nouvelle carte/pointeur/ring
//    ne peut JAMAIS utiliser le rectangle de l'étape précédente, même une frame ;
//  - transitions douces (AnimatePresence mode="wait") ;
//  - pointeur ancré sur le placement RÉELLEMENT résolu (source unique carte+ptr) ;
//  - auto-scroll INTELLIGENT (skip si déjà visible) ;
//  - « Plus tard » = snooze temporaire, pas un skip permanent ;
//  - accessibilité : sauvegarde/restauration du focus (avec repli déterministe
//    si l'élément initial a disparu), inert + aria-hidden réversibles, focus-trap ;
//  - reprise cross-route après refresh (auto-resume).

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";

import {
  IDLE_STATE,
  CLONECHAT_TOUR,
  CLONECHAT_WELCOME,
  MY_CLONESTORE_TOUR,
  MY_CLONESTORE_WELCOME,
  PIERRE_COCKPIT_TOUR,
  PIERRE_COCKPIT_WELCOME,
  PUBLIC_DISCOVERY_TOUR,
  PUBLIC_DISCOVERY_WELCOME,
  computeCardPlacement,
  computePointerAnchor,
  computeSpotlightRect,
  getTour,
  isFirstStep,
  isLastStep,
  isResolutionReady,
  readProgress,
  resolveResumeIndex,
  selectCurrentStep,
  selectFocusRestoreTarget,
  selectProgress,
  shouldOfferTour,
  shouldScrollToTarget,
  stepResolutionKey,
  tourReducer,
  tourTargetSelector,
  writeProgress,
  writeSnooze,
  type CardPlacement,
  type KeyValueStore,
  type Rect,
  type Size,
  type Tour,
  type TourAction,
  type TourState,
  type TourStep,
  type TourStepAction,
  type Viewport,
} from "@/lib/guided-tour";

import { isDemoContextualPromptEnabled } from "@/lib/demo/contextual-prompt/contextual-prompt-flags";
import { shouldSuppressHomepageAutoWelcome } from "@/lib/demo/contextual-prompt/detect";
// Canonical Analytics Runtime Wiring — instrumentation ADDITIVE, pure observation de la machine
// à états du tour. Ne modifie AUCUN comportement visuel, aucune règle de collision de prompt.
import { track, currentPageViewId } from "@/lib/analytics/client/track";
import { GuidedTourContext, type GuidedTourApi } from "./guided-tour-context";
import { GuidedTourPortal } from "./GuidedTourPortal";
import { GuidedTourOverlay } from "./GuidedTourOverlay";
import { GuidedTourPointer } from "./GuidedTourPointer";
import { GuidedTourCard } from "./GuidedTourCard";
import { GuidedTourWelcome, type WelcomeCopy } from "./GuidedTourWelcome";
import "./guided-tour.css";

/** Sélectionne le tour proposé selon la route (public sur `/`, My CloneStore sur
 *  `/profile`, cockpit Pierre sur `/agents/pierre/use`). */
function selectContextualTour(pathname: string): { tour: Tour; welcome: WelcomeCopy } | null {
  if (pathname === "/") return { tour: PUBLIC_DISCOVERY_TOUR, welcome: PUBLIC_DISCOVERY_WELCOME };
  if (pathname === "/profile") return { tour: MY_CLONESTORE_TOUR, welcome: MY_CLONESTORE_WELCOME };
  if (pathname === "/agents/pierre/use") return { tour: PIERRE_COCKPIT_TOUR, welcome: PIERRE_COCKPIT_WELCOME };
  if (pathname === "/assistant") return { tour: CLONECHAT_TOUR, welcome: CLONECHAT_WELCOME };
  return null;
}

const TARGET_POLL_INTERVAL = 90;
const TARGET_POLL_TIMEOUT = 3200;
const WELCOME_DELAY = 1200;
const CLOSE_FADE = 320;
const SNOOZE_MS = 24 * 60 * 60 * 1000; // « Plus tard » : reproposé après 24 h
const DEFAULT_VIEWPORT: Viewport = { width: 1280, height: 800 };
const DEFAULT_CARD_SIZE: Size = { width: 340, height: 220 };

/** Géométrie résolue POUR une étape identifiée (anti stale-step). */
type Resolution = { key: string; rect: Rect | null };

function nowMs(): number {
  return new Date().getTime();
}

function nowIso(): string {
  return new Date().toISOString();
}

function getLocalStore(): KeyValueStore | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readViewport(): Viewport {
  if (typeof window === "undefined") return DEFAULT_VIEWPORT;
  return { width: window.innerWidth, height: window.innerHeight };
}

type WelcomeState = { atStep: number; tourId: string; copy: WelcomeCopy } | null;

export function GuidedTourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;

  const activeTourRef = useRef<Tour | null>(null);
  const storeRef = useRef<KeyValueStore | null>(null);
  const stepElRef = useRef<HTMLElement | null>(null);

  const [state, dispatch] = useReducer(
    (prev: TourState, action: TourAction) => tourReducer(prev, action, activeTourRef.current),
    IDLE_STATE,
  );

  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [cardSize, setCardSize] = useState<Size>(DEFAULT_CARD_SIZE);
  const [welcome, setWelcome] = useState<WelcomeState>(null);
  const [hydrated, setHydrated] = useState(false);

  const running = state.status === "running";
  const currentStep: TourStep | null = selectCurrentStep(state, activeTourRef.current);
  const currentKey = stepResolutionKey(state);

  // ready === true UNIQUEMENT si la géométrie stockée a été résolue pour l'étape
  // EXACTEMENT courante. Sinon (transition, navigation) → aucune UI d'étape.
  const ready = running && !!currentStep && isResolutionReady(resolution?.key, currentKey);
  const targetRect: Rect | null = ready ? (resolution?.rect ?? null) : null;

  // Source de lancement du prochain tour (analytics uniquement) : "manual" si déclenché par une
  // action utilisateur (startTour / acceptWelcome), "automatic" pour une reprise au montage.
  const tourLaunchSourceRef = useRef<"automatic" | "manual">("automatic");

  // — Actions —
  const startTour = useCallback((tourId: string, options?: { atStep?: number }) => {
    const tour = getTour(tourId);
    if (!tour) return;
    activeTourRef.current = tour;
    tourLaunchSourceRef.current = "manual";
    setWelcome(null);
    dispatch({ type: "START", tour, atStep: options?.atStep });
  }, []);

  const next = useCallback(() => dispatch({ type: "NEXT" }), []);
  const prev = useCallback(() => dispatch({ type: "PREV" }), []);
  const goTo = useCallback((index: number) => dispatch({ type: "GO_TO", index }), []);
  const skip = useCallback(() => dispatch({ type: "SKIP" }), []);
  const finish = useCallback(() => dispatch({ type: "COMPLETE" }), []);
  const stop = useCallback(() => dispatch({ type: "STOP" }), []);

  // — Montage : store local + viewport réel + auto-resume d'un tour en cours.
  useEffect(() => {
    storeRef.current = getLocalStore();
    setViewport(readViewport());
    // Reprise : on relance le tour RÉELLEMENT en cours (auth prioritaire), quelle
    // que soit la page — préserve la reprise cross-route du tour public.
    const clonechatResume = resolveResumeIndex(storeRef.current, CLONECHAT_TOUR);
    const cockpitResume = resolveResumeIndex(storeRef.current, PIERRE_COCKPIT_TOUR);
    const authResume = resolveResumeIndex(storeRef.current, MY_CLONESTORE_TOUR);
    const publicResume = resolveResumeIndex(storeRef.current, PUBLIC_DISCOVERY_TOUR);
    if (clonechatResume != null) {
      activeTourRef.current = CLONECHAT_TOUR;
      dispatch({ type: "START", tour: CLONECHAT_TOUR, atStep: clonechatResume });
    } else if (cockpitResume != null) {
      activeTourRef.current = PIERRE_COCKPIT_TOUR;
      dispatch({ type: "START", tour: PIERRE_COCKPIT_TOUR, atStep: cockpitResume });
    } else if (authResume != null) {
      activeTourRef.current = MY_CLONESTORE_TOUR;
      dispatch({ type: "START", tour: MY_CLONESTORE_TOUR, atStep: authResume });
    } else if (publicResume != null) {
      activeTourRef.current = PUBLIC_DISCOVERY_TOUR;
      dispatch({ type: "START", tour: PUBLIC_DISCOVERY_TOUR, atStep: publicResume });
    }
    setHydrated(true);
  }, []);

  // — Persistance : à chaque changement d'état actif.
  useEffect(() => {
    if (!state.tourId || state.status === "idle") return;
    writeProgress(storeRef.current, {
      tourId: state.tourId,
      version: state.version ?? 0,
      status: state.status,
      stepIndex: state.stepIndex,
      updatedAt: nowIso(),
    });
  }, [state]);

  // — Clôture douce : completed/skipped → fondu → idle (STOP).
  useEffect(() => {
    if (state.status !== "completed" && state.status !== "skipped") return;
    const timer = setTimeout(() => dispatch({ type: "STOP" }), reduced ? 0 : CLOSE_FADE);
    return () => clearTimeout(timer);
  }, [state.status, reduced]);

  // — Analytics canonique (additif, pure observation) : émet started/step_completed/completed/
  //   skipped à partir des transitions de la machine à états. Aucune influence sur l'UI.
  const tourAnalyticsRef = useRef<{ tourId: string | null; startedFor: string | null; lastStepIndex: number; endedFor: string | null }>({
    tourId: null, startedFor: null, lastStepIndex: -1, endedFor: null,
  });
  useEffect(() => {
    const a = tourAnalyticsRef.current;
    const tourId = state.tourId ?? null;
    if (!tourId) return;
    const pv = currentPageViewId() ?? undefined;

    if (state.status === "running") {
      if (a.startedFor !== tourId) {
        a.startedFor = tourId;
        a.tourId = tourId;
        a.lastStepIndex = -1;
        a.endedFor = null;
        track("guided_tour_started", {
          pageViewId: pv,
          properties: { tourId: tourId.slice(0, 64), ctaKey: tourLaunchSourceRef.current },
          dedupeKey: `guided_tour_started:${tourId}`,
        });
      }
      if (state.stepIndex !== a.lastStepIndex) {
        a.lastStepIndex = state.stepIndex;
        track("guided_tour_step_completed", {
          pageViewId: pv,
          stepId: `${tourId.slice(0, 40)}:${state.stepIndex}`,
          properties: { tourId: tourId.slice(0, 64) },
          dedupeKey: `guided_tour_step:${tourId}:${state.stepIndex}`,
        });
      }
    } else if (state.status === "completed" && a.endedFor !== tourId) {
      a.endedFor = tourId;
      track("guided_tour_completed", {
        pageViewId: pv,
        properties: { tourId: tourId.slice(0, 64) },
        dedupeKey: `guided_tour_completed:${tourId}`,
      });
    } else if (state.status === "skipped" && a.endedFor !== tourId) {
      a.endedFor = tourId;
      track("guided_tour_skipped", {
        pageViewId: pv,
        properties: { tourId: tourId.slice(0, 64) },
        dedupeKey: `guided_tour_skipped:${tourId}`,
      });
    }
    // Reset launch source once consumed (next automatic resume defaults to "automatic").
    if (state.status === "idle") tourLaunchSourceRef.current = "automatic";
  }, [state.status, state.tourId, state.stepIndex]);

  // — Résolution de la cible de l'étape courante, ESTAMPILLÉE par sa clé :
  //   route change (push + attente), attente d'apparition (polling + timeout),
  //   scroll INTELLIGENT, repli centré si absente.
  useEffect(() => {
    if (state.status !== "running") {
      stepElRef.current = null;
      setResolution(null);
      return;
    }
    const tour = activeTourRef.current;
    const step = tour ? tour.steps[state.stepIndex] : null;
    const key = stepResolutionKey(state);
    if (!step || !key) return;

    // Nouvelle étape : on invalide la résolution → l'UI est masquée le temps de résoudre.
    setResolution(null);
    stepElRef.current = null;

    if (step.route && pathname !== step.route) {
      router.push(step.route);
      return; // l'effet se rejoue au changement de pathname
    }

    if (!step.targetId) {
      setResolution({ key, rect: null }); // étape centrée, prête
      return;
    }

    let cancelled = false;
    let elapsed = 0;
    let timer: ReturnType<typeof setTimeout>;
    const selector = tourTargetSelector(step.targetId);

    const finalize = (el: HTMLElement) => {
      stepElRef.current = el;
      const before = el.getBoundingClientRect();
      const rect: Rect = { top: before.top, left: before.left, width: before.width, height: before.height };
      if (shouldScrollToTarget(rect, readViewport())) {
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center", inline: "nearest" });
      }
      const after = el.getBoundingClientRect();
      setViewport(readViewport());
      setResolution({
        key,
        rect: { top: after.top, left: after.left, width: after.width, height: after.height },
      });
    };

    const attempt = () => {
      if (cancelled || typeof document === "undefined") return;
      const el = document.querySelector(selector) as HTMLElement | null;
      const rr = el?.getBoundingClientRect();
      if (el && rr && (rr.width > 0 || rr.height > 0)) {
        finalize(el);
        return;
      }
      elapsed += TARGET_POLL_INTERVAL;
      if (elapsed >= TARGET_POLL_TIMEOUT) {
        stepElRef.current = null;
        setResolution({ key, rect: null }); // cible absente → repli centré
        return;
      }
      timer = setTimeout(attempt, TARGET_POLL_INTERVAL);
    };

    timer = setTimeout(attempt, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state, pathname, router, reduced]);

  // — Recalcul au scroll / resize (met à jour la géométrie SANS changer la clé).
  useEffect(() => {
    if (state.status !== "running" || typeof window === "undefined") return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setViewport(readViewport());
        const el = stepElRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setResolution((prev) =>
          prev && prev.rect
            ? { key: prev.key, rect: { top: r.top, left: r.left, width: r.width, height: r.height } }
            : prev,
        );
      });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [state.status]);

  // — Clavier : Escape (passer), flèches (précédent/suivant).
  useEffect(() => {
    if (state.status !== "running" || typeof document === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.status, skip, next, prev]);

  // — Accessibilité : focus initial sauvegardé, arrière-plan inert + aria-hidden
  //   RÉVERSIBLE, restauration exacte au cleanup avec REPLI déterministe si
  //   l'élément d'origine a disparu (ex. changement de route).
  useEffect(() => {
    if (state.status !== "running" || typeof document === "undefined") return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const bg = Array.from(document.body.children).filter(
      (el) => !el.hasAttribute("data-guided-tour"),
    ) as HTMLElement[];
    const saved = bg.map((el) => ({
      el,
      ariaHidden: el.getAttribute("aria-hidden"),
      inert: el.inert,
    }));
    for (const el of bg) {
      el.setAttribute("aria-hidden", "true");
      el.inert = true;
    }
    return () => {
      for (const entry of saved) {
        if (entry.ariaHidden === null) entry.el.removeAttribute("aria-hidden");
        else entry.el.setAttribute("aria-hidden", entry.ariaHidden);
        entry.el.inert = entry.inert;
      }
      // Restauration du focus : l'élément d'origine s'il est encore connecté,
      // sinon un repli accessible et déterministe (marque de marque / main de la
      // route courante). La sélection est déléguée à un helper PUR et testé.
      const fallback =
        (document.querySelector('a[href="/"]') as HTMLElement | null) ??
        (document.querySelector("main a, main button, main [tabindex]") as HTMLElement | null);
      const restoreTarget = selectFocusRestoreTarget(previousFocus, fallback);
      restoreTarget?.focus?.();
    };
  }, [state.status]);

  // — Invitation de bienvenue CONTEXTUELLE (public sur `/`, authentifié sur
  //   `/profile`), 1ʳᵉ visite, non intrusive, hors snooze. Sur `/profile`, un
  //   visiteur anonyme est redirigé vers /login avant le délai → seule une
  //   session authentifiée voit l'invitation.
  //
  // DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — arbitrage anti-collision : il
  // ne doit jamais exister deux invitations flottantes automatiques simultanées sur
  // la homepage. Quand le nouveau prompt contextuel démo est activé
  // (NEXT_PUBLIC_DEMO_CONTEXTUAL_PROMPT_ENABLED=true), l'accueil AUTOMATIQUE du tour
  // public sur `/` est supprimé — mais uniquement l'auto-affichage sur cette route
  // précise : le lancement manuel du tour (startTour/acceptWelcome), les tours des
  // autres routes (/profile, /agents/pierre/use, /assistant), le stockage
  // (shouldOfferTour/writeSnooze/readProgress) et l'accessibilité restent
  // intégralement inchangés. Voir DEMO_CONTEXTUAL_PROMPT_SPEC.md.
  useEffect(() => {
    if (!hydrated) return;
    if (running) {
      setWelcome(null);
      return;
    }
    if (shouldSuppressHomepageAutoWelcome(pathname ?? "", isDemoContextualPromptEnabled())) {
      setWelcome(null);
      return;
    }
    const ctx = selectContextualTour(pathname);
    if (!ctx) {
      setWelcome(null);
      return;
    }
    if (!shouldOfferTour(storeRef.current, ctx.tour, nowMs())) {
      setWelcome(null);
      return;
    }
    const timer = setTimeout(() => {
      // Ne proposer que si l'ancre de la 1ʳᵉ étape existe réellement (ex. cockpit
      // rendu, pas l'écran d'accès verrouillé) → jamais d'invitation hors contexte.
      const firstTarget = ctx.tour.steps[0]?.targetId;
      if (firstTarget && typeof document !== "undefined") {
        const el = document.querySelector(tourTargetSelector(firstTarget));
        if (!el) return;
      }
      setWelcome({ atStep: 0, tourId: ctx.tour.id, copy: ctx.welcome });
    }, WELCOME_DELAY);
    return () => clearTimeout(timer);
  }, [hydrated, pathname, running]);

  const dismissWelcome = useCallback(() => {
    if (welcome) writeSnooze(storeRef.current, welcome.tourId, nowMs() + SNOOZE_MS);
    setWelcome(null);
  }, [welcome]);

  const acceptWelcome = useCallback(() => {
    if (!welcome) return;
    startTour(welcome.tourId, { atStep: welcome.atStep });
  }, [welcome, startTour]);

  const handleAction = useCallback(
    (action: TourStepAction) => {
      if (action.behavior === "navigate" && action.href) {
        finish();
        router.push(action.href);
      } else if (action.behavior === "finish") {
        finish();
      } else {
        next();
      }
    },
    [finish, next, router],
  );

  const handleMeasure = useCallback((size: Size) => {
    setCardSize(size);
  }, []);

  // — Placement carte + ancre pointeur : SOURCE DE VÉRITÉ UNIQUE.
  const placement: CardPlacement = useMemo(
    () => computeCardPlacement(targetRect, cardSize, viewport, currentStep?.placement ?? "bottom"),
    [targetRect, cardSize, viewport, currentStep?.placement],
  );
  const spotlightRect =
    targetRect && currentStep
      ? computeSpotlightRect(targetRect, currentStep.spotlightPadding ?? 8, viewport)
      : null;
  const pointerAnchor = targetRect ? computePointerAnchor(targetRect, placement.placement) : null;

  // — API du contexte —
  const api: GuidedTourApi = useMemo(() => {
    const tour = activeTourRef.current;
    return {
      status: state.status,
      activeTour: tour,
      currentStep,
      stepIndex: state.stepIndex,
      progress: selectProgress(state, tour),
      isFirst: isFirstStep(state),
      isLast: isLastStep(state, tour),
      isActive: running,
      startTour,
      next,
      prev,
      goTo,
      skip,
      finish,
      stop,
    };
  }, [state, currentStep, running, startTour, next, prev, goTo, skip, finish, stop]);

  const progress = selectProgress(state, activeTourRef.current);
  const portalActive =
    running ||
    !!welcome ||
    state.status === "completed" ||
    state.status === "skipped";
  const showStepUi = ready && !!currentStep;

  return (
    <GuidedTourContext.Provider value={api}>
      {children}
      {portalActive ? (
        <GuidedTourPortal>
          <AnimatePresence>
            {running ? (
              <motion.div
                key="csgt-layer"
                className="csgt-layer"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.28 }}
              >
                <GuidedTourOverlay
                  spotlight={showStepUi ? spotlightRect : null}
                  reduced={reduced}
                  stepKey={showStepUi ? currentKey ?? undefined : undefined}
                />

                <AnimatePresence mode="wait">
                  {showStepUi && pointerAnchor ? (
                    <GuidedTourPointer key={`ptr-${currentKey}`} anchor={pointerAnchor} reduced={reduced} />
                  ) : null}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {showStepUi ? (
                    <GuidedTourCard
                      key={`card-${currentKey}`}
                      step={currentStep}
                      placement={placement}
                      progress={progress}
                      isFirst={isFirstStep(state)}
                      isLast={isLastStep(state, activeTourRef.current)}
                      reduced={reduced}
                      onMeasure={handleMeasure}
                      onPrev={prev}
                      onNext={next}
                      onSkip={skip}
                      onFinish={finish}
                      onAction={handleAction}
                    />
                  ) : null}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {welcome && !running ? (
              <GuidedTourWelcome
                key="csgt-welcome"
                welcome={welcome.copy}
                reduced={reduced}
                onAccept={acceptWelcome}
                onDismiss={dismissWelcome}
              />
            ) : null}
          </AnimatePresence>
        </GuidedTourPortal>
      ) : null}
    </GuidedTourContext.Provider>
  );
}
