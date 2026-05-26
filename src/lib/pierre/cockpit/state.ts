// src/lib/pierre/cockpit/state.ts
// Pierre Cockpit B40 — State machine. Pure. No async, no Supabase, no side effects.
// Resolves cockpit state from tenant context + data availability.

import type {
  PierreCockpitState,
  PierreTenantContext,
  PierreCockpitSnapshot,
  PierreBudgetStatus,
  PierreRuntimeModes,
} from "./types";

// ── State resolution ──────────────────────────────────────────────────────────

export function resolveCockpitState(
  tenant: PierreTenantContext | null,
  opts: {
    hasData: boolean;
    hasError: boolean;
    isLoading: boolean;
  },
): PierreCockpitState {
  if (opts.isLoading) return "loading";
  if (!tenant) return "blocked_no_company";

  if (!tenant.company_id || !tenant.user_id) return "blocked_no_company";

  const unpaidLevels = ["anonymous", "logged_unpaid"];
  if (unpaidLevels.includes(tenant.access_level)) return "blocked_not_paid";

  if (!tenant.owns_pierre) return "blocked_not_active";
  if (!tenant.pierre_enabled) return "blocked_not_active";

  if (opts.hasError && !opts.hasData) return "error";
  if (opts.hasError && opts.hasData) return "degraded";

  return "ready";
}

// ── State predicates ──────────────────────────────────────────────────────────

export function isBlockedState(state: PierreCockpitState): boolean {
  return (
    state === "blocked_not_active" ||
    state === "blocked_not_paid" ||
    state === "blocked_no_company" ||
    state === "blocked_no_access"
  );
}

export function isOperationalState(state: PierreCockpitState): boolean {
  return state === "ready" || state === "degraded";
}

export function canSubmitMission(state: PierreCockpitState, tenant: PierreTenantContext | null): boolean {
  if (!isOperationalState(state)) return false;
  if (!tenant) return false;
  return tenant.owns_pierre && tenant.pierre_enabled;
}

// ── State label (display) ─────────────────────────────────────────────────────

export function getCockpitStateLabel(state: PierreCockpitState): string {
  switch (state) {
    case "loading": return "Chargement…";
    case "ready": return "Actif";
    case "blocked_not_active": return "Configuration requise";
    case "blocked_not_paid": return "Abonnement requis";
    case "blocked_no_company": return "Entreprise non configurée";
    case "blocked_no_access": return "Accès refusé";
    case "degraded": return "Mode dégradé";
    case "error": return "Erreur";
  }
}

export function getCockpitStateBlockReason(state: PierreCockpitState): string | null {
  switch (state) {
    case "blocked_not_active":
      return "Pierre n'est pas activé pour votre compte. Contactez le support.";
    case "blocked_not_paid":
      return "Votre abonnement Pierre est inactif. Renouvelez votre accès.";
    case "blocked_no_company":
      return "Aucune entreprise trouvée dans votre session. Reconnectez-vous.";
    case "blocked_no_access":
      return "Vous n'avez pas les droits d'accès à Pierre.";
    default:
      return null;
  }
}

// ── Budget status helpers ─────────────────────────────────────────────────────

export function buildDefaultBudgetStatus(): PierreBudgetStatus {
  return {
    ai_mode: "mock",
    daily_used_cents: null,
    daily_cap_cents: null,
    monthly_used_cents: null,
    monthly_cap_cents: null,
    shield_active: true,
    emergency_shutdown: false,
    budget_ok: true,
  };
}

export function buildBudgetStatusFromAIStatus(raw: unknown): PierreBudgetStatus {
  const fallback = buildDefaultBudgetStatus();
  try {
    if (typeof raw !== "object" || raw === null) return fallback;
    const data = raw as Record<string, unknown>;
    const status = typeof data.status === "object" && data.status !== null
      ? data.status as Record<string, unknown>
      : data;

    const mode = typeof status.mode === "string" ? status.mode : "mock";
    const emergency = status.emergency_shutdown === true;
    const shield = status.shield_active !== false;

    const dailyUsed = typeof status.daily_used_cents === "number" ? status.daily_used_cents : null;
    const dailyCap = typeof status.daily_cap_cents === "number" ? status.daily_cap_cents : null;
    const monthlyUsed = typeof status.monthly_used_cents === "number" ? status.monthly_used_cents : null;
    const monthlyCap = typeof status.monthly_cap_cents === "number" ? status.monthly_cap_cents : null;

    const budgetOk =
      !emergency &&
      (dailyCap === null || dailyUsed === null || dailyUsed < dailyCap) &&
      (monthlyCap === null || monthlyUsed === null || monthlyUsed < monthlyCap);

    return {
      ai_mode: mode === "production" ? "production" : mode === "disabled" ? "disabled" : "mock",
      daily_used_cents: dailyUsed,
      daily_cap_cents: dailyCap,
      monthly_used_cents: monthlyUsed,
      monthly_cap_cents: monthlyCap,
      shield_active: shield,
      emergency_shutdown: emergency,
      budget_ok: budgetOk,
    };
  } catch {
    return fallback;
  }
}

// ── Runtime modes helpers ─────────────────────────────────────────────────────

export function buildDefaultRuntimeModes(): PierreRuntimeModes {
  return {
    ai_mode: "mock",
    email_mode: "mock",
    email_send_live: false,
    file_mode: "mock",
    channel_mode: "mock",
  };
}

// ── Snapshot builder ─────────────────────────────────────────────────────────

export function buildEmptySnapshot(
  tenant: PierreTenantContext,
  state: PierreCockpitState,
): PierreCockpitSnapshot {
  return {
    tenant,
    state,
    current_mission: null,
    missions: [],
    tasks: [],
    validations: [],
    deliverables: [],
    timeline: [],
    memory_summary: {
      status: "not_configured",
      score: null,
      tone: null,
      autonomy: null,
      validationMode: null,
      signature: null,
      configured: false,
    },
    channel_status: { email_mode: "mock", email_live: false },
    budget_status: buildDefaultBudgetStatus(),
    runtime_modes: buildDefaultRuntimeModes(),
    warnings: [],
    next_actions: [],
    generated_at: new Date().toISOString(),
  };
}

// ── Warning builder ───────────────────────────────────────────────────────────

export function buildSnapshotWarnings(
  state: PierreCockpitState,
  budget: PierreBudgetStatus,
  modes: PierreRuntimeModes,
): string[] {
  const warnings: string[] = [];

  if (state === "degraded") {
    warnings.push("Certaines données sont indisponibles. Le cockpit fonctionne en mode dégradé.");
  }

  if (budget.emergency_shutdown) {
    warnings.push("Kill switch AI actif — aucun appel IA n'est autorisé.");
  }

  if (!budget.budget_ok) {
    warnings.push("Budget IA atteint — les appels IA sont suspendus jusqu'à demain.");
  }

  if (modes.email_mode === "mock") {
    warnings.push("Emails en mode mock — aucun vrai email ne sera envoyé.");
  }

  if (modes.ai_mode === "mock") {
    warnings.push("IA en mode mock — les analyses utilisent des données simulées.");
  }

  return warnings;
}
