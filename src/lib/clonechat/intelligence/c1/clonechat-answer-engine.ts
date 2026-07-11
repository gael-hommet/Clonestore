// src/lib/clonechat/intelligence/c1/clonechat-answer-engine.ts
// C1 — Moteur de réponse : compose chaque réponse depuis la connaissance CANONIQUE
// (site map, vérité, Pierre, technologies, prix, roadmap, vente, support), adapte au
// mode (visitor/prospect/client/founder/internal), et fait passer CHAQUE réponse par
// la garde de claims (fail-closed). En cas de doute : le dire, poser UNE question
// précise, ou router vers un humain. Prospects → clair et concret + CTA ;
// clients → utile et support ; fondateur/interne → vérité brute et blocages ;
// légal → jamais de garantie, recommandation de revue humaine.

import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import type { Env } from "@/lib/clonestore/pricing/stripe-pricing-config";
import {
  type AnswerCTA,
  type AnswerMode,
  type BugIntake,
  type CloneChatAnswer,
  type LearningCandidate,
  type QuestionRouting,
  type RelevantLink,
} from "./clonechat-knowledge-types";
import { C1_FORBIDDEN_CLAIM_RULES, guardAnswerText } from "./clonechat-claims-policy";
import { routeCloneChatQuestion } from "./clonechat-answer-router";
import { CLONESTORE_SITE_PAGES, NAVIGATION_TOPICS, UNAVAILABLE_ROUTES, getSitePage, resolveLink } from "./clonechat-site-map";
import { explainCloneStore } from "./clonechat-product-knowledge";
import { PIERRE_LAUNCH_PITCH, explainPierre } from "./clonechat-pierre-knowledge";
import { findTechnologyInText } from "./clonechat-technology-knowledge";
import {
  answerCanIPayNow,
  answerCanIReserve,
  answerCountryAvailability,
  answerFreeTrial,
  answerHowMuch,
  answerWhy449,
  answerWhyCHF,
} from "./clonechat-pricing-knowledge";
import { externalBlockers, roadmapByHorizon, NEXT_PHASES } from "./clonechat-roadmap-knowledge";
import { findSalesObjection, salesObjectionById } from "./clonechat-sales-brain";
import { createC1BugMemory, type C1BugMemory } from "./clonechat-bug-memory";
import { supportRespond } from "./clonechat-support-brain";
import { proposeLearningCandidate } from "./clonechat-learning-loop";
import type { TruthStatus } from "./clonechat-knowledge-types";

const ALL_FORBIDDEN_RULE_IDS: readonly string[] = Object.freeze(C1_FORBIDDEN_CLAIM_RULES.map((r) => r.id));

const CLAIM_PIERRE_IDENTITY = "Pierre est un employé IA RH.";
const CLAIM_HUMAN_VALIDATION = "Pierre garde les décisions sensibles sous validation humaine.";
const CLAIM_PRICING = "Pierre coûte 449 € / mois en France, Belgique et Luxembourg, et 499 CHF / mois en Suisse.";
const CLAIM_MISSIONS = "Pierre transforme les demandes RH en missions structurées.";

export interface AnswerOptions {
  readonly mode?: AnswerMode;
  readonly env?: Env;
  readonly bugMemory?: C1BugMemory;
  readonly companyId?: string | null;
  readonly userId?: string | null;
  readonly at?: string;
}

const DEFAULT_AT = "1970-01-01T00:00:00.000Z";

function link(route: string, label: string): RelevantLink {
  return Object.freeze({ route, label });
}

function linksFor(routes: readonly string[]): readonly RelevantLink[] {
  return routes
    .map((r) => {
      const p = getSitePage(r);
      return p ? link(p.route, p.title) : null;
    })
    .filter((l): l is RelevantLink => l !== null);
}

function statusLabel(status: TruthStatus): string {
  switch (status) {
    case "verified_live": return "vérifié en conditions réelles";
    case "verified_local_safe": return "vérifié en local sûr";
    case "integration_ready": return "prêt pour intégration";
    case "architecture_ready": return "architecture prête";
    case "demo_only": return "disponible en démo";
    case "roadmap": return "en roadmap";
    case "external_blocked": return "en attente de vérification externe";
    case "forbidden_claim": return "ne doit jamais être revendiqué";
    case "unknown": return "à vérifier";
  }
}

interface Composed {
  readonly answer: string;
  readonly cta: AnswerCTA | null;
  readonly links: readonly RelevantLink[];
  readonly claims: readonly string[];
  readonly escalate: boolean;
  readonly learning: LearningCandidate | null;
}

function compose(routing: QuestionRouting, question: string, opts: Required<Pick<AnswerOptions, "mode" | "env" | "at">> & AnswerOptions): Composed {
  const { mode, env, at } = opts;
  const q = question.toLowerCase();

  switch (routing.category) {
    case "product_explanation":
      return {
        answer: explainCloneStore(mode),
        cta: { label: "Voir la démo", route: "/demo" },
        links: linksFor(["/comprendre-clonestore", "/demo", "/agents/pierre"]),
        claims: [CLAIM_PIERRE_IDENTITY],
        escalate: false,
        learning: null,
      };

    case "pierre_explanation":
      return {
        answer: explainPierre(mode === "client" || mode === "founder" || mode === "internal"),
        cta: { label: "Découvrir Pierre", route: "/agents/pierre" },
        links: linksFor(["/agents/pierre", "/demo/pierre", "/reserver/pierre"]),
        claims: [CLAIM_PIERRE_IDENTITY, CLAIM_MISSIONS, CLAIM_HUMAN_VALIDATION],
        escalate: false,
        learning: null,
      };

    case "technology_explanation": {
      const tech = findTechnologyInText(question);
      if (!tech) {
        return {
          answer:
            "CloneStore repose sur 15 technologies de base (documents, e-mails, mémoire, permissions, audit…) et 14 systèmes produit (CloneOS, CloneGuard, CloneTrace, CloneCall, CloneRoom…). Laquelle voulez-vous que je vous explique ?",
          cta: null,
          links: linksFor(["/comprendre-clonestore"]),
          claims: [],
          escalate: false,
          learning: null,
        };
      }
      const explanation = mode === "founder" || mode === "internal" ? tech.internalExplanation : tech.clientExplanation;
      const honest =
        tech.id === "clonevoice" || tech.id === "voice"
          ? " Réponse directe : non, il n'y a pas de voix opérationnelle aujourd'hui — l'entrée texte reste la référence."
          : tech.id === "clonecall"
            ? " Réponse directe : non, CloneCall ne vous appelle pas par téléphone — les sessions sont locales, par texte, et gouvernées."
            : tech.id === "cloneroom"
              ? " Réponse directe : pas d'échanges directs entre employés IA — tout passe par CloneOS, sous gouvernance."
              : tech.id === "cloneos"
                ? " À ne pas confondre : CloneOS orchestre ; Pierre reste l'employé RH — le raisonnement RH vit chez Pierre, pas dans CloneOS."
                : "";
      return {
        answer: `${tech.name} : ${tech.definition} ${explanation}${honest} Statut honnête : ${statusLabel(tech.currentStatus)}.`,
        cta: mode === "prospect" || mode === "visitor" ? { label: "Voir la démo", route: "/demo" } : null,
        links: linksFor(["/comprendre-clonestore"]),
        claims: tech.canClaim.slice(0, 1),
        escalate: false,
        learning: null,
      };
    }

    case "pricing": {
      let answer: string;
      if (/pourquoi.*(449|ce\s+prix)|why.*449|justifi/i.test(q)) answer = answerWhy449();
      else if (/pourquoi.*(499|chf|suisse)/i.test(q)) answer = answerWhyCHF();
      else if (/payer\s+maintenant|puis-je\s+payer|peux\s+payer|pay\s+now/i.test(q)) answer = answerCanIPayNow(env);
      else if (/essai|gratuit|trial/i.test(q)) answer = answerFreeTrial();
      else if (/réserv|reserv/i.test(q)) answer = answerCanIReserve();
      else answer = answerHowMuch();
      return {
        answer,
        cta: { label: "Réserver Pierre (sans paiement)", route: "/reserver/pierre" },
        links: linksFor(["/reserver/pierre", "/comprendre-clonestore", "/legal/cgv"]),
        claims: [CLAIM_PRICING],
        escalate: false,
        learning: null,
      };
    }

    case "country_availability": {
      const country = /suisse|switzerland/i.test(q) ? "suisse" : /belgique|belgium/i.test(q) ? "belgique" : /luxembourg/i.test(q) ? "luxembourg" : /france/i.test(q) ? "france" : null;
      return {
        answer: answerCountryAvailability(country),
        cta: { label: "Réserver Pierre", route: "/reserver/pierre" },
        links: linksFor(["/reserver/pierre", "/comprendre-clonestore"]),
        claims: [CLAIM_PRICING],
        escalate: false,
        learning: null,
      };
    }

    case "demo_or_reservation":
      return {
        answer:
          "La démo immersive est sur /demo (version centrée Pierre : /demo/pierre) — sans compte, sans paiement. " +
          "Pour réserver Pierre : /reserver/pierre — la réservation fondateur ne demande aucun paiement et conserve le prix fondateur. " +
          (mode === "prospect" || mode === "visitor" ? "Trois minutes de démo valent tous les argumentaires." : "Le support (/questions) peut aussi organiser une présentation guidée."),
        cta: { label: "Voir la démo", route: "/demo" },
        links: linksFor(["/demo", "/demo/pierre", "/reserver/pierre"]),
        claims: [],
        escalate: false,
        learning: null,
      };

    case "sales_objection": {
      const objection = findSalesObjection(question) ?? salesObjectionById("readiness");
      if (!objection) break;
      return {
        answer: `${objection.shortAnswer} ${objection.explanation} ${objection.painReframing} Concrètement : ${objection.proofOrFeature}`,
        cta: objection.cta,
        links: linksFor([objection.cta.route, "/agents/pierre"]),
        claims: [CLAIM_HUMAN_VALIDATION],
        escalate: false,
        learning: null,
      };
    }

    case "support_bug": {
      const bugMemory = opts.bugMemory ?? createC1BugMemory();
      const intake: BugIntake = {
        userId: opts.userId ?? null,
        companyId: opts.companyId ?? null,
        route: null,
        browserOrDevice: null,
        screenSize: null,
        category: null,
        description: question,
        reproductionSteps: null,
        expectedBehaviour: null,
        actualBehaviour: null,
        severity: null,
        at,
      };
      const support = supportRespond(intake, bugMemory);
      const learning =
        support.artifact.status === "reported" || support.artifact.status === "escalated"
          ? proposeLearningCandidate({
              sourceType: "repeated_bug",
              proposedKnowledgeType: "bug_memory",
              summary: `Signalement ${support.artifact.category} à investiguer`,
              suggestedAnswer: support.artifact.redactedDescription,
              confidence: 0.3,
              scope: opts.companyId ? "account" : "global",
              accountId: opts.companyId ?? null,
              evidence: [support.artifact.id],
              at,
            })
          : null;
      return {
        answer: support.message,
        cta: { label: "Contacter le support", route: "/questions" },
        links: linksFor(["/questions"]),
        claims: [],
        escalate: support.escalated,
        learning,
      };
    }

    case "site_navigation": {
      // Sujets connus d'abord.
      const topic =
        /mentions/i.test(q) ? NAVIGATION_TOPICS.mentions
        : /cgu/i.test(q) ? NAVIGATION_TOPICS.cgu
        : /cgv/i.test(q) ? NAVIGATION_TOPICS.cgv
        : /confidentialité|privacy/i.test(q) ? NAVIGATION_TOPICS.privacy
        : /\bdpa\b/i.test(q) ? NAVIGATION_TOPICS.dpa
        : /démo|demo/i.test(q) ? NAVIGATION_TOPICS.demo
        : /réserv|reserv/i.test(q) ? NAVIGATION_TOPICS.reservation
        : /prospect|meilleur\s+lien|quel\s+lien/i.test(q) ? NAVIGATION_TOPICS.pierre
        : /explique\s+le\s+mieux|comprendre/i.test(q) ? NAVIGATION_TOPICS.pitch
        : /support|contact|aide/i.test(q) ? NAVIGATION_TOPICS.support
        : null;
      if (topic) {
        const p = getSitePage(topic);
        const extra = topic === NAVIGATION_TOPICS.pierre ? " Pour un prospect, le duo gagnant : /agents/pierre puis /demo." : "";
        return {
          answer: p ? `C'est ici : ${p.route} — ${p.title}. ${p.description}${extra}` : `C'est ici : ${topic}.`,
          cta: p && p.cta ? { label: p.cta, route: p.route } : null,
          links: p ? [link(p.route, p.title)] : [],
          claims: [],
          escalate: false,
          learning: null,
        };
      }
      // Route/nom cité qui n'existe pas ? (ex. « Est-ce que CloneCall a une page ? »)
      const mentioned = UNAVAILABLE_ROUTES.find((u) => q.includes(u.route.slice(1)));
      if (mentioned) {
        const resolution = resolveLink(mentioned.route);
        const closest = resolution.closestExisting;
        return {
          answer:
            `Non — la page ${mentioned.route} n'existe pas${mentioned.planned ? " encore (elle est envisagée)" : ""}. ${mentioned.note}` +
            (closest ? ` La page existante la plus proche : ${closest.route} (${closest.title}).` : ""),
          cta: closest && closest.cta ? { label: closest.cta, route: closest.route } : null,
          links: closest ? [link(closest.route, closest.title)] : [],
          claims: [],
          escalate: false,
          learning: null,
        };
      }
      return {
        answer:
          "Les pages clés : /demo (démo), /agents/pierre (produit), /reserver/pierre (réservation), /comprendre-clonestore (référence), /questions (support), /legal/* (CGU, CGV, mentions, confidentialité, DPA). Quelle page cherchez-vous exactement ?",
        cta: null,
        links: linksFor(["/demo", "/agents/pierre", "/questions"]),
        claims: [],
        escalate: false,
        learning: null,
      };
    }

    case "roadmap": {
      const now = roadmapByHorizon("now").map((x) => x.title).join(" · ");
      const next = roadmapByHorizon("next").map((x) => x.title).join(" · ");
      return {
        answer:
          `Disponible maintenant : ${now}. ` +
          `Ensuite : ${next}. ` +
          "Certaines ouvertures dépendent de vérifications externes (paiement en ligne, revue légale/fiscale, providers de signature/e-mail/voix/téléphonie) — nous ne promettons pas de date tant qu'elles ne sont pas acquises.",
        cta: { label: "Voir la démo de ce qui existe déjà", route: "/demo" },
        links: linksFor(["/demo", "/comprendre-clonestore"]),
        claims: [],
        escalate: false,
        learning: null,
      };
    }

    case "legal_or_compliance":
      return {
        answer:
          "Réponse honnête : Pierre ne fournit pas de garantie de conformité et ne remplace pas un conseil juridique. " +
          "Ce qui est structurel : validation humaine systématique sur les actions sensibles, planchers durs (les décisions disciplinaires/salariales finales restent humaines), traçabilité complète, isolation par entreprise. " +
          "La revue légale/fiscale externe est un prérequis assumé avant l'ouverture payante — elle n'a pas encore été réalisée. " +
          "Pour toute question engageante, je recommande une revue humaine/juridique : le support (/questions) organise cela.",
        cta: { label: "Demander une revue humaine", route: "/questions" },
        links: linksFor(["/legal/cgu", "/legal/confidentialite", "/legal/dpa", "/questions"]),
        claims: [CLAIM_HUMAN_VALIDATION],
        escalate: true,
        learning: null,
      };

    case "internal_status": {
      const paymentMode = resolvePaymentMode(env);
      const blockers = externalBlockers().map((b) => `${b.title} — ${b.honestStatement}`);
      return {
        answer:
          "Vérité interne, sans fard. " +
          `Production : OFF (PRODUCTION_AUTHORIZED=${String(PRODUCTION_AUTHORIZED)}, plancher P10 — seule une modification de code délibérée peut le lever). ` +
          `Paiement : mode « ${paymentMode} » — le paiement en ligne n'est pas ouvert. ` +
          `Blocages externes exacts : ${blockers.join(" | ")}. ` +
          `Prochaines phases : ${NEXT_PHASES.join(" puis ")} ; le câblage UI de CloneChat est une étape dédiée.`,
        cta: null,
        links: [],
        claims: [],
        escalate: false,
        learning: null,
      };
    }

    case "unknown":
    default:
      break;
  }

  // Inconnu (ou trou de composition) : le dire, poser UNE question précise, router humain.
  const learning = proposeLearningCandidate({
    sourceType: "user_question",
    proposedKnowledgeType: "faq_entry",
    summary: "Question sans réponse canonique — candidate FAQ",
    suggestedAnswer: "",
    confidence: 0.2,
    scope: "global",
    accountId: null,
    evidence: [question.slice(0, 200)],
    at: opts.at,
  });
  return {
    answer:
      "Je préfère ne pas improviser : je n'ai pas de réponse canonique fiable à cette question. " +
      "Pouvez-vous préciser s'il s'agit du produit, de Pierre, du prix, d'une page du site ou d'un problème technique ? " +
      "Sinon, le support humain prend le relais via /questions.",
    cta: { label: "Poser la question au support", route: "/questions" },
    links: linksFor(["/questions"]),
    claims: [],
    escalate: true,
    learning,
  };
}

/** Point d'entrée principal C1 : répondre à toute question CloneStore. */
export function answerCloneStoreQuestion(question: string, options: AnswerOptions = {}): CloneChatAnswer {
  const mode: AnswerMode = options.mode ?? "visitor";
  const env: Env = options.env ?? process.env;
  const at = options.at ?? DEFAULT_AT;
  const routing = routeCloneChatQuestion(question, mode);
  const composed = compose(routing, question, { ...options, mode, env, at });
  const guarded = guardAnswerText(composed.answer);
  return Object.freeze({
    category: routing.category,
    mode,
    confidence: guarded.safe ? routing.confidence : "low",
    answer: guarded.safeText,
    suggestedCTA: composed.cta,
    relevantLinks: composed.links,
    claimsUsed: composed.claims,
    forbiddenClaimsAvoided: ALL_FORBIDDEN_RULE_IDS,
    needsHumanEscalation: composed.escalate || !guarded.safe,
    learningCandidate: composed.learning,
  });
}

/** Entrée dédiée vente : force le traitement objection/pitch honnête. */
export function answerSalesQuestion(question: string, options: AnswerOptions = {}): CloneChatAnswer {
  const routed = routeCloneChatQuestion(question, options.mode ?? "prospect");
  if (routed.category === "sales_objection" || routed.category === "pricing" || routed.category === "demo_or_reservation") {
    return answerCloneStoreQuestion(question, { ...options, mode: options.mode ?? "prospect" });
  }
  const objection = findSalesObjection(question);
  if (objection) {
    const guarded = guardAnswerText(
      `${objection.shortAnswer} ${objection.explanation} ${objection.painReframing} Concrètement : ${objection.proofOrFeature}`,
    );
    return Object.freeze({
      category: "sales_objection",
      mode: options.mode ?? "prospect",
      confidence: guarded.safe ? "high" : "low",
      answer: guarded.safeText,
      suggestedCTA: objection.cta,
      relevantLinks: linksFor([objection.cta.route]),
      claimsUsed: [CLAIM_HUMAN_VALIDATION],
      forbiddenClaimsAvoided: ALL_FORBIDDEN_RULE_IDS,
      needsHumanEscalation: !guarded.safe,
      learningCandidate: null,
    });
  }
  // Pas une objection identifiable → pitch honnête par défaut.
  const guarded = guardAnswerText(
    `${PIERRE_LAUNCH_PITCH} La démo montre le vrai produit ; la réservation fondateur est ouverte, sans paiement.`,
  );
  return Object.freeze({
    category: "sales_objection",
    mode: options.mode ?? "prospect",
    confidence: "medium",
    answer: guarded.safeText,
    suggestedCTA: { label: "Voir la démo", route: "/demo" },
    relevantLinks: linksFor(["/demo", "/reserver/pierre"]),
    claimsUsed: [CLAIM_PIERRE_IDENTITY],
    forbiddenClaimsAvoided: ALL_FORBIDDEN_RULE_IDS,
    needsHumanEscalation: !guarded.safe,
    learningCandidate: null,
  });
}

/** Entrée dédiée support : la question est traitée comme un signalement/problème. */
export function answerSupportQuestion(question: string, options: AnswerOptions = {}): CloneChatAnswer {
  const bugMemory = options.bugMemory ?? createC1BugMemory();
  const intake: BugIntake = {
    userId: options.userId ?? null,
    companyId: options.companyId ?? null,
    route: null,
    browserOrDevice: null,
    screenSize: null,
    category: null,
    description: question,
    reproductionSteps: null,
    expectedBehaviour: null,
    actualBehaviour: null,
    severity: null,
    at: options.at ?? DEFAULT_AT,
  };
  const support = supportRespond(intake, bugMemory);
  const guarded = guardAnswerText(support.message);
  return Object.freeze({
    category: "support_bug",
    mode: options.mode ?? "client",
    confidence: guarded.safe ? (support.artifact.linkedKnownIssueId ? "high" : "medium") : "low",
    answer: guarded.safeText,
    suggestedCTA: { label: "Contacter le support", route: "/questions" },
    relevantLinks: linksFor(["/questions"]),
    claimsUsed: [],
    forbiddenClaimsAvoided: ALL_FORBIDDEN_RULE_IDS,
    needsHumanEscalation: support.escalated || !guarded.safe,
    learningCandidate: null,
  });
}

/** Sanity export pour le command center : le site map minimal attendu. */
export const REQUIRED_SITE_ROUTES: readonly string[] = Object.freeze([
  "/",
  "/comprendre-clonestore",
  "/agents",
  "/agents/pierre",
  "/demo",
  "/demo/pierre",
  "/reserver/pierre",
  "/questions",
  "/assistant",
  "/paiement",
  "/cockpit",
  "/cockpit/pierre",
  "/cockpit/room",
  "/legal/cgu",
  "/legal/cgv",
  "/legal/confidentialite",
  "/legal/dpa",
  "/legal/mentions",
]);

/** Vérité statique : toutes les routes requises existent dans le site map. */
export function requiredRoutesPresent(): boolean {
  return REQUIRED_SITE_ROUTES.every((r) => CLONESTORE_SITE_PAGES.some((p) => p.route === r));
}
