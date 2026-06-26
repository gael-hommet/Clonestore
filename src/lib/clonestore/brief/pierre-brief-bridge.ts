// TECH-09 — CloneBrief Executive Summaries — Pierre → CloneBrief Bridge
// Permet à Pierre d'alimenter CloneBrief sans modifier son moteur.
// Bridge seulement. Ne modifie pas Pierre. N'invente pas d'activité RH.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type { GlobalTraceTimeline } from "../trace/global-trace-types";
import type {
  CloneBriefExecutiveSummary,
  CloneBriefGenerationInput,
  CloneBriefGenerationResult,
  CloneBriefSection,
} from "./clonebrief-types";
import { generateCloneBrief, generateDailyCloneBrief } from "./clonebrief-generator";
import { buildBriefGenerationInputFromTrace } from "./clonebrief-source-adapters";
import {
  buildEmptyCloneBrief,
  buildDefaultBriefPeriod,
} from "./clonebrief-defaults";
import {
  buildBlockedActionsSection,
  buildValidationsRequiredSection,
  buildCompletedActionsSection,
  buildOverviewSection,
} from "./clonebrief-sections";

// ── Pierre brief bridge input ─────────────────────────────────────────────────

export interface PierreBriefBridgeInput {
  company_id: string;
  trace_timeline?: GlobalTraceTimeline;
  mission_id?: string;
  is_demo?: boolean;
}

// ── Legacy fallback type ──────────────────────────────────────────────────────

export interface PierreLegacyBriefFallback {
  can_use_legacy: boolean;
  fallback_reason: string;
  pierre_contract_slug: "pierre";
  legacy_summary?: string;
}

// ── Bridge functions ──────────────────────────────────────────────────────────

/**
 * Construit un CloneBriefGenerationInput depuis la timeline Pierre.
 * Ne modifie pas Pierre. Ne crée pas de DB.
 */
export function buildPierreBriefInputFromTrace(
  timeline: GlobalTraceTimeline,
  options?: Partial<CloneBriefGenerationInput>,
): CloneBriefGenerationInput {
  // Filtre les événements Pierre uniquement
  const pierreEvents = (timeline.events ?? []).filter(
    (e) => e.employee_slug === "pierre" || e.source === "pierre_bridge",
  );

  const filteredTimeline: GlobalTraceTimeline = {
    ...timeline,
    events: pierreEvents,
    event_count: pierreEvents.length,
  };

  return buildBriefGenerationInputFromTrace(filteredTimeline, {
    brief_type: "daily",
    audience: "founder",
    employee_slug_filter: "pierre",
    ...options,
  });
}

/**
 * Construit un briefing quotidien depuis la timeline Pierre.
 * Retourne un briefing empty/partial si aucun événement.
 */
export function buildPierreDailyBrief(
  timeline: GlobalTraceTimeline,
  options?: Partial<CloneBriefGenerationInput>,
): CloneBriefGenerationResult {
  const input = buildPierreBriefInputFromTrace(timeline, options);

  // Si aucun événement Pierre → brief empty/partial
  if (!input.trace_events || input.trace_events.length === 0) {
    const emptyBrief = buildEmptyCloneBrief(input.company_id, "daily");
    return {
      ok: true,
      brief: {
        ...emptyBrief,
        status: "empty",
        title: "Briefing Pierre — Aucune activité",
        executive_summary: "Aucune activité Pierre enregistrée pour cette période.",
        warnings: ["Aucun événement Pierre dans la timeline."],
      },
      warnings: ["Aucun événement Pierre dans la timeline."],
      errors: [],
      generation_notes: ["Brief empty car aucun événement Pierre détecté."],
    };
  }

  return generateDailyCloneBrief(input);
}

/**
 * Construit un briefing pour une mission Pierre précise.
 */
export function buildPierreMissionBrief(
  timeline: GlobalTraceTimeline,
  missionId: string,
  options?: Partial<CloneBriefGenerationInput>,
): CloneBriefGenerationResult {
  const input = buildPierreBriefInputFromTrace(timeline, {
    brief_type: "mission",
    mission_id_filter: missionId,
    ...options,
  });

  // Filtrer par mission_id
  const missionEvents = (input.trace_events ?? []).filter(
    (e) => e.mission_id === missionId,
  );

  const missionInput: CloneBriefGenerationInput = {
    ...input,
    trace_events: missionEvents,
    brief_type: "mission",
  };

  if (missionEvents.length === 0) {
    const emptyBrief = buildEmptyCloneBrief(input.company_id, "mission");
    return {
      ok: true,
      brief: {
        ...emptyBrief,
        status: "empty",
        title: `Résumé mission ${missionId} — Aucune activité`,
        executive_summary: `Aucun événement pour la mission ${missionId}.`,
        warnings: [`Aucun événement trouvé pour la mission ${missionId}.`],
      },
      warnings: [`Aucun événement pour la mission ${missionId}.`],
      errors: [],
      generation_notes: [],
    };
  }

  return generateCloneBrief(missionInput);
}

/**
 * Mappe la timeline Pierre en sections CloneBrief.
 * Utilisé pour l'intégration sans générer un brief complet.
 */
export function mapPierreTraceToBriefSections(
  timeline: GlobalTraceTimeline,
): CloneBriefSection[] {
  const input = buildPierreBriefInputFromTrace(timeline);

  return [
    buildOverviewSection(input),
    buildCompletedActionsSection(input),
    buildBlockedActionsSection(input),
    buildValidationsRequiredSection(input),
  ];
}

/**
 * Construit un fallback legacy Pierre si CloneBrief ne peut pas générer.
 */
export function buildPierreLegacyBriefFallback(
  brief: CloneBriefExecutiveSummary,
): PierreLegacyBriefFallback {
  if (brief.status === "ready") {
    return {
      can_use_legacy: false,
      fallback_reason: "CloneBrief a généré le briefing avec succès — legacy non requis.",
      pierre_contract_slug: "pierre",
    };
  }

  if (brief.status === "empty") {
    return {
      can_use_legacy: true,
      fallback_reason: "Brief vide — Pierre peut utiliser son résumé legacy si disponible.",
      pierre_contract_slug: "pierre",
      legacy_summary: "Aucune activité Pierre enregistrée.",
    };
  }

  if (brief.status === "failed") {
    return {
      can_use_legacy: true,
      fallback_reason: "Échec de génération CloneBrief — fallback Pierre legacy activé.",
      pierre_contract_slug: "pierre",
    };
  }

  return {
    can_use_legacy: false,
    fallback_reason: "Statut briefing: " + brief.status,
    pierre_contract_slug: "pierre",
  };
}
