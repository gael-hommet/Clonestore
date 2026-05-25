// src/lib/pierre/quality/pierre-document-style-readiness.ts
// B38D — Document Style Kit preparation for B44/B45.
// Source of truth for all style requirements Pierre will need to reproduce
// client document style, formatting, and visual identity.
// This file does NOT implement extraction or template matching — that is B44/B45.
// Pure: no async, no env, no side effects.

import type { DocumentStyleKitRequirement, DocumentStyleCapabilityStatus } from "../../cloneos/ai/quality-policy/types";

// ── B45 Document Style Kit requirements ──────────────────────────────────────

const DOCUMENT_STYLE_KIT_REQUIREMENTS: DocumentStyleKitRequirement[] = [

  {
    id: "official_payslip_samples",
    source_type: "payslip",
    label: "Fiches de paie exemples",
    description: "Exemples anonymisés de fiches de paie client pour reproduire la structure, les sections, les libellés et le format des bulletins officiels.",
    required_for_launch: true,
    target_block: "B45",
    capability_status: "not_started",
    expected_future_behavior: "Pierre peut générer une fiche de paie pré-remplie reprenant exactement la structure client. Les champs variables sont identifiés et listés séparément.",
  },

  {
    id: "HR_letterhead",
    source_type: "letterhead",
    label: "En-tête officiel RH",
    description: "En-tête officiel avec logo, nom légal, adresse, SIRET et coordonnées. Utilisé pour tous les courriers et documents officiels.",
    required_for_launch: true,
    target_block: "B45",
    capability_status: "placeholder_ready",
    expected_future_behavior: "Pierre place automatiquement l'en-tête officiel sur tous les documents client-visible et officiels.",
  },

  {
    id: "certificate_template",
    source_type: "employment_certificate",
    label: "Template attestation de travail",
    description: "Modèle officiel d'attestation d'emploi conforme aux exigences légales françaises. Reproduit la structure attendue par les organismes (Pôle Emploi, banques, etc.).",
    required_for_launch: true,
    target_block: "B45",
    capability_status: "contract_ready",
    expected_future_behavior: "Pierre génère une attestation conforme avec variables pré-remplies, validation humaine requise avant signature.",
  },

  {
    id: "contract_template",
    source_type: "contract",
    label: "Template contrat de travail",
    description: "Templates pour CDI, CDD, temps partiel, alternance. Reprend la structure contractuelle conforme au droit du travail français.",
    required_for_launch: true,
    target_block: "B45",
    capability_status: "not_started",
    expected_future_behavior: "Pierre génère un brouillon de contrat conforme au type choisi, avec variables manquantes identifiées et validation RH+juridique obligatoire.",
  },

  {
    id: "amendment_template",
    source_type: "amendment",
    label: "Template avenant",
    description: "Modèle d'avenant au contrat de travail. Référence le contrat original et identifie clairement les clauses modifiées.",
    required_for_launch: true,
    target_block: "B45",
    capability_status: "not_started",
    expected_future_behavior: "Pierre génère un avenant cohérent avec le contrat source, validation RH+juridique obligatoire.",
  },

  {
    id: "internal_note_template",
    source_type: "internal_memo",
    label: "Template note interne RH",
    description: "Format standardisé pour les notes internes RH (avertissement, félicitation, mise au point). Reprend le style interne de l'entreprise.",
    required_for_launch: false,
    target_block: "B44",
    capability_status: "not_started",
    expected_future_behavior: "Pierre génère des notes internes selon le format interne de l'entreprise, style cohérent.",
  },

  {
    id: "email_signature",
    source_type: "other",
    label: "Signature email standard",
    description: "Template de signature email pour les courriers envoyés au nom du RH ou de Pierre. Reprend le format de signature officiel de l'entreprise.",
    required_for_launch: false,
    target_block: "B44",
    capability_status: "placeholder_ready",
    expected_future_behavior: "Pierre insère automatiquement la signature email selon le profil CloneADN de l'entreprise.",
  },

  {
    id: "logo_asset",
    source_type: "logo",
    label: "Logo entreprise",
    description: "Logo officiel de l'entreprise (SVG ou PNG haute résolution) pour inclusion dans les documents PDF et courriers officiels.",
    required_for_launch: true,
    target_block: "B45",
    capability_status: "not_started",
    expected_future_behavior: "Pierre intègre le logo dans tous les documents officiels clients (PDF, en-têtes, attestations).",
  },

  {
    id: "header_footer_rules",
    source_type: "footer",
    label: "Règles en-tête et pied de page",
    description: "Règles de composition des headers et footers : mentions légales, numérotation, confidentialité, identité entreprise.",
    required_for_launch: true,
    target_block: "B45",
    capability_status: "contract_ready",
    expected_future_behavior: "Pierre applique les règles header/footer conformément à la charte entreprise sur tous les exports PDF.",
  },

  {
    id: "table_style_rules",
    source_type: "brand_guidelines",
    label: "Règles style de tableaux",
    description: "Couleurs, bordures, espacement, polices pour les tableaux dans les documents officiels et rapports.",
    required_for_launch: false,
    target_block: "B45",
    capability_status: "not_started",
    expected_future_behavior: "Pierre génère des tableaux conformes à la charte graphique de l'entreprise.",
  },

  {
    id: "typography_rules",
    source_type: "brand_guidelines",
    label: "Règles typographiques",
    description: "Polices, tailles, espacements, styles (gras, italique) conformes à la charte de l'entreprise.",
    required_for_launch: false,
    target_block: "B45",
    capability_status: "not_started",
    expected_future_behavior: "Pierre respecte la typographie officielle dans tous les exports PDF.",
  },

  {
    id: "date_number_format_rules",
    source_type: "brand_guidelines",
    label: "Format dates et nombres",
    description: "Conventions de formatage : jj/mm/aaaa vs dd MMMM yyyy, séparateur milliers, devise, unités.",
    required_for_launch: true,
    target_block: "B44",
    capability_status: "not_started",
    expected_future_behavior: "Pierre formate automatiquement les dates et nombres selon la convention de l'entreprise.",
  },

  {
    id: "tone_examples",
    source_type: "HR_policy",
    label: "Exemples de ton officiel",
    description: "Exemples de documents réels ou expurgés montrant le ton, les formulations et le vocabulaire préféré de l'entreprise.",
    required_for_launch: false,
    target_block: "B44",
    capability_status: "not_started",
    expected_future_behavior: "Pierre adapte automatiquement son ton aux exemples fournis via CloneADN.",
  },

  {
    id: "forbidden_phrasing",
    source_type: "HR_policy",
    label: "Formulations interdites",
    description: "Liste de formulations, mots ou tournures que Pierre ne doit jamais utiliser pour cette entreprise.",
    required_for_launch: false,
    target_block: "B44",
    capability_status: "not_started",
    expected_future_behavior: "Pierre filtre automatiquement les formulations interdites selon la politique de l'entreprise.",
  },

  {
    id: "approval_stamp_rules",
    source_type: "HR_policy",
    label: "Règles de cachet/approbation",
    description: "Qui signe quoi, format des signatures, tampons officiels, circuit de validation documentaire.",
    required_for_launch: true,
    target_block: "B45",
    capability_status: "not_started",
    expected_future_behavior: "Pierre identifie clairement les signataires requis et le circuit de validation pour chaque type de document.",
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function getAllDocumentStyleRequirements(): DocumentStyleKitRequirement[] {
  return DOCUMENT_STYLE_KIT_REQUIREMENTS;
}

export function getRequirementsForBlock(block: "B44" | "B45"): DocumentStyleKitRequirement[] {
  return DOCUMENT_STYLE_KIT_REQUIREMENTS.filter((r) => r.target_block === block);
}

export function getLaunchCriticalRequirements(): DocumentStyleKitRequirement[] {
  return DOCUMENT_STYLE_KIT_REQUIREMENTS.filter((r) => r.required_for_launch);
}

export function getReadyRequirements(): DocumentStyleKitRequirement[] {
  const readyStatuses: DocumentStyleCapabilityStatus[] = ["contract_ready", "partially_implemented", "complete"];
  return DOCUMENT_STYLE_KIT_REQUIREMENTS.filter((r) => readyStatuses.includes(r.capability_status));
}

export function getNotStartedRequirements(): DocumentStyleKitRequirement[] {
  return DOCUMENT_STYLE_KIT_REQUIREMENTS.filter((r) => r.capability_status === "not_started");
}

export function getRequirementById(id: string): DocumentStyleKitRequirement | null {
  return DOCUMENT_STYLE_KIT_REQUIREMENTS.find((r) => r.id === id) ?? null;
}

export function getStyleKitCompletionSummary(): {
  total: number;
  not_started: number;
  placeholder_or_contract_ready: number;
  implemented: number;
  launch_critical_missing: number;
} {
  const total = DOCUMENT_STYLE_KIT_REQUIREMENTS.length;
  const not_started = DOCUMENT_STYLE_KIT_REQUIREMENTS.filter((r) => r.capability_status === "not_started").length;
  const placeholder_or_contract_ready = DOCUMENT_STYLE_KIT_REQUIREMENTS.filter((r) =>
    r.capability_status === "placeholder_ready" || r.capability_status === "contract_ready",
  ).length;
  const implemented = DOCUMENT_STYLE_KIT_REQUIREMENTS.filter((r) =>
    r.capability_status === "partially_implemented" || r.capability_status === "complete",
  ).length;
  const launch_critical_missing = DOCUMENT_STYLE_KIT_REQUIREMENTS.filter(
    (r) => r.required_for_launch && r.capability_status === "not_started",
  ).length;

  return { total, not_started, placeholder_or_contract_ready, implemented, launch_critical_missing };
}
