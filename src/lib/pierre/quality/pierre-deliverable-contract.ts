// src/lib/pierre/quality/pierre-deliverable-contract.ts
// B38D — Quality contracts for each Pierre deliverable type.
// Answers: what must/must never appear in each deliverable.
// Pure: no async, no env, no side effects.

import type { PierreDeliverableType, PierreDeliverableQualityContract, OutputQualityLevel } from "../../cloneos/ai/quality-policy/types";

// ── Contract table ────────────────────────────────────────────────────────────

const PIERRE_DELIVERABLE_CONTRACTS: Record<PierreDeliverableType, PierreDeliverableQualityContract> = {

  email_draft: {
    deliverable_type: "email_draft",
    output_quality_level: "client_visible",
    must_include: [
      "Objet clair et précis",
      "Corps structuré en paragraphes lisibles",
      "Ton adapté au destinataire",
      "Signature indiquée (template — à compléter par l'utilisateur)",
    ],
    must_never_include: [
      "Envoi automatique sans validation humaine",
      "Décision définitive sur sujet sensible (licenciement, sanction)",
      "Données personnelles non autorisées",
      "Phrase générique 'Cordialement, [Votre nom]'",
      "Placeholder brut non signalé",
    ],
    tone_rules: [
      "Ton entreprise — adapté selon CloneADN si configuré",
      "Professionnel, jamais robotique",
      "Formulation naturelle en français correct",
    ],
    structure_rules: [
      "Objet en première ligne",
      "Accroche, corps, conclusion",
      "Signature template clairement identifiée comme brouillon",
    ],
    formatting_rules: [
      "Texte propre, pas de markdown brut",
      "Paragraphes courts",
    ],
    validation_rules: [
      "Validation obligatoire avant envoi si sujet sensible",
      "Brouillon uniquement — jamais auto-envoyé",
    ],
    human_validation_required: false,
    premium_model_required: false,
    document_style_required_later: false,
    template_support_target_block: null,
  },

  hr_note: {
    deliverable_type: "hr_note",
    output_quality_level: "operational",
    must_include: [
      "Contexte de la situation RH",
      "Faits documentés",
      "Date et auteur",
      "Statut (brouillon, à valider, validé)",
    ],
    must_never_include: [
      "Décision disciplinaire autonome",
      "Mention d'informations non vérifiées comme faits établis",
      "Données sensibles non pertinentes",
    ],
    tone_rules: [
      "Neutre et factuel",
      "Orienté documentation opérationnelle",
    ],
    structure_rules: [
      "Titre, date, contexte, contenu, statut",
    ],
    formatting_rules: [
      "Format structuré, sections courtes",
    ],
    validation_rules: [
      "Validation recommandée pour toute note impactant le dossier employé",
    ],
    human_validation_required: false,
    premium_model_required: false,
    document_style_required_later: false,
    template_support_target_block: null,
  },

  candidate_summary: {
    deliverable_type: "candidate_summary",
    output_quality_level: "client_visible",
    must_include: [
      "Synthèse compétences et expérience pertinentes",
      "Points forts identifiés",
      "Points de vigilance le cas échéant",
      "Recommandation (sans décision définitive de recrutement)",
    ],
    must_never_include: [
      "Décision de recrutement autonome et définitive",
      "Données discriminatoires (âge, sexe, origine, santé)",
      "Phrases génériques sans contenu",
      "Prétention salariale inventée",
    ],
    tone_rules: [
      "Professionnel et objectif",
      "Orienté compétences, jamais discriminatoire",
    ],
    structure_rules: [
      "Synthèse en tête, puis détail, puis recommandation",
    ],
    formatting_rules: [
      "Sections claires, lisible par DRH",
    ],
    validation_rules: [
      "Validation humaine recommandée avant partage candidat",
    ],
    human_validation_required: false,
    premium_model_required: false,
    document_style_required_later: false,
    template_support_target_block: null,
  },

  onboarding_plan: {
    deliverable_type: "onboarding_plan",
    output_quality_level: "client_visible",
    must_include: [
      "Étapes structurées J1/S1/M1",
      "Responsable par étape",
      "Ressources requises",
      "Points de contrôle",
    ],
    must_never_include: [
      "Actions bloquantes sans validation manager",
      "Engagements non vérifiés avec le client",
      "Coûts chiffrés sans source",
    ],
    tone_rules: [
      "Professionnel et bienveillant",
      "Orienté intégration réussie",
    ],
    structure_rules: [
      "Timeline avec jalons clairs",
      "Format tabulaire ou liste numérotée",
    ],
    formatting_rules: [
      "Lisible par RRH et manager",
    ],
    validation_rules: [
      "Validation manager recommandée avant remise au salarié",
    ],
    human_validation_required: false,
    premium_model_required: false,
    document_style_required_later: false,
    template_support_target_block: "B45",
  },

  absence_followup: {
    deliverable_type: "absence_followup",
    output_quality_level: "client_visible",
    must_include: [
      "Période d'absence documentée",
      "Type d'absence (maladie, congé, etc.)",
      "Impacts sur la mission/équipe",
      "Prochaines actions recommandées",
    ],
    must_never_include: [
      "Décision de sanction autonome",
      "Mention de diagnostic médical",
      "Données de santé non autorisées",
    ],
    tone_rules: [
      "Neutre et factuel",
      "Jamais invasif sur la vie privée",
    ],
    structure_rules: [
      "Contexte, faits, impact, actions",
    ],
    formatting_rules: [
      "Structuré et lisible par RRH",
    ],
    validation_rules: [
      "Validation si sujet sensible (maladie longue durée, disciplinaire)",
    ],
    human_validation_required: false,
    premium_model_required: false,
    document_style_required_later: false,
    template_support_target_block: null,
  },

  prepayroll_summary: {
    deliverable_type: "prepayroll_summary",
    output_quality_level: "premium_client_visible",
    must_include: [
      "Liste des variables de paie à vérifier",
      "Anomalies détectées (absences, heures supplémentaires, etc.)",
      "Justificatifs manquants",
      "Rappel de validation obligatoire avant transmission paie/DSN",
    ],
    must_never_include: [
      "Calcul de salaire net définitif",
      "Déclaration DSN autonome",
      "Prétention de remplacer le logiciel de paie",
      "Engagement fiscal ou social non vérifié",
    ],
    tone_rules: [
      "Factuel et précis",
      "Orienté aide à la décision, pas décision",
    ],
    structure_rules: [
      "Variables, anomalies, justificatifs, statut validation",
    ],
    formatting_rules: [
      "Format tabulaire recommandé",
      "Chaque anomalie clairement identifiée",
    ],
    validation_rules: [
      "Validation humaine OBLIGATOIRE avant transmission au service paie",
      "Pierre ne remplace jamais le service paie ni la DSN",
    ],
    human_validation_required: true,
    premium_model_required: false,
    document_style_required_later: true,
    template_support_target_block: "B45",
  },

  employee_file_summary: {
    deliverable_type: "employee_file_summary",
    output_quality_level: "client_visible",
    must_include: [
      "Données principales du dossier (poste, ancienneté, contrat)",
      "Historique RH pertinent",
      "Points d'attention identifiés",
    ],
    must_never_include: [
      "Données médicales sans autorisation",
      "Décision sur le dossier sans validation",
      "Informations non présentes dans le dossier source",
    ],
    tone_rules: [
      "Synthétique et factuel",
    ],
    structure_rules: [
      "Fiche structurée : identité, contrat, historique, alertes",
    ],
    formatting_rules: [
      "Lisible par RRH et manager",
    ],
    validation_rules: [
      "Validation si données sensibles ou historique disciplinaire",
    ],
    human_validation_required: false,
    premium_model_required: false,
    document_style_required_later: false,
    template_support_target_block: "B44",
  },

  certificate_draft: {
    deliverable_type: "certificate_draft",
    output_quality_level: "official_document",
    must_include: [
      "Identification de l'entreprise (nom, adresse, SIRET)",
      "Identification du salarié (nom, prénom, poste)",
      "Période de travail certifiée",
      "Variables manquantes explicitement listées",
      "Mention 'À valider par DRH avant signature'",
    ],
    must_never_include: [
      "Signature automatique",
      "Informations inventées non vérifiées",
      "Mentions juridiques non conformes à la législation française",
      "Envoi automatique sans validation",
    ],
    tone_rules: [
      "Formel et administratif",
      "Vocabulaire juridique correct",
    ],
    structure_rules: [
      "En-tête entreprise, corps certificat, date, signature placeholder",
    ],
    formatting_rules: [
      "Style officiel — nécessite charte entreprise (B45)",
      "Aucun markdown brut dans version finale",
    ],
    validation_rules: [
      "Validation humaine OBLIGATOIRE avant signature et remise",
      "Template style entreprise requis via B45",
    ],
    human_validation_required: true,
    premium_model_required: true,
    document_style_required_later: true,
    template_support_target_block: "B45",
  },

  contract_draft: {
    deliverable_type: "contract_draft",
    output_quality_level: "official_document",
    must_include: [
      "Parties contractantes identifiées",
      "Objet du contrat",
      "Durée, lieu, rémunération (à compléter si manquants)",
      "Variables manquantes explicitement listées",
      "Mention 'Brouillon — validation juridique obligatoire'",
    ],
    must_never_include: [
      "Signature automatique",
      "Décision juridique définitive",
      "Clauses inventées non conformes au droit du travail français",
      "Envoi automatique sans validation RH et juridique",
    ],
    tone_rules: [
      "Formel et juridiquement précis",
      "Jamais approximatif sur les obligations contractuelles",
    ],
    structure_rules: [
      "Préambule, articles numérotés, date, signatures placeholder",
    ],
    formatting_rules: [
      "Format contrat officiel — charte entreprise via B45",
      "Aucun markdown brut dans version finale",
    ],
    validation_rules: [
      "Validation RH ET juridique OBLIGATOIRE",
      "Ne jamais présenter comme contrat final sans validation",
    ],
    human_validation_required: true,
    premium_model_required: true,
    document_style_required_later: true,
    template_support_target_block: "B45",
  },

  amendment_draft: {
    deliverable_type: "amendment_draft",
    output_quality_level: "official_document",
    must_include: [
      "Référence au contrat original",
      "Clauses modifiées clairement identifiées",
      "Date d'entrée en vigueur",
      "Variables manquantes listées",
      "Mention 'Avenant — validation obligatoire'",
    ],
    must_never_include: [
      "Signature automatique",
      "Modification rétroactive non explicite",
      "Clauses contraires au droit du travail",
      "Envoi automatique",
    ],
    tone_rules: [
      "Formel et précis",
      "Référence explicite au contrat source",
    ],
    structure_rules: [
      "Référence contrat, articles modifiés, date, signatures placeholder",
    ],
    formatting_rules: [
      "Format avenant officiel — charte B45",
    ],
    validation_rules: [
      "Validation RH ET juridique OBLIGATOIRE",
    ],
    human_validation_required: true,
    premium_model_required: true,
    document_style_required_later: true,
    template_support_target_block: "B45",
  },

  executive_report: {
    deliverable_type: "executive_report",
    output_quality_level: "premium_client_visible",
    must_include: [
      "Synthèse exécutive en tête",
      "Données chiffrées vérifiées",
      "Recommandations opérationnelles",
      "Conclusion et prochaine action claire",
    ],
    must_never_include: [
      "Phrase générique sans valeur ('Voici un rapport...')",
      "Données inventées ou non vérifiées",
      "Décisions autonomes engageant la direction",
      "Markdown brut non rendu",
    ],
    tone_rules: [
      "Niveau dirigeant DRH",
      "Percutant et synthétique",
      "Formulation soignée, jamais robotique",
    ],
    structure_rules: [
      "Synthèse exécutive, contexte, analyse, recommandations, conclusion",
    ],
    formatting_rules: [
      "Sections titrées, tables si données chiffrées",
      "Aucun placeholder visible",
    ],
    validation_rules: [
      "Validation humaine avant présentation direction",
    ],
    human_validation_required: true,
    premium_model_required: true,
    document_style_required_later: true,
    template_support_target_block: "B45",
  },

  pdf_export: {
    deliverable_type: "pdf_export",
    output_quality_level: "premium_client_visible",
    must_include: [
      "Contenu généré par un livrable validé (contrat, attestation, rapport)",
      "En-tête et pied de page selon charte entreprise (B45 requis)",
      "Variables résolues ou explicitement listées",
    ],
    must_never_include: [
      "Markdown brut non converti",
      "Placeholder visible dans le PDF final",
      "Contenu non validé par humain si document officiel",
    ],
    tone_rules: [
      "Hérité du livrable source (contrat, rapport, etc.)",
    ],
    structure_rules: [
      "Mise en page conforme à la charte entreprise",
    ],
    formatting_rules: [
      "PDF propre — aucun artifact markdown",
      "En-tête/pied de page/logo si disponible (B45)",
      "Lisible et imprimable directement",
    ],
    validation_rules: [
      "Validation humaine obligatoire si export d'un document officiel",
    ],
    human_validation_required: false,
    premium_model_required: true,
    document_style_required_later: true,
    template_support_target_block: "B45",
  },

  spreadsheet_export: {
    deliverable_type: "spreadsheet_export",
    output_quality_level: "client_visible",
    must_include: [
      "Colonnes nommées et cohérentes",
      "Données sources identifiées",
      "Onglets organisés si plusieurs sections",
    ],
    must_never_include: [
      "Calculs inventés",
      "Formules cachées incorrectes",
      "Données personnelles non autorisées dans export",
    ],
    tone_rules: [
      "Factuel et structuré",
    ],
    structure_rules: [
      "En-tête de colonnes clair, lignes cohérentes",
    ],
    formatting_rules: [
      "Format tabulaire propre",
      "Pas de cellules vides non justifiées",
    ],
    validation_rules: [
      "Vérification des formules/totaux recommandée",
    ],
    human_validation_required: false,
    premium_model_required: false,
    document_style_required_later: false,
    template_support_target_block: "B45",
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getPierreDeliverableContract(
  type: PierreDeliverableType,
): PierreDeliverableQualityContract {
  return PIERRE_DELIVERABLE_CONTRACTS[type];
}

export function getAllPierreDeliverableContracts(): PierreDeliverableQualityContract[] {
  return Object.values(PIERRE_DELIVERABLE_CONTRACTS);
}

export function listDeliverableTypesRequiringHumanValidation(): PierreDeliverableType[] {
  return Object.values(PIERRE_DELIVERABLE_CONTRACTS)
    .filter((c) => c.human_validation_required)
    .map((c) => c.deliverable_type);
}

export function listDeliverableTypesTargetingB45(): PierreDeliverableType[] {
  return Object.values(PIERRE_DELIVERABLE_CONTRACTS)
    .filter((c) => c.template_support_target_block === "B45")
    .map((c) => c.deliverable_type);
}

export function deliverableNeverAllowsAutoSend(type: PierreDeliverableType): boolean {
  const contract = PIERRE_DELIVERABLE_CONTRACTS[type];
  return contract.must_never_include.some(
    (rule) => rule.toLowerCase().includes("auto") && rule.toLowerCase().includes("send"),
  ) || contract.must_never_include.some(
    (rule) => rule.toLowerCase().includes("automatique"),
  );
}
