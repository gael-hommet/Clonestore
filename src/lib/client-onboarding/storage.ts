// Client Onboarding — pont de persistance (P9.2).
//
// Réutilise le modèle et la persistance localStorage EXISTANTS
// (`GlobalOnboardingDraft`, `clonestore.globalOnboarding.draft.v1`) — aucun
// modèle concurrent, aucune migration, aucun backend parallèle. Les mappers
// (draft ↔ Quick Start, draft → complétudes d'empreinte) sont PURS et testables
// en `node` ; les wrappers localStorage sont server-safe (via les helpers
// existants). La persistance serveur reste flag-gated OFF (gap documenté) : ici,
// reprise sur le même navigateur uniquement — jamais présentée comme cross-device.

import {
  buildEmptyGlobalOnboardingDraft,
  loadGlobalOnboardingDraftFromLocalStorage,
  normalizeGlobalOnboardingPayload,
  saveGlobalOnboardingDraftToLocalStorage,
} from "@/lib/clonestore/onboarding";
import type { GlobalOnboardingDraft } from "@/lib/clonestore/onboarding";
import { createEmptyQuickStart, type QuickStartDraft } from "./quick-start";
import type { SectionCompletionMap } from "./guided-footprint";

// ── Mappers PURS (testables) ────────────────────────────────────────────────

/** Extrait un brouillon Quick Start depuis un draft d'onboarding existant. */
export function extractQuickStart(draft: GlobalOnboardingDraft | null): QuickStartDraft {
  const qs = createEmptyQuickStart();
  if (!draft) return qs;
  const c = draft.company ?? ({} as GlobalOnboardingDraft["company"]);
  return {
    companyName: c.company_name ?? "",
    companySize: c.size_range ?? "",
    sector: c.industry ?? "",
    country: c.country ?? "",
    firstObjective: draft.first_mission?.prompt ?? "",
  };
}

/** Applique un Quick Start dans un draft existant (immutable). */
export function applyQuickStart(
  draft: GlobalOnboardingDraft,
  qs: QuickStartDraft,
  nowIso: string,
): GlobalOnboardingDraft {
  const hasObjective = qs.firstObjective.trim().length > 0;
  return {
    ...draft,
    company: {
      ...draft.company,
      company_name: qs.companyName.trim(),
      size_range: qs.companySize.trim(),
      industry: qs.sector.trim(),
      country: qs.country.trim(),
    },
    first_mission: hasObjective
      ? {
          mission_type: draft.first_mission?.mission_type ?? "hr_email_onboarding",
          prompt: qs.firstObjective.trim(),
          employee_slug: "pierre",
          plan_only: true,
        }
      : draft.first_mission,
    updated_at: nowIso,
  };
}

function filledCount(values: readonly string[]): number {
  return values.filter((v) => (v ?? "").trim().length > 0).length;
}

/** Complétudes par section d'empreinte, dérivées du CONTENU réel du draft. */
export function computeFootprintInputs(draft: GlobalOnboardingDraft | null): SectionCompletionMap {
  if (!draft) return {};
  const c = draft.company ?? ({} as GlobalOnboardingDraft["company"]);
  const identity =
    filledCount([c.company_name, c.size_range, c.industry, c.country]) / 4;
  const savedAt = draft.updated_at;
  return {
    identity: { completion: identity, savedAt },
    team: { completion: (draft.humans?.length ?? 0) > 0 ? 1 : 0, savedAt },
    documents: { completion: (draft.documents?.length ?? 0) > 0 ? 1 : 0, savedAt },
    rules: { completion: (draft.rules?.length ?? 0) > 0 ? 1 : 0, savedAt },
    technologies: { completion: (draft.technologies?.length ?? 0) > 0 ? 1 : 0, savedAt },
    mission: {
      completion: (draft.first_mission?.prompt ?? "").trim().length > 0 ? 1 : 0,
      savedAt,
    },
  };
}

// ── Wrappers localStorage (client, server-safe) ─────────────────────────────

/** Charge le draft existant, ou en construit un vide (jamais null côté client). */
export function loadOnboardingDraft(): GlobalOnboardingDraft {
  const raw = loadGlobalOnboardingDraftFromLocalStorage();
  const normalized = normalizeGlobalOnboardingPayload(raw);
  return normalized ?? buildEmptyGlobalOnboardingDraft();
}

export function persistOnboardingDraft(draft: GlobalOnboardingDraft): void {
  saveGlobalOnboardingDraftToLocalStorage(draft);
}

export function loadQuickStart(): QuickStartDraft {
  return extractQuickStart(loadOnboardingDraft());
}

export function persistQuickStart(qs: QuickStartDraft): void {
  const draft = loadOnboardingDraft();
  persistOnboardingDraft(applyQuickStart(draft, qs, new Date().toISOString()));
}

export function loadFootprintInputs(): SectionCompletionMap {
  return computeFootprintInputs(loadOnboardingDraft());
}
