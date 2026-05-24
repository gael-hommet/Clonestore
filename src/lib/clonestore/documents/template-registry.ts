// src/lib/clonestore/documents/template-registry.ts
// 12 default CloneStore/Pierre document templates — Bloc 27
// Pure: no async, no side effects, no imports outside types/utils.

import type {
  CloneDocumentTemplate,
  CloneDocumentTheme,
  CloneDocumentSignature,
  CloneDocumentTemplateIndex,
} from "./types";

// ── Default theme ─────────────────────────────────────────────────────────────

export function buildDefaultCloneDocumentTheme(): CloneDocumentTheme {
  return {
    name: "pierre_default",
    primary_color: "#1a1a2e",
    accent_color: "#4f6ef2",
    text_color: "#1a1a1a",
    background_color: "#ffffff",
    font_family: "'Segoe UI', Arial, Helvetica, sans-serif",
    border_radius: "4px",
    density: "comfortable",
  };
}

// ── Default signature ─────────────────────────────────────────────────────────

export function buildDefaultCloneDocumentSignature(): CloneDocumentSignature {
  return {
    name: null,
    role: "Service RH",
    company: null,
    email: null,
    phone: null,
    legal_footer:
      "Ce document a été préparé par Pierre comme brouillon opérationnel. Il ne constitue pas une décision juridique définitive.",
  };
}

// ── Default templates ─────────────────────────────────────────────────────────

export function buildCloneDocumentTemplateRegistry(): CloneDocumentTemplate[] {
  const theme = buildDefaultCloneDocumentTheme();
  const signature = buildDefaultCloneDocumentSignature();
  const now = new Date().toISOString();

  return [
    // ── 1. hr_contract_draft ───────────────────────────────────────
    {
      id: "pierre_hr_contract_draft_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "hr_contract_draft",
      title: "Contrat de travail (brouillon)",
      description:
        "Brouillon de contrat de travail CDI/CDD. Validation juridique humaine obligatoire avant tout usage officiel.",
      audience: "employee",
      default_format: "pdf_ready_html",
      tone: "formal",
      risk_level: "high",
      validation_mode: "required",
      variables: [
        { key: "company_name", label: "Nom de l'entreprise", required: true, description: "Raison sociale de l'employeur", fallback: "[Entreprise]", sensitive: false },
        { key: "employee_name", label: "Nom du salarié", required: true, description: "Nom complet du salarié", fallback: "[Salarié]", sensitive: false },
        { key: "position", label: "Poste", required: true, description: "Intitulé du poste", fallback: "[Poste]", sensitive: false },
        { key: "contract_type", label: "Type de contrat", required: true, description: "CDI ou CDD", fallback: "[CDI/CDD]", sensitive: false },
        { key: "start_date", label: "Date de début", required: true, description: "Date de prise de poste", fallback: "[Date]", sensitive: false },
        { key: "salary", label: "Salaire brut mensuel", required: true, description: "Rémunération mensuelle brute", fallback: "[Salaire]", sensitive: true },
        { key: "trial_period", label: "Période d'essai", required: false, description: "Durée de la période d'essai", fallback: null, sensitive: false },
        { key: "manager_name", label: "Nom du responsable", required: false, description: "Supérieur hiérarchique", fallback: null, sensitive: false },
        { key: "address", label: "Adresse du salarié", required: false, description: "Adresse personnelle", fallback: "[Adresse]", sensitive: true },
        { key: "location", label: "Lieu de signature", required: false, description: "Ville de signature", fallback: "[Lieu]", sensitive: false },
        { key: "collective_agreement", label: "Convention collective", required: false, description: "Convention collective applicable", fallback: null, sensitive: false },
      ],
      blocks: [
        { id: "header", type: "header", label: "En-tête", content: "{{company_name}}\nCONTRAT DE TRAVAIL — BROUILLON", optional: false, variables: ["company_name"], risk_level: "low" },
        { id: "legal_notice_draft", type: "legal_notice", label: "Avis brouillon", content: "ATTENTION : Ce document est un brouillon préparé par Pierre. Il ne constitue pas un contrat juridiquement valide. Une validation juridique humaine est obligatoire avant toute signature.", optional: false, variables: [], risk_level: "high" },
        { id: "parties", type: "paragraph", label: "Entre les parties", content: "Entre la société {{company_name}}, ci-après dénommée l'Employeur,\n\net {{employee_name}}, demeurant {{address}}, ci-après dénommé(e) le Salarié,\n\nil est convenu ce qui suit.", optional: false, variables: ["company_name", "employee_name", "address"], risk_level: "medium" },
        { id: "engagement", type: "paragraph", label: "Article 1 — Engagement", content: "{{company_name}} engage {{employee_name}} en qualité de {{position}}, à compter du {{start_date}}, dans le cadre d'un contrat à durée {{contract_type}}.\n\nLe Salarié exercera ses fonctions sous la responsabilité de {{manager_name}}.", optional: false, variables: ["company_name", "employee_name", "position", "start_date", "contract_type", "manager_name"], risk_level: "medium" },
        { id: "remuneration", type: "paragraph", label: "Article 2 — Rémunération", content: "Le Salarié percevra une rémunération mensuelle brute de {{salary}}.\n\nCette rémunération sera versée mensuellement selon les modalités légales en vigueur.", optional: false, variables: ["salary"], risk_level: "high" },
        { id: "essai", type: "paragraph", label: "Article 3 — Période d'essai", content: "Le présent contrat est conclu sous réserve d'une période d'essai de {{trial_period}}.", optional: true, variables: ["trial_period"], risk_level: "low" },
        { id: "general", type: "paragraph", label: "Article 4 — Dispositions générales", content: "Le présent contrat est soumis aux dispositions légales et conventionnelles en vigueur, notamment celles issues de la convention collective {{collective_agreement}}.", optional: false, variables: ["collective_agreement"], risk_level: "medium" },
        { id: "signature", type: "signature", label: "Signatures", content: "Fait à {{location}}, le {{date}}.\n\nPour {{company_name}} :\n_____________________\n\nLu et approuvé — {{employee_name}} :\n_____________________", optional: false, variables: ["location", "date", "company_name", "employee_name"], risk_level: "low" },
        { id: "footer", type: "footer", label: "Pied de page", content: "Brouillon Pierre — Document soumis à validation humaine avant toute utilisation officielle.", optional: false, variables: [], risk_level: "low" },
      ],
      theme,
      signature,
      tags: ["contrat", "rh", "brouillon", "validation_requise", "juridique"],
      created_at: now,
      updated_at: now,
    },

    // ── 2. hr_contract_amendment ───────────────────────────────────
    {
      id: "pierre_hr_amendment_draft_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "hr_contract_amendment",
      title: "Avenant au contrat de travail (brouillon)",
      description:
        "Brouillon d'avenant pour modifier un contrat de travail existant. Validation juridique obligatoire.",
      audience: "employee",
      default_format: "pdf_ready_html",
      tone: "formal",
      risk_level: "high",
      validation_mode: "required",
      variables: [
        { key: "company_name", label: "Nom de l'entreprise", required: true, description: "Raison sociale", fallback: "[Entreprise]", sensitive: false },
        { key: "employee_name", label: "Nom du salarié", required: true, description: "Nom complet", fallback: "[Salarié]", sensitive: false },
        { key: "amendment_subject", label: "Objet de l'avenant", required: true, description: "Ce qui est modifié", fallback: "[Modification]", sensitive: false },
        { key: "effective_date", label: "Date d'entrée en vigueur", required: true, description: "À partir de quand", fallback: "[Date]", sensitive: false },
        { key: "position", label: "Nouveau poste", required: false, description: "Poste modifié si applicable", fallback: null, sensitive: false },
        { key: "salary", label: "Nouvelle rémunération", required: false, description: "Salaire modifié si applicable", fallback: null, sensitive: true },
        { key: "location", label: "Lieu de signature", required: false, description: "Ville", fallback: "[Lieu]", sensitive: false },
        { key: "manager_name", label: "Responsable", required: false, description: "Signataire entreprise", fallback: null, sensitive: false },
      ],
      blocks: [
        { id: "header", type: "header", label: "En-tête", content: "{{company_name}}\nAVENANT AU CONTRAT DE TRAVAIL — BROUILLON", optional: false, variables: ["company_name"], risk_level: "low" },
        { id: "legal_notice", type: "legal_notice", label: "Avis brouillon", content: "ATTENTION : Ce document est un brouillon. Validation juridique humaine obligatoire avant signature.", optional: false, variables: [], risk_level: "high" },
        { id: "parties", type: "paragraph", label: "Entre les parties", content: "Entre {{company_name}} et {{employee_name}},\n\nIl est convenu de modifier le contrat de travail initial par le présent avenant.", optional: false, variables: ["company_name", "employee_name"], risk_level: "medium" },
        { id: "objet", type: "paragraph", label: "Objet", content: "Le présent avenant a pour objet de modifier les dispositions suivantes :\n\n{{amendment_subject}}", optional: false, variables: ["amendment_subject"], risk_level: "medium" },
        { id: "conditions", type: "paragraph", label: "Nouvelles conditions", content: "À compter du {{effective_date}} :\n\nPoste : {{position}}\nRémunération : {{salary}}", optional: false, variables: ["effective_date", "position", "salary"], risk_level: "high" },
        { id: "maintien", type: "paragraph", label: "Maintien des autres clauses", content: "Toutes les autres clauses du contrat de travail initial demeurent inchangées.", optional: false, variables: [], risk_level: "low" },
        { id: "signature", type: "signature", label: "Signatures", content: "Fait à {{location}}, le {{date}}.\n\nPour {{company_name}} : {{manager_name}}\n_____________________\n\nLu et approuvé — {{employee_name}} :\n_____________________", optional: false, variables: ["location", "date", "company_name", "manager_name", "employee_name"], risk_level: "low" },
        { id: "footer", type: "footer", label: "Pied de page", content: "Brouillon Pierre — Soumis à validation humaine.", optional: false, variables: [], risk_level: "low" },
      ],
      theme,
      signature,
      tags: ["avenant", "contrat", "modification", "brouillon"],
      created_at: now,
      updated_at: now,
    },

    // ── 3. candidate_rejection ─────────────────────────────────────
    {
      id: "pierre_candidate_rejection_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "candidate_rejection",
      title: "Refus de candidature",
      description: "Lettre de refus professionnelle et bienveillante adressée à un candidat.",
      audience: "candidate",
      default_format: "html",
      tone: "candidate_friendly",
      risk_level: "low",
      validation_mode: "recommended",
      variables: [
        { key: "candidate_name", label: "Nom du candidat", required: true, description: "Nom complet du candidat", fallback: "Madame, Monsieur", sensitive: false },
        { key: "position", label: "Poste", required: true, description: "Poste pour lequel il a postulé", fallback: "[Poste]", sensitive: false },
        { key: "company_name", label: "Nom de l'entreprise", required: true, description: "Entreprise recruteur", fallback: "[Entreprise]", sensitive: false },
        { key: "manager_name", label: "Signataire", required: false, description: "Nom du recruteur ou RH", fallback: "Le service RH", sensitive: false },
      ],
      blocks: [
        { id: "salutation", type: "paragraph", label: "Salutation", content: "Madame, Monsieur {{candidate_name}},", optional: false, variables: ["candidate_name"], risk_level: "low" },
        { id: "corps", type: "paragraph", label: "Corps", content: "Nous avons bien reçu votre candidature pour le poste de {{position}} au sein de {{company_name}} et vous remercions de l'intérêt que vous portez à notre entreprise.\n\nAprès examen attentif de votre dossier, nous avons le regret de vous informer que votre candidature n'a pas été retenue pour cette opportunité.", optional: false, variables: ["position", "company_name"], risk_level: "low" },
        { id: "encouragement", type: "paragraph", label: "Encouragement", content: "Nous vous souhaitons plein succès dans vos recherches d'emploi et espérons avoir l'opportunité de reconsidérer votre profil pour de futures opportunités.", optional: true, variables: [], risk_level: "low" },
        { id: "signature", type: "signature", label: "Signature", content: "Cordialement,\n\n{{manager_name}}\nService RH — {{company_name}}", optional: false, variables: ["manager_name", "company_name"], risk_level: "low" },
      ],
      theme,
      signature,
      tags: ["refus", "candidat", "recrutement", "email"],
      created_at: now,
      updated_at: now,
    },

    // ── 4. interview_invitation ────────────────────────────────────
    {
      id: "pierre_interview_invitation_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "interview_invitation",
      title: "Convocation à entretien",
      description: "Convocation professionnelle pour un entretien d'embauche ou RH.",
      audience: "candidate",
      default_format: "html",
      tone: "formal",
      risk_level: "low",
      validation_mode: "recommended",
      variables: [
        { key: "candidate_name", label: "Nom du candidat/salarié", required: true, description: "Destinataire", fallback: "[Destinataire]", sensitive: false },
        { key: "position", label: "Poste", required: true, description: "Poste concerné", fallback: "[Poste]", sensitive: false },
        { key: "company_name", label: "Entreprise", required: true, description: "Recruteur", fallback: "[Entreprise]", sensitive: false },
        { key: "date", label: "Date de l'entretien", required: true, description: "Quand", fallback: "[Date]", sensitive: false },
        { key: "time", label: "Heure", required: true, description: "À quelle heure", fallback: "[Heure]", sensitive: false },
        { key: "location", label: "Lieu", required: true, description: "Adresse ou visio", fallback: "[Lieu]", sensitive: false },
        { key: "manager_name", label: "Contact", required: false, description: "Responsable entretien", fallback: "Le service RH", sensitive: false },
        { key: "interview_type", label: "Type d'entretien", required: false, description: "RH, technique, etc.", fallback: "entretien", sensitive: false },
      ],
      blocks: [
        { id: "salutation", type: "paragraph", label: "Salutation", content: "Madame, Monsieur {{candidate_name}},", optional: false, variables: ["candidate_name"], risk_level: "low" },
        { id: "objet", type: "paragraph", label: "Objet", content: "Nous avons le plaisir de vous convier à un {{interview_type}} pour le poste de {{position}} au sein de {{company_name}}.", optional: false, variables: ["interview_type", "position", "company_name"], risk_level: "low" },
        { id: "details", type: "paragraph", label: "Détails", content: "Date : {{date}}\nHeure : {{time}}\nLieu : {{location}}", optional: false, variables: ["date", "time", "location"], risk_level: "low" },
        { id: "preparation", type: "paragraph", label: "Préparation", content: "Merci de confirmer votre présence en répondant à cet email ou en contactant {{manager_name}}.", optional: true, variables: ["manager_name"], risk_level: "low" },
        { id: "signature", type: "signature", label: "Signature", content: "Cordialement,\n\n{{manager_name}}\nService RH — {{company_name}}", optional: false, variables: ["manager_name", "company_name"], risk_level: "low" },
      ],
      theme,
      signature,
      tags: ["entretien", "convocation", "recrutement"],
      created_at: now,
      updated_at: now,
    },

    // ── 5. onboarding_plan ─────────────────────────────────────────
    {
      id: "pierre_onboarding_plan_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "onboarding_plan",
      title: "Plan d'onboarding",
      description: "Guide d'accueil et plan d'intégration pour un nouveau salarié.",
      audience: "employee",
      default_format: "html",
      tone: "warm",
      risk_level: "medium",
      validation_mode: "recommended",
      variables: [
        { key: "employee_name", label: "Prénom et nom", required: true, description: "Nouveau salarié", fallback: "[Salarié]", sensitive: false },
        { key: "company_name", label: "Entreprise", required: true, description: "Employeur", fallback: "[Entreprise]", sensitive: false },
        { key: "position", label: "Poste", required: true, description: "Intitulé du poste", fallback: "[Poste]", sensitive: false },
        { key: "start_date", label: "Date d'arrivée", required: true, description: "Jour J", fallback: "[Date]", sensitive: false },
        { key: "manager_name", label: "Manager", required: false, description: "Responsable direct", fallback: null, sensitive: false },
        { key: "department", label: "Département", required: false, description: "Service d'intégration", fallback: null, sensitive: false },
        { key: "buddy_name", label: "Référent intégration", required: false, description: "Binôme", fallback: null, sensitive: false },
        { key: "location", label: "Lieu de travail", required: false, description: "Site ou adresse", fallback: null, sensitive: false },
        { key: "it_contact", label: "Contact IT", required: false, description: "Pour accès informatique", fallback: null, sensitive: false },
      ],
      blocks: [
        { id: "bienvenue", type: "title", label: "Bienvenue", content: "Bienvenue chez {{company_name}}, {{employee_name}} !", optional: false, variables: ["company_name", "employee_name"], risk_level: "low" },
        { id: "intro", type: "paragraph", label: "Introduction", content: "Nous sommes ravis de vous accueillir en qualité de {{position}} à compter du {{start_date}}. Ce document vous guidera pour vos premiers jours parmi nous.", optional: false, variables: ["position", "start_date"], risk_level: "low" },
        { id: "equipe", type: "paragraph", label: "Votre équipe", content: "Vous intégrerez le département {{department}}, sous la responsabilité de {{manager_name}}. Votre référent intégration sera {{buddy_name}}.", optional: true, variables: ["department", "manager_name", "buddy_name"], risk_level: "low" },
        { id: "pratique", type: "paragraph", label: "Informations pratiques", content: "Lieu de travail : {{location}}\nContact IT : {{it_contact}}\n\nMerci de vous présenter à l'accueil le {{start_date}} à 9h00 avec une pièce d'identité.", optional: true, variables: ["location", "it_contact", "start_date"], risk_level: "low" },
        { id: "documents", type: "bullet_list", label: "Documents à fournir", content: "Pièce d'identité en cours de validité\nRIB pour versement du salaire\nAttestation de sécurité sociale\nDiplômes si requis pour le poste", optional: false, variables: [], risk_level: "low" },
        { id: "contact", type: "signature", label: "Contact RH", content: "Pour toute question : {{manager_name}}\nService RH — {{company_name}}", optional: false, variables: ["manager_name", "company_name"], risk_level: "low" },
      ],
      theme,
      signature,
      tags: ["onboarding", "accueil", "intégration", "rh"],
      created_at: now,
      updated_at: now,
    },

    // ── 6. absence_followup ────────────────────────────────────────
    {
      id: "pierre_absence_followup_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "absence_followup",
      title: "Suivi d'absence",
      description: "Document de suivi ou relance pour une absence non justifiée ou prolongée.",
      audience: "employee",
      default_format: "html",
      tone: "neutral",
      risk_level: "medium",
      validation_mode: "recommended",
      variables: [
        { key: "employee_name", label: "Salarié", required: true, description: "Nom du salarié concerné", fallback: "[Salarié]", sensitive: false },
        { key: "absence_type", label: "Type d'absence", required: true, description: "Maladie, congé, etc.", fallback: "[Absence]", sensitive: false },
        { key: "start_date", label: "Date de début", required: true, description: "Début de l'absence", fallback: "[Date]", sensitive: false },
        { key: "end_date", label: "Date de fin prévue", required: false, description: "Retour estimé", fallback: null, sensitive: false },
        { key: "justification", label: "Justification fournie", required: false, description: "Pièce justificative", fallback: null, sensitive: false },
        { key: "manager_name", label: "Manager", required: false, description: "Responsable", fallback: "Le service RH", sensitive: false },
        { key: "company_name", label: "Entreprise", required: false, description: "Employeur", fallback: null, sensitive: false },
        { key: "deadline", label: "Délai de justification", required: false, description: "Avant quelle date", fallback: "48 heures", sensitive: false },
      ],
      blocks: [
        { id: "salutation", type: "paragraph", label: "Salutation", content: "Madame, Monsieur {{employee_name}},", optional: false, variables: ["employee_name"], risk_level: "low" },
        { id: "objet", type: "paragraph", label: "Objet", content: "Nous vous contactons au sujet de votre absence de type «{{absence_type}}» débutée le {{start_date}}.", optional: false, variables: ["absence_type", "start_date"], risk_level: "low" },
        { id: "justification", type: "paragraph", label: "Justification", content: "{{justification}}\n\nUn justificatif médical ou administratif doit nous parvenir dans un délai de {{deadline}} à compter de la date du début de l'absence.", optional: true, variables: ["justification", "deadline"], risk_level: "medium" },
        { id: "action", type: "callout", label: "Action requise", content: "Merci de bien vouloir nous transmettre les éléments justificatifs nécessaires ou de nous contacter pour régulariser votre situation.", optional: false, variables: [], risk_level: "medium" },
        { id: "signature", type: "signature", label: "Signature", content: "Cordialement,\n\n{{manager_name}}\nService RH — {{company_name}}", optional: false, variables: ["manager_name", "company_name"], risk_level: "low" },
      ],
      theme,
      signature,
      tags: ["absence", "suivi", "relance", "rh"],
      created_at: now,
      updated_at: now,
    },

    // ── 7. prepay_summary ──────────────────────────────────────────
    {
      id: "pierre_prepay_summary_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "prepay_summary",
      title: "Synthèse pré-paie",
      description:
        "Document confidentiel de transmission des éléments variables de paie. Validation manager/RH requise.",
      audience: "internal",
      default_format: "pdf_ready_html",
      tone: "neutral",
      risk_level: "high",
      validation_mode: "required",
      variables: [
        { key: "employee_name", label: "Salarié", required: true, description: "Nom complet", fallback: "[Salarié]", sensitive: true },
        { key: "period", label: "Période", required: true, description: "Mois/année concerné", fallback: "[Période]", sensitive: false },
        { key: "company_name", label: "Entreprise", required: true, description: "Employeur", fallback: "[Entreprise]", sensitive: false },
        { key: "base_salary", label: "Salaire de base brut", required: false, description: "Mensuel brut fixe", fallback: null, sensitive: true },
        { key: "variable_elements", label: "Éléments variables", required: false, description: "Primes, commissions, etc.", fallback: null, sensitive: true },
        { key: "absences", label: "Absences", required: false, description: "Jours d'absence", fallback: null, sensitive: false },
        { key: "bonuses", label: "Primes", required: false, description: "Primes exceptionnelles", fallback: null, sensitive: true },
        { key: "manager_name", label: "Validateur", required: false, description: "Manager ou RH validant", fallback: null, sensitive: false },
      ],
      blocks: [
        { id: "header", type: "header", label: "En-tête confidentiel", content: "DOCUMENT CONFIDENTIEL — USAGE INTERNE UNIQUEMENT\nÉLÉMENTS DE PRÉ-PAIE — {{period}}", optional: false, variables: ["period"], risk_level: "high" },
        { id: "identification", type: "paragraph", label: "Identification", content: "Salarié : {{employee_name}}\nPériode : {{period}}\nSociété : {{company_name}}", optional: false, variables: ["employee_name", "period", "company_name"], risk_level: "high" },
        { id: "elements_fixes", type: "paragraph", label: "Éléments fixes", content: "Salaire de base mensuel brut : {{base_salary}}", optional: false, variables: ["base_salary"], risk_level: "high" },
        { id: "elements_variables", type: "paragraph", label: "Éléments variables", content: "Éléments variables : {{variable_elements}}\nAbsences : {{absences}}\nPrimes : {{bonuses}}", optional: true, variables: ["variable_elements", "absences", "bonuses"], risk_level: "high" },
        { id: "validation", type: "callout", label: "Validation requise", content: "Ces éléments sont soumis à validation par le responsable hiérarchique avant transmission au service paie.\n\nValidé par : {{manager_name}}", optional: false, variables: ["manager_name"], risk_level: "high" },
        { id: "footer", type: "footer", label: "Pied de page", content: "Document confidentiel Pierre — Validation humaine obligatoire avant transmission.", optional: false, variables: [], risk_level: "high" },
      ],
      theme,
      signature,
      tags: ["paie", "pré-paie", "confidentiel", "validation_requise"],
      created_at: now,
      updated_at: now,
    },

    // ── 8. employee_file_summary ───────────────────────────────────
    {
      id: "pierre_employee_file_summary_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "employee_file_summary",
      title: "Synthèse dossier salarié",
      description: "Synthèse récapitulative confidentielle du dossier d'un salarié.",
      audience: "internal",
      default_format: "html",
      tone: "neutral",
      risk_level: "medium",
      validation_mode: "recommended",
      variables: [
        { key: "employee_name", label: "Salarié", required: true, description: "Nom complet", fallback: "[Salarié]", sensitive: false },
        { key: "company_name", label: "Entreprise", required: true, description: "Employeur", fallback: "[Entreprise]", sensitive: false },
        { key: "position", label: "Poste", required: false, description: "Intitulé du poste actuel", fallback: null, sensitive: false },
        { key: "department", label: "Département", required: false, description: "Service", fallback: null, sensitive: false },
        { key: "hire_date", label: "Date d'embauche", required: false, description: "Date d'entrée", fallback: null, sensitive: false },
        { key: "salary", label: "Rémunération", required: false, description: "Salaire actuel", fallback: null, sensitive: true },
        { key: "status", label: "Statut", required: false, description: "Statut contractuel", fallback: null, sensitive: false },
        { key: "manager_name", label: "Manager", required: false, description: "Responsable hiérarchique", fallback: null, sensitive: false },
      ],
      blocks: [
        { id: "header", type: "header", label: "En-tête", content: "SYNTHÈSE DOSSIER SALARIÉ — {{company_name}}\nConfidentiel", optional: false, variables: ["company_name"], risk_level: "medium" },
        { id: "identite", type: "paragraph", label: "Identité", content: "Nom : {{employee_name}}\nPoste : {{position}}\nDépartement : {{department}}\nDate d'entrée : {{hire_date}}\nStatut : {{status}}", optional: false, variables: ["employee_name", "position", "department", "hire_date", "status"], risk_level: "medium" },
        { id: "contrat", type: "paragraph", label: "Éléments contractuels", content: "Rémunération : {{salary}}\nResponsable hiérarchique : {{manager_name}}", optional: true, variables: ["salary", "manager_name"], risk_level: "high" },
        { id: "note", type: "legal_notice", label: "Note RH", content: "Document établi par le service RH de {{company_name}}. Strictement confidentiel.", optional: false, variables: ["company_name"], risk_level: "medium" },
      ],
      theme,
      signature,
      tags: ["synthèse", "dossier", "salarié", "confidentiel"],
      created_at: now,
      updated_at: now,
    },

    // ── 9. sensitive_case_note ─────────────────────────────────────
    {
      id: "pierre_sensitive_case_note_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "sensitive_case_note",
      title: "Note de cas sensible",
      description:
        "Note interne pour dossiers RH sensibles (disciplinaire, harcelèment, contentieux). Validation humaine obligatoire.",
      audience: "internal",
      default_format: "html",
      tone: "neutral",
      risk_level: "critical",
      validation_mode: "human_only",
      variables: [
        { key: "note_subject", label: "Objet de la note", required: true, description: "Sujet principal", fallback: "[Objet]", sensitive: true },
        { key: "employee_name", label: "Salarié concerné", required: false, description: "Nom du salarié", fallback: null, sensitive: true },
        { key: "author", label: "Auteur", required: false, description: "Rédacteur de la note", fallback: null, sensitive: false },
        { key: "company_name", label: "Entreprise", required: false, description: "Employeur", fallback: null, sensitive: false },
        { key: "action_required", label: "Action requise", required: false, description: "Ce qui doit être fait", fallback: null, sensitive: false },
        { key: "risk_summary", label: "Résumé du risque", required: false, description: "Niveau et nature du risque", fallback: null, sensitive: true },
      ],
      blocks: [
        { id: "header", type: "header", label: "En-tête critique", content: "NOTE CONFIDENTIELLE — CAS SENSIBLE\nValidation humaine obligatoire", optional: false, variables: [], risk_level: "critical" },
        { id: "critical_notice", type: "legal_notice", label: "Avis critique", content: "IMPORTANT : Ce document contient des informations sensibles à caractère juridique et/ou disciplinaire. Il ne peut être utilisé, diffusé ou archivé qu'après validation explicite par un responsable RH ou juridique habilité.", optional: false, variables: [], risk_level: "critical" },
        { id: "objet", type: "paragraph", label: "Objet", content: "{{note_subject}}", optional: false, variables: ["note_subject"], risk_level: "critical" },
        { id: "contexte", type: "paragraph", label: "Contexte", content: "Salarié concerné : {{employee_name}}\nAuteur : {{author}}\nRésumé du risque : {{risk_summary}}", optional: true, variables: ["employee_name", "author", "risk_summary"], risk_level: "critical" },
        { id: "action", type: "callout", label: "Action requise", content: "{{action_required}}", optional: true, variables: ["action_required"], risk_level: "critical" },
        { id: "footer", type: "footer", label: "Pied de page", content: "Note Pierre — Usage strictement interne — Validation humaine obligatoire avant toute action.", optional: false, variables: [], risk_level: "critical" },
      ],
      theme,
      signature: { ...signature, legal_footer: "Note confidentielle — Validation humaine obligatoire. Ne pas diffuser sans autorisation explicite." },
      tags: ["sensible", "confidentiel", "disciplinaire", "human_only", "critique"],
      created_at: now,
      updated_at: now,
    },

    // ── 10. offboarding_checklist ──────────────────────────────────
    {
      id: "pierre_offboarding_checklist_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "offboarding_checklist",
      title: "Checklist de départ",
      description:
        "Checklist et procédure de départ salarié. Validation RH et direction obligatoire avant usage.",
      audience: "internal",
      default_format: "html",
      tone: "formal",
      risk_level: "high",
      validation_mode: "required",
      variables: [
        { key: "employee_name", label: "Salarié", required: true, description: "Nom complet", fallback: "[Salarié]", sensitive: false },
        { key: "departure_date", label: "Date de départ", required: true, description: "Dernier jour", fallback: "[Date]", sensitive: false },
        { key: "departure_reason", label: "Motif de départ", required: true, description: "Démission, licenciement, etc.", fallback: "[Motif]", sensitive: true },
        { key: "position", label: "Poste", required: false, description: "Intitulé du poste", fallback: null, sensitive: false },
        { key: "department", label: "Département", required: false, description: "Service", fallback: null, sensitive: false },
        { key: "manager_name", label: "Manager", required: false, description: "Responsable", fallback: null, sensitive: false },
        { key: "company_name", label: "Entreprise", required: false, description: "Employeur", fallback: null, sensitive: false },
        { key: "hr_contact", label: "Contact RH", required: false, description: "Interlocuteur RH", fallback: null, sensitive: false },
      ],
      blocks: [
        { id: "header", type: "header", label: "En-tête", content: "CHECKLIST DE DÉPART — {{company_name}}\nDocument soumis à validation RH et direction", optional: false, variables: ["company_name"], risk_level: "high" },
        { id: "salarie", type: "paragraph", label: "Salarié", content: "Nom : {{employee_name}}\nPoste : {{position}}\nDépartement : {{department}}\nDate de départ : {{departure_date}}\nMotif : {{departure_reason}}", optional: false, variables: ["employee_name", "position", "department", "departure_date", "departure_reason"], risk_level: "high" },
        { id: "restitution", type: "bullet_list", label: "Matériel à restituer", content: "Badge d'accès et clés\nMatériel informatique (PC, téléphone, périphériques)\nVéhicule de fonction si applicable\nDocuments et accès confidentiels\nCartes d'affaires et identifiants", optional: false, variables: [], risk_level: "medium" },
        { id: "documents_depart", type: "bullet_list", label: "Documents de fin de contrat", content: "Certificat de travail\nAttestation Pôle Emploi / France Travail\nSolde de tout compte\nPortabilité mutuelle et prévoyance\nDerniers bulletins de salaire", optional: false, variables: [], risk_level: "high" },
        { id: "validation_note", type: "callout", label: "Validation obligatoire", content: "IMPORTANT : Ce document est soumis à validation RH et direction. Tout départ sensible nécessite une vérification juridique préalable.\n\nContact RH : {{hr_contact}}\nResponsable : {{manager_name}}", optional: false, variables: ["hr_contact", "manager_name"], risk_level: "high" },
        { id: "footer", type: "footer", label: "Pied de page", content: "Checklist Pierre — Validation obligatoire. Ne pas utiliser sans visa RH.", optional: false, variables: [], risk_level: "high" },
      ],
      theme,
      signature,
      tags: ["départ", "offboarding", "rh", "validation_requise"],
      created_at: now,
      updated_at: now,
    },

    // ── 11. hr_weekly_briefing ─────────────────────────────────────
    {
      id: "pierre_hr_weekly_briefing_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "hr_weekly_briefing",
      title: "Briefing RH hebdomadaire",
      description: "Résumé hebdomadaire des activités RH à destination de la direction.",
      audience: "executive",
      default_format: "html",
      tone: "executive",
      risk_level: "low",
      validation_mode: "none",
      variables: [
        { key: "week", label: "Semaine", required: true, description: "Numéro ou dates de la semaine", fallback: "[Semaine]", sensitive: false },
        { key: "company_name", label: "Entreprise", required: true, description: "Nom de l'entreprise", fallback: "[Entreprise]", sensitive: false },
        { key: "manager_name", label: "Préparateur", required: false, description: "RH rédacteur", fallback: "Pierre RH", sensitive: false },
        { key: "active_employees", label: "Salariés actifs", required: false, description: "Nombre de salariés", fallback: null, sensitive: false },
        { key: "open_missions", label: "Missions en cours", required: false, description: "Nombre de missions Pierre actives", fallback: null, sensitive: false },
        { key: "alerts", label: "Points d'attention", required: false, description: "Alertes RH de la semaine", fallback: "Aucune alerte cette semaine.", sensitive: false },
        { key: "upcoming_actions", label: "Actions à venir", required: false, description: "Prochaines échéances RH", fallback: "Aucune action planifiée.", sensitive: false },
        { key: "highlights", label: "Faits marquants", required: false, description: "Événements clés de la semaine", fallback: null, sensitive: false },
      ],
      blocks: [
        { id: "header", type: "header", label: "En-tête", content: "BRIEFING RH — Semaine {{week}}\n{{company_name}}\nPréparé par {{manager_name}}", optional: false, variables: ["week", "company_name", "manager_name"], risk_level: "low" },
        { id: "kpis", type: "paragraph", label: "Indicateurs clés", content: "Salariés actifs : {{active_employees}}\nMissions Pierre en cours : {{open_missions}}", optional: true, variables: ["active_employees", "open_missions"], risk_level: "low" },
        { id: "highlights", type: "paragraph", label: "Faits marquants", content: "{{highlights}}", optional: true, variables: ["highlights"], risk_level: "low" },
        { id: "alertes", type: "callout", label: "Points d'attention", content: "{{alerts}}", optional: false, variables: ["alerts"], risk_level: "low" },
        { id: "actions", type: "paragraph", label: "Actions à venir", content: "{{upcoming_actions}}", optional: false, variables: ["upcoming_actions"], risk_level: "low" },
        { id: "footer", type: "footer", label: "Pied de page", content: "Briefing hebdomadaire Pierre — {{company_name}} — Semaine {{week}}", optional: false, variables: ["company_name", "week"], risk_level: "low" },
      ],
      theme,
      signature: { ...signature, legal_footer: "Ce briefing est préparé par Pierre comme support de pilotage RH." },
      tags: ["briefing", "hebdomadaire", "direction", "executive", "rh"],
      created_at: now,
      updated_at: now,
    },

    // ── 12. manager_notification ───────────────────────────────────
    {
      id: "pierre_manager_notification_v1",
      version: "1.0",
      scope: "platform_default",
      agent_slug: "pierre",
      document_type: "manager_notification",
      title: "Notification manager",
      description: "Email ou note de notification envoyée à un manager pour information ou action requise.",
      audience: "manager",
      default_format: "html",
      tone: "direct",
      risk_level: "low",
      validation_mode: "recommended",
      variables: [
        { key: "manager_name", label: "Manager", required: true, description: "Destinataire manager", fallback: "[Manager]", sensitive: false },
        { key: "notification_subject", label: "Objet", required: true, description: "Sujet de la notification", fallback: "[Objet]", sensitive: false },
        { key: "employee_name", label: "Salarié concerné", required: false, description: "Le cas échéant", fallback: null, sensitive: false },
        { key: "company_name", label: "Entreprise", required: false, description: "Employeur", fallback: null, sensitive: false },
        { key: "action_required", label: "Action attendue", required: false, description: "Ce que le manager doit faire", fallback: null, sensitive: false },
        { key: "deadline", label: "Échéance", required: false, description: "Avant quelle date", fallback: null, sensitive: false },
        { key: "sender_name", label: "Expéditeur", required: false, description: "Service ou personne qui envoie", fallback: "Le service RH", sensitive: false },
      ],
      blocks: [
        { id: "salutation", type: "paragraph", label: "Salutation", content: "Bonjour {{manager_name}},", optional: false, variables: ["manager_name"], risk_level: "low" },
        { id: "objet", type: "paragraph", label: "Objet", content: "Nous vous contactons au sujet de : {{notification_subject}}.\n\nSalarié concerné : {{employee_name}}", optional: false, variables: ["notification_subject", "employee_name"], risk_level: "low" },
        { id: "action", type: "callout", label: "Action attendue", content: "{{action_required}}\n\nMerci de traiter ce point avant le {{deadline}}.", optional: true, variables: ["action_required", "deadline"], risk_level: "medium" },
        { id: "signature", type: "signature", label: "Signature", content: "Cordialement,\n\n{{sender_name}}\nService RH — {{company_name}}", optional: false, variables: ["sender_name", "company_name"], risk_level: "low" },
      ],
      theme,
      signature,
      tags: ["notification", "manager", "action", "rh"],
      created_at: now,
      updated_at: now,
    },
  ];
}

// ── Registry helpers ──────────────────────────────────────────────────────────

export function listCloneDocumentTemplates(): CloneDocumentTemplate[] {
  return buildCloneDocumentTemplateRegistry();
}

export function getCloneDocumentTemplateById(id: string): CloneDocumentTemplate | null {
  if (!id) return null;
  return buildCloneDocumentTemplateRegistry().find((t) => t.id === id) ?? null;
}

export function getCloneDocumentTemplatesByType(
  documentType: string,
): CloneDocumentTemplate[] {
  if (!documentType) return [];
  return buildCloneDocumentTemplateRegistry().filter(
    (t) => t.document_type === documentType,
  );
}

export function buildCloneDocumentTemplateIndex(
  templates?: CloneDocumentTemplate[],
): CloneDocumentTemplateIndex {
  const all = templates ?? buildCloneDocumentTemplateRegistry();

  const by_type: Record<string, CloneDocumentTemplate[]> = {};
  for (const t of all) {
    if (!by_type[t.document_type]) by_type[t.document_type] = [];
    by_type[t.document_type].push(t);
  }

  const platform_default = all.filter((t) => t.scope === "platform_default").length;
  const company_custom = all.filter((t) => t.scope === "company_custom").length;
  const employee_ai_custom = all.filter((t) => t.scope === "employee_ai_custom").length;

  return {
    templates: all,
    by_type,
    totals: {
      templates: all.length,
      platform_default,
      company_custom,
      employee_ai_custom,
    },
  };
}
