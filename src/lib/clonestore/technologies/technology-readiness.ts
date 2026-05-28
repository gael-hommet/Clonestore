// B46 — Technology Readiness Computation
// Pure: no Supabase, no Next, no async, no side effects. No throw.

import type {
  CloneStoreTechnologyId,
  B46TechnologyItem,
  B46TechnologyReadiness,
  B46TechnologyStatus,
  B46ReadinessContext,
  GlobalTechnologiesReadiness,
} from "./technology-b46-types";
import { B46_LAUNCH_CRITICAL } from "./technology-b46-types";

// ── Default context (all B38-B45 closed) ─────────────────────────────────────

export function getDefaultB46ReadinessContext(overrides?: Partial<B46ReadinessContext>): B46ReadinessContext {
  return {
    b38_closed: true,
    b39_closed: true,
    b40_closed: true,
    b41_closed: true,
    b42_closed: true,
    b43_closed: true,
    b44_closed: true,
    b45_closed: true,
    empreinte_ready: true,
    document_style_ready: true,
    security_ready: true,
    observability_ready: true,
    email_runtime_mode: "mock",
    ai_runtime_mode: "mock",
    ...overrides,
  };
}

// ── Per-technology readiness ──────────────────────────────────────────────────

export function computeTechnologyReadiness(
  id: CloneStoreTechnologyId,
  status: B46TechnologyStatus,
  context: B46ReadinessContext,
  now?: Date,
): B46TechnologyReadiness {
  const ts = (now ?? new Date()).toISOString();
  const warnings: string[] = [];
  const blockers: string[] = [];
  const missing_required: string[] = [];
  let score = 0;
  let dependencies_ok = true;

  switch (id) {
    case "cloneos": {
      score = context.b42_closed ? 85 : 45;
      if (!context.b42_closed) {
        missing_required.push("B42 Final Workflow Completion");
        blockers.push("Workflows RH finaux non validés.");
        dependencies_ok = false;
      }
      if (!context.security_ready) {
        warnings.push("Sécurité B41 non finalisée — certaines garanties dégradées.");
        score = Math.max(score - 10, 0);
      }
      if (context.ai_runtime_mode === "mock") {
        warnings.push("AI Runtime en mode mock — fonctionnalités IA limitées.");
      }
      break;
    }
    case "cloneadn": {
      score = context.b44_closed ? 80 : 40;
      if (!context.b44_closed) {
        missing_required.push("B44 Empreinte Entreprise & Pierre");
        blockers.push("Empreinte entreprise non configurée.");
        dependencies_ok = false;
      }
      if (context.b44_closed && !context.empreinte_ready) {
        warnings.push("Empreinte Pierre non complète — contexte réduit.");
        score = Math.max(score - 10, 0);
      }
      break;
    }
    case "cloneguard": {
      score = 55;
      if (context.b41_closed) score += 30;
      else {
        missing_required.push("B41 Security / RGPD");
        blockers.push("Sécurité non finalisée — CloneGuard partiellement dégradé.");
        dependencies_ok = false;
      }
      if (context.b38_closed) score += 10;
      else {
        missing_required.push("B38 AI Quality Policy");
        warnings.push("Politique qualité IA non finalisée.");
      }
      score = Math.min(score, 95);
      break;
    }
    case "clonetrace": {
      score = 50;
      if (context.b43_closed) score += 25;
      else {
        missing_required.push("B43 Observability & Error Handling");
        warnings.push("Observabilité non finalisée — trace moins détaillée.");
      }
      if (context.b41_closed) score += 15;
      else {
        missing_required.push("B41 Security / RGPD");
        blockers.push("Audit trail sécurisé non garanti sans B41.");
        dependencies_ok = false;
      }
      score = Math.min(score, 90);
      break;
    }
    case "clonevoice": {
      score = 10;
      missing_required.push("Fournisseur vocal configuré (ElevenLabs/Whisper — B4x futur)");
      warnings.push("CloneVoice : aucun fournisseur vocal configuré.");
      warnings.push("Disponible en option premium — non requis pour le lancement Pierre.");
      dependencies_ok = false;
      break;
    }
    case "clonechat": {
      score = 30;
      warnings.push("CloneChat en mode limité — interface de base disponible.");
      warnings.push("Brain omniscient et support complet planifiés pour B4x futur.");
      break;
    }
  }

  if (status === "disabled") {
    score = 0;
    return { score: 0, ready: false, active_safe: false, missing_required, warnings, blockers, dependencies_ok, last_checked_at: ts };
  }
  if (status === "degraded") {
    score = Math.min(score, 50);
    warnings.push("Technologie en état dégradé.");
  }
  if (status === "needs_configuration") {
    score = Math.min(score, 40);
  }

  const finalScore = Math.round(Math.max(0, Math.min(100, score)));
  const ready = finalScore >= 60 && blockers.length === 0;
  const active_safe = finalScore >= 70 && blockers.length === 0;

  return { score: finalScore, ready, active_safe, missing_required, warnings, blockers, dependencies_ok, last_checked_at: ts };
}

// ── Global readiness ──────────────────────────────────────────────────────────

export function computeGlobalTechnologiesReadiness(
  items: B46TechnologyItem[],
  context: B46ReadinessContext,
): GlobalTechnologiesReadiness {
  const criticalItems = items.filter((t) => B46_LAUNCH_CRITICAL.includes(t.id));
  const warnings: string[] = [];
  const blockers: string[] = [];

  for (const item of items) {
    for (const w of item.readiness.warnings) warnings.push(`[${item.id}] ${w}`);
    for (const b of item.readiness.blockers) blockers.push(`[${item.id}] ${b}`);
  }

  if (context.email_runtime_mode === "mock") {
    warnings.push("Email Runtime en mode mock — emails non envoyés en production.");
  }
  if (context.ai_runtime_mode === "mock") {
    warnings.push("AI Runtime en mode mock — fonctionnalités IA simulées.");
  }

  const criticalScores = criticalItems.map((t) => t.readiness.score);
  const score = criticalScores.length > 0
    ? Math.round(criticalScores.reduce((a, b) => a + b, 0) / criticalScores.length)
    : 0;

  const launch_critical_ok = criticalItems.every(
    (t) => t.readiness.score >= 60 && t.readiness.blockers.length === 0,
  );

  return {
    score,
    ready: launch_critical_ok && score >= 60,
    launch_critical_ok,
    warnings: [...new Set(warnings)],
    blockers: [...new Set(blockers)],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildTechnologyWarnings(
  id: CloneStoreTechnologyId,
  context: B46ReadinessContext,
): string[] {
  return computeTechnologyReadiness(id, "active", context).warnings;
}

export function buildTechnologyNextActions(
  items: B46TechnologyItem[],
  _context: B46ReadinessContext,
): string[] {
  const actions: string[] = [];
  for (const item of items) {
    if (item.readiness.blockers.length > 0) {
      actions.push(`Résoudre blocage ${item.id} : ${item.readiness.blockers[0]}`);
    }
  }
  if (items.some((t) => t.id === "clonevoice" && !t.enabled)) {
    actions.push("Configurer fournisseur vocal pour activer CloneVoice (optionnel).");
  }
  if (items.some((t) => t.id === "clonechat" && t.status !== "active")) {
    actions.push("Configurer CloneChat pour orientation et support de base.");
  }
  return actions;
}
