export type PierreMissingInfoInput = {
  input: string;
  classification?: string | null;
  context?: string | null;
};

export type PierreMissingInfoResult = {
  missing_info: string[];
  missing_info_questions: string[];
  can_produce_draft: boolean;
  should_block_execution: boolean;
  completeness_score: number;
};

type MissingFieldRule = {
  key: string;
  appliesTo: string[];
  requiredWhen: (corpus: string, rawInput: string) => boolean;
  isPresent: (corpus: string, rawInput: string) => boolean;
  missingLabel: string;
  question: string;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildCorpus(input: PierreMissingInfoInput): string {
  return normalizeText(
    [input.input, input.context || "", input.classification || ""]
      .filter(Boolean)
      .join("\n"),
  );
}

function hasEmail(value: string): boolean {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value);
}

function hasDate(value: string): boolean {
  return /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(value);
}

function hasHour(value: string): boolean {
  return /\b\d{1,2}h(\d{2})?\b/i.test(value);
}

function hasFullName(value: string): boolean {
  return /\b[A-ZÃƒâ€°ÃƒË†Ãƒâ‚¬Ãƒâ€šÃƒÅ ÃƒÅ½Ãƒâ€Ãƒâ€ºÃƒâ€žÃƒâ€¹ÃƒÂÃƒâ€“ÃƒÅ“][a-zÃƒÂ©ÃƒÂ¨Ãƒ ÃƒÂ¢ÃƒÂªÃƒÂ®ÃƒÂ´ÃƒÂ»ÃƒÂ¤ÃƒÂ«ÃƒÂ¯ÃƒÂ¶ÃƒÂ¼'-]+\s+[A-ZÃƒâ€°ÃƒË†Ãƒâ‚¬Ãƒâ€šÃƒÅ ÃƒÅ½Ãƒâ€Ãƒâ€ºÃƒâ€žÃƒâ€¹ÃƒÂÃƒâ€“ÃƒÅ“][a-zÃƒÂ©ÃƒÂ¨Ãƒ ÃƒÂ¢ÃƒÂªÃƒÂ®ÃƒÂ´ÃƒÂ»ÃƒÂ¤ÃƒÂ«ÃƒÂ¯ÃƒÂ¶ÃƒÂ¼'-]+\b/.test(
    value,
  );
}

function hasJobTitle(corpus: string): boolean {
  return (
    corpus.includes("poste ") ||
    corpus.includes("intitule du poste") ||
    corpus.includes("intitulÃƒÂ© du poste") ||
    corpus.includes("job title") ||
    corpus.includes("role ")
  );
}

function hasLocation(corpus: string): boolean {
  return (
    corpus.includes("site ") ||
    corpus.includes("lieu ") ||
    corpus.includes("localisation") ||
    corpus.includes("location ")
  );
}

function hasManager(corpus: string): boolean {
  return (
    corpus.includes("manager") ||
    corpus.includes("responsable") ||
    corpus.includes("superviseur") ||
    corpus.includes("reporting to")
  );
}

const RULES: MissingFieldRule[] = [
  {
    key: "person_name",
    appliesTo: [
      "convocation_entretien",
      "refus_candidat",
      "relance_candidat",
      "onboarding",
      "candidature",
    ],
    requiredWhen: () => true,
    isPresent: (_corpus, rawInput) => hasFullName(rawInput),
    missingLabel: "Nom complet de la personne concernÃƒÂ©e manquant",
    question: "Quel est le nom complet de la personne concernÃƒÂ©e ?",
  },
  {
    key: "recipient_email",
    appliesTo: [
      "convocation_entretien",
      "refus_candidat",
      "relance_candidat",
      "onboarding",
    ],
    requiredWhen: () => true,
    isPresent: (_corpus, rawInput) => hasEmail(rawInput),
    missingLabel: "Adresse email destinataire manquante",
    question: "Quelle est lÃ¢â‚¬â„¢adresse email du destinataire ?",
  },
  {
    key: "interview_date",
    appliesTo: ["convocation_entretien"],
    requiredWhen: () => true,
    isPresent: (_corpus, rawInput) => hasDate(rawInput),
    missingLabel: "Date dÃ¢â‚¬â„¢entretien manquante",
    question: "Quelle est la date exacte de lÃ¢â‚¬â„¢entretien ?",
  },
  {
    key: "interview_hour",
    appliesTo: ["convocation_entretien"],
    requiredWhen: () => true,
    isPresent: (_corpus, rawInput) => hasHour(rawInput),
    missingLabel: "Horaire dÃ¢â‚¬â„¢entretien manquant",
    question: "Ãƒâ‚¬ quelle heure doit avoir lieu lÃ¢â‚¬â„¢entretien ?",
  },
  {
    key: "job_title",
    appliesTo: ["offre_emploi", "onboarding"],
    requiredWhen: () => true,
    isPresent: (corpus) => hasJobTitle(corpus),
    missingLabel: "IntitulÃƒÂ© du poste absent ou insuffisant",
    question: "Quel est lÃ¢â‚¬â„¢intitulÃƒÂ© exact du poste ?",
  },
  {
    key: "location",
    appliesTo: ["offre_emploi", "convocation_entretien", "onboarding"],
    requiredWhen: () => true,
    isPresent: (corpus) => hasLocation(corpus),
    missingLabel: "Lieu ou localisation manquants",
    question: "Quel est le lieu ou la localisation Ãƒ  indiquer ?",
  },
  {
    key: "manager",
    appliesTo: ["onboarding"],
    requiredWhen: () => true,
    isPresent: (corpus) => hasManager(corpus),
    missingLabel: "Responsable ou rÃƒÂ©fÃƒÂ©rent hiÃƒÂ©rarchique manquant",
    question: "Quel est le nom du responsable ou du rÃƒÂ©fÃƒÂ©rent Ãƒ  mentionner ?",
  },
];

function isExecutionSensitive(classification: string): boolean {
  return [
    "convocation_entretien",
    "refus_candidat",
    "relance_candidat",
    "onboarding",
    "courrier_rh",
    "demande_sensible",
  ].includes(classification);
}

function canStillProduceDraft(
  classification: string,
  missingInfoCount: number,
): boolean {
  if (missingInfoCount === 0) return true;

  if (classification === "offre_emploi") return true;
  if (classification === "note_rh") return true;
  if (classification === "rappel_procedure") return true;
  if (classification === "compte_rendu") return true;

  return missingInfoCount <= 1;
}

export function detectMissingMissionInfo(
  input: PierreMissingInfoInput,
): PierreMissingInfoResult {
  const classification = normalizeText(input.classification || "mission_rh_generale");
  const corpus = buildCorpus(input);
  const rawInput = input.input || "";

  const applicableRules = RULES.filter((rule) =>
    rule.appliesTo.includes(classification),
  );

  const missing_info: string[] = [];
  const missing_info_questions: string[] = [];

  for (const rule of applicableRules) {
    const required = rule.requiredWhen(corpus, rawInput);
    if (!required) continue;

    const present = rule.isPresent(corpus, rawInput);
    if (present) continue;

    missing_info.push(rule.missingLabel);
    missing_info_questions.push(rule.question);
  }

  const uniqueMissing = [...new Set(missing_info)];
  const uniqueQuestions = [...new Set(missing_info_questions)];

  const can_produce_draft = canStillProduceDraft(
    classification,
    uniqueMissing.length,
  );

  const should_block_execution =
    uniqueMissing.length > 0 &&
    isExecutionSensitive(classification) &&
    !can_produce_draft;

  const denominator = Math.max(applicableRules.length, 1);
  const completeness_score = Number(
    Math.max(0, 1 - uniqueMissing.length / denominator).toFixed(2),
  );

  return {
    missing_info: uniqueMissing,
    missing_info_questions: uniqueQuestions,
    can_produce_draft,
    should_block_execution,
    completeness_score,
  };
}
