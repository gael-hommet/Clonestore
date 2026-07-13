// src/lib/pierre/v1/analysis.ts
// PHASE 8.1 — Pierre Production Runtime Core — canonical request analysis.
//
// Deterministic, rule-based analyzer (NO AI call in P8.1 — the AI provider is
// wired in a later block; a mock provider must be impossible in production).
// Produces a strict, validated analysis contract that drives real persistence:
// assumptions are never turned into facts, unknowns produce awaiting_info,
// sensitive cases produce approval/blocks.

import type { ActionKind, RiskLevel, Sensitivity } from "./autonomy";

export type AnalyzedTask = {
  type: string;
  objective: string;
  action: ActionKind;
  risk: RiskLevel;
  sensitivity: Sensitivity;
  domain: string;
  channel: string;
  external_side_effect: boolean;
  expected_output: string;
  depends_on: number[]; // indexes within proposed_tasks
  priority: number;
};

export type MissingInfo = { id: string; question: string; priority: "high" | "medium" | "low" };

export type AnalysisResult = {
  intent: string;
  domain: string;
  summary: string;
  risk_level: RiskLevel;
  sensitivity: Sensitivity;
  approval_required: boolean;
  missing_info: MissingInfo[];
  proposed_tasks: AnalyzedTask[];
  prohibited_actions: string[];
  next_best_action: string;
  confidence: number;
  /** P16D §3.B — restriction explicite de l'utilisateur CONSERVÉE et TRACÉE (« sans mon accord »).
   *  `null` s'il n'y en a pas. Une restriction ne peut qu'AJOUTER des contraintes. */
  user_restriction?: string | null;
};

const SENSITIVE_RULES: Array<{ re: RegExp; action: ActionKind; risk: RiskLevel; sensitivity: Sensitivity; intent: string }> = [
  // « virer » (licencier) est ajouté ici, borné pour NE PAS accrocher « virement » (paie).
  { re: /\b(licenci|rupture|renvoy|d[ée]missionn)|\bvir(e|es|er|ez|ent)\b/i, action: "termination", risk: "critical", sensitivity: "restricted", intent: "termination" },
  { re: /\b(sanction|disciplinaire|avertissement|mise [àa] pied)/i, action: "sanction", risk: "high", sensitivity: "restricted", intent: "sanction" },
  { re: /\b(salaire|r[ée]mun[ée]ration|augmentation|prime exceptionnelle)/i, action: "compensation", risk: "high", sensitivity: "sensitive", intent: "compensation" },
  { re: /\b(contrat|cdi|cdd|avenant)/i, action: "contract", risk: "high", sensitivity: "sensitive", intent: "contract" },
  { re: /\b(arr[êe]t maladie|m[ée]dical|pathologie)/i, action: "sensitive_medical", risk: "critical", sensitivity: "restricted", intent: "medical" },
  // P16E §6 — harcèlement / discrimination : classés sensibles DÈS L'ANALYSE (pas seulement
  // rattrapés par CloneGuard à l'exécution). Pierre prépare un dossier factuel, la décision reste
  // humaine. Radicaux (jamais de `\b` final) pour couvrir les conjugaisons/accents.
  { re: /harc[èe]l|discriminat/i, action: "harassment_flagged", risk: "critical", sensitivity: "restricted", intent: "harassment" },
  // P16E §7 — APPROBATION DE PAIE : décision réservée à l'humain (Pierre prépare/vérifie, jamais
  // n'approuve). « paie »/« payroll »/« bulletin »/« DSN » côté validation.
  { re: /\b(approuv|valid).{0,20}(paie|paye|payroll|bulletin|dsn)|(paie|payroll|dsn).{0,20}(approuv|valid)/i, action: "compensation", risk: "critical", sensitivity: "restricted", intent: "payroll_approval" },
  // P16E §7 — REJET DE CANDIDAT : décision de recrutement finale réservée à l'humain.
  { re: /\b(rejet|refus|[ée]cart).{0,25}candidat|candidat.{0,25}(rejet|refus|non retenu|[ée]cart)/i, action: "final_recruitment_decision", risk: "high", sensitivity: "restricted", intent: "candidate_rejection" },
];

const OPERATIONAL_RULES: Array<{ re: RegExp; action: ActionKind; intent: string; expected: string }> = [
  { re: /\b(relance|relancer)/i, action: "reminder", intent: "reminder", expected: "Brouillon de relance prêt à valider" },
  { re: /\b(rappel|[ée]ch[ée]ance|deadline)/i, action: "deadline_reminder", intent: "deadline_reminder", expected: "Rappel d'échéance planifié" },
  { re: /\b(document manquant|pi[èe]ce manquante|justificatif)/i, action: "request_missing_info", intent: "request_missing_info", expected: "Demande d'information préparée" },
  { re: /\b(classer|classement|trier|ranger)/i, action: "classification", intent: "classification", expected: "Classement logique proposé" },
  { re: /\b(synth[èe]se|r[ée]sum[ée]|rapport)/i, action: "operational_summary", intent: "summary", expected: "Synthèse structurée" },
  { re: /\b(notifier|notification|pr[ée]venir)/i, action: "low_risk_notification", intent: "notification", expected: "Notification interne préparée" },
];

/**
 * P16D §3.A — une DIRECTIVE VAGUE délègue sans rien demander : « fais le nécessaire »,
 * « occupe-toi de Paul », « gère ça », « comme d'habitude ». Elle ne porte AUCUNE action
 * identifiable — Pierre doit poser une question, jamais deviner laquelle exécuter.
 * Testé sur un texte replié en ASCII (les accents ne doivent rien changer au verdict).
 */
const VAGUE_DIRECTIVES: readonly RegExp[] = [
  /\ble necessaire\b/,
  /\bce qu('| )il faut\b/,
  /\boccupe(s)?( |-)toi\b/,
  /\bgere (ca|le reste|tout)\b/,
  /\bdebrouille(s)?( |-)toi\b/,
  /\bfais au mieux\b/,
  /\bcomme d('| )habitude\b/,
  /\btu sais (quoi faire|ce qu('| )il faut)\b/,
];

export function isVagueDirective(instruction: string): boolean {
  return VAGUE_DIRECTIVES.some((re) => re.test(fold(instruction)));
}

/** Repli ASCII : les accents ne doivent JAMAIS changer un verdict de gouvernance. */
function fold(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * P16D \u00a73.B \u2014 RESTRICTION EXPLICITE de l'utilisateur (\u00ab \u2026mais ne contacte personne sans mon
 * accord \u00bb, \u00ab ne fais rien sans ma validation \u00bb). Une consigne CONTRADICTOIRE doit pr\u00e9server la
 * contrainte la PLUS STRICTE : une restriction ne peut qu'AJOUTER des garde-fous, jamais \u00eatre
 * \u00e9cras\u00e9e par une classification permissive.
 *
 * Avant P16D la restriction \u00e9tait PUREMENT IGNOR\u00c9E d\u00e8s que l'action \u00e9tait jug\u00e9e \u00ab \u00e0 faible
 * risque \u00bb : \u00ab Notifier l'\u00e9quipe MAIS ne contacte personne sans mon accord \u00bb ressortait
 * `risk=low, sensitivity=normal` \u21d2 CloneGuard VERT \u21d2 ex\u00e9cution autonome. L'utilisateur avait
 * pourtant explicitement interdit d'agir sans lui. (Le cas \u00ab Envoie le CONTRAT\u2026 \u00bb n'\u00e9tait sauv\u00e9
 * que par ACCIDENT : \u00ab contrat \u00bb d\u00e9clenche une r\u00e8gle sensible \u2014 pas la restriction elle-m\u00eame.)
 */
const USER_RESTRICTIONS: readonly RegExp[] = [
  /\bsans (mon|ton|son) accord\b/,
  /\bsans (ma|ta|sa) validation\b/,
  /\bsans me (demander|consulter|pr[\u00e9e]venir|valider)\b/,
  /\bne (fais|fait|faire) rien sans\b/,
  /\bne contacte (personne|pas)\b/,
  /\bn(e|') (envoie|envoyer|envoyez) (rien|pas)\b/,
  /\b(demande|demandez)[- ]moi avant\b/,
  /\bvalide avec moi\b/,
  /\bavant (de|d'| )?(m'|me )?(en )?(informer|valider|confirmer)\b.*\bavant\b/,
];

/** La restriction trouv\u00e9e (pour la TRACE), ou `null`. */
export function detectUserRestriction(instruction: string): string | null {
  const t = fold(instruction);
  const hit = USER_RESTRICTIONS.find((re) => re.test(t));
  return hit ? (t.match(hit)?.[0] ?? null) : null;
}

function detectMissingInfo(instruction: string): MissingInfo[] {
  const out: MissingInfo[] = [];
  // Accent-safe subject detection (JS \b does not handle accented chars). Either
  // an HR-subject stem, a civility, or a capitalized name token after a space.
  const hasSubject =
    /(salari|employ|candidat|[ée]quipe|manager|directeur|stagiaire|\bmme\b|\bm\.|\bmr\b)/i.test(instruction) ||
    /\s[A-ZÉÈÀ][a-zà-ÿ']{2,}/.test(instruction);
  if (!hasSubject) {
    out.push({ id: "who", question: "Quel salarié / candidat / équipe est concerné ?", priority: "high" });
  }
  const hasWhen = /([ée]ch[ée]ance|deadline|avant|date|vendredi|lundi|mardi|semaine|mois)/i.test(instruction);
  if (!hasWhen && /(relance|rappel)/i.test(instruction)) {
    out.push({ id: "deadline", question: "Quelle est l'échéance visée ?", priority: "medium" });
  }
  return out;
}

export function analyzeInstruction(instruction: string): AnalysisResult {
  const text = (instruction ?? "").trim();
  if (text.length === 0) {
    return {
      intent: "unknown", domain: "hr_ops", summary: "Demande vide", risk_level: "low", sensitivity: "normal",
      approval_required: false, missing_info: [{ id: "instruction", question: "Quelle est la demande ?", priority: "high" }],
      proposed_tasks: [], prohibited_actions: [], next_best_action: "Préciser la demande", confidence: 0.1,
    };
  }

  const sensitive = SENSITIVE_RULES.find((r) => r.re.test(text));
  const missing = detectMissingInfo(text);
  const tasks: AnalyzedTask[] = [];

  if (sensitive) {
    tasks.push({
      type: "prepare_sensitive_draft",
      objective: `Préparer un dossier factuel pour: ${sensitive.intent}`,
      action: sensitive.action,
      risk: sensitive.risk,
      sensitivity: sensitive.sensitivity,
      domain: "hr_sensitive",
      channel: "internal",
      external_side_effect: false,
      expected_output: "Synthèse factuelle + points de vigilance (aucune décision)",
      depends_on: [],
      priority: 200,
    });
    // P16D §3.B — la restriction éventuelle est TRACÉE ici aussi (le cas sensible est déjà le
    // plus strict : on ne l'assouplit jamais, on documente simplement le conflit).
    const sensitiveRestriction = detectUserRestriction(text);
    return {
      intent: sensitive.intent, domain: "hr_sensitive",
      summary: sensitiveRestriction
        ? `Cas sensible détecté: ${sensitive.intent} — RESTRICTION UTILISATEUR conservée (« ${sensitiveRestriction} »).`
        : `Cas sensible détecté: ${sensitive.intent}`,
      risk_level: sensitive.risk, sensitivity: sensitive.sensitivity, approval_required: true,
      user_restriction: sensitiveRestriction,
      missing_info: missing, proposed_tasks: tasks,
      prohibited_actions: ["decision_finale_autonome", "sanction_autonome", "envoi_autonome"],
      next_best_action: "Préparer et soumettre à validation humaine", confidence: 0.75,
    };
  }

  const matched = OPERATIONAL_RULES.filter((r) => r.re.test(text));

  // P16D §3.A — DIRECTIVE VAGUE : une intention SANS ACTION (« Fais le nécessaire pour Paul. »).
  // Auparavant on retombait sur une tâche générique `create_task`, et — parce que
  // `detectMissingInfo` ne contrôlait QUE le « qui » (et le « quand » des relances), jamais le
  // « quoi » — la seule présence du mot « Paul » suffisait à vider `missing_info` :
  // `approval_required` tombait à false et Pierre concluait « Exécuter les tâches faibles
  // risques ». Il INVENTAIT donc une action que personne n'avait demandée.
  //
  // On détecte la VACUITÉ explicitement, et NON « aucune règle opérationnelle n'a matché » :
  // OPERATIONAL_RULES est une liste étroite (relance / rappel / pièce manquante / classement /
  // synthèse / notification), et quantité d'instructions parfaitement claires n'y figurent pas
  // (« Prépare l'onboarding de Sarah lundi »). Traiter un simple non-match comme une ambiguïté
  // bloquerait des demandes légitimes.
  //
  // Doctrine : face à une instruction vide de sens, Pierre DEMANDE — il ne devine pas.
  const vague = isVagueDirective(text);
  if (vague) {
    missing.push({ id: "what", question: "Que dois-je faire précisément (document, relance, synthèse, convocation…) ?", priority: "high" });
  }

  const rules = vague
    ? [{ re: /.*/, action: "request_missing_info" as ActionKind, intent: "clarification_required", expected: "Question de clarification préparée — aucune action engagée" }]
    : matched.length > 0 ? matched
    : [{ re: /.*/, action: "create_task" as ActionKind, intent: "general", expected: "Tâche RH préparée" }];

  rules.forEach((r, idx) => {
    tasks.push({
      type: r.action, // executor key == action kind (see executors.ts registry)
      objective: `${r.intent} — ${text.slice(0, 140)}`,
      action: r.action,
      risk: "low",
      sensitivity: "normal",
      domain: "hr_ops",
      channel: r.action === "low_risk_notification" ? "internal" : "internal",
      external_side_effect: false,
      expected_output: r.expected,
      depends_on: idx > 0 ? [0] : [],
      priority: 100 - idx,
    });
  });

  // P16D §3.B — LE PLUS STRICT L'EMPORTE. Une restriction explicite de l'utilisateur ne peut
  // qu'AJOUTER des garde-fous. On élève la sensibilité des tâches à `restricted` : CloneGuard
  // renvoie alors ROUGE (allow=false, requires_approval=true) — donc « préparer seulement, puis
  // demander confirmation », jamais une exécution autonome. Le conflit est TRACÉ
  // (`user_restriction` + `prohibited_actions`), pas silencieusement résolu.
  const restriction = detectUserRestriction(text);
  if (restriction) {
    for (const t of tasks) {
      t.sensitivity = "restricted";
      t.external_side_effect = false;   // rien ne part sans accord humain explicite
    }
  }

  const approval_required = restriction !== null || missing.some((m) => m.priority === "high");
  return {
    intent: rules[0].intent, domain: "hr_ops",
    summary: restriction
      ? `Demande opérationnelle: ${rules.map((r) => r.intent).join(", ")} — RESTRICTION UTILISATEUR conservée (« ${restriction} ») : préparation seule, validation humaine requise.`
      : `Demande opérationnelle: ${rules.map((r) => r.intent).join(", ")}`,
    risk_level: "low",
    sensitivity: restriction ? "restricted" : "normal",
    approval_required,
    user_restriction: restriction,
    missing_info: missing, proposed_tasks: tasks,
    prohibited_actions: restriction ? ["execution_autonome", "envoi_autonome"] : [],
    next_best_action: restriction
      ? "Préparer et soumettre à validation humaine (restriction explicite de l'utilisateur)"
      : missing.length > 0 ? "Collecter les informations manquantes" : "Exécuter les tâches faibles risques",
    confidence: matched.length > 0 ? 0.8 : 0.5,
  };
}
