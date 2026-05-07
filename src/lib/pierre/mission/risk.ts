export type PierreMissionRiskLevel = "normal" | "sensitive" | "critical";

export type PierreRiskInput = {
  input: string;
  classification?: string | null;
  context?: string | null;
};

export type PierreRiskResult = {
  risk_level: PierreMissionRiskLevel;
  approval_required: boolean;
  blocked: boolean;
  reasons: string[];
  matched_signals: string[];
  warnings: string[];
};

type RiskRule = {
  level: PierreMissionRiskLevel;
  signals: string[];
  reason: string;
  approval_required?: boolean;
  blocked?: boolean;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildCorpus(input: PierreRiskInput): string {
  return normalizeText(
    [input.input, input.context || "", input.classification || ""]
      .filter(Boolean)
      .join("\n"),
  );
}

const CRITICAL_RULES: RiskRule[] = [
  {
    level: "critical",
    signals: [
      "licenciement",
      "harcelement",
      "harcÃ¨lement",
      "discrimination",
      "prud'hommes",
      "contentieux",
      "sanction disciplinaire",
      "rupture forcee",
      "rupture forcÃ©e",
    ],
    reason:
      "La demande contient un signal RH critique impliquant un risque juridique, disciplinaire ou rÃ©putationnel Ã©levÃ©.",
    approval_required: true,
    blocked: false,
  },
  {
    level: "critical",
    signals: [
      "decide seul",
      "dÃ©cide seul",
      "sans validation",
      "envoie directement sans validation",
      "prends la decision juridique",
      "prend la decision disciplinaire",
    ],
    reason:
      "La demande cherche Ã  contourner la validation humaine sur un sujet sensible ou critique.",
    approval_required: true,
    blocked: true,
  },
];

const SENSITIVE_RULES: RiskRule[] = [
  {
    level: "sensitive",
    signals: [
      "avertissement",
      "mise a pied",
      "mise Ã  pied",
      "conflit",
      "absence injustifiee",
      "absence injustifiÃ©e",
      "salaire",
      "confidentiel",
      "plainte",
      "recadrage",
    ],
    reason:
      "La demande contient un signal RH sensible nÃ©cessitant prudence, traÃ§abilitÃ© et contrÃ´le.",
    approval_required: true,
    blocked: false,
  },
  {
    level: "sensitive",
    signals: [
      "refus candidat",
      "refus de candidature",
      "convocation entretien",
      "onboarding",
      "offre emploi",
      "courrier rh",
    ],
    reason:
      "La mission relÃ¨ve dâ€™un usage RH encadrÃ©, gÃ©nÃ©ralement autorisÃ© mais nÃ©cessitant une formulation soignÃ©e.",
    approval_required: false,
    blocked: false,
  },
];

const CLASSIFICATION_DEFAULTS: Partial<Record<string, PierreMissionRiskLevel>> = {
  offre_emploi: "normal",
  convocation_entretien: "normal",
  refus_candidat: "normal",
  relance_candidat: "normal",
  onboarding: "normal",
  note_rh: "normal",
  rappel_procedure: "normal",
  compte_rendu: "normal",
  courrier_rh: "sensitive",
  demande_sensible: "sensitive",
  hors_perimetre: "critical",
};

function scoreRuleMatches(
  corpus: string,
  rules: RiskRule[],
): Array<{
  rule: RiskRule;
  matchedSignals: string[];
}> {
  return rules
    .map((rule) => ({
      rule,
      matchedSignals: rule.signals.filter((signal) =>
        corpus.includes(normalizeText(signal)),
      ),
    }))
    .filter((entry) => entry.matchedSignals.length > 0);
}

export function assessMissionRisk(input: PierreRiskInput): PierreRiskResult {
  const corpus = buildCorpus(input);
  const classificationKey = normalizeText(input.classification || "");

  const criticalMatches = scoreRuleMatches(corpus, CRITICAL_RULES);
  const sensitiveMatches = scoreRuleMatches(corpus, SENSITIVE_RULES);

  const reasons: string[] = [];
  const matched_signals: string[] = [];
  const warnings: string[] = [];

  let risk_level: PierreMissionRiskLevel =
    CLASSIFICATION_DEFAULTS[classificationKey] || "normal";
  let approval_required = risk_level !== "normal";
  let blocked = classificationKey === "hors_perimetre";

  if (classificationKey === "hors_perimetre") {
    reasons.push(
      "La mission est classÃ©e hors pÃ©rimÃ¨tre de Pierre et doit Ãªtre bloquÃ©e ou reroutÃ©e.",
    );
    warnings.push(
      "Pierre ne doit pas exÃ©cuter une demande hors pÃ©rimÃ¨tre RH contrÃ´lÃ©.",
    );
  }

  if (sensitiveMatches.length > 0 && risk_level === "normal") {
    risk_level = "sensitive";
  }

  if (criticalMatches.length > 0) {
    risk_level = "critical";
  }

  for (const match of [...sensitiveMatches, ...criticalMatches]) {
    reasons.push(match.rule.reason);
    matched_signals.push(...match.matchedSignals);

    if (match.rule.approval_required) {
      approval_required = true;
    }

    if (match.rule.blocked) {
      blocked = true;
    }
  }

  if (risk_level === "critical") {
    warnings.push(
      "Validation humaine obligatoire avant toute action sortante ou document sensible.",
    );
  } else if (risk_level === "sensitive") {
    warnings.push(
      "Mission sensible : garder une traÃ§abilitÃ© propre et un niveau de contrÃ´le humain adaptÃ©.",
    );
  }

  if (
    corpus.includes("juridique") ||
    corpus.includes("avocat") ||
    corpus.includes("contentieux")
  ) {
    warnings.push(
      "Pierre ne remplace pas un avis juridique et ne doit pas trancher seul un sujet lÃ©gal.",
    );
    approval_required = true;
  }

  return {
    risk_level,
    approval_required,
    blocked,
    reasons: [...new Set(reasons)],
    matched_signals: [...new Set(matched_signals)],
    warnings: [...new Set(warnings)],
  };
}
export function detectPierreRiskLevel(input: string, _fallback?: unknown) {
  const result = assessMissionRisk({ input } as any) as any;
  return result.risk_level ?? result.level ?? "low";
}

export function detectPierreApprovalRequired(input: string, _fallback?: unknown) {
  const result = assessMissionRisk({ input } as any) as any;
  return Boolean(result.approval_required ?? result.approvalRequired ?? false);
}

