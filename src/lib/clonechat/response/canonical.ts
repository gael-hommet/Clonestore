// src/lib/clonechat/response/canonical.ts
// C1.8 — BLOC A : UNE SEULE FORME DE RÉPONSE VISIBLE.
//
// La route canonique possédait autant de formes que de branches :
//
//   · `openai_public` / `public_fallback` → `structured.answer`
//   · `openai_vision`                    → `analysis` (objet), et AUCUN `structured`
//   · `image_unavailable`, `refused`, `public_blocked`, `rate_limited`… → encore autre chose
//
// L'interface devait donc connaître chaque source, une par une. C'est exactement ainsi qu'un
// champ finit par être renvoyé par le serveur et JAMAIS affiché (c'est arrivé à `analysis`).
//
// Ce module est PUR. Il prend N'IMPORTE quel corps de réponse de la route et en dérive UNE forme
// visible unique. Il ne remplace aucune branche : il les NORMALISE. Aucune seconde route, aucun
// second moteur.
//
// RÈGLE DURE : une réponse VIDE n'est jamais présentée comme terminée. Elle échoue de façon
// visible et rejouable — un assemblage partiel n'est pas une réponse.

import { validatedLinks } from "../links/safe-links";
// C1.8 BLOC C — CloneInspector : le JUGEMENT au-dessus de l'analyse d'image. Il ne remplace pas
// le fournisseur multimodal, il en exploite la sortie. Câblé ICI pour que le diagnostic soit
// RENDU (et non calculé puis jeté, comme l'a été `analysis` avant le bloc A).
import { inspectScreenshot, type InspectorResult } from "../inspector/cloneinspector";

export type RenderedHonesty =
  | "answered" | "clarification_required" | "unknown" | "blocked" | "escalated";

export interface RenderedLink {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly internal: boolean;
}

export interface RenderedAttachment {
  readonly name: string;
  readonly kind: "image" | "screenshot" | "document" | "file";
  /** VRAI seulement si le fichier a RÉELLEMENT atteint le modèle et produit quelque chose. */
  readonly analysed: boolean;
  /** La preuve, en clair. `null` quand il n'y en a pas — jamais une affirmation nue. */
  readonly provider_evidence: string | null;
  readonly detail: string | null;
}

export interface CloneChatRenderedResponse {
  readonly answer: string;
  readonly honesty: RenderedHonesty;
  readonly source: string;
  readonly citations: readonly { label: string; href?: string }[];
  readonly links: readonly RenderedLink[];
  readonly attachments: readonly RenderedAttachment[];
  /** Combien d'images ont RÉELLEMENT été transmises au fournisseur (mesuré, pas déclaré). */
  readonly images_sent_to_provider: number;
  readonly conversation_id: string | null;
  readonly persisted: boolean;
  /** Une erreur récupérable : l'utilisateur peut réessayer. Jamais un faux succès. */
  readonly retryable_error: string | null;
  /** Limite honnête à afficher à côté de la réponse (jamais confondue avec la réponse). */
  readonly limitation: string | null;
  readonly human_required: boolean;
  /** Diagnostic de capture d'écran — `null` si aucune image n'a atteint le modèle. */
  readonly inspector: InspectorResult | null;
}

type Json = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Rend LISIBLE une analyse d'image. Le serveur produisait un objet structuré que seule une
 * branche d'interface savait lire ; ici il devient du texte, comme toute autre réponse.
 */
function analysisToText(a: Json): string {
  const lines: string[] = [];
  const summary = str(a.summary).trim();
  if (summary) lines.push(summary);

  const proven = arr(a.visibly_proven).map(str).filter(Boolean);
  if (proven.length) lines.push("Ce que je vois : " + proven.join(" · "));

  const inferred = arr(a.inference).map(str).filter(Boolean);
  if (inferred.length) lines.push("Hypothèses (à confirmer) : " + inferred.join(" · "));

  const unknown = arr(a.unknown).map(str).filter(Boolean);
  if (unknown.length) lines.push("Ce que l'image ne montre pas : " + unknown.join(" · "));

  const next = str(a.next_action).trim();
  if (next) lines.push("Étape suivante : " + next);

  return lines.join("\n\n").trim();
}

/** Classe une pièce jointe d'après son nom — jamais d'après une déclaration du client. */
function attachmentKind(name: string): RenderedAttachment["kind"] {
  const n = name.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp)$/.test(n)) return /capture|screenshot|ecran|écran/.test(n) ? "screenshot" : "image";
  if (/\.(pdf|docx?|xlsx?|csv|txt|md|pptx?)$/.test(n)) return "document";
  return "file";
}

function normalizeAttachments(raw: unknown[]): RenderedAttachment[] {
  return raw.map((x) => {
    const a = (x ?? {}) as Json;
    const name = str(a.name) || "fichier";
    const state = str(a.state);
    // « analysé » n'est JAMAIS une politesse : seul l'état `analysed` le prouve.
    const analysed = state === "analysed";
    return {
      name,
      kind: attachmentKind(name),
      analysed,
      provider_evidence: analysed ? (str(a.detail) || "extraits fournis au modèle") : null,
      detail: str(a.detail) || null,
    };
  });
}

function mapHonesty(raw: string, humanRequired: boolean, blocked: boolean): RenderedHonesty {
  if (humanRequired) return "escalated";
  if (blocked) return "blocked";
  if (raw === "needs_clarification" || raw === "clarification_required") return "clarification_required";
  if (raw === "unknown" || raw === "source_missing" || raw === "unsupported" || raw === "permission_denied") return "unknown";
  if (raw === "answered") return "answered";
  return "unknown"; // valeur inconnue ⇒ on n'affirme pas « répondu »
}

/**
 * LE NORMALISATEUR. Toute branche de la route passe par ici — sans exception.
 *
 * `care` est l'enveloppe CloneCare (C1.8) : elle apporte les blocages prouvés et l'escalade.
 */
export function buildRenderedResponse(payload: Json, care?: Json | null): CloneChatRenderedResponse {
  const source = str(payload.source) || "unknown";
  const structured = (payload.structured ?? null) as Json | null;
  const analysis = (payload.analysis ?? null) as Json | null;

  const careDiag = ((care?.diagnosis ?? null) as Json | null) ?? null;
  const humanRequired = care?.human_required === true;
  const blockers = arr(care?.blockers);

  // ── 1. LE TEXTE VISIBLE ──────────────────────────────────────────────────────
  // Il vient de `structured.answer` si elle existe ; sinon d'une `analysis` rendue lisible.
  // C'est LA correction du défaut : une analyse d'image n'est plus une forme parallèle.
  let answer = str(structured?.answer).trim();
  let fromAnalysis = false;
  if (!answer && analysis) {
    answer = analysisToText(analysis);
    fromAnalysis = answer.length > 0;
  }

  // Un problème connu reconnu sur la capture enrichit la réponse — il ne la remplace pas.
  const knownIssue = (payload.knownIssue ?? null) as Json | null;
  if (answer && knownIssue) {
    const t = str(knownIssue.title).trim();
    const w = str(knownIssue.workaround).trim() || str(knownIssue.solution).trim();
    if (t) answer += `\n\nProblème connu : ${t}${w ? ` — ${w}` : ""}`;
  }

  // ── 2. FAIL-CLOSED : un assemblage vide n'est PAS une réponse ────────────────
  const retryableFromPayload = payload.ok === false ? (str(payload.error) || "Une erreur est survenue.") : null;
  let retryable: string | null = retryableFromPayload;
  if (!answer) {
    answer = "Je n'ai pas réussi à produire une réponse complète. Réessayez — et si cela se reproduit, dites-le-moi : je transmettrai.";
    retryable = retryable ?? "empty_answer";
  }

  // ── 3. HONNÊTETÉ ─────────────────────────────────────────────────────────────
  // Une image RÉELLEMENT analysée est une réponse : la branche vision ne porte aucun champ
  // `honesty`, et sans cette ligne un vrai diagnostic d'image serait affiché comme « je ne sais
  // pas ». Le fait est mesuré (des extraits ont été produits), il n'est pas supposé.
  const rawHonesty = fromAnalysis
    ? "answered"
    : (str(structured?.honesty) || str(careDiag?.status));
  const isBlocked = blockers.length > 0 && str(careDiag?.status) === "blocked";
  const honesty: RenderedHonesty = retryable === "empty_answer"
    ? "unknown"
    : mapHonesty(rawHonesty, humanRequired, isBlocked);

  // ── 4. LIENS — validés par le REGISTRE, jamais inventés ──────────────────────
  const rawLinksFromInspector: Array<{ route?: string; label?: string }> = [];
  const rawLinks: Array<{ route?: string; href?: string; label?: string }> = [];
  const cta = payload.cta as { route?: string; label?: string } | undefined;
  if (cta) rawLinks.push(cta);
  const suggested = payload.suggestedCTA as { route?: string; label?: string } | undefined;
  if (suggested) rawLinks.push(suggested);
  for (const l of arr(payload.relevantLinks)) rawLinks.push(l as { route?: string; label?: string });
  for (const b of blockers) {
    const bb = b as Json;
    const href = str(bb.next_step_href);
    if (href) rawLinks.push({ route: href, label: str(bb.next_step_label) });
  }
  // (les liens de CloneInspector sont ajoutés plus bas, puis validés comme tous les autres)

  // ── 5. PIÈCES JOINTES : état VÉRIDIQUE ──────────────────────────────────────
  const attachments = normalizeAttachments(arr(payload.attachments));

  // ── 6. LIMITE HONNÊTE — dite À CÔTÉ de la réponse, jamais à sa place ─────────
  let limitation: string | null = null;
  if (source === "image_unavailable") limitation = "L'image n'a pas pu être traitée.";
  else if (blockers.length > 0) limitation = str((blockers[0] as Json).message) || null;
  else if (str(payload.prerequisiteMessage)) limitation = str(payload.prerequisiteMessage);

  // ── CLONEINSPECTOR — uniquement s'il y a VRAIMENT eu une image ──────────────
  const imagesSent = typeof payload.imagesSentToProvider === "number" ? payload.imagesSentToProvider : 0;
  const inspector = analysis
    ? inspectScreenshot({
        analysis: analysis as never,
        imagesSentToProvider: imagesSent,
        // La route COURANTE vient du serveur/registre — jamais d'une déclaration de l'utilisateur.
        currentRoute: str(care?.page_route) || null,
        message: str(payload.message),
      })
    : null;

  // Un diagnostic exploitable enrichit la réponse. Un aveu d'ignorance aussi : il est DIT.
  if (inspector && inspector.screenshot_received) {
    if (inspector.cannot_conclude) {
      answer += `

${inspector.reason}`;
    } else if (inspector.likely_page) {
      answer += `

Page reconnue : ${inspector.likely_page} (confiance : ${inspector.confidence}).`;
      if (inspector.next_action) answer += ` ${inspector.next_action}`;
    }
    if (inspector.navigation_target) {
      rawLinksFromInspector.push({ route: inspector.navigation_target.href, label: inspector.navigation_target.label });
    }
  }

  const citations = arr(structured?.citations)
    .map((c) => (typeof c === "string" ? { label: c } : { label: str((c as Json).label) }))
    .filter((c) => c.label.length > 0);

  // Le lien proposé par CloneInspector passe EXACTEMENT par les mêmes protections que les autres.
  const links = validatedLinks([...rawLinks, ...rawLinksFromInspector])
    .map((l) => ({ id: l.id, label: l.label, href: l.href, internal: l.internal }));

  return Object.freeze({
    answer,
    honesty,
    source,
    citations: Object.freeze(citations),
    links: Object.freeze(links),
    attachments: Object.freeze(attachments),
    images_sent_to_provider: typeof payload.imagesSentToProvider === "number" ? payload.imagesSentToProvider : 0,
    conversation_id: str(payload.conversation_id) || null,
    persisted: payload.durable === true,
    retryable_error: retryable,
    limitation,
    human_required: humanRequired,
    inspector,
  });
}
