export type PierreMissionClassification =
  | "recrutement"
  | "candidature"
  | "offre_emploi"
  | "convocation_entretien"
  | "refus_candidat"
  | "relance_candidat"
  | "onboarding"
  | "communication_interne_rh"
  | "rappel_procedure"
  | "note_rh"
  | "compte_rendu"
  | "courrier_rh"
  | "mission_suivi"
  | "demande_sensible"
  | "hors_perimetre"
  | "mission_rh_generale";

export type PierreClassifyInput = {
  input: string;
  context?: string | null;
};

export type PierreClassifyResult = {
  classification: PierreMissionClassification;
  confidence: number;
  reasons: string[];
  matchedSignals: string[];
};

type WeightedRule = {
  classification: PierreMissionClassification;
  signals: string[];
  weight: number;
  reason: string;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildCorpus(input: PierreClassifyInput): string {
  return normalizeText([input.input, input.context || ""].filter(Boolean).join("\n"));
}

const RULES: WeightedRule[] = [
  {
    classification: "offre_emploi",
    signals: ["offre d'emploi", "job offer", "fiche de poste", "poste a pourvoir", "annonce"],
    weight: 12,
    reason: "Le texte évoque une création ou rédaction d’offre de poste.",
  },
  {
    classification: "convocation_entretien",
    signals: ["convocation", "entretien", "rdv candidat", "invite a un entretien", "invitation entretien"],
    weight: 12,
    reason: "Le texte porte sur un entretien ou une convocation.",
  },
  {
    classification: "refus_candidat",
    signals: ["refus", "rejet candidature", "candidature non retenue", "candidate rejected"],
    weight: 12,
    reason: "Le texte porte sur un refus candidat.",
  },
  {
    classification: "relance_candidat",
    signals: ["relance", "follow up", "pas de reponse", "aucune reponse", "recontacter le candidat"],
    weight: 10,
    reason: "Le texte décrit une logique de relance ou de suivi candidat.",
  },
  {
    classification: "onboarding",
    signals: ["onboarding", "integration", "bienvenue", "arrivee du collaborateur", "parcours d'integration"],
    weight: 11,
    reason: "Le texte traite de l’intégration d’un salarié.",
  },
  {
    classification: "note_rh",
    signals: ["note rh", "note interne", "note au personnel", "memo rh", "memo interne"],
    weight: 10,
    reason: "Le texte vise une note RH ou interne.",
  },
  {
    classification: "rappel_procedure",
    signals: ["procedure", "rappel de procedure", "consigne", "respect du processus", "processus interne"],
    weight: 10,
    reason: "Le texte vise un rappel de procédure.",
  },
  {
    classification: "compte_rendu",
    signals: ["compte rendu", "compte-rendu", "synthese d'entretien", "resume entretien", "minutes"],
    weight: 10,
    reason: "Le texte demande un compte rendu ou une synthèse.",
  },
  {
    classification: "courrier_rh",
    signals: ["courrier", "lettre", "notification", "document officiel", "courrier salarie"],
    weight: 9,
    reason: "Le texte demande un courrier RH.",
  },
  {
    classification: "communication_interne_rh",
    signals: ["communication interne", "message equipe", "annonce interne", "communication rh"],
    weight: 8,
    reason: "Le texte vise une communication RH interne.",
  },
  {
    classification: "mission_suivi",
    signals: ["suivi", "timeline", "rappel", "faire le point", "pilotage", "monitoring"],
    weight: 8,
    reason: "Le texte est orienté suivi opérationnel.",
  },
  {
    classification: "demande_sensible",
    signals: [
      "avertissement",
      "mise a pied",
      "conflit",
      "harcelement",
      "sanction disciplinaire",
      "absence injustifiee",
      "contentieux",
      "plainte",
    ],
    weight: 14,
    reason: "Le texte contient des signaux RH sensibles.",
  },
  {
    classification: "recrutement",
    signals: ["recrutement", "recruter", "candidat", "pipeline candidat", "shortlist", "sourcing"],
    weight: 7,
    reason: "Le texte se situe dans un cadre recrutement.",
  },
  {
    classification: "candidature",
    signals: ["candidature", "cv", "profil candidat", "postulation", "dossier candidat"],
    weight: 7,
    reason: "Le texte est centré sur une candidature.",
  },
  {
    classification: "hors_perimetre",
    signals: ["prospection commerciale", "cold email", "vente", "marketing massif", "campagne publicitaire"],
    weight: 16,
    reason: "Le texte sort du périmètre RH contrôlé de Pierre.",
  },
];

export function classifyMission(
  input: PierreClassifyInput,
): PierreClassifyResult {
  const corpus = buildCorpus(input);

  const scoreMap = new Map<PierreMissionClassification, number>();
  const reasonsMap = new Map<PierreMissionClassification, string[]>();
  const signalsMap = new Map<PierreMissionClassification, string[]>();

  for (const rule of RULES) {
    const matchedSignals = rule.signals.filter((signal) =>
      corpus.includes(normalizeText(signal)),
    );

    if (matchedSignals.length === 0) continue;

    const signalScore = rule.weight * matchedSignals.length;
    scoreMap.set(
      rule.classification,
      (scoreMap.get(rule.classification) || 0) + signalScore,
    );

    reasonsMap.set(rule.classification, [
      ...(reasonsMap.get(rule.classification) || []),
      rule.reason,
    ]);

    signalsMap.set(rule.classification, [
      ...(signalsMap.get(rule.classification) || []),
      ...matchedSignals,
    ]);
  }

  if (scoreMap.size === 0) {
    return {
      classification: "mission_rh_generale",
      confidence: 0.42,
      reasons: [
        "Aucun signal métier fort n’a dominé. La mission reste dans un cadre RH générique.",
      ],
      matchedSignals: [],
    };
  }

  const ranked = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]);
  const [bestClassification, bestScore] = ranked[0];
  const secondScore = ranked[1]?.[1] || 0;

  let confidence = 0.55 + Math.min(0.4, (bestScore - secondScore) / 30);
  confidence = Math.max(0.5, Math.min(0.97, confidence));

  return {
    classification: bestClassification,
    confidence: Number(confidence.toFixed(2)),
    reasons: [...new Set(reasonsMap.get(bestClassification) || [])],
    matchedSignals: [...new Set(signalsMap.get(bestClassification) || [])],
  };
}
export type PierreClassification = PierreMissionClassification;
