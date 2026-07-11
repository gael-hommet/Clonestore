// src/lib/clonechat/intelligence/c1-1/parrain-support-runtime.ts
// C1.1 — Runtime support multi-tours : description + capture/fichier + route + métadonnées
// navigateur/appareil + contexte compte + bugs validés + historique support du compte.
// Flow : classifier → connaissance page/feature → findings visuels/fichiers → problèmes
// connus → ≤2 questions précises → contournement sûr (jamais « corrigé » pour un
// contournement) → artefact scoped si non résolu → candidat d'apprentissage après
// résolution VALIDÉE uniquement.

import { classifyBugCategory, inferSeverity, missingInfoQuestions, safeTroubleshooting } from "../c1/clonechat-support-brain";
import type { BugCategory, BugSeverity } from "../c1/clonechat-knowledge-types";
import { redactSymptom } from "../../bug-memory";
import { honestResolutionText, type BugQueryContext, type ParrainBugStore, type ParrainKnownBug } from "./parrain-bug-learning";
import { sitePageByRoute } from "./parrain-site-index";
import { parrainHash } from "./parrain-types";
import type { ExistingScreenshotAnalysis } from "./parrain-image-adapter";
import type { AttachmentIngestionResult } from "./parrain-attachment-types";

export interface SupportTurnInput {
  readonly description: string;
  readonly companyId: string | null;
  readonly userId: string | null;
  readonly route: string | null;
  readonly browser: string | null;
  readonly device: string | null;
  readonly release: string | null;
  readonly screenshotAnalysis: ExistingScreenshotAnalysis | null;
  readonly attachments: readonly AttachmentIngestionResult[];
  readonly at: string;
}

export interface ParrainSupportArtifact {
  readonly id: string;
  readonly companyId: string | null;
  readonly category: BugCategory;
  readonly severity: BugSeverity;
  readonly route: string | null;
  readonly redactedDescription: string;
  readonly visualFindings: readonly string[];
  readonly fileFindings: readonly string[];
  readonly linkedKnownBugId: string | null;
  readonly status: "resolved_workaround" | "known_no_workaround" | "needs_info" | "escalated";
  readonly createdAt: string;
}

export interface SupportTurnResult {
  readonly message: string;
  readonly artifact: ParrainSupportArtifact;
  readonly askedQuestions: readonly string[];
  readonly workaround: string | null;
  readonly escalated: boolean;
  /** Candidat d'apprentissage proposé UNIQUEMENT après résolution validée. */
  readonly learningEligible: boolean;
}

export function runSupportTurn(input: SupportTurnInput, bugStore: ParrainBugStore): SupportTurnResult {
  const category = classifyBugCategory(input.description, input.route);
  const severity = inferSeverity(input.description);
  const page = input.route ? sitePageByRoute(input.route) : null;
  const visualFindings = input.screenshotAnalysis ? input.screenshotAnalysis.visibly_proven.map((f) => redactSymptom(f)) : [];
  const fileFindings = input.attachments
    .filter((a) => a.attachment.supportStatus !== "unsupported" && a.attachment.supportStatus !== "parse_failed")
    .map((a) => `${a.attachment.filename}: ${a.honestSummary.slice(0, 120)}`);

  // Recherche de problèmes connus VALIDÉS, scoped (compte, route, navigateur, appareil).
  const query: BugQueryContext = {
    text: [input.description, ...visualFindings].join(". "),
    companyId: input.companyId,
    route: input.route,
    browser: input.browser,
    device: input.device,
    release: input.release,
  };
  const known: ParrainKnownBug | null = bugStore.find(query)[0]?.bug ?? null;

  const questions = known ? [] : missingInfoQuestions({
    route: input.route,
    browserOrDevice: input.browser ?? input.device,
    reproductionSteps: null,
    description: input.description,
  });

  const status: ParrainSupportArtifact["status"] = known
    ? known.workaround || known.confirmedFix
      ? "resolved_workaround"
      : "known_no_workaround"
    : questions.length > 0
      ? "needs_info"
      : "escalated";

  const artifact: ParrainSupportArtifact = Object.freeze({
    id: `psup_${parrainHash(`${input.companyId ?? "anon"}|${category}|${redactSymptom(input.description)}`)}`,
    companyId: input.companyId,
    category,
    severity,
    route: input.route,
    redactedDescription: redactSymptom(input.description),
    visualFindings,
    fileFindings,
    linkedKnownBugId: known?.id ?? null,
    status,
    createdAt: input.at,
  });

  const pageNote = page ? ` Contexte de page : ${page.route} — ${page.purpose}` : "";
  const visualNote = visualFindings.length ? ` Ce que montre votre capture : ${visualFindings.slice(0, 3).join(" ; ")}.` : "";

  if (known) {
    return Object.freeze({
      message: `${honestResolutionText(known)}${visualNote}${pageNote} Si cela ne suffit pas, je transmets à l'équipe avec votre dossier complet.`,
      artifact,
      askedQuestions: [],
      workaround: known.workaround ?? known.confirmedFix,
      escalated: known.workaround === null && known.confirmedFix === null,
      learningEligible: false, // déjà connu — rien à apprendre
    });
  }

  if (status === "needs_info") {
    return Object.freeze({
      message: `Pour vous aider précisément (${category}), deux questions maximum : ${questions.join(" ")}${visualNote} En attendant : ${safeTroubleshooting(category)}`,
      artifact,
      askedQuestions: questions,
      workaround: null,
      escalated: false,
      learningEligible: false,
    });
  }

  return Object.freeze({
    message:
      `Merci — votre signalement (${category}, sévérité ${severity}) est enregistré et transmis.${visualNote}${pageNote} ` +
      `${safeTroubleshooting(category)} Je ne promets pas de correctif immédiat : le dossier est tracé et suivi.`,
    artifact,
    askedQuestions: [],
    workaround: null,
    escalated: true,
    learningEligible: true, // une résolution ultérieure VALIDÉE pourra devenir un candidat
  });
}
