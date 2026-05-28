// B46 — Pierre Technology Readiness
// Computes Pierre-specific readiness from technology items.
// Pure: no Supabase, no Next, no async, no side effects. No throw.

import type {
  B46TechnologyItem,
  B46ReadinessContext,
} from "../../clonestore/technologies/technology-b46-types";

// ── Pierre Technology Readiness Result ───────────────────────────────────────

export type PierreTechnologyReadiness = {
  score: number;           // 0–100
  ready: boolean;
  safe_to_run: boolean;
  missing_critical: string[];
  warnings: string[];
  degraded_capabilities: string[];
  voice_ready: boolean;
  chat_ready: boolean;
  document_generation_ready: boolean;
  premium_documents_ready: boolean;
};

// ── Compute Pierre readiness from technology items ────────────────────────────

export function computePierreTechnologyReadiness(
  items: B46TechnologyItem[],
  context: B46ReadinessContext,
): PierreTechnologyReadiness {
  const find = (id: string) => items.find((t) => t.id === id);
  const isActive = (id: string) => {
    const t = find(id);
    return t ? t.enabled && t.readiness.score >= 60 : false;
  };

  const missing_critical: string[] = [];
  const warnings: string[] = [];
  const degraded_capabilities: string[] = [];

  // Critical technologies
  if (!isActive("cloneos")) missing_critical.push("CloneOS — orchestration missions requise.");
  if (!isActive("cloneguard")) missing_critical.push("CloneGuard — gouvernance requise.");
  if (!isActive("clonetrace")) missing_critical.push("CloneTrace — audit trail requis.");

  // Important but degradable
  if (!isActive("cloneadn")) {
    warnings.push("CloneADN inactif — Pierre sans contexte entreprise (mode générique).");
    degraded_capabilities.push("company_memory");
  } else if (find("cloneadn")?.status === "degraded") {
    degraded_capabilities.push("company_memory");
  }

  if (!context.b45_closed) {
    warnings.push("Document Style Kit non configuré — documents sans style entreprise.");
    degraded_capabilities.push("document_style");
  }

  if (context.ai_runtime_mode === "mock") {
    warnings.push("AI Runtime en mode mock — génération IA simulée.");
    degraded_capabilities.push("ai_generation");
  }

  if (context.email_runtime_mode === "mock") {
    warnings.push("Email Runtime en mode mock — aucun email envoyé.");
    degraded_capabilities.push("email_live");
  }

  // Voice and chat
  const voiceReady = isActive("clonevoice");
  const chatItem = find("clonechat");
  const chatReady = chatItem ? chatItem.status !== "disabled" : false;

  if (!voiceReady) warnings.push("CloneVoice non disponible — Pierre en mode texte uniquement.");
  if (!chatReady) warnings.push("CloneChat limité — interface de base uniquement.");

  // Document generation needs CloneOS + CloneGuard + B45
  const docGenReady = isActive("cloneos") && isActive("cloneguard");
  const premiumDocsReady = docGenReady && context.b45_closed;

  // Score computation
  const criticalOk = missing_critical.length === 0;
  let score = criticalOk ? 70 : 20;
  if (isActive("cloneadn")) score += 15;
  if (premiumDocsReady) score += 10;
  if (voiceReady) score += 5;
  if (chatReady) score += 5;
  if (degraded_capabilities.length > 0) score = Math.max(score - degraded_capabilities.length * 5, 0);
  score = Math.min(score, 100);

  return {
    score: Math.round(score),
    ready: criticalOk && score >= 60,
    safe_to_run: criticalOk,
    missing_critical,
    warnings,
    degraded_capabilities,
    voice_ready: voiceReady,
    chat_ready: chatReady,
    document_generation_ready: docGenReady,
    premium_documents_ready: premiumDocsReady,
  };
}
