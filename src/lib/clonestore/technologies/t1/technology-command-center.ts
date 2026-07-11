// src/lib/clonestore/technologies/t1/technology-command-center.ts
// T1 — COMMAND CENTER : l'état COMPUTÉ de la couche technologies (jamais déclaré à la main).
// `readyForPierreIntegration` = prêt pour la porte P16C (adaptateurs) — cela ne signifie
// JAMAIS que les providers live sont prêts. Dérive des évaluateurs réels : plancher P10
// (PRODUCTION_AUTHORIZED const false) + mode de paiement P15.1 (fail-closed).

import { resolvePaymentMode, type PaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import type { Env } from "@/lib/clonestore/pricing/stripe-pricing-config";
import { ALL_TECHNOLOGY_IDS } from "./technology-types";
import { fallbackResult } from "./technology-result";
import { createTechnologyAuditEntry } from "./technology-audit";
import { checkTechnologyPermission } from "./technology-permissions";
import { isLiveExecutionAllowed, resolveTechnologyMode, technologyProductionAllowed } from "./technology-status";
import {
  crossCheckTechnologyRegistryWithMasterSplit, listTechnologyRegistryEntries, type TechnologyRegistryEntry,
} from "./technology-registry";

export interface TechnologyCommandCenterReport {
  readonly totalTechnologies: number;
  readonly verified: number;
  readonly partial: number;
  readonly architectureReady: number;
  readonly missing: number;
  readonly externalBlocked: number;
  readonly disabled: number;
  readonly reusableCount: number;
  readonly pierreOnlyCount: number;
  readonly liveProviderBlockedCount: number;
  readonly safeFallbackAvailableCount: number;
  /** Prêt pour la porte P16C — PAS « providers live prêts ». */
  readonly readyForPierreIntegration: boolean;
  readonly exactBlockers: readonly string[];
  readonly exactWarnings: readonly string[];
  readonly recommendedNextStep: string;
  /** Dérivé du plancher dur P10 (const false — jamais levé par le code). */
  readonly productionAuthorized: boolean;
  /** Dérivé de P15.1 (fail-closed — jamais « live » tant que P10=false). */
  readonly paymentMode: PaymentMode;
  readonly liveExecutionAllowed: boolean;
  readonly masterSplitCrossCheckOk: boolean;
  /** true si des entrées ont été injectées (tests) — le rapport le déclare toujours. */
  readonly entriesInjected: boolean;
  readonly note: string;
}

/**
 * Calcule le rapport du command center. `entriesOverride` sert UNIQUEMENT aux tests
 * (prouver que readyForPierreIntegration devient false si une condition manque).
 */
export function summarizeTechnologyCommandCenter(
  env: Env = process.env,
  entriesOverride?: readonly TechnologyRegistryEntry[],
): TechnologyCommandCenterReport {
  const entries = entriesOverride ?? listTechnologyRegistryEntries();
  const blockers: string[] = [];
  const warnings: string[] = [];

  const count = (s: string) => entries.filter((e) => e.status === s).length;

  // ── Conditions DURES de readyForPierreIntegration ────────────────────────────
  // 1) Les 15 technologies sont enregistrées.
  const registeredIds = new Set(entries.map((e) => e.id));
  const missingIds = ALL_TECHNOLOGY_IDS.filter((id) => !registeredIds.has(id));
  if (missingIds.length > 0) blockers.push(`Technologies non enregistrées : ${missingIds.join(", ")}.`);
  if (entries.length !== ALL_TECHNOLOGY_IDS.length) blockers.push(`Registre incomplet : ${entries.length}/${ALL_TECHNOLOGY_IDS.length}.`);

  // 2) Chaque technologie a un contrat complet (prepare/validate/audit + fallback) —
  //    entrée cassée/forgée → blocker computé, jamais un crash.
  for (const e of entries) {
    const c = e.contract as typeof e.contract | undefined;
    if (!c || typeof c.prepare !== "function" || typeof c.validate !== "function" || typeof c.audit !== "function") {
      blockers.push(`Contrat incomplet pour « ${e.id} » (prepare/validate/audit requis).`);
    }
    if (!e.safeFallback || e.safeFallback.trim().length === 0) {
      blockers.push(`Fallback sûr manquant pour « ${e.id} ».`);
    }
  }

  // 3) Aucune techno pierreOnly (règle dure — défaut réutilisable).
  const pierreOnlyCount = entries.filter((e) => e.pierreOnly as boolean).length;
  if (pierreOnlyCount > 0) blockers.push(`${pierreOnlyCount} technologie(s) pierreOnly — interdit sans justification écrite.`);

  // 3bis) Aucune techno enregistrée mais missing/disabled : la porte P16C exige au moins
  //       architecture_ready pour chaque techno.
  if (count("missing") > 0 || count("disabled") > 0) {
    blockers.push(`Technologies missing/disabled présentes (missing=${count("missing")}, disabled=${count("disabled")}) — porte P16C fermée.`);
  }

  // 4) Tout chemin live/externe est bloqué par défaut.
  if (isLiveExecutionAllowed()) {
    blockers.push("Exécution live permise — INTERDIT en T1 (production OFF, aucun provider vérifié).");
  }
  for (const e of entries) {
    const c = e.contract as typeof e.contract | undefined;
    if (!c) continue; // déjà bloqué en 2)
    if (c.liveDependency !== "none") {
      const mode = resolveTechnologyMode({ status: e.status, liveDependency: c.liveDependency });
      if (mode !== "live_disabled" && mode !== "blocked") {
        blockers.push(`« ${e.id} » dépend du live mais son mode est « ${mode} » (attendu live_disabled/blocked).`);
      }
    }
    if (c.allowedInProduction) {
      blockers.push(`« ${e.id} » allowedInProduction=true alors que le plancher P10 est false.`);
    }
  }

  // 5) Les permissions sont fail-closed — les TROIS branches de refus sont sondées
  //    (employé vide, société vide, techno inconnue), pas seulement la première.
  const permissionProbes = [
    checkTechnologyPermission("", "document", { companyId: "probe-company" }),
    checkTechnologyPermission("probe-employee", "document", { companyId: "" }),
    checkTechnologyPermission("probe-employee", "techno-inconnue", { companyId: "probe-company" }),
  ];
  if (permissionProbes.some((p) => p.allowed)) {
    blockers.push("PermissionTech ne refuse pas fail-closed (sondes : employé vide / société vide / techno inconnue).");
  }

  // 6) L'audit existe, y compris en fallback — sonde FALSIFIABLE : périmètre écho,
  //    fallback tracé, secret expurgé.
  try {
    const probe = createTechnologyAuditEntry(
      fallbackResult("voice", { employeeId: "probe-employee", companyId: "probe-company" }, null, "sonde fallback sk_live_probe1234567890"),
    );
    const auditOk =
      probe.id.length > 0 && probe.live === false && probe.companyId === "probe-company" &&
      probe.fallbackUsed === true && !probe.note.includes("sk_live_") && probe.note.includes("[REDACTED]");
    if (!auditOk) blockers.push("Audit indisponible, incohérent ou fuite de secret (sonde fallback).");
  } catch {
    blockers.push("Audit en échec sur un résultat fallback.");
  }

  // 7) Grounding : cross-check avec le master split P16.0 réel — TOUJOURS bloquant
  //    (le cross-check lit le registre réel, indépendamment d'entriesOverride).
  const crossCheck = crossCheckTechnologyRegistryWithMasterSplit();
  if (!crossCheck.ok) {
    for (const issue of crossCheck.issues) blockers.push(`Cross-check P16.0 : ${issue}`);
  }

  // ── Avertissements (attendus en T1 — n'empêchent pas la porte P16C) ──────────
  const liveBlocked = entries.filter((e) => e.liveBlockedReason !== null);
  for (const e of liveBlocked) warnings.push(`« ${e.id} » : ${e.liveBlockedReason}`);
  for (const e of entries.filter((x) => x.recommendedIntegrationPhase === "later")) {
    warnings.push(`« ${e.id} » : intégration recommandée « later » (pas dans la porte P16C initiale).`);
  }
  warnings.push("Aucun provider live vérifié — l'exécution live reste impossible (attendu en T1).");
  warnings.push("« readyForPierreIntegration » = prêt pour P16C ; cela ne signifie PAS providers live prêts.");

  const productionAuthorized = technologyProductionAllowed(); // false (plancher P10)
  const paymentMode = resolvePaymentMode(env);                // fail-closed (jamais live tant que P10=false)
  if (productionAuthorized) blockers.push("PRODUCTION_AUTHORIZED devrait être false en T1.");
  if (paymentMode === "live") blockers.push("Mode de paiement « live » détecté — interdit en T1.");

  const ready = blockers.length === 0;

  return {
    totalTechnologies: entries.length,
    verified: count("verified"),
    partial: count("partial"),
    architectureReady: count("architecture_ready"),
    missing: count("missing"),
    externalBlocked: count("external_blocked"),
    disabled: count("disabled"),
    reusableCount: entries.filter((e) => e.reusable).length,
    pierreOnlyCount,
    liveProviderBlockedCount: entries.filter((e) => e.contract.liveDependency !== "none").length,
    safeFallbackAvailableCount: entries.filter((e) => e.safeFallback.trim().length > 0).length,
    readyForPierreIntegration: ready,
    exactBlockers: blockers,
    exactWarnings: warnings,
    recommendedNextStep: ready
      ? "Ouvrir la porte P16C — adaptateurs Pierre→Technologies (après P16A) ; aucun provider live requis."
      : `Corriger d'abord : ${blockers[0]}`,
    productionAuthorized,
    paymentMode,
    liveExecutionAllowed: isLiveExecutionAllowed(),
    masterSplitCrossCheckOk: crossCheck.ok,
    entriesInjected: entriesOverride !== undefined,
    note: "Rapport COMPUTÉ depuis le registre réel + plancher P10 + mode paiement P15.1. La preuve « tests pass » reste la porte vitest externe.",
  };
}
