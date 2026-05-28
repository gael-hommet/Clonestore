// B47 — Disclaimers Registry
// Required disclaimers for Pierre/CloneStore outputs.
// Pure: no Supabase, no Next, no async. No throw.

import type { Disclaimer, OutputContext } from "./types";

// ── Disclaimer registry ───────────────────────────────────────────────────────

export const DISCLAIMERS: Record<string, Disclaimer> = {
  HUMAN_RESPONSIBILITY: {
    id: "HUMAN_RESPONSIBILITY",
    type: "hr_responsibility",
    short_text: "Les décisions sensibles restent sous responsabilité humaine.",
    full_text:
      "Pierre automatise les tâches RH opérationnelles. Les décisions sensibles (disciplinaires, contractuelles, juridiques, de santé) restent sous la responsabilité exclusive de l'employeur et des personnes habilitées.",
    required_contexts: ["marketing", "cockpit", "document"],
    severity: "required",
    customer_visible: true,
    internal_only: false,
  },

  LEGAL_LIMIT: {
    id: "LEGAL_LIMIT",
    type: "legal_limit",
    short_text: "Pierre ne fournit pas de conseil juridique.",
    full_text:
      "Pierre ne fournit pas de conseil juridique et ne remplace pas un professionnel du droit. Pour toute question juridique, consultez un avocat ou un conseil RH qualifié.",
    required_contexts: ["marketing", "document", "email"],
    severity: "required",
    customer_visible: true,
    internal_only: false,
  },

  PAYROLL_LIMIT: {
    id: "PAYROLL_LIMIT",
    type: "payroll_limit",
    short_text: "Pierre prépare la pré-paie, mais ne remplace pas la DSN ni un expert paie.",
    full_text:
      "Pierre prépare des éléments variables de pré-paie et signale les anomalies. Il ne génère pas la DSN, ne produit pas de bulletins de paie officiels et ne remplace pas un logiciel de paie ni un expert-comptable ou expert paie.",
    required_contexts: ["document", "cockpit"],
    severity: "required",
    customer_visible: true,
    internal_only: false,
  },

  OFFICIAL_DOCUMENT_VALIDATION: {
    id: "OFFICIAL_DOCUMENT_VALIDATION",
    type: "document_validation",
    short_text: "Tout document officiel doit être validé par une personne habilitée avant usage.",
    full_text:
      "Tout document officiel ou sensible généré par Pierre (attestation, contrat, avenant, sanction, licenciement, courrier RH sensible) doit être relu, corrigé si nécessaire et validé par une personne habilitée avant toute utilisation ou envoi officiel.",
    required_contexts: ["document", "pdf", "email"],
    severity: "required",
    customer_visible: true,
    internal_only: false,
  },

  AI_LIMIT: {
    id: "AI_LIMIT",
    type: "ai_limit",
    short_text: "Les résultats IA doivent être vérifiés selon le contexte.",
    full_text:
      "Les sorties générées par Pierre utilisent l'intelligence artificielle. Les résultats doivent être vérifiés et adaptés selon le contexte spécifique de votre entreprise avant tout usage officiel.",
    required_contexts: ["marketing", "cockpit", "document", "support"],
    severity: "warning",
    customer_visible: true,
    internal_only: false,
  },

  DATA_PROTECTION_REVIEW: {
    id: "DATA_PROTECTION_REVIEW",
    type: "data_protection",
    short_text: "Les paramètres RGPD doivent être validés avant déploiement public.",
    full_text:
      "Les paramètres RGPD et contractuels (sous-traitance, DPA, durées de conservation) doivent être configurés et validés par le responsable de traitement avant tout déploiement public ou traitement de données personnelles à grande échelle.",
    required_contexts: ["marketing"],
    severity: "required",
    customer_visible: false,
    internal_only: true,
  },

  DEMO_LIMIT: {
    id: "DEMO_LIMIT",
    type: "demo_limit",
    short_text: "La démonstration est illustrative et ne déclenche pas d'actions réelles.",
    full_text:
      "La démonstration gratuite de Pierre est purement illustrative. Aucune action réelle n'est déclenchée : aucun email envoyé, aucun document officiel exporté, aucune donnée client stockée durablement, aucune IA payante sollicitée.",
    required_contexts: ["demo"],
    severity: "required",
    customer_visible: true,
    internal_only: false,
  },

  EMAIL_SEND_LIMIT: {
    id: "EMAIL_SEND_LIMIT",
    type: "human_validation",
    short_text: "Les emails sensibles nécessitent une validation humaine avant envoi.",
    full_text:
      "Les emails sensibles ou officiels (sanction, licenciement, courrier RH délicat) préparés par Pierre nécessitent une validation humaine explicite avant tout envoi. Pierre ne transmet jamais automatiquement ce type de message.",
    required_contexts: ["email", "cockpit"],
    severity: "required",
    customer_visible: true,
    internal_only: false,
  },

  LEGAL_REVIEW_REQUIRED: {
    id: "LEGAL_REVIEW_REQUIRED",
    type: "legal_limit",
    short_text: "Revue juridique humaine requise avant lancement public.",
    full_text:
      "L'ensemble des politiques, disclaimers, conditions générales et communications publiques de CloneStore/Pierre doivent être revus par un conseil juridique qualifié avant tout lancement public. Ce module B47 constitue une base technique sérieuse mais ne se substitue pas à un avis juridique professionnel.",
    required_contexts: ["marketing"],
    severity: "required",
    customer_visible: false,
    internal_only: true,
  },
};

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getDisclaimer(id: string): Disclaimer | null {
  return DISCLAIMERS[id] ?? null;
}

export function getAllDisclaimers(): Disclaimer[] {
  return Object.values(DISCLAIMERS);
}

export function getRequiredDisclaimersForContext(context: Pick<OutputContext, "surface" | "domain" | "is_sensitive" | "is_official_document" | "is_demo">): Disclaimer[] {
  const required: Disclaimer[] = [];

  // Always require HUMAN_RESPONSIBILITY for public marketing and sensitive contexts
  if (context.surface === "marketing" || context.is_sensitive) {
    required.push(DISCLAIMERS.HUMAN_RESPONSIBILITY);
    required.push(DISCLAIMERS.LEGAL_LIMIT);
    required.push(DISCLAIMERS.AI_LIMIT);
  }

  // Payroll contexts
  if (context.domain === "payroll") {
    required.push(DISCLAIMERS.PAYROLL_LIMIT);
    required.push(DISCLAIMERS.OFFICIAL_DOCUMENT_VALIDATION);
  }

  // Official documents
  if (context.is_official_document) {
    required.push(DISCLAIMERS.OFFICIAL_DOCUMENT_VALIDATION);
    required.push(DISCLAIMERS.HUMAN_RESPONSIBILITY);
  }

  // Demo contexts
  if (context.is_demo || context.surface === "demo") {
    required.push(DISCLAIMERS.DEMO_LIMIT);
  }

  // Email contexts with sensitive
  if (context.surface === "email" && context.is_sensitive) {
    required.push(DISCLAIMERS.EMAIL_SEND_LIMIT);
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return required.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

export function hasRequiredDisclaimer(text: string, disclaimerId: string): boolean {
  const disclaimer = DISCLAIMERS[disclaimerId];
  if (!disclaimer) return false;
  const lower = text.toLowerCase();
  const shortLower = disclaimer.short_text.toLowerCase();
  return lower.includes(shortLower.substring(0, Math.min(30, shortLower.length)));
}

export function injectRequiredDisclaimers(text: string, context: Pick<OutputContext, "surface" | "domain" | "is_sensitive" | "is_official_document" | "is_demo">): string {
  const required = getRequiredDisclaimersForContext(context);
  if (required.length === 0) return text;

  const missing = required.filter((d) => !hasRequiredDisclaimer(text, d.id) && d.customer_visible);
  if (missing.length === 0) return text;

  const injected = missing.map((d) => `[${d.short_text}]`).join(" ");
  return `${text}\n\n⚠️ ${injected}`;
}

export function getMissingRequiredDisclaimers(text: string, context: Pick<OutputContext, "surface" | "domain" | "is_sensitive" | "is_official_document" | "is_demo">): string[] {
  const required = getRequiredDisclaimersForContext(context);
  return required
    .filter((d) => !hasRequiredDisclaimer(text, d.id))
    .map((d) => d.id);
}
