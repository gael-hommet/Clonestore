// B47 — Pierre Sensitive HR Policy
// What Pierre can and cannot do for each sensitive HR category.
// Pure: no Supabase, no Next, no async. No throw.

import {
  getAllTaxonomyDefinitions,
  getTaxonomyDefinition,
  type PierreSensitiveHrCategory,
  type PierreLegalActionPolicy,
} from "./pierre-legal-taxonomy";

export type PierreSensitiveHrCapability = {
  category: PierreSensitiveHrCategory;
  can_prepare: boolean;
  can_draft: boolean;
  can_list_missing_info: boolean;
  can_propose_escalation: boolean;
  can_send: boolean;
  can_decide: boolean;
  can_export: boolean;
  note: string;
};

export function getPierreSensitiveHrCapability(category: PierreSensitiveHrCategory): PierreSensitiveHrCapability {
  const def = getTaxonomyDefinition(category);
  if (!def) {
    return {
      category,
      can_prepare: true,
      can_draft: true,
      can_list_missing_info: true,
      can_propose_escalation: true,
      can_send: false,
      can_decide: false,
      can_export: false,
      note: "Catégorie inconnue — comportement par défaut conservateur.",
    };
  }

  return {
    category,
    can_prepare: def.policy.prepare_allowed,
    can_draft: def.policy.draft_allowed,
    can_list_missing_info: true,
    can_propose_escalation: true,
    can_send: def.policy.send_allowed,
    can_decide: def.policy.autonomous_allowed,
    can_export: def.policy.export_allowed,
    note: buildCapabilityNote(category, def.policy),
  };
}

function buildCapabilityNote(category: PierreSensitiveHrCategory, policy: PierreLegalActionPolicy): string {
  const parts: string[] = [];
  if (policy.prepare_allowed) parts.push("peut préparer un brouillon prudent");
  if (policy.draft_allowed) parts.push("peut rédiger sous validation");
  parts.push("peut lister les informations manquantes");
  parts.push("peut proposer une escalade humaine");
  if (!policy.send_allowed) parts.push("ne peut pas envoyer seul");
  if (!policy.autonomous_allowed) parts.push("ne peut pas décider seul");
  if (!policy.export_allowed) parts.push("ne peut pas exporter sans validation");
  if (policy.legal_review_recommended) parts.push("revue juridique recommandée");
  return `Pierre ${parts.join(", ")}.`;
}

export function getAllSensitiveHrCapabilities(): PierreSensitiveHrCapability[] {
  return getAllTaxonomyDefinitions().map((def) => getPierreSensitiveHrCapability(def.category));
}

export function isSensitiveHrCategory(text: string): boolean {
  const lower = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const highRiskKeywords = [
    "licenci", "sanction", "harcel", "discrimin", "maladie", "dsn", "paie",
    "contrat", "avenant", "prud", "litige", "conflit", "inaptitude",
    "abandon de poste", "accident du travail",
  ];
  return highRiskKeywords.some((kw) => lower.includes(kw));
}

export function buildSensitiveCaseSummary(category: PierreSensitiveHrCategory): {
  what_pierre_can_do: string[];
  what_pierre_cannot_do: string[];
  required_next_step: string;
} {
  const cap = getPierreSensitiveHrCapability(category);
  const def = getTaxonomyDefinition(category);

  const can: string[] = [];
  const cannot: string[] = [];

  if (cap.can_prepare) can.push("Préparer une synthèse prudente du dossier");
  if (cap.can_draft) can.push("Rédiger un brouillon de document sous validation humaine");
  can.push("Lister les informations manquantes ou à vérifier");
  can.push("Proposer une escalade à un responsable RH ou conseil");

  if (!cap.can_send) cannot.push("Envoyer seul tout document ou communication");
  if (!cap.can_decide) cannot.push("Prendre la décision finale");
  if (!cap.can_export) cannot.push("Exporter un document officiel sans validation");
  cannot.push("Promettre une légalité ou conformité garantie");
  cannot.push("Remplacer un avis juridique professionnel");

  return {
    what_pierre_can_do: can,
    what_pierre_cannot_do: cannot,
    required_next_step: def?.policy.safe_next_actions[0] ?? "escalate_to_hr_manager",
  };
}
