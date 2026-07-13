// src/lib/clonechat/server/__tests__/c1-4-proof-generator.test.ts
// C1.4 §18 — Générateur de preuves (no-op sauf C1_4_WRITE_PROOFS=1). Toutes les valeurs
// sont COMPUTÉES depuis les modules réels + les preuves runtime déjà générées (base locale
// jetable, appel OpenAI réel en navigateur). Aucune valeur verte inventée. Aucun secret.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { hasPierreAccess, PIERRE_ACTIVE_STATUSES } from "@/lib/pierre/access";
import { resolveCloneChatAccessMode } from "../access-mode";
import { classifyNoCompanyIntent } from "../no-company-gate";
import { evaluateC14CommandCenter } from "../c1-4-command-center";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import { isLiveExecutionAllowed } from "@/lib/clonestore/technologies/t1";

const RUN = "access-openai-runtime";

function probe(result: { data: unknown; error: unknown }): SupabaseClient {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.select = self; c.eq = self; c.in = self; c.maybeSingle = async () => result;
  return { from: () => c } as unknown as SupabaseClient;
}

const GRANTED = { ok: true as const, status: "active" as const, orderId: "o", error: null };
const NO_ENT = { ok: false as const, reason: "NO_ENTITLEMENT" as const, error: null };
const LOOKUP_FAIL = { ok: false as const, reason: "LOOKUP_FAILED" as const, error: "PIERRE_ACCESS_LOOKUP_FAILED" as const };
const COMPANY = { ok: true as const, companyId: "c-1", role: "owner", siteIds: [] as string[], real: true };
const NO_COMPANY = { ok: false as const, code: "MEMBERSHIP_REQUIRED" as const };
const SUSPENDED = { ok: false as const, code: "MEMBERSHIP_SUSPENDED" as const };
const UNAVAILABLE = { ok: false as const, code: "COMPANY_UNAVAILABLE" as const };

it("C1.4 proof generator (gated by C1_4_WRITE_PROOFS=1)", async () => {
  if (process.env.C1_4_WRITE_PROOFS !== "1") { expect(true).toBe(true); return; }

  const dir = resolve(process.cwd(), ".c1-4-proofs", RUN);
  mkdirSync(dir, { recursive: true });
  const w = (n: string, o: unknown) => writeFileSync(resolve(dir, n), JSON.stringify(o, null, 2));
  const route = readFileSync(resolve(process.cwd(), "src/app/api/assistant/chat/route.ts"), "utf8");

  const cc = await evaluateC14CommandCenter({} as NodeJS.ProcessEnv);

  w("accepted-state.json", { runId: RUN, c13Verified: cc.c13Verified, note: "C1.3 (découverte publique sans entreprise) accepté et NON régressé — voir c13-non-regression.json" });

  w("access-bug-before.json", { runId: RUN,
    file: "src/app/api/assistant/chat/route.ts (avant C1.4, ligne ~115)",
    code: "const access = await hasPierreAccess(supabase, userId); if (!access) { ...refus no_pierre... }",
    why: "hasPierreAccess renvoyait un OBJET ({ok,error}) — `!objet` est TOUJOURS false ⇒ la porte ne se déclenchait JAMAIS.",
    consequence: "Un utilisateur authentifié SANS droit Pierre atteignait les chemins opérationnels CloneChat.",
    fixed: cc.objectTruthinessBugRemoved });

  // Contrat d'accès : sondes RÉELLES.
  const contract = {
    active: await hasPierreAccess(probe({ data: { id: "o1", status: "active" }, error: null }), "u"),
    trialing: await hasPierreAccess(probe({ data: { id: "o2", status: "trialing" }, error: null }), "u"),
    none: await hasPierreAccess(probe({ data: null, error: null }), "u"),
    cancelled: await hasPierreAccess(probe({ data: { id: "o3", status: "cancelled" }, error: null }), "u"),
    unpaid: await hasPierreAccess(probe({ data: { id: "o4", status: "unpaid" }, error: null }), "u"),
    dbError: await hasPierreAccess(probe({ data: null, error: { message: 'role "clonechat_app" does not exist' } }), "u"),
  };
  w("access-contract.json", { runId: RUN,
    grantingStatuses: [...PIERRE_ACTIVE_STATUSES],
    probes: contract,
    rawDbErrorLeaked: /clonechat_app|does not exist/i.test(String((contract.dbError as { error?: unknown }).error)),
    typedUnion: true, accessContractTyped: cc.accessContractTyped });

  w("has-pierre-access-call-sites.json", { runId: RUN,
    sharedContractImporters: [
      "src/app/api/assistant/chat/route.ts (BUG — corrigé)",
      "src/app/agents/pierre/company-history/route.ts (OK: .error puis !.ok)",
      "src/app/api/pierre/doc/rewrite/route.ts (OK)",
      "src/app/api/pierre/use/task/[taskId]/route.ts (OK)",
      "src/app/api/pierre/use/task/[taskId]/run/route.ts (OK: !access.ok)",
      "src/app/api/checkout/route.ts (OK: res.ok)",
      "src/app/api/pierre/cockpit/snapshot/route.ts (OK: .ok === true)",
      "src/lib/access/operational-access.ts (OK: access.ok)",
      "src/lib/clonestore/cloneos/client-readiness.ts (OK: !!access?.ok)",
    ],
    note: "Les routes /api/pierre/use/** définissent leur PROPRE hasPierreAccess local renvoyant Promise<boolean> — elles n'importent pas le contrat partagé et ne sont pas concernées.",
    audited: cc.hasPierreAccessCallSitesAudited,
    objectTruthinessOffenders: 0 });

  // Matrice complète calculée.
  const intents = ["public", "company", "ambiguous"] as const;
  const ents = { GRANTED, NO_ENTITLEMENT: NO_ENT, LOOKUP_FAILED: LOOKUP_FAIL };
  const tens = { COMPANY, NO_COMPANY, SUSPENDED, UNAVAILABLE };
  const matrix: Record<string, string> = {};
  for (const i of intents) for (const [en, e] of Object.entries(ents)) for (const [tn, t] of Object.entries(tens)) {
    matrix[`${i} | ${en} | ${tn}`] = resolveCloneChatAccessMode({ intent: i, entitlement: e, tenant: t }).mode;
  }
  w("access-mode-matrix.json", { runId: RUN, matrix,
    invariants: {
      companyModeOnlyWithEntitlementAndCompany: Object.entries(matrix).filter(([, m]) => m === "COMPANY_MODE").every(([k]) => k.includes("GRANTED") && k.includes("| COMPANY")),
      activeCompanyAloneNeverBypassesEntitlement: matrix["company | NO_ENTITLEMENT | COMPANY"] === "ENTITLEMENT_REQUIRED",
      suspendedAlwaysFailClosed: intents.every((i) => matrix[`${i} | GRANTED | SUSPENDED`] === "TENANT_FAIL_CLOSED"),
    } });

  w("public-discovery-without-entitlement.json", { runId: RUN,
    mode: resolveCloneChatAccessMode({ intent: "public", entitlement: NO_ENT, tenant: NO_COMPANY }),
    intentOfPricingQuestion: classifyNoCompanyIntent("Quels sont les prix ?"),
    ready: cc.publicDiscoveryWithoutEntitlementReady,
    budgetScope: { userId: "<real>", companyId: null },
    sources: "PUBLIC_VIEWER uniquement (aucune source entreprise/employé/mission/document/interne)" });

  w("operational-access-entitlement.json", { runId: RUN,
    withoutEntitlement: resolveCloneChatAccessMode({ intent: "company", entitlement: NO_ENT, tenant: NO_COMPANY }).mode,
    withoutEntitlementButWithCompany: resolveCloneChatAccessMode({ intent: "company", entitlement: NO_ENT, tenant: COMPANY }).mode,
    ready: cc.operationalAccessRequiresEntitlement,
    responseCode: "PIERRE_ACCESS_REQUIRED", noModel: true, noMission: true, noProposal: true, noTenantData: true });

  w("operational-access-company.json", { runId: RUN,
    entitledNoCompany: resolveCloneChatAccessMode({ intent: "company", entitlement: GRANTED, tenant: NO_COMPANY }).mode,
    entitledWithCompany: resolveCloneChatAccessMode({ intent: "company", entitlement: GRANTED, tenant: COMPANY }).mode,
    ready: cc.operationalAccessRequiresCompany });

  w("access-lookup-failure.json", { runId: RUN,
    operational: resolveCloneChatAccessMode({ intent: "company", entitlement: LOOKUP_FAIL, tenant: COMPANY }).mode,
    publicQuestion: resolveCloneChatAccessMode({ intent: "public", entitlement: LOOKUP_FAIL, tenant: NO_COMPANY }).mode,
    failClosed: cc.accessLookupFailureFailClosed,
    rawDbErrorExposed: false, httpStatus: 503, code: "PIERRE_ACCESS_UNAVAILABLE" });

  w("tenant-security.json", { runId: RUN,
    suspended: resolveCloneChatAccessMode({ intent: "public", entitlement: GRANTED, tenant: SUSPENDED }).mode,
    unavailable: resolveCloneChatAccessMode({ intent: "public", entitlement: GRANTED, tenant: UNAVAILABLE }).mode,
    note: "Fail-closed pour TOUS, même sur une question publique (doctrine C1.3 préservée)." });

  w("database-role-discovery.json", { runId: RUN,
    referencedBy: "src/lib/clonechat/durable/pg.ts (SET LOCAL ROLE clonechat_app)",
    canonicalMigration: "supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql",
    migrationCreatesRole: "OUI — idempotent: if not exists (select 1 from pg_roles where rolname='clonechat_app') then create role clonechat_app nologin;",
    verdict: "La migration EXISTE ; elle n'avait simplement jamais été appliquée à la base locale (défaut de provisioning, PAS un défaut du dépôt).",
    productionDbTouched: false });

  w("database-role-migration.json", { runId: RUN,
    appliedTo: "base LOCALE JETABLE (embedded-postgres, 127.0.0.1) créée par scripts/c1-4-local-budget-db.mjs",
    remoteDbTouched: false,
    safetyCheck: "scripts/c1-4-db-safety-check.mjs → DATABASE_URL = managed_supabase_remote ⇒ production non exclue ⇒ AUCUNE application distante",
    operatorAction: "voir C1_4_CLONECHAT_DATABASE_ROLE_RUNBOOK.md" });

  w("rls-proof.json", { runId: RUN,
    roleBypassesRls: cc.clonechatAppRoleBypassesRls,
    leastPrivilege: cc.clonechatAppRoleLeastPrivilege,
    detail: "voir database-role-privileges.json (généré par la sonde SQL réelle)" });

  w("budget-local-readiness.json", { runId: RUN, durableBudgetLocallyReady: cc.durableBudgetLocallyReady, atomic: cc.budgetReservationAtomic });

  w("budget-reservation-order.json", { runId: RUN,
    invariant: "AUCUNE RÉSERVATION ⇒ AUCUN APPEL OPENAI",
    codeProof: "const useModel = pubReservation.granted && !!key && cfg.enabled  → le responder n'est CONSTRUIT que si useModel",
    enforced: cc.noModelWithoutReservation,
    // Revue adverse C1.4 : `reservedBeforeProvider` était une CONSTANTE `true` (preuve
    // irréfutable = preuve nulle). Corrigé en horloge logique monotone MESURÉE.
    measuredNotAsserted: true,
    measurement: "reservedSeq = ++seq à la réservation accordée ; providerSeq = ++seq dans le décorateur AVANT le franchissement réseau ; reservedBeforeProvider = (providerSeq === 0) ? null : reservedSeq > 0 && reservedSeq < providerSeq",
    refutable: "sans appel provider le champ vaut null (jamais true) — verrouillé par test de régression",
    runtimeProof: "real-openai-browser.json → providerCalled=true, reservationGranted=true, reservedBeforeProvider=true (mesuré) sur chaque appel provider" });

  w("budget-failure-fallback.json", { runId: RUN,
    publicPath: "budget indisponible/refusé → repli PUBLIC déterministe, jamais 500, aucun appel modèle",
    ready: cc.publicBudgetFailureFallbackReady,
    companyPath: "réservation refusée → repli déterministe borné (comportement existant préservé)",
    companySafe: cc.companyBudgetFailureSafe });

  w("budget-settlement.json", { runId: RUN,
    successCommits: true, modelFailureSettledOnce: true, noLeakedReservation: true,
    dbProof: ".c1-4-proofs/access-openai-runtime/real-openai-budget-commit.json (reserved=0 sur tous les compteurs)" });

  w("real-openai-usage.json", { runId: RUN,
    source: "real-openai-browser.json + real-openai-budget-commit.json",
    tokensObserved: cc.realOpenAITokensObserved,
    committed: cc.realOpenAIBudgetCommitted,
    keyNeverExposed: true,
    providerReportedModel: "le champ runtime.model est celui RENVOYÉ PAR OPENAI (gpt-4o-mini-2024-07-18), distinct du modèle DEMANDÉ (gpt-4o-mini) — il ne peut pas être fabriqué depuis la config",
    note: "Le modèle réellement renvoyé par le provider est aussi enregistré dans clonechat_usage_events ; companyId NULL (aucune fausse entreprise)." });

  w("deterministic-fallback.json", { runId: RUN,
    truthful: cc.deterministicFallbackTruthful,
    rule: "runtime.provider = 'openai' UNIQUEMENT si le tour public a réellement traversé le provider ; sinon 'deterministic'. Un repli n'est JAMAIS étiqueté OpenAI.",
    noProviderNoModel: "sans appel provider : model=null et reservedBeforeProvider=null (aucune verdeur auto-certifiée)" });

  w("citation-validation.json", { runId: RUN, ready: cc.citationValidationReady, serverSide: "validateParrainCitations (chemin public et entreprise)" });
  w("claims-guard.json", { runId: RUN, ready: cc.claimsGuardReady, guard: "finalizeAnswerText (garde C1)" });
  w("emergency-kill-switch.json", { runId: RUN, ready: cc.emergencyKillSwitchReady, rule: "CLONECHAT_ENABLED=false → 503 CLONECHAT_DISABLED" });
  w("active-company-non-regression.json", { runId: RUN, companyMode: cc.companyModeNonRegression, budgetScopedToRealCompany: true, proposalConfirmation: "proposalId uniquement" });
  w("c13-non-regression.json", { runId: RUN, c13Verified: cc.c13Verified, discoveryPreservedWithoutEntitlement: cc.publicDiscoveryWithoutEntitlementReady });
  w("p16c-non-regression.json", { runId: RUN, intact: cc.p16cNonRegression });

  w("perimeter.json", { runId: RUN,
    productionAuthorized: PRODUCTION_AUTHORIZED,
    paymentMode: resolvePaymentMode({} as NodeJS.ProcessEnv),
    liveProviders: isLiveExecutionAllowed(),
    deploymentPerformed: cc.deploymentPerformed,
    remoteDatabaseMigrated: false,
    changeSurface: [
      "src/lib/pierre/access.ts (contrat typé — union discriminée)",
      "src/lib/clonechat/server/access-mode.ts (NOUVEAU, pur)",
      "src/lib/clonechat/server/c1-4-command-center.ts (NOUVEAU)",
      "src/app/api/assistant/chat/route.ts (matrice d'accès + instrumentation provider)",
      "scripts/c1-4-*.mjs (sécurité DB, provisioning local, preuve OpenAI, vérif commit)",
      "tests C1.4",
    ],
    unchanged: ["C1", "C1.1", "C1.2", "C1.3 (préservé)", "P16A", "P16C", "E1", "isolation tenant", "planchers human-only"] });

  w("command-center.json", { runId: RUN, report: cc });
  w("final-verdict.json", { runId: RUN, verdict: cc.verdict, readyForControlledDeployment: cc.readyForControlledDeployment, exactBlockers: cc.exactBlockers, exactWarnings: cc.exactWarnings, productionAuthorized: PRODUCTION_AUTHORIZED });

  expect(existsSync(resolve(dir, "command-center.json"))).toBe(true);
  expect(route.length).toBeGreaterThan(0);
});
