// src/lib/cloneos/files/classification.ts
// B34 — HR file classification heuristics. Pure, no async, no AI needed.

import type { HrFileCategory, FileRiskLevel, FileVisibility, FileClassificationResult } from "./types";

// ── Classification rules ──────────────────────────────────────────────────────

type ClassificationRule = {
  category: HrFileCategory;
  risk_level: FileRiskLevel;
  visibility: FileVisibility;
  filename_patterns: RegExp[];
  text_patterns: RegExp[];
  base_confidence: number;
};

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    category: "legal_sensitive",
    risk_level: "sensitive",
    visibility: "restricted",
    filename_patterns: [/licencie|licenciement|sanction|harcèle|harcel|discrimination|disciplin|prud.?hom|contentieux/i],
    text_patterns: [/licencie|licenciement|faute.?grave|harcèlement|harassment|discrimination|sanction disciplin|prud.?hom|contentieux|rupture.?conventionelle|mise.?en.?demeure/i],
    base_confidence: 0.85,
  },
  {
    category: "sick_leave",
    risk_level: "sensitive",
    visibility: "restricted",
    filename_patterns: [/arret.?travail|arret.?maladie|avis.?arret|certificat.?medical|mi.?temps.?therap/i],
    text_patterns: [/arrêt de travail|arrêt maladie|certificat médical|mi.temps thérapeutique|affection.?longue.?durée|incapacité.?temporaire|médecin.?traitant/i],
    base_confidence: 0.85,
  },
  {
    category: "identity_document",
    risk_level: "sensitive",
    visibility: "restricted",
    filename_patterns: [/passport|cin|carte.?identit|id.?card|permis.?sejour|carte.?sejour|titre.?sejour/i],
    text_patterns: [/numéro.?national|passeport|carte.?d.identité|titre.?de.?séjour|permis.?de.?séjour/i],
    base_confidence: 0.9,
  },
  {
    category: "cv",
    risk_level: "medium",
    visibility: "manager_visible",
    filename_patterns: [/\bcv\b|curriculum.?vitae|resume/i],
    text_patterns: [/curriculum vitae|\bcv\b|expérience.?professionnelle|formation.?initiale|compétences.?clés|références.?professionnelles|objectif.?professionnel/i],
    base_confidence: 0.7,
  },
  {
    category: "contract",
    risk_level: "high",
    visibility: "internal",
    filename_patterns: [/contrat.?travail|contract|cdi|cdd|contrat.?emploi/i],
    text_patterns: [/contrat de travail|contrat à durée|cdi|cdd|période.?d.essai|poste de travail|rémunération.?mensuelle|horaires.?de.?travail|convention.?collective/i],
    base_confidence: 0.8,
  },
  {
    category: "amendment",
    risk_level: "high",
    visibility: "internal",
    filename_patterns: [/avenant/i],
    text_patterns: [/avenant.?(?:au|n[°º]|numéro)|avenant.?(?:contrat|salaire|poste|durée)|modification.?du.?contrat|est.?complété.?(?:et|par)/i],
    base_confidence: 0.8,
  },
  {
    category: "absence_proof",
    risk_level: "medium",
    visibility: "internal",
    filename_patterns: [/justificatif.?absence|absence|conge|justif/i],
    text_patterns: [/justificatif.?d.absence|demande.?d.absence|absence.?injustifiée|congés?.payés?|congé.?(?:maladie|maternité|paternité|parental)/i],
    base_confidence: 0.7,
  },
  {
    category: "payroll_export",
    risk_level: "high",
    visibility: "restricted",
    filename_patterns: [/export.?paie|paie.?export|dsn|fiche.?paie|bulletin.?paie|bulletins?/i],
    text_patterns: [/déclaration.?sociale.?nominative|dsn|bulletin.?de.?salaire|bulletin.?de.?paie|cotisations.?salariales|brut.?imposable|net.?à.?payer/i],
    base_confidence: 0.85,
  },
  {
    category: "payroll_variable",
    risk_level: "high",
    visibility: "restricted",
    filename_patterns: [/variable.?paie|heures.?sup|prime|note.?frais|frais.?pro/i],
    text_patterns: [/variables.?de.?paie|heures.?supplémentaires|prime.?(?:exceptionnelle|objectif|performance)|note.?de.?frais|remboursement.?frais/i],
    base_confidence: 0.75,
  },
  {
    category: "onboarding_document",
    risk_level: "low",
    visibility: "employee_related",
    filename_patterns: [/onboarding|integration|parcours.?integration|bienvenue/i],
    text_patterns: [/parcours.?d.intégration|onboarding|programme.?accueil|welcome|période.?d.intégration|check.?list.?arrivée/i],
    base_confidence: 0.7,
  },
  {
    category: "offboarding_document",
    risk_level: "high",
    visibility: "internal",
    filename_patterns: [/offboarding|depart|sortie.?employe|solde.?tout.?compte/i],
    text_patterns: [/solde.?de.?tout.?compte|départ.?du.?salarié|attestation.?pôle.?emploi|certificat.?de.?travail|restitution.?matériel/i],
    base_confidence: 0.8,
  },
  {
    category: "policy",
    risk_level: "low",
    visibility: "internal",
    filename_patterns: [/politique|charte|reglement|handbook|code.?conduite/i],
    text_patterns: [/politique.?(?:rh|ressources.?humaines|interne)|charte.?(?:informatique|éthique|d.utilisation)|règlement.?intérieur|code.?de.?conduite|handbook/i],
    base_confidence: 0.7,
  },
  {
    category: "procedure",
    risk_level: "low",
    visibility: "internal",
    filename_patterns: [/procedure|processus|mode.?operatoire|guide.?rh/i],
    text_patterns: [/procédure.?(?:rh|de|d.)|processus.?(?:rh|de|d.)|mode.?opératoire|étapes.?à.?suivre|guide.?pratique.?rh/i],
    base_confidence: 0.65,
  },
  {
    category: "job_description",
    risk_level: "low",
    visibility: "internal",
    filename_patterns: [/fiche.?poste|job.?description|profil.?poste|poste/i],
    text_patterns: [/fiche.?de.?poste|description.?du.?poste|missions.?principales|compétences.?requises|profil.?recherché|rattachement.?hiérarchique/i],
    base_confidence: 0.7,
  },
  {
    category: "interview_report",
    risk_level: "medium",
    visibility: "manager_visible",
    filename_patterns: [/entretien|compte.?rendu|bilan.?annuel|evaluation|evaluation.?annuelle/i],
    text_patterns: [/entretien.?(?:annuel|professionnel|de.?mi.?année)|compte.?rendu.?d.entretien|bilan.?annuel|évaluation.?des.?performances|objectifs.?(?:fixés|atteints)/i],
    base_confidence: 0.7,
  },
  {
    category: "training_document",
    risk_level: "low",
    visibility: "employee_related",
    filename_patterns: [/formation|habilitation|certificat.?formation|attestation.?formation/i],
    text_patterns: [/attestation.?de.?formation|habilitation.?(?:électrique|sécurité|caces)|plan.?de.?formation|cpf|organisme.?de.?formation/i],
    base_confidence: 0.7,
  },
  {
    category: "certificate",
    risk_level: "low",
    visibility: "employee_related",
    filename_patterns: [/attestation|certificat|diplome|titre.?pro/i],
    text_patterns: [/atteste.?que|certifie.?que|attestation.?de.?(?:travail|salaire|présence)|certificat.?de.?(?:travail|scolarité)/i],
    base_confidence: 0.65,
  },
  {
    category: "employee_file",
    risk_level: "medium",
    visibility: "restricted",
    filename_patterns: [/dossier.?salarie|dossier.?employe|dossier.?personnel|file.?employee/i],
    text_patterns: [/dossier.?salarié|dossier.?du.?salarié|dossier.?personnel|récapitulatif.?(?:salarié|employé)/i],
    base_confidence: 0.7,
  },
];

// ── Suggested links by category ───────────────────────────────────────────────

function getSuggestedLinks(category: HrFileCategory): FileClassificationResult["suggested_links"] {
  const MISSION_CATEGORIES: HrFileCategory[] = [
    "cv", "contract", "amendment", "sick_leave", "absence_proof", "offboarding_document", "legal_sensitive",
  ];
  const EMPLOYEE_CATEGORIES: HrFileCategory[] = [
    "cv", "contract", "amendment", "sick_leave", "absence_proof", "identity_document",
    "certificate", "payroll_export", "payroll_variable", "employee_file", "offboarding_document",
  ];
  const TEMPLATE_CATEGORIES: HrFileCategory[] = [
    "policy", "procedure", "job_description", "onboarding_document", "training_document",
  ];

  const links: FileClassificationResult["suggested_links"] = [];
  if (MISSION_CATEGORIES.includes(category)) links.push({ type: "mission", reason: `Catégorie "${category}" nécessite une mission Pierre.` });
  if (EMPLOYEE_CATEGORIES.includes(category)) links.push({ type: "employee", reason: `Catégorie "${category}" doit être rattachée au dossier salarié.` });
  if (TEMPLATE_CATEGORIES.includes(category)) links.push({ type: "template", reason: `Catégorie "${category}" peut servir de modèle CloneADN.` });
  return links;
}

function getMissingInfo(category: HrFileCategory, hasEmployee: boolean, hasMission: boolean): string[] {
  const missing: string[] = [];
  const needsEmployee: HrFileCategory[] = ["contract", "amendment", "sick_leave", "absence_proof", "identity_document", "payroll_export", "payroll_variable", "employee_file"];
  const needsMission: HrFileCategory[] = ["cv", "legal_sensitive", "offboarding_document"];

  if (needsEmployee.includes(category) && !hasEmployee) missing.push("Identifiant salarié non fourni.");
  if (needsMission.includes(category) && !hasMission) missing.push("Identifiant mission non fourni.");
  return missing;
}

// ── Main classification ───────────────────────────────────────────────────────

export function classifyHrFile(params: {
  filename: string;
  text?: string | null;
  hasEmployee?: boolean;
  hasMission?: boolean;
}): FileClassificationResult {
  const { filename, text, hasEmployee = false, hasMission = false } = params;
  const textLower = (text ?? "").toLowerCase();
  const filenameLower = filename.toLowerCase();

  let bestRule: ClassificationRule | null = null;
  let bestScore = 0;

  for (const rule of CLASSIFICATION_RULES) {
    let score = 0;

    const filenameMatch = rule.filename_patterns.some((p) => p.test(filenameLower));
    const textMatch = text ? rule.text_patterns.some((p) => p.test(textLower)) : false;

    if (filenameMatch) score += 0.5;
    if (textMatch) score += 0.5;

    const finalScore = score * rule.base_confidence;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestRule = rule;
    }
  }

  const category: HrFileCategory = bestRule?.category ?? "other";
  const confidence = bestScore > 0 ? Math.min(bestScore, 1.0) : 0.1;
  const risk_level: FileRiskLevel = bestRule?.risk_level ?? "low";
  const visibility: FileVisibility = bestRule?.visibility ?? "internal";

  return {
    category,
    confidence,
    risk_level,
    visibility,
    suggested_links: getSuggestedLinks(category),
    missing_info: getMissingInfo(category, hasEmployee, hasMission),
    warnings: confidence < 0.4 ? ["Confiance de classification faible — vérification manuelle recommandée."] : [],
    reason: bestRule
      ? `Classifié "${category}" par correspondance ${bestScore >= 0.5 * bestRule.base_confidence ? "nom de fichier et/ou" : ""} contenu.`
      : "Aucune règle de classification correspondante — catégorie par défaut.",
  };
}
