import type { CloneChatConfidence } from "../care/contracts";
import type { ScreenshotResult } from "../openai/screenshot";
import { ROUTE_REGISTRY, getRouteEntry, routeLabel } from "../../nav/route-registry";
// C1.8 BLOC C — registre officiel des surfaces : reconnaître une page par ses signaux DISTINCTIFS
// quand la capture ne montre aucun chemin (cas des captures de contenu, sans barre d'adresse).
import { matchSurface } from "./surface-registry";

export type InspectorConfidence = CloneChatConfidence;

type ScreenshotAnalysisContract = NonNullable<ScreenshotResult["analysis"]>;

export type ScreenshotAnalysis = ScreenshotAnalysisContract;

export interface InspectorInput {
  /** L'analyse produite par le fournisseur. `null` = aucune image n'a atteint le modele. */
  analysis: ScreenshotAnalysis | null;
  /** Nombre d'images REELLEMENT transmises au fournisseur (mesure cote serveur). */
  imagesSentToProvider: number;
  /** Route REELLE de l'utilisateur, resolue par l'application (jamais declaree par l'utilisateur). */
  currentRoute: string | null;
  /** Texte du message de l'utilisateur. */
  message: string;
}

export interface InspectorResult {
  screenshot_received: boolean;
  likely_page: string | null;
  likely_route: string | null;
  confidence: InspectorConfidence;
  observed: string[];
  visible_error: string | null;
  probable_problem: string | null;
  missing: string[];
  next_action: string | null;
  navigation_target: { href: string; label: string } | null;
  needs_another_screenshot: boolean;
  cannot_conclude: boolean;
  escalate: boolean;
  reason: string;
}

interface RouteMatch {
  path: string;
  label: string;
}

const ERROR_PATTERN = /\b(?:erreur|error|echec|échec|impossible|refuse|refusé|4\d\d|5\d\d)\b/i;
const CLONESTORE_PATTERN = /\b(?:clonestore|pierre|clonechat)\b/i;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPath(text: string, path: string): boolean {
  const source = normalizeText(text);
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) return false;
  const pattern = new RegExp(`(^|[^a-z0-9/])${escapeRegExp(normalizedPath)}($|[?#]|[^a-z0-9/])`, "i");
  return pattern.test(source);
}

/**
 * CORRECTION CLAUDE (revue de la frappe STRIKE-01).
 *
 * Un libellé ne prouve une page que s'il est DISTINCTIF. Le registre contient des libellés d'un
 * seul mot — celui de `/agents/pierre` est littéralement « Pierre » — or « Pierre » apparaît sur
 * quasiment tous les écrans de CloneStore. Résultat mesuré avant correction : une capture du
 * COCKPIT, dont le résumé mentionnait « Pierre » dans l'en-tête, était diagnostiquée comme la page
 * produit `/agents/pierre` avec une confiance « high » et `cannot_conclude: false`.
 *
 * C'est exactement le faux état que l'on s'interdit. Un libellé générique n'est donc PAS une
 * preuve : il faut soit le CHEMIN, soit un libellé réellement distinctif.
 */
const DISTINCTIVE_LABEL_MIN_CHARS = 12;

function isDistinctiveLabel(label: string): boolean {
  const n = normalizeText(label);
  const words = n.split(" ").filter(Boolean);
  return words.length >= 2 || n.length >= DISTINCTIVE_LABEL_MIN_CHARS;
}

function containsLabel(text: string, label: string): boolean {
  if (!isDistinctiveLabel(label)) return false; // « Pierre » ne prouve rien
  const source = normalizeText(text);
  const normalizedLabel = normalizeText(label);
  if (!normalizedLabel) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedLabel)}($|[^a-z0-9])`, "i");
  return pattern.test(source);
}

function captureTexts(analysis: ScreenshotAnalysis): string[] {
  return [analysis.summary, ...analysis.visibly_proven].filter((value) => typeof value === "string" && value.trim().length > 0);
}

function dropSubsumedLabelMatches(matches: RouteMatch[]): RouteMatch[] {
  const labels = matches.map((match) => ({ match, normalizedLabel: normalizeText(match.label) }));
  return labels
    .filter(({ match, normalizedLabel }) => {
      return !labels.some(({ match: otherMatch, normalizedLabel: otherLabel }) => {
        return otherMatch.path !== match.path
          && otherLabel.length > normalizedLabel.length
          && otherLabel.includes(normalizedLabel);
      });
    })
    .map(({ match }) => match);
}

function uniqueRouteMatch(matches: RouteMatch[]): RouteMatch | null {
  const uniqueByPath = Array.from(new Map(matches.map((match) => [match.path, match])).values());
  return uniqueByPath.length === 1 ? uniqueByPath[0] : null;
}

function findProvenRoute(analysis: ScreenshotAnalysis): RouteMatch | null {
  const texts = captureTexts(analysis);

  // Preuve 1 — le CHEMIN cité (la plus forte : une capture qui montre son URL/fil d'Ariane).
  const pathMatches = ROUTE_REGISTRY
    .filter((entry) => texts.some((text) => containsPath(text, entry.path)))
    .map((entry) => ({ path: entry.path, label: entry.label }));
  const exactPath = uniqueRouteMatch(pathMatches);
  if (exactPath) return exactPath;
  if (pathMatches.length > 1) return null;

  // Preuve 2 — la SURFACE officielle : plusieurs signaux distinctifs propres à une page.
  // C'est ce qui permet d'identifier une capture de CONTENU (sans URL visible) sans jamais
  // deviner à partir d'un mot générique. La route revient TOUJOURS du registre canonique.
  const surfaceRoute = matchSurface(texts.join(" "));
  if (surfaceRoute) {
    const entry = getRouteEntry(surfaceRoute);
    if (entry) return { path: entry.path, label: entry.label };
  }

  // Preuve 3 — un LIBELLÉ distinctif (multi-mots) cité tel quel.
  const labelMatches = ROUTE_REGISTRY
    .filter((entry) => texts.some((text) => containsLabel(text, entry.label)))
    .map((entry) => ({ path: entry.path, label: entry.label }));
  return uniqueRouteMatch(dropSubsumedLabelMatches(labelMatches));
}

function knownRoute(path: string | null): string | null {
  if (!path) return null;
  return getRouteEntry(path) ? path : null;
}

function analysisMentionsCloneStore(analysis: ScreenshotAnalysis): boolean {
  const allText = [
    analysis.summary,
    ...analysis.visibly_proven,
    ...analysis.inference,
    ...analysis.unknown,
    analysis.known_issue ?? "",
    analysis.next_action ?? "",
  ].join(" ");
  return CLONESTORE_PATTERN.test(normalizeText(allText));
}

function firstVisibleError(analysis: ScreenshotAnalysis): string | null {
  for (const item of analysis.visibly_proven) {
    if (ERROR_PATTERN.test(item)) return item;
  }
  return null;
}

function extractKnownRouteFromText(text: string | null): string | null {
  if (!text) return null;
  const matches = ROUTE_REGISTRY
    .filter((entry) => containsPath(text, entry.path))
    .map((entry) => entry.path);
  const unique = Array.from(new Set(matches));
  return unique.length === 1 ? unique[0] : null;
}

function buildReason(params: {
  screenshotReceived: boolean;
  contradiction: boolean;
  externalCapture: boolean;
  provenRoute: RouteMatch | null;
  currentRoute: string | null;
  visibleProofCount: number;
  visibleError: string | null;
}): string {
  if (!params.screenshotReceived) {
    return "Je ne peux pas conclure car aucune capture exploitable n'a ete transmise.";
  }

  if (params.contradiction) {
    const currentLabel = params.currentRoute ? routeLabel(params.currentRoute, params.currentRoute) : "la page courante";
    return `Je ne peux pas conclure car la capture pointe vers « ${params.provenRoute?.label ?? "une autre page"} » alors que la route reelle est « ${currentLabel} ».`;
  }

  if (params.provenRoute && params.currentRoute === params.provenRoute.path) {
    return `La capture prouve la page « ${params.provenRoute.label} » et elle correspond a la route reelle.`;
  }

  if (params.provenRoute) {
    return `La capture prouve la page « ${params.provenRoute.label} », sans route reelle pour la corroborer.`;
  }

  if (params.externalCapture) {
    return "Je ne peux pas conclure car la capture ne semble pas venir de CloneStore.";
  }

  if (params.visibleProofCount === 0) {
    return "Je ne peux pas conclure car la capture ne montre aucun element exploitable.";
  }

  if (params.visibleError) {
    return "Je ne peux pas conclure car une erreur est visible sans page CloneStore prouvee.";
  }

  return "Je ne peux pas conclure car la capture semble liee a CloneStore sans prouver une page du registre.";
}

function buildNextAction(params: {
  screenshotReceived: boolean;
  contradiction: boolean;
  externalCapture: boolean;
  navigationTarget: { href: string; label: string } | null;
  cannotConclude: boolean;
}): string | null {
  if (!params.screenshotReceived) return null;
  if (params.contradiction || params.externalCapture || params.cannotConclude) {
    return "Partagez une nouvelle capture nette de la page concernee.";
  }
  if (params.navigationTarget) {
    return `Ouvrez « ${params.navigationTarget.label} ».`;
  }
  return null;
}

export function inspectScreenshot(input: InspectorInput): InspectorResult {
  const screenshotReceived = input.analysis !== null && input.imagesSentToProvider > 0;
  if (!screenshotReceived || input.analysis === null) {
    return {
      screenshot_received: false,
      likely_page: null,
      likely_route: null,
      confidence: "unknown",
      observed: [],
      visible_error: null,
      probable_problem: null,
      missing: [],
      next_action: null,
      navigation_target: null,
      needs_another_screenshot: true,
      cannot_conclude: true,
      escalate: false,
      reason: "Je ne peux pas conclure car aucune capture exploitable n'a ete transmise.",
    };
  }

  const analysis = input.analysis;
  const provenRoute = findProvenRoute(analysis);
  const currentRoute = knownRoute(input.currentRoute);
  const contradiction = provenRoute !== null && currentRoute !== null && provenRoute.path !== currentRoute;
  const externalCapture = provenRoute === null && !analysisMentionsCloneStore(analysis);
  const visibleError = firstVisibleError(analysis);
  const probableProblem = analysis.known_issue ?? null;
  const nextActionRoute = contradiction || externalCapture ? null : extractKnownRouteFromText(analysis.next_action);
  const safeLikelyRoute = contradiction ? null : provenRoute?.path ?? null;
  const safeLikelyPage = safeLikelyRoute ? routeLabel(safeLikelyRoute, safeLikelyRoute) : null;
  const navigationRoute = contradiction || externalCapture ? null : nextActionRoute ?? safeLikelyRoute;
  const navigationTarget = navigationRoute
    ? { href: navigationRoute, label: routeLabel(navigationRoute, navigationRoute) }
    : null;

  let confidence: InspectorConfidence = "low";
  if (contradiction) {
    confidence = "medium";
  } else if (safeLikelyRoute && currentRoute === safeLikelyRoute) {
    confidence = "certain";
  } else if (safeLikelyRoute) {
    confidence = "high";
  } else if (analysis.visibly_proven.length === 0) {
    confidence = "low";
  }

  const cannotConclude = contradiction || safeLikelyRoute === null;
  const needsAnotherScreenshot = cannotConclude;
  const escalate = (probableProblem !== null && navigationTarget === null) || (visibleError !== null && safeLikelyRoute === null);
  const reason = buildReason({
    screenshotReceived: true,
    contradiction,
    externalCapture,
    provenRoute,
    currentRoute,
    visibleProofCount: analysis.visibly_proven.length,
    visibleError,
  });
  const nextAction = buildNextAction({
    screenshotReceived: true,
    contradiction,
    externalCapture,
    navigationTarget,
    cannotConclude,
  });

  return {
    screenshot_received: true,
    likely_page: safeLikelyPage,
    likely_route: safeLikelyRoute,
    confidence,
    observed: [...analysis.visibly_proven],
    visible_error: visibleError,
    probable_problem: probableProblem,
    missing: [...analysis.unknown],
    next_action: nextAction,
    navigation_target: navigationTarget,
    needs_another_screenshot: needsAnotherScreenshot,
    cannot_conclude: cannotConclude,
    escalate,
    reason,
  };
}
