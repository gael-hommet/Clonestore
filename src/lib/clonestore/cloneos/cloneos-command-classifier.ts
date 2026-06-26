// TECH-08 — CloneOS Command Center — Command Classifier
// Classification heuristique déterministe, sans IA, sans OpenAI.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSCommandInput,
  CloneOSClassifiedCommand,
  CloneOSCommandDomain,
  CloneOSCommandIntent,
  CloneOSCommandPriority,
  CloneOSCommandRiskLevel,
  CloneOSCommandId,
} from "./cloneos-command-types";

// ── ID generation ─────────────────────────────────────────────────────────────

export function generateCloneOSCommandId(): CloneOSCommandId {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Mots-clés ─────────────────────────────────────────────────────────────────

const HR_KEYWORDS = [
  "rh", "hr", "embauche", "salarié", "salariée", "contrat", "amendment",
  "avenant", "absence", "congé", "congés", "paie", "paies", "salaire",
  "entretien", "onboarding", "offboarding", "recrutement", "licenciement",
  "rupture", "disciplinaire", "avertissement", "préavis", "retraite",
  "accident du travail", "arrêt maladie", "temps partiel", "mutation",
  "promotion", "dossier employé", "fiche de paie", "bilan social",
  "réunion rh", "comité social", "rse", "formation", "certification",
  "évaluation", "annuelle", "recadrage", "procédure", "démission",
  "employé", "employée", "employés", "employées",
  "candidat", "candidats", "candidature",
  "collaborateur", "collaboratrice", "collaborateurs",
  "nouvelle recrue", "bienvenue", "intégration",
];

const FINANCE_KEYWORDS = [
  "comptabilité", "comptable", "facture", "devis", "trésorerie", "budget",
  "bilan", "compte de résultat", "clôture", "iban", "virement", "paiement",
  "relance client", "tva", "bilan financier",
];

const SUPPORT_KEYWORDS = [
  "support", "ticket", "incident", "client bloqué", "bug", "problème client",
  "réclamation", "remboursement", "retour client", "satisfaction",
];

const ADMIN_KEYWORDS = [
  "admin", "administratif", "kbis", "siret", "statuts", "actes",
  "assurance", "contrat fournisseur", "bail", "loyer", "immobilier",
];

const LEGAL_KEYWORDS = [
  "juridique", "légal", "contentieux", "avocat", "tribunal", "contrat commercial",
  "cgv", "cgu", "rgpd", "gdpr", "litige", "mise en demeure",
];

const DOCUMENT_KEYWORDS = [
  "rédiger", "créer", "générer", "préparer", "document", "lettre",
  "courrier", "rapport", "synthèse", "résumé", "fiche", "modèle", "template",
];

const EMAIL_KEYWORDS = [
  "envoyer email", "envoyer un email", "email", "mail", "courriel",
  "envoyer", "envoyer message", "notifier", "informer par email",
];

const EMAIL_SEND_KEYWORDS = [
  "envoyer email", "envoyer un email", "envoyer ce mail", "envoyer le mail",
  "transmettre par email",
];

const INFORMATION_KEYWORDS = [
  "question", "informer", "expliquer", "savoir", "demander",
  "qu'est-ce que", "comment", "pourquoi", "combien", "quel est", "quelle est",
];

const CRITICAL_KEYWORDS = [
  "licencier", "licenciement", "rupture conventionnelle", "faute grave",
  "faute lourde", "procédure disciplinaire", "tribunal", "contentieux",
  "décision légale", "sanction définitive", "signature contrat", "signer contrat",
  "paie officielle", "virement salaire", "exécution paie",
];

const HIGH_RISK_KEYWORDS = [
  "disciplinaire", "avertissement", "données personnelles", "sanction",
  "confidentiel", "mise en demeure", "préavis", "démission", "licenciement",
];

// ── Inférence domaine ─────────────────────────────────────────────────────────

export function inferCommandDomain(rawRequest: string): {
  domain: CloneOSCommandDomain;
  confidence: number;
} {
  const lower = rawRequest.toLowerCase();

  const hrScore = HR_KEYWORDS.filter((k) => lower.includes(k)).length;
  const financeScore = FINANCE_KEYWORDS.filter((k) => lower.includes(k)).length;
  const supportScore = SUPPORT_KEYWORDS.filter((k) => lower.includes(k)).length;
  const adminScore = ADMIN_KEYWORDS.filter((k) => lower.includes(k)).length;
  const legalScore = LEGAL_KEYWORDS.filter((k) => lower.includes(k)).length;

  const maxScore = Math.max(hrScore, financeScore, supportScore, adminScore, legalScore);

  if (maxScore === 0) {
    return { domain: "general", confidence: 0.3 };
  }

  if (hrScore === maxScore) return { domain: "hr", confidence: Math.min(0.95, 0.5 + hrScore * 0.1) };
  if (financeScore === maxScore) return { domain: "finance", confidence: Math.min(0.9, 0.5 + financeScore * 0.1) };
  if (supportScore === maxScore) return { domain: "support", confidence: Math.min(0.9, 0.5 + supportScore * 0.1) };
  if (legalScore === maxScore) return { domain: "legal", confidence: Math.min(0.9, 0.5 + legalScore * 0.1) };
  if (adminScore === maxScore) return { domain: "admin", confidence: Math.min(0.9, 0.5 + adminScore * 0.1) };

  return { domain: "unknown", confidence: 0.2 };
}

// ── Inférence intention ───────────────────────────────────────────────────────

export function inferCommandIntent(rawRequest: string): CloneOSCommandIntent {
  const lower = rawRequest.toLowerCase();

  const isEmailSend = EMAIL_SEND_KEYWORDS.some((k) => lower.includes(k));
  const isEmail = EMAIL_KEYWORDS.some((k) => lower.includes(k));
  const isDocument = DOCUMENT_KEYWORDS.some((k) => lower.includes(k));
  const isInfo = INFORMATION_KEYWORDS.some((k) => lower.includes(k));
  const isHR = HR_KEYWORDS.some((k) => lower.includes(k));

  if (isEmailSend) return "send_email";
  if (isEmail && isDocument) return "prepare_email";
  if (isEmail) return "prepare_email";
  if (lower.includes("update_memory") || lower.includes("mémoriser") || lower.includes("noter dans la mémoire")) {
    return "update_memory";
  }
  if (lower.includes("analyser") && lower.includes("fichier")) return "analyze_file";
  if (lower.includes("suivi") || lower.includes("relance") || lower.includes("rappel")) {
    return "plan_followup";
  }
  if (isDocument) return "create_document";
  if (isInfo) return "ask_information";
  if (isHR) return "hr_operation";

  return "unknown";
}

// ── Inférence priorité ────────────────────────────────────────────────────────

export function inferCommandPriority(rawRequest: string): CloneOSCommandPriority {
  const lower = rawRequest.toLowerCase();

  if (lower.includes("urgent") || lower.includes("urgence") || lower.includes("immédiat")) {
    return "urgent";
  }
  if (lower.includes("prioritaire") || lower.includes("dès que possible") || lower.includes("asap")) {
    return "high";
  }
  if (lower.includes("quand tu peux") || lower.includes("pas pressé") || lower.includes("à l'occasion")) {
    return "low";
  }
  return "normal";
}

// ── Inférence risque ──────────────────────────────────────────────────────────

export function inferCommandRiskLevel(rawRequest: string): CloneOSCommandRiskLevel {
  const lower = rawRequest.toLowerCase();

  const hasCritical = CRITICAL_KEYWORDS.some((k) => lower.includes(k));
  if (hasCritical) return "critical";

  const hasHigh = HIGH_RISK_KEYWORDS.some((k) => lower.includes(k));
  if (hasHigh) return "high";

  // Emails externes avec destinataires → high par défaut
  if ((lower.includes("email") || lower.includes("mail")) &&
      (lower.includes("externe") || lower.includes("candidat") || lower.includes("client"))) {
    return "high";
  }

  // Documents disciplinaires
  if (lower.includes("disciplinaire") || lower.includes("avertissement")) {
    return "high";
  }

  // Demandes d'information simple
  const isInfo = INFORMATION_KEYWORDS.some((k) => lower.includes(k));
  if (isInfo && !hasHigh) return "low";

  return "medium";
}

// ── Extraction d'entités ──────────────────────────────────────────────────────

export function extractCommandEntities(rawRequest: string): Record<string, string> {
  const entities: Record<string, string> = {};

  // Détecter le nom d'un employé (simplifié)
  const nameMatch = rawRequest.match(/pour\s+([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)?)/);
  if (nameMatch) entities.target_employee = nameMatch[1];

  // Détecter une date
  const dateMatch = rawRequest.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/);
  if (dateMatch) entities.date_ref = dateMatch[1];

  // Détecter un email
  const emailMatch = rawRequest.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) entities.email_ref = emailMatch[0];

  return entities;
}

// ── Candidats employés ────────────────────────────────────────────────────────

export function getCandidateEmployeesForCommand(
  classified: Pick<CloneOSClassifiedCommand, "domain" | "intent">,
): string[] {
  // En V1, Pierre est le seul employé actif
  if (classified.domain === "hr") return ["pierre"];
  if (classified.intent === "hr_operation") return ["pierre"];

  // Autres domaines : pas d'employé actif en V1
  // (Emma/Lucas/Sophie ne sont pas encore créés)
  return [];
}

// ── Classifier principal ──────────────────────────────────────────────────────

/**
 * Classifie une commande CloneOS de façon heuristique et déterministe.
 * Pas d'IA, pas d'OpenAI, pas de réseau.
 */
export function classifyCloneOSCommand(
  input: CloneOSCommandInput,
): CloneOSClassifiedCommand {
  const commandId = input.command_id ?? generateCloneOSCommandId();
  const rawRequest = input.raw_request.trim();

  const { domain, confidence: domainConf } = inferCommandDomain(rawRequest);
  const intent = inferCommandIntent(rawRequest);
  const priority = inferCommandPriority(rawRequest);
  const riskLevel = inferCommandRiskLevel(rawRequest);
  const entities = extractCommandEntities(rawRequest);

  const classified: Omit<CloneOSClassifiedCommand, "candidate_employee_slugs"> = {
    command_id: commandId,
    domain,
    intent,
    priority,
    risk_level: riskLevel,
    summary: rawRequest.length > 120 ? rawRequest.slice(0, 120) + "…" : rawRequest,
    extracted_entities: entities,
    requires_employee: domain !== "unknown" && domain !== "general",
    confidence: domainConf,
    classification_notes: [],
  };

  const candidates = getCandidateEmployeesForCommand(classified);

  const notes: string[] = [];
  if (domain === "unknown") notes.push("Domaine non identifié — traitement général.");
  if (riskLevel === "critical") notes.push("Risque critique détecté — Guard requis.");
  if (input.preferred_employee_slug) {
    notes.push(`Employé préféré demandé : ${input.preferred_employee_slug}`);
  }

  return {
    ...classified,
    candidate_employee_slugs: candidates,
    classification_notes: notes,
  };
}
