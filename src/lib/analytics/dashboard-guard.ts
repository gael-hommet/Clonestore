// Garde + assemblage de données du dashboard funnel Analytics — même porte que le reste du
// Founder Command Center (resolveOwnerGateState / resolveFounderAdmin, lecture seule, jamais
// modifiés). Aucune donnée personnelle assemblée ici — uniquement des comptes agrégés.

import { resolveFounderAdmin, resolveOwnerGateState } from "@/lib/founder-access/admin-guard";
import { buildLoginRedirect } from "@/lib/auth/redirects";
import { getAnalyticsDbForIngestion } from "./runtime";
import { countFunnelStages, measurementHealthSnapshot, type FunnelStageCount } from "./store";
import { CANONICAL_EVENT_NAMES } from "./schema";

export type AnalyticsDashboardGate =
  | { kind: "notfound" }
  | { kind: "locked" }
  | { kind: "redirect"; to: string }
  | {
      kind: "ready";
      email: string;
      stages: FunnelStageCount[];
      health: { eventsAccepted: number; eventsByTrustLevel: Record<string, number> } | null;
      storageAvailable: boolean;
      windowSinceIso: string;
      windowUntilIso: string;
      includeQa: boolean;
    };

const FUNNEL_V1_STAGE_ORDER = [
  "page_viewed",
  "demo_started",
  "demo_completed",
  "pierre_demo_started",
  "pierre_demo_completed",
  "reservation_cta_clicked",
  "reservation_form_started",
  "reservation_submitted",
  "reservation_created",
  "reservation_email_confirmed",
  "activation_started",
  "activation_completed",
  "checkout_started",
  "checkout_session_created",
  "payment_succeeded",
] as const satisfies readonly (typeof CANONICAL_EVENT_NAMES)[number][];

export async function resolveAnalyticsDashboardAccess(
  { slug, cookieHeader, loginReturnPath, windowDays = 30, includeQa = false }: {
    slug: string;
    cookieHeader: string | null;
    loginReturnPath: string;
    windowDays?: number;
    /** Contrôle propriétaire « Inclure le trafic QA » — désactivé par défaut (external-only). */
    includeQa?: boolean;
  },
): Promise<AnalyticsDashboardGate> {
  const expected = process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
  if (!expected || slug !== expected) return { kind: "notfound" };

  const gate = resolveOwnerGateState(cookieHeader);
  if (gate === "misconfigured") return { kind: "notfound" };
  if (gate === "locked") return { kind: "locked" };

  const auth = await resolveFounderAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") return { kind: "redirect", to: buildLoginRedirect(loginReturnPath) };
    return { kind: "notfound" };
  }

  const until = new Date();
  const since = new Date(until.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const windowSinceIso = since.toISOString();
  const windowUntilIso = until.toISOString();

  const db = await getAnalyticsDbForIngestion();
  if (!db) {
    return {
      kind: "ready",
      email: auth.email,
      stages: [],
      health: null,
      storageAvailable: false,
      windowSinceIso,
      windowUntilIso,
      includeQa,
    };
  }

  const [stages, health] = await Promise.all([
    countFunnelStages(db, FUNNEL_V1_STAGE_ORDER, windowSinceIso, windowUntilIso, includeQa),
    measurementHealthSnapshot(db, windowSinceIso),
  ]);

  return {
    kind: "ready",
    email: auth.email,
    stages,
    health: { eventsAccepted: health.eventsAccepted, eventsByTrustLevel: health.eventsByTrustLevel },
    storageAvailable: true,
    windowSinceIso,
    windowUntilIso,
    includeQa,
  };
}

export { FUNNEL_V1_STAGE_ORDER };
