// src/lib/clonechat/intelligence/c1/clonechat-support-brain.ts
// C1 — Cerveau support : comprendre le problème, poser MAX 2 questions précises,
// chercher la mémoire de bugs validés, donner le contournement exact si connu,
// sinon classifier + dépannage sûr + artefact de signalement + escalade interne.
// Jamais prétendre corrigé quand seul un contournement existe. Jamais toucher
// aux données de production. Résolution → candidat de connaissance (à valider).

import { redactSymptom } from "../../bug-memory";
import {
  c1Fingerprint,
  type BugCategory,
  type BugIntake,
  type BugReportArtifact,
  type BugSeverity,
} from "./clonechat-knowledge-types";
import type { C1BugMemory } from "./clonechat-bug-memory";

// ── Classification ────────────────────────────────────────────────────────────
const CATEGORY_SIGNALS: readonly { readonly category: BugCategory; readonly pattern: RegExp }[] = [
  { category: "login", pattern: /connexion|connecter|login|log\s?in|mot de passe|password|session|compte bloqué|redirig.*login/i },
  { category: "payment", pattern: /paiement|payer|checkout|carte|facture|stripe|payment/i },
  { category: "pricing", pattern: /prix|tarif|449|499|chf|euro|€|bon prix|price/i },
  { category: "demo", pattern: /démo|demo|réserver|reserver|bouton réserver/i },
  { category: "clonecall", pattern: /clonecall|clone call|appel/i },
  { category: "cloneroom", pattern: /cloneroom|clone room|salle|salon/i },
  { category: "pierre", pattern: /pierre|mission|validation|cockpit|assistant/i },
  { category: "document", pattern: /document|pdf|fichier|attestation|export/i },
  { category: "mobile", pattern: /mobile|téléphone|iphone|android|écran cassé|responsive|tablette/i },
  { category: "performance", pattern: /lent|rame|charge pas|longtemps|slow|performance|timeout/i },
  { category: "visual", pattern: /affichage|visuel|css|décalé|chevauche|illisible|couleur|s'affiche mal/i },
];

export function classifyBugCategory(description: string, route?: string | null): BugCategory {
  const text = `${description} ${route ?? ""}`;
  for (const s of CATEGORY_SIGNALS) {
    if (s.pattern.test(text)) return s.category;
  }
  return "unknown";
}

export function inferSeverity(description: string): BugSeverity {
  if (/impossible|bloqu|plus rien|aucun accès|perdu|blocking|critical/i.test(description)) return "blocking";
  if (/erreur|échec|crash|plante|ne fonctionne pas|marche pas|broken/i.test(description)) return "high";
  if (/lent|bizarre|parfois|intermittent|décalé/i.test(description)) return "medium";
  return "low";
}

/** Max 2 questions précises — uniquement pour les infos réellement manquantes. */
export function missingInfoQuestions(intake: Pick<BugIntake, "route" | "browserOrDevice" | "reproductionSteps" | "description">): readonly string[] {
  const questions: string[] = [];
  if (!intake.route && !/\/(demo|cockpit|assistant|reserver|paiement|questions|agents)/i.test(intake.description)) {
    questions.push("Sur quelle page étiez-vous (l'adresse commence par clonestore, ex. /demo) ?");
  }
  if (!intake.reproductionSteps) {
    questions.push("Que faisiez-vous juste avant le problème (dernière action cliquée) ?");
  }
  if (questions.length < 2 && !intake.browserOrDevice && /mobile|téléphone|écran/i.test(intake.description)) {
    questions.push("Quel appareil et quel navigateur utilisez-vous ?");
  }
  return questions.slice(0, 2);
}

// ── Dépannage sûr par catégorie (jamais d'action destructive) ─────────────────
const SAFE_TROUBLESHOOTING: Readonly<Partial<Record<BugCategory, string>>> = Object.freeze({
  login: "Vérifiez l'adresse e-mail utilisée, puis retentez depuis /login. Les pages cockpit exigent une session active.",
  payment: "Le paiement en ligne n'est pas encore ouvert — aucune carte n'est demandée aujourd'hui. La réservation (/reserver/pierre) fonctionne sans paiement.",
  pricing: "Le prix dépend du pays : France/Belgique/Luxembourg 449 € / mois, Suisse 499 CHF / mois. Renseignez votre pays pour voir la bonne offre.",
  demo: "Rechargez /demo ; si l'appareil est ancien, le mode simplifié (sans JavaScript) s'affiche automatiquement.",
  pierre: "Rechargez le cockpit ; si une mission semble figée, la timeline (vue Evidence) montre l'état réel — rien ne se perd.",
  cloneroom: "Rechargez /cockpit/room ; les échanges sont conservés et tracés.",
  clonecall: "CloneCall fonctionne en session locale (texte) — aucun appel téléphonique réel n'est encore possible, ce n'est pas une panne.",
  document: "Vérifiez le format du fichier ; les formats inconnus partent volontairement en revue manuelle plutôt qu'en lecture hasardeuse.",
  mobile: "Essayez un navigateur récent à jour ; signalez l'appareil exact pour que l'équipe reproduise.",
  performance: "Premier accès parfois plus lent (chargement initial) ; le second accès est rapide. Si ça persiste, signalez la page exacte.",
  visual: "Faites une capture d'écran si possible et indiquez la taille d'écran — l'équipe reproduira.",
  unknown: "Décrivez la page et la dernière action effectuée : l'équipe pourra reproduire et corriger.",
});

export function safeTroubleshooting(category: BugCategory): string {
  return SAFE_TROUBLESHOOTING[category] ?? SAFE_TROUBLESHOOTING.unknown ?? "";
}

// ── Artefact de signalement ───────────────────────────────────────────────────
export function classifyBugReport(intake: BugIntake, bugMemory?: C1BugMemory): BugReportArtifact {
  const category = intake.category ?? classifyBugCategory(intake.description, intake.route);
  const severity = intake.severity ?? inferSeverity(intake.description);
  const questions = missingInfoQuestions(intake);
  const known = bugMemory
    ? bugMemory.find({ text: intake.description, route: intake.route, companyId: intake.companyId })
    : [];
  const best = known.length > 0 ? known[0] : null;
  const redacted = redactSymptom(intake.description);
  const needsInfo = questions.length > 0 && !best;
  const status = best
    ? best.bug.workaround
      ? "workaround_available"
      : "known_bug"
    : needsInfo
      ? "needs_info"
      : severity === "blocking" || severity === "high"
        ? "escalated"
        : "reported";
  return Object.freeze({
    id: c1Fingerprint("bugreport", `${category}|${redacted}|${intake.companyId ?? "anon"}`),
    category,
    severity,
    status,
    route: intake.route,
    companyId: intake.companyId,
    redactedDescription: redacted,
    missingInfoQuestions: questions,
    linkedKnownIssueId: best ? best.bug.id : null,
    workaround: best ? best.bug.workaround : null,
    escalated: status === "escalated",
    createdAt: intake.at,
  });
}

// ── Réponse support complète ──────────────────────────────────────────────────
export interface SupportAnswer {
  readonly message: string;
  readonly artifact: BugReportArtifact;
  readonly escalated: boolean;
  readonly askedQuestions: readonly string[];
}

export function supportRespond(intake: BugIntake, bugMemory: C1BugMemory): SupportAnswer {
  const artifact = classifyBugReport(intake, bugMemory);

  if (artifact.linkedKnownIssueId && artifact.workaround) {
    const bug = bugMemory.get(artifact.linkedKnownIssueId);
    const fixNote =
      bug && bug.confirmedFix
        ? "Un correctif a été confirmé."
        : "C'est un contournement — le problème reste suivi, il n'est pas considéré comme corrigé.";
    return Object.freeze({
      message:
        `Oui, c'est connu : ${bug ? bug.title : "problème identifié"}. ` +
        `Contournement immédiat : ${artifact.workaround} ${fixNote} ` +
        "Si cela ne suffit pas, je transmets à l'équipe.",
      artifact,
      escalated: false,
      askedQuestions: [],
    });
  }

  if (artifact.linkedKnownIssueId && !artifact.workaround) {
    return Object.freeze({
      message:
        "C'est un problème connu et suivi, mais il n'existe pas encore de contournement fiable — je ne vais pas vous en inventer un. " +
        "Votre signalement est enregistré et transmis à l'équipe.",
      artifact,
      escalated: true,
      askedQuestions: [],
    });
  }

  if (artifact.status === "needs_info") {
    return Object.freeze({
      message:
        "Pour vous aider précisément, deux questions maximum : " +
        artifact.missingInfoQuestions.join(" ") +
        ` En attendant : ${safeTroubleshooting(artifact.category)}`,
      artifact,
      escalated: false,
      askedQuestions: artifact.missingInfoQuestions,
    });
  }

  return Object.freeze({
    message:
      `Merci pour le signalement — il est enregistré (${artifact.category}, sévérité ${artifact.severity}) et transmis à l'équipe. ` +
      `${safeTroubleshooting(artifact.category)} ` +
      "Je ne peux pas garantir de correctif immédiat, mais rien ne se perd : chaque signalement est tracé.",
    artifact,
    escalated: true,
    askedQuestions: [],
  });
}
