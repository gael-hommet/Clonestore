// BLOC FINAL §11 — logique de garde + assemblage des données de la page readiness,
// extraite du rendu (.tsx) pour être testable directement. Même ORDRE que le cockpit :
// slug exact → porte configurée → porte déverrouillée → session → allowlist.
// Aucune valeur de secret n'est jamais collectée : uniquement présence/conformité.

import { resolveFounderAdmin, resolveOwnerGateState } from "@/lib/founder-access/admin-guard";
import {
  checkFounderStripeEnvironment, checkFounderEmailEnvironment, checkFounderAnalyticsEnvironment,
  aggregateProductionReadiness, type ReadinessComponent, type PhaseEProductionReadiness, type EnvCheck,
} from "@/lib/founder-access/production-readiness";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { verifyFounderAccessSchema } from "@/lib/founder-access/production-verify";
import { verifyStripeWebhookDatabaseRole, isDedicatedWebhookDbConfigured } from "@/lib/founder-access/webhook-db";

export type ReadinessGate =
  | { kind: "notfound" }
  | { kind: "locked" }
  | { kind: "redirect"; to: string }
  | { kind: "ready"; email: string; components: ReadinessComponent[]; verdict: PhaseEProductionReadiness };

function toComp(key: string, r: EnvCheck): ReadinessComponent {
  return { key, ok: r.ok, blockers: r.blockers, warnings: r.warnings };
}

// Schéma + rôle journal sur la base runtime. Résilient si la connexion est indisponible.
async function dbComponents(): Promise<ReadinessComponent[]> {
  try {
    const db = await getRuntimeDb();
    const schema = await verifyFounderAccessSchema(db);
    const role = await verifyStripeWebhookDatabaseRole(db);
    return [
      { key: "db-schema", ok: schema.ok, blockers: schema.ok ? [] : schema.checks.filter((c) => !c.ok).map((c) => c.name), warnings: [] },
      { key: "db-webhook-role", ok: role.ok, blockers: role.ok ? [] : [`rôle: ${role.reason}`],
        warnings: isDedicatedWebhookDbConfigured() ? [] : ["connexion webhook dédiée non configurée (CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL)"] },
    ];
  } catch {
    return [{ key: "db", ok: false, blockers: ["base non vérifiée (connexion indisponible)"], warnings: [] }];
  }
}

/** Résout l'accès + assemble les données readiness, dans l'ordre fail-closed du cockpit. */
export async function resolveReadiness(slug: string, cookieHeader: string | null): Promise<ReadinessGate> {
  const expected = process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
  if (!expected || slug !== expected) return { kind: "notfound" };

  const gate = resolveOwnerGateState(cookieHeader);
  if (gate === "misconfigured") return { kind: "notfound" };
  if (gate === "locked") return { kind: "locked" };

  const auth = await resolveFounderAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") return { kind: "redirect", to: `/login?next=/internal/${slug}/command-center/readiness` };
    return { kind: "notfound" };
  }

  const components: ReadinessComponent[] = [
    toComp("stripe-env", checkFounderStripeEnvironment()),
    toComp("email-env", checkFounderEmailEnvironment()),
    toComp("analytics-env", checkFounderAnalyticsEnvironment()),
    ...(await dbComponents()),
  ];
  return { kind: "ready", email: auth.email, components, verdict: aggregateProductionReadiness(components) };
}
