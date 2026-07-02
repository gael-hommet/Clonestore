import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Tests structurels (source) de la couche React du guided tour. L'environnement
// Vitest est `node` (pas de jsdom) : on vérifie le CÂBLAGE des comportements DOM
// exigés par les corrections P9.1 directement dans le code source. Ces tests
// structurels sont COMPLÉTÉS par une validation navigateur réelle (Playwright)
// documentée dans le rapport — ils ne la remplacent pas.

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

const DIR = "src/components/guided-tour";
const provider = read(`${DIR}/GuidedTourProvider.tsx`);
const portal = read(`${DIR}/GuidedTourPortal.tsx`);
const overlay = read(`${DIR}/GuidedTourOverlay.tsx`);
const pointer = read(`${DIR}/GuidedTourPointer.tsx`);
const card = read(`${DIR}/GuidedTourCard.tsx`);
const welcome = read(`${DIR}/GuidedTourWelcome.tsx`);
const controls = read(`${DIR}/GuidedTourControls.tsx`);
const css = read(`${DIR}/guided-tour.css`);

describe("Provider — cycle de vie & écouteurs", () => {
  it("est un composant client", () => {
    expect(provider.startsWith('"use client"')).toBe(true);
  });

  it("attache ET retire les écouteurs scroll/resize (aucune fuite)", () => {
    expect(provider).toContain('window.addEventListener("resize"');
    expect(provider).toContain('window.addEventListener("scroll"');
    expect(provider).toContain('window.removeEventListener("resize"');
    expect(provider).toContain('window.removeEventListener("scroll"');
  });

  it("recalcule via requestAnimationFrame et l'annule au cleanup", () => {
    expect(provider).toContain("requestAnimationFrame");
    expect(provider).toContain("cancelAnimationFrame");
  });

  it("clavier : Escape (passer), flèches (précédent/suivant)", () => {
    expect(provider).toContain('event.key === "Escape"');
    expect(provider).toContain('event.key === "ArrowRight"');
    expect(provider).toContain('event.key === "ArrowLeft"');
    expect(provider).toContain('document.addEventListener("keydown"');
    expect(provider).toContain('document.removeEventListener("keydown"');
  });

  it("ne monte le portail QUE lorsque le tour est actif (portalActive)", () => {
    expect(provider).toContain("portalActive");
    expect(provider).toContain("{portalActive ? (");
  });

  it("ne pose AUCUN scroll-lock global (rien à fuiter après fermeture)", () => {
    expect(provider).not.toContain("body.style.overflow");
    expect(provider).not.toContain("documentElement.style.overflow");
    expect(provider).not.toMatch(/overflow\s*=\s*["']hidden["']/);
  });

  it("respecte prefers-reduced-motion", () => {
    expect(provider).toContain("useReducedMotion");
  });
});

describe("Provider — Étape 2 : parcours multi-page & cible robuste", () => {
  it("navigue réellement entre routes (router.push)", () => {
    expect(provider).toContain("router.push(step.route)");
  });

  it("attend l'apparition de la cible (polling + timeout)", () => {
    expect(provider).toContain("TARGET_POLL_TIMEOUT");
    expect(provider).toContain("clearTimeout");
    expect(provider).toContain("querySelector(selector)");
  });

  it("anti stale-step : géométrie estampillée par la clé d'étape (identité de résolution)", () => {
    // La géométrie est stockée avec la clé exacte de l'étape.
    expect(provider).toContain("stepResolutionKey(state)");
    expect(provider).toContain("isResolutionReady(resolution?.key, currentKey)");
    expect(provider).toContain("setResolution({ key, rect");
    // targetRect n'est utilisé que si la résolution correspond à l'étape courante.
    expect(provider).toContain("ready ? (resolution?.rect ?? null) : null");
    // L'UI d'étape n'est rendue que via showStepUi (= ready).
    expect(provider).toContain("const showStepUi = ready");
    expect(provider).toContain("showStepUi ? (");
    // Le scroll/resize met à jour la géométrie SANS changer la clé.
    expect(provider).toContain("key: prev.key, rect:");
  });

  it("reprise cross-route après refresh (auto-resume au montage)", () => {
    expect(provider).toContain("resolveResumeIndex");
    expect(provider).toContain('dispatch({ type: "START"');
  });
});

describe("Provider — Étape 3 : transitions douces (sortie puis entrée)", () => {
  it("utilise AnimatePresence mode=\"wait\" pour carte et pointeur", () => {
    expect(provider).toContain('mode="wait"');
    expect(provider).toContain("AnimatePresence");
  });
});

describe("Provider — Étape 4 : pointeur sur le placement RÉSOLU (source unique)", () => {
  it("calcule le placement de la carte dans le provider", () => {
    expect(provider).toContain("computeCardPlacement");
  });
  it("ancre le pointeur sur placement.placement (résolu), pas step.placement", () => {
    expect(provider).toContain("computePointerAnchor(targetRect, placement.placement)");
    expect(provider).not.toContain("computePointerAnchor(targetRect, currentStep");
  });
});

describe("Provider — Étape 5 : auto-scroll intelligent", () => {
  it("ne scrolle que si nécessaire (shouldScrollToTarget)", () => {
    expect(provider).toContain("shouldScrollToTarget");
    expect(provider).toContain("scrollIntoView");
  });
  it("smooth hors reduced-motion, auto sinon", () => {
    expect(provider).toContain('behavior: reduced ? "auto" : "smooth"');
  });
});

describe("Provider — Étape 6 : « Plus tard » = snooze, pas skip", () => {
  it("le dismiss écrit un snooze et ne marque pas skipped", () => {
    expect(provider).toContain("writeSnooze");
    // dismissWelcome ne doit pas écrire de progression skipped.
    expect(provider).not.toMatch(/dismissWelcome[\s\S]*?status:\s*"skipped"/);
  });
});

describe("Provider — Étape 7 : accessibilité réelle", () => {
  it("sauvegarde le focus initial et le restaure au cleanup", () => {
    expect(provider).toContain("document.activeElement");
    expect(provider).toContain("restoreTarget?.focus?.()");
  });

  it("repli déterministe si l'élément d'origine a disparu (nœud détaché)", () => {
    expect(provider).toContain("selectFocusRestoreTarget(previousFocus, fallback)");
    expect(provider).toContain('document.querySelector(\'a[href="/"]\')');
  });
  it("applique inert + aria-hidden à l'arrière-plan puis restaure exactement", () => {
    expect(provider).toContain("el.inert = true");
    expect(provider).toContain('setAttribute("aria-hidden", "true")');
    expect(provider).toContain('removeAttribute("aria-hidden")');
    expect(provider).toContain("entry.el.inert = entry.inert");
  });
  it("exclut le portail du blocage arrière-plan", () => {
    expect(provider).toContain('hasAttribute("data-guided-tour")');
  });
});

describe("Portal — montage dans <body>", () => {
  it("porte le contenu dans document.body via createPortal, en display:contents", () => {
    expect(portal).toContain("createPortal");
    expect(portal).toContain("document.body");
    expect(portal).toContain('display: "contents"');
  });
  it("ne rend rien avant hydratation", () => {
    expect(portal).toContain("if (!mounted");
    expect(portal).toContain("return null");
  });
});

describe("Overlay — flou, spotlight, blocage, sortie de liseré", () => {
  it("trois couches : block (clics), scrim (flou/teinte), ring (liseré)", () => {
    expect(overlay).toContain("csgt-block");
    expect(overlay).toContain("csgt-scrim");
    expect(overlay).toContain("csgt-ring");
  });
  it("le liseré s'anime en entrée/sortie (AnimatePresence)", () => {
    expect(overlay).toContain("AnimatePresence");
    expect(overlay).toContain("exit=");
  });
});

describe("Pointeur — SVG premium (pas d'emoji), entrée/sortie", () => {
  it("est un SVG avec halo, pas une image/emoji", () => {
    expect(pointer).toContain("<svg");
    expect(pointer).toContain("csgt-pointer__halo");
    expect(/\p{Extended_Pictographic}/u.test(pointer)).toBe(false);
  });
  it("a une animation de sortie", () => {
    expect(pointer).toContain("exit=");
  });
});

describe("Card — dialog, focus, focus-trap, mesure, sortie", () => {
  it("dialog accessible", () => {
    expect(card).toContain('role="dialog"');
    expect(card).toContain('aria-modal="true"');
  });
  it("prend le focus à chaque étape", () => {
    expect(card).toContain("cardRef.current?.focus()");
  });
  it("focus-trap au Tab", () => {
    expect(card).toContain('event.key !== "Tab"');
  });
  it("remonte sa taille mesurée au provider (placement partagé)", () => {
    expect(card).toContain("onMeasure");
    expect(card).toContain("useLayoutEffect");
    expect(card).toContain("placement.top");
    expect(card).toContain("placement.placement");
  });
  it("a une animation de sortie", () => {
    expect(card).toContain("exit=");
  });
});

describe("Welcome — invitation discrète, non intrusive", () => {
  it("propose et permet de refuser sans blocage", () => {
    expect(welcome).toContain("onAccept");
    expect(welcome).toContain("onDismiss");
    expect(welcome).toContain("csgt-welcome");
  });
});

describe("Controls — navigation & actions", () => {
  it("expose passer / précédent / suivant / terminer", () => {
    expect(controls).toContain("Passer");
    expect(controls).toContain("Précédent");
    expect(controls).toContain("Suivant");
    expect(controls).toContain("Terminer");
  });
});

describe("CSS — réutilise les tokens, ne remplace aucun style global", () => {
  it("floute l'arrière-plan et découpe un trou pour la cible", () => {
    expect(css).toContain("backdrop-filter");
    expect(css).toContain("mask: radial-gradient");
  });
  it("réutilise les tokens CloneStore (--cs-*)", () => {
    expect(css).toContain("var(--cs-");
    expect(css).toContain("--cs-graphite");
    expect(css).toContain("--cs-violet");
  });
  it("toutes les classes sont préfixées csgt- (aucun sélecteur global)", () => {
    expect(css).not.toMatch(/^\s*(body|html|:root|\*)\s*[,{]/m);
    const classSelectors = css.match(/\.[a-zA-Z][\w-]*/g) ?? [];
    for (const sel of classSelectors) {
      expect(sel.startsWith(".csgt-")).toBe(true);
    }
  });
});
