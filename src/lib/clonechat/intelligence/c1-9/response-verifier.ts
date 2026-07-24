// C1.9 — VÉRIFICATEUR FINAL.
//
// Différence essentielle avec l'existant : en cas d'échec on CORRIGE, on demande une
// précision, ou on bloque honnêtement. On ne substitue jamais un paragraphe pré-écrit.
//
// La garde de claims reste un plancher de sécurité, mais devient RÉPARATRICE : elle
// excise la phrase fautive au lieu de jeter toute la réponse. Cela corrige deux défauts
// mesurés : la substitution tout-ou-rien (D7 hors streaming) et l'injection d'un pavé
// canné au milieu d'un flux (D7 en streaming).
import { checkAnswerTextSafety } from "../c1/clonechat-claims-policy";
import type { TruthContext } from "./truth-context";
import { citableIds } from "./truth-context";
import type { ResponsePlan } from "./response-composer";
import type { ToolExecutionOutcome } from "./governed-tools";
import { tokenize } from "./semantic-retrieval";
import {
  allowedRoutePathsFor,
  findUnsolicitedSentences,
  DEPTH_SENTENCE_CEILING,
} from "./response-relevance";

export type VerdictAction = "accept" | "repaired" | "clarify" | "block";

export interface VerificationIssue {
  readonly code: string;
  readonly detail: string;
  readonly severity: "minor" | "major";
}

export interface Verdict {
  readonly action: VerdictAction;
  readonly text: string;
  readonly citations: readonly string[];
  readonly issues: readonly VerificationIssue[];
  /** Points du contrat de couverture qui ne sont pas traités. */
  readonly uncoveredGoals: readonly string[];
}

export interface VerifyInput {
  readonly answer: string;
  readonly citations: readonly string[];
  readonly plan: ResponsePlan;
  readonly truth: TruthContext;
  readonly toolOutcomes: readonly ToolExecutionOutcome[];
}

/** Découpe en phrases en conservant la ponctuation finale. */
function splitSentences(text: string): readonly string[] {
  return text.split(/(?<=[.!?…])\s+/).filter((s) => s.trim().length > 0);
}

/**
 * Une revendication d'action effectuée. CloneChat prépare ; il n'exécute pas.
 * Motifs volontairement étroits et ancrés — ce sont des affirmations d'EFFET RÉALISÉ,
 * pas des mots-clés de sujet.
 */
const CLAIMED_EXECUTION = /\b(j'ai (?:envoyé|signé|créé|supprimé|payé|débité|activé|résilié)|c'est (?:envoyé|signé|fait|activé)|je viens de (?:le |l')?(?:envoyer|signer|créer|activer))\b/i;

/** Un montant présenté comme certain alors qu'il est dérivé. */
const BARE_AMOUNT = /\b\d[\d\s.,]*\s?(?:€|eur|euros|chf)\b/i;
/**
 * Une GRANDEUR dérivée non monétaire : heures, jours, pourcentages.
 *
 * Trouvé par la campagne réelle : le modèle a produit « 17 heures par mois » et
 * « 5 à 10 heures » alors qu'aucun outil ni aucune source ne les fournissait. Ne
 * contrôler que les montants en euros laissait passer l'invention la plus fréquente
 * dans une conversation de productivité.
 */
const BARE_QUANTITY = /\b\d[\d\s.,]*\s?(?:heures?|jours?|%|pour\s?cent)\b/i;
const ESTIMATION_MARK = /\b(estimation|estim[ée]|ordre de grandeur|environ|autour de|fourchette|hypoth[èe]se|approximat|je pars du principe|si l'on retient)\b/i;
/** Marqueur de citation laissé dans la prose : il appartient au champ `citations`. */
const INLINE_CITATION = /\[[a-z0-9][a-z0-9._/#-]*\]/gi;

export function verifyResponse(input: VerifyInput): Verdict {
  const issues: VerificationIssue[] = [];
  let text = input.answer;

  // ── 1) Plancher de sécurité, en mode RÉPARATION ────────────────────────────
  const safety = checkAnswerTextSafety(text);
  if (!safety.safe) {
    const sentences = splitSentences(text);
    const kept = sentences.filter((s) => checkAnswerTextSafety(s).safe);
    if (kept.length > 0 && kept.length < sentences.length) {
      // On retire la ou les phrases fautives et on garde la réponse. L'espace inter-phrase
      // est explicitement restitué — l'ancien assemblage le perdait (« précisément.Pour »).
      text = kept.join(" ").replace(/\s+/g, " ").trim();
      issues.push({
        code: "CLAIM_SENTENCE_REMOVED",
        detail: `${sentences.length - kept.length} phrase(s) retirée(s) : ${safety.violations.map((v) => v.ruleId).join(", ")}`,
        severity: "major",
      });
    } else {
      // Toute la réponse est fautive : on BLOQUE honnêtement, sans prétendre répondre.
      return Object.freeze({
        action: "block" as const,
        text: "",
        citations: Object.freeze([]),
        issues: Object.freeze([{
          code: "CLAIM_POLICY_BLOCK",
          detail: safety.violations.map((v) => v.ruleId).join(", "),
          severity: "major" as const,
        }]),
        uncoveredGoals: input.plan.coverage,
      });
    }
  }

  // ── 2) Citations : ne garder que les identifiants réellement fournis ───────
  const allowed = new Set(citableIds(input.truth));
  const validCitations = input.citations.filter((c) => allowed.has(c));
  if (validCitations.length < input.citations.length) {
    issues.push({
      code: "CITATION_DROPPED",
      detail: `${input.citations.length - validCitations.length} citation(s) absente(s) du contexte fourni`,
      severity: "minor",
    });
  }

  // ── 3) Aucune action prétendue exécutée ───────────────────────────────────
  if (CLAIMED_EXECUTION.test(text)) {
    issues.push({ code: "FALSE_EXECUTION_CLAIM", detail: "la réponse affirme avoir exécuté une action", severity: "major" });
  }
  for (const t of input.toolOutcomes) {
    if (!t.executed && text.toLowerCase().includes(t.toolId.replace(/_/g, " "))) {
      issues.push({ code: "UNEXECUTED_TOOL_MENTIONED", detail: t.toolId, severity: "minor" });
    }
  }

  // ── 4) Une valeur dérivée doit être annoncée comme telle ──────────────────
  const officialAmounts = input.truth.facts
    .filter((f) => f.evidence === "official" && /\d/.test(f.value))
    .map((f) => f.value.replace(/\s+/g, " "));
  if (BARE_AMOUNT.test(text) && !ESTIMATION_MARK.test(text)) {
    const mentionsOnlyOfficial = officialAmounts.some((v) => text.includes(v.split(" ")[0]));
    if (!mentionsOnlyOfficial) {
      issues.push({ code: "UNMARKED_DERIVED_AMOUNT", detail: "montant présenté sans marque d'estimation", severity: "major" });
    }
  }
  // Une grandeur (heures, jours, %) n'est légitime que si un outil l'a CALCULÉE ou si
  // elle est annoncée comme une estimation. Sinon c'est une invention.
  if (BARE_QUANTITY.test(text)) {
    const toolProducedQuantity = input.toolOutcomes.some((t) => t.executed && t.result !== null);
    if (!toolProducedQuantity && !ESTIMATION_MARK.test(text)) {
      issues.push({ code: "UNSOURCED_QUANTITY", detail: "grandeur chiffrée sans outil ni marque d'estimation", severity: "major" });
    }
  }

  // ── 4bis) Aucun marqueur de citation ne doit rester dans la prose ─────────
  const inlineCitations = text.match(INLINE_CITATION) ?? [];
  if (inlineCitations.length > 0) {
    text = text.replace(INLINE_CITATION, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
    issues.push({ code: "INLINE_CITATION_STRIPPED", detail: `${inlineCitations.length} marqueur(s) retiré(s) de la prose`, severity: "minor" });
  }

  // ── 4ter) PERTINENCE : retirer ce qui n'a pas été demandé ─────────────────
  //
  // Ordre de réparation (§5) : on retire la phrase fautive, on garde la réponse valide.
  // Deux protections empêchent la réparation de nuire :
  //   — une phrase qui sert un point du contrat de couverture n'est jamais candidate
  //     (garantie dans `findUnsolicitedSentences`) ;
  //   — si l'excision viderait la réponse, on n'excise pas : on signale. Une réponse
  //     amputée serait un défaut plus grave que l'ajout qu'on voulait corriger.
  const relevance = input.plan.relevance;
  const unsolicited = findUnsolicitedSentences(text, relevance, allowedRoutePathsFor(relevance));
  if (unsolicited.length > 0) {
    const drop = new Set(unsolicited.map((h) => h.sentence));
    const kept = splitSentences(text).filter((s) => !drop.has(s));
    const rebuilt = kept.join(" ").replace(/\s+/g, " ").trim();
    // Seuil abaissé de 40 à 24 : mesuré (pr1), « En France, Pierre coûte 449 € par mois. »
    // (~38 car., mais après excision d'une SEULE phrase le reste peut être plus court) était
    // au-dessus de l'ancien plancher tantôt, en dessous tantôt — et la caution TVA interdite
    // survivait. Une réponse valide courte (« Oui, la Suisse est couverte. » ~28 car.) doit
    // pouvoir subsister à l'excision d'un ajout. En deçà de 24, l'excision viderait vraiment.
    if (rebuilt.length >= 24) {
      text = rebuilt;
      issues.push({
        code: "UNSOLICITED_TOPIC_REMOVED",
        detail: `${unsolicited.length} phrase(s) hors demande : ${[...new Set(unsolicited.map((h) => h.topicId))].join(", ")}`,
        severity: "minor",
      });
    } else {
      issues.push({
        code: "UNSOLICITED_TOPIC_DOMINANT",
        detail: `réponse essentiellement hors demande : ${[...new Set(unsolicited.map((h) => h.topicId))].join(", ")}`,
        severity: "minor",
      });
    }
  }

  // Longueur : une question atomique n'appelle pas un panorama. Signalé, jamais coupé —
  // tronquer une réponse au milieu serait pire que sa longueur.
  const sentenceCount = splitSentences(text).length;
  if (sentenceCount > DEPTH_SENTENCE_CEILING[relevance.answerDepth]) {
    issues.push({
      code: "ANSWER_TOO_LONG_FOR_REQUEST",
      detail: `${sentenceCount} phrases pour une demande « ${relevance.answerDepth} »`,
      severity: "minor",
    });
  }

  // Un pays hors périmètre a été évoqué : la réponse doit le dire. Signalé pour la mesure,
  // sans dégrader le tour — la correction de fond est le fait de périmètre servi au prompt.
  if (relevance.unsupportedCountries.length > 0 &&
      !/\b(?:pas (?:encore )?(?:couvert|ouvert|disponible|pr[ée]sent)|n'est pas|ne sommes pas|hors (?:de notre )?p[ée]rim[èe]tre|uniquement|seuls?)\b/i.test(text)) {
    issues.push({
      code: "UNSUPPORTED_COUNTRY_NOT_FLAGGED",
      detail: relevance.unsupportedCountries.join(", "),
      severity: "minor",
    });
  }

  // ── 5) Couverture : chaque objectif du plan doit être abordé ──────────────
  const answerTokens = new Set(tokenize(text));
  const uncovered = input.plan.coverage.filter((goal) => {
    const goalTokens = tokenize(goal);
    if (goalTokens.length === 0) return false;
    const hits = goalTokens.filter((t) => answerTokens.has(t)).length;
    return hits / goalTokens.length < 0.34;
  });
  if (uncovered.length > 0) {
    issues.push({
      code: "INCOMPLETE_COVERAGE",
      detail: `${uncovered.length}/${input.plan.coverage.length} point(s) non traité(s)`,
      severity: "major",
    });
  }

  // ── 6) Grounding vide : la réponse ne doit pas faire semblant ─────────────
  if (input.truth.groundingEmpty && !/\b(je ne (?:sais|dispose|peux)|pas d'information|je préfère demander|pouvez-vous préciser)\b/i.test(text)) {
    issues.push({ code: "UNGROUNDED_CONFIDENCE", detail: "aucune source, mais la réponse ne le signale pas", severity: "major" });
  }

  const major = issues.filter((i) => i.severity === "major");
  // Une RÉPARATION réussie n'est pas un échec : la réponse reste servie, amendée. Seule
  // une faute majeure non réparable justifie de demander une précision.
  const repaired = issues.some(
    (i) => i.code === "CLAIM_SENTENCE_REMOVED" || i.code === "UNSOLICITED_TOPIC_REMOVED",
  );
  const action: VerdictAction =
    major.some((i) => i.code === "FALSE_EXECUTION_CLAIM") ? "clarify"
      : major.length > 0 && !repaired ? "clarify"
        : repaired ? "repaired"
          : major.length > 0 ? "clarify"
            : "accept";

  return Object.freeze({
    action,
    text,
    citations: Object.freeze(validCitations),
    issues: Object.freeze(issues),
    uncoveredGoals: Object.freeze(uncovered),
  });
}
