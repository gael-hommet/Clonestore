// B45 — Pierre document quality assessment
// Pure: no async, no Supabase, no Next.js, no side effects. No throw.

import type { DocumentRenderResult, DocumentRenderContext } from "../../clonestore/document-style-kit/types";
import type { PierreDocumentVerdict, PierreDocumentVerdictArea } from "./pierre-document-types";
import { scoreRenderedDocumentQuality } from "../../clonestore/document-style-kit/quality-gates";

// ── Score individual areas ────────────────────────────────────────────────────

function scoreAntiChatGpt(text: string): PierreDocumentVerdictArea {
  const forbiddenFound = [
    "Voici un modèle",
    "[Votre nom]",
    "[Nom de l'entreprise]",
    "à adapter selon votre situation",
    "je vous conseille juridiquement",
  ].find((p) => text.toLowerCase().includes(p.toLowerCase()));

  return {
    name: "anti_chatgpt",
    passed: !forbiddenFound,
    score: forbiddenFound ? 0 : 100,
    message: forbiddenFound
      ? `Phrase générique détectée : "${forbiddenFound}"`
      : "Aucune phrase générique de type ancien ChatGPT.",
  };
}

function scoreStructure(html: string, text: string): PierreDocumentVerdictArea {
  const hasTitle = html.includes("b45-main-title") || html.includes("<h1");
  const hasSections = html.includes("<h2") || html.includes("b45-section-heading");
  const isLongEnough = text.trim().length >= 100;
  const score = (hasTitle ? 34 : 0) + (hasSections ? 33 : 0) + (isLongEnough ? 33 : 0);
  return {
    name: "structure",
    passed: score >= 60,
    score,
    message: score >= 60
      ? "Structure du document correcte."
      : "Document mal structuré (titre, sections, longueur).",
  };
}

function scoreSafety(html: string): PierreDocumentVerdictArea {
  const hasScript = /<script\b/i.test(html);
  const hasEventHandler = /\bon\w+\s*=/i.test(html);
  const passed = !hasScript && !hasEventHandler;
  return {
    name: "safety",
    passed,
    score: passed ? 100 : 0,
    message: passed
      ? "Aucune injection HTML/JS détectée."
      : `Injection détectée : ${hasScript ? "script" : ""} ${hasEventHandler ? "event handler" : ""}`.trim(),
  };
}

function scoreEnterpriseIdentity(text: string, companyName: string | null): PierreDocumentVerdictArea {
  if (!companyName) {
    return {
      name: "enterprise_identity",
      passed: false,
      score: 40,
      message: "Nom d'entreprise non fourni dans le contexte.",
    };
  }
  const found = text.toLowerCase().includes(companyName.toLowerCase());
  return {
    name: "enterprise_identity",
    passed: found,
    score: found ? 100 : 30,
    message: found
      ? `Identité entreprise "${companyName}" présente.`
      : `Nom d'entreprise "${companyName}" absent du rendu.`,
  };
}

function scoreCompleteness(
  missingVariables: string[],
  unresolvedTokens: string[],
): PierreDocumentVerdictArea {
  const totalIssues = missingVariables.length + unresolvedTokens.length;
  const score = Math.max(0, 100 - totalIssues * 20);
  return {
    name: "completeness",
    passed: totalIssues === 0,
    score,
    message: totalIssues === 0
      ? "Toutes les variables sont résolues."
      : `${totalIssues} variable(s)/token(s) non résolus.`,
  };
}

// ── Build verdict ─────────────────────────────────────────────────────────────

export function buildPierreDocumentVerdict(
  result: DocumentRenderResult,
  ctx: DocumentRenderContext,
): PierreDocumentVerdict {
  const areas: PierreDocumentVerdictArea[] = [
    scoreAntiChatGpt(result.text),
    scoreStructure(result.html, result.text),
    scoreSafety(result.html),
    scoreEnterpriseIdentity(result.text, ctx.company_name),
    scoreCompleteness(result.missing_variables, result.unresolved_tokens),
  ];

  const quality = scoreRenderedDocumentQuality({
    ctx,
    html: result.html,
    text: result.text,
    unresolved_tokens: result.unresolved_tokens,
    missing_variables: result.missing_variables,
  });

  const overall_score = Math.round(
    areas.reduce((sum, a) => sum + a.score, 0) / areas.length,
  );

  const blocking_issues: string[] = [
    ...quality.hard_fails.map((f) => f.message),
    ...areas.filter((a) => !a.passed && a.name === "safety").map((a) => a.message),
  ];

  const recommendations: string[] = [];
  if (!areas.find((a) => a.name === "enterprise_identity")?.passed) {
    recommendations.push("Ajouter le nom de l'entreprise dans les variables (company_name).");
  }
  if (!areas.find((a) => a.name === "completeness")?.passed) {
    recommendations.push("Fournir toutes les variables requises avant génération.");
  }
  if (!ctx.style_kit.signature.enabled) {
    recommendations.push("Activer le bloc de signature dans le style kit.");
  }
  if (result.quality_score < 80) {
    recommendations.push("Compléter les informations entreprise (B44 Empreinte Entreprise).");
  }

  let level: PierreDocumentVerdict["level"];
  if (overall_score >= 90) level = "premium";
  else if (overall_score >= 70) level = "good";
  else if (overall_score >= 50) level = "acceptable";
  else level = "poor";

  return {
    overall_score,
    passed: blocking_issues.length === 0 && overall_score >= 50,
    level,
    areas,
    blocking_issues,
    recommendations,
    anti_chatgpt_passed: areas.find((a) => a.name === "anti_chatgpt")?.passed ?? false,
    enterprise_identity_passed: areas.find((a) => a.name === "enterprise_identity")?.passed ?? false,
    structure_passed: areas.find((a) => a.name === "structure")?.passed ?? false,
    safety_passed: areas.find((a) => a.name === "safety")?.passed ?? false,
  };
}
