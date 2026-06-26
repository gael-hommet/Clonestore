// GO-LIVE 03 — Legal Pages Final Scanner
// Verifies that legal pages contain required content and no forbidden claims.
// Pure: no Supabase, no Next, no async, no throw.

import type {
  LegalPageKey,
  LegalPageRequirement,
  LegalPageScanResult,
  LegalPagesFinalScanResult,
} from "./types";

export const LEGAL_PAGE_REQUIREMENTS: LegalPageRequirement[] = [
  {
    key: "cgu",
    route: "/legal/cgu",
    label: "Conditions Générales d'Utilisation",
    required_content_patterns: [
      "ne remplace pas",
      "validation humaine",
      "responsabilité",
      "données",
    ],
    forbidden_content_patterns: [
      "remplace un avocat",
      "garantit la conformité",
      "zéro erreur",
      "essai gratuit de 7 jours",
    ],
    placeholder_markers: [
      "Placeholder à valider juridiquement",
      "Draft 1.0",
      "À faire valider",
      "juridiction de l'éditeur du service",
    ],
    proof_id: "LEGAL_CGU_VALIDATED",
  },
  {
    key: "cgv",
    route: "/legal/cgv",
    label: "Conditions Générales de Vente",
    required_content_patterns: ["449", "mensuel", "résiliation", "démo"],
    forbidden_content_patterns: [
      "essai gratuit illimité",
      "satisfait ou remboursé",
      "gratuit production open-bar",
    ],
    placeholder_markers: [
      "Placeholder à valider juridiquement",
      "Draft 1.0",
      "À faire valider",
      "TVA et taxes — Placeholder",
    ],
    proof_id: "LEGAL_CGV_VALIDATED",
  },
  {
    key: "dpa",
    route: "/legal/dpa",
    label: "Data Processing Agreement",
    required_content_patterns: [
      "RGPD",
      "sous-traitant",
      "données",
      "suppression",
      "droits",
    ],
    forbidden_content_patterns: ["données 100% protégées sans réserve"],
    placeholder_markers: [
      "Placeholder à valider juridiquement",
      "Draft 1.0",
      "À faire valider",
      "À préciser",
    ],
    proof_id: "LEGAL_DPA_VALIDATED",
  },
  {
    key: "mentions",
    route: "/legal/mentions",
    label: "Mentions Légales",
    required_content_patterns: ["éditeur", "hébergement", "propriété intellectuelle"],
    forbidden_content_patterns: [],
    placeholder_markers: [
      "Placeholder — à compléter",
      "Placeholder — à renseigner",
      "À renseigner",
      "À préciser",
      "Placeholder à valider juridiquement",
    ],
    proof_id: "LEGAL_MENTIONS_VALIDATED",
  },
  {
    key: "confidentialite",
    route: "/legal/confidentialite",
    label: "Politique de Confidentialité",
    required_content_patterns: [
      "données",
      "suppression",
      "droits",
      "sécurité",
    ],
    forbidden_content_patterns: ["données 100% protégées sans réserve"],
    placeholder_markers: [
      "Placeholder à valider",
      "Draft 1.0",
      "À faire valider",
      "À préciser",
    ],
    proof_id: "LEGAL_PRIVACY_VALIDATED",
  },
];

export function scanLegalPage(
  requirement: LegalPageRequirement,
  content: string
): LegalPageScanResult {
  const lower = content.toLowerCase();

  const placeholder_markers_found = requirement.placeholder_markers.filter((m) =>
    lower.includes(m.toLowerCase())
  );

  const has_placeholder = placeholder_markers_found.length > 0;
  const is_draft = has_placeholder;

  const missing_required = requirement.required_content_patterns.filter(
    (p) => !lower.includes(p.toLowerCase())
  );

  const forbidden_found = requirement.forbidden_content_patterns.filter((p) =>
    lower.includes(p.toLowerCase())
  );

  const safe_for_launch =
    missing_required.length === 0 && forbidden_found.length === 0 && !has_placeholder;

  return {
    key: requirement.key,
    route: requirement.route,
    has_placeholder,
    missing_required,
    forbidden_found,
    placeholder_markers_found,
    is_draft,
    safe_for_launch,
  };
}

export function scanAllLegalPages(
  pageContents: Partial<Record<LegalPageKey, string>>
): LegalPagesFinalScanResult {
  const pages: LegalPageScanResult[] = [];
  const blocking_issues: string[] = [];
  let total_placeholders = 0;

  for (const req of LEGAL_PAGE_REQUIREMENTS) {
    const content = pageContents[req.key];
    if (!content) {
      pages.push({
        key: req.key,
        route: req.route,
        has_placeholder: false,
        missing_required: req.required_content_patterns,
        forbidden_found: [],
        placeholder_markers_found: [],
        is_draft: false,
        safe_for_launch: false,
      });
      blocking_issues.push(`Page ${req.route} : contenu absent ou non fourni`);
      continue;
    }

    const result = scanLegalPage(req, content);
    pages.push(result);

    total_placeholders += result.placeholder_markers_found.length;

    if (!result.safe_for_launch) {
      if (result.has_placeholder) {
        blocking_issues.push(`${req.route} : ${result.placeholder_markers_found.length} placeholder(s) actifs`);
      }
      if (result.missing_required.length > 0) {
        blocking_issues.push(`${req.route} : contenu requis manquant — ${result.missing_required.join(", ")}`);
      }
      if (result.forbidden_found.length > 0) {
        blocking_issues.push(`${req.route} : formulations interdites — ${result.forbidden_found.join(", ")}`);
      }
    }
  }

  const all_routes_present = Object.keys(pageContents).length >= LEGAL_PAGE_REQUIREMENTS.length;
  const all_safe = pages.every((p) => p.safe_for_launch);

  return { pages, all_routes_present, blocking_issues, total_placeholders, all_safe };
}

export function getLegalPageRequirements(): LegalPageRequirement[] {
  return [...LEGAL_PAGE_REQUIREMENTS];
}

export function getLegalPageRoutes(): string[] {
  return LEGAL_PAGE_REQUIREMENTS.map((r) => r.route);
}
