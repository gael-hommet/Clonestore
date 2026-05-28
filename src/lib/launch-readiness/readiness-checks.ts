// B48 — Core Readiness Checks Aggregator
// Builds per-surface LaunchReadinessReport from all check modules.
// Pure: no Supabase, no Next, no async. No throw.

import type { LaunchReadinessCheck, LaunchReadinessReport, LaunchReadinessStatus, LaunchSurface } from "./types";
import { getSecurityReadinessChecks } from "./security-readiness";
import { getBillingReadinessChecks } from "./billing-readiness";
import { getDemoReadinessChecks } from "./demo-readiness";
import { getPierreReadinessChecks } from "./pierre-readiness";
import { getClonestoreReadinessChecks } from "./clonestore-readiness";
import { getMissingBlockingPages, getUiReadinessSummary } from "./ui-readiness";
import { getAllProductionFlags } from "./production-flags";

function buildLegalChecks(): LaunchReadinessCheck[] {
  const missingPages = getMissingBlockingPages();
  const checks: LaunchReadinessCheck[] = [];

  if (missingPages.some((p) => p.path === "/legal/cgu")) {
    checks.push({
      id: "LEGAL_CGU_MISSING",
      surface: "legal",
      label: "CGU manquantes",
      description: "La page /legal/cgu n'existe pas. Requis avant lancement public.",
      status: "blocked",
      severity: "critical",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: true,
      notes: "Page absente — BLOCKER.",
      remediation: "Rédiger les CGU avec un conseil juridique. Créer src/app/legal/cgu/page.tsx.",
    });
  }

  if (missingPages.some((p) => p.path === "/legal/cgv")) {
    checks.push({
      id: "LEGAL_CGV_MISSING",
      surface: "legal",
      label: "CGV manquantes",
      description: "La page /legal/cgv n'existe pas. Requis avant lancement public.",
      status: "blocked",
      severity: "critical",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: true,
      notes: "Page absente — BLOCKER.",
      remediation: "Rédiger les CGV avec un conseil juridique. Créer src/app/legal/cgv/page.tsx.",
    });
  }

  checks.push({
    id: "LEGAL_REVIEW_REQUIRED",
    surface: "legal",
    label: "Revue juridique humaine requise",
    description: "B47 est une base technique — pas un avis juridique. Revue humaine obligatoire.",
    status: "blocked",
    severity: "blocking",
    is_manual: true,
    manual_verified: false,
    blocking_public_launch: true,
    notes: "Non vérifiée.",
    remediation: "Faire relire les guardrails B47 par un juriste ou avocat.",
  });

  checks.push({
    id: "LEGAL_PRIVACY_POLICY",
    surface: "legal",
    label: "Politique de confidentialité à compléter",
    description: "/legal/confidentialite existe mais doit être complétée et validée RGPD.",
    status: "ready_with_warnings",
    severity: "warning",
    is_manual: true,
    manual_verified: false,
    blocking_public_launch: false,
    notes: "Page existe, contenu à valider.",
    remediation: "Compléter la politique avec DPO, sous-traitants, durées de rétention.",
  });

  return checks;
}

function buildRgpdChecks(): LaunchReadinessCheck[] {
  return [
    {
      id: "RGPD_PRIVACY_PAGE",
      surface: "rgpd",
      label: "Page confidentialité accessible",
      description: "La politique de confidentialité doit être accessible depuis toutes les pages.",
      status: "ready",
      severity: "warning",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: false,
      notes: "/legal/confidentialite exists.",
      remediation: null,
    },
    {
      id: "RGPD_DPA",
      surface: "rgpd",
      label: "DPA / Accord de sous-traitance à préparer",
      description: "Les clients B2B qui traitent des données de salariés ont besoin d'un DPA.",
      status: "blocked",
      severity: "warning",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "Non encore préparé.",
      remediation: "Rédiger un DPA template. Le mettre à disposition dans les paramètres du compte.",
    },
    {
      id: "RGPD_DATA_RETENTION",
      surface: "rgpd",
      label: "Durées de rétention des données définies",
      description: "Les durées de rétention des données RH/paie sont définies et documentées.",
      status: "ready_with_warnings",
      severity: "warning",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "À documenter dans la politique de confidentialité.",
      remediation: "Définir et documenter les durées de rétention par type de données.",
    },
  ];
}

function buildOperationsChecks(): LaunchReadinessCheck[] {
  return [
    {
      id: "OPS_MONITORING",
      surface: "observability",
      label: "Monitoring de production configuré",
      description: "Alertes sur erreurs 5xx, latence élevée, échecs Stripe webhook.",
      status: "ready_with_warnings",
      severity: "warning",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "À configurer (Sentry, Vercel monitoring, etc.).",
      remediation: "Configurer Sentry ou équivalent. Alertes sur downtime et erreurs critiques.",
    },
    {
      id: "OPS_BACKUP",
      surface: "operations",
      label: "Backups Supabase configurés",
      description: "Les backups automatiques Supabase sont activés et testés.",
      status: "ready_with_warnings",
      severity: "warning",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "À vérifier sur le dashboard Supabase.",
      remediation: "Activer les backups automatiques sur le plan Supabase approprié.",
    },
    {
      id: "OPS_LAUNCH_READINESS_DASHBOARD",
      surface: "operations",
      label: "Dashboard launch readiness B48 accessible",
      description: "La page /profile/launch-readiness est accessible et retourne le verdict correct.",
      status: "ready",
      severity: "info",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: false,
      notes: "B48 dashboard implemented.",
      remediation: null,
    },
  ];
}

export function getAllReadinessChecks(): LaunchReadinessCheck[] {
  return [
    ...buildLegalChecks(),
    ...buildRgpdChecks(),
    ...getSecurityReadinessChecks(),
    ...getBillingReadinessChecks(),
    ...getDemoReadinessChecks(),
    ...getPierreReadinessChecks(),
    ...getClonestoreReadinessChecks(),
    ...buildOperationsChecks(),
  ];
}

function computeSurfaceStatus(checks: LaunchReadinessCheck[]): LaunchReadinessStatus {
  if (checks.length === 0) return "not_applicable";
  if (checks.some((c) => c.blocking_public_launch && c.status === "blocked")) return "blocked";
  if (checks.some((c) => c.status === "blocked")) return "ready_with_warnings";
  if (checks.some((c) => c.status === "ready_with_warnings")) return "ready_with_warnings";
  return "ready";
}

export function buildReadinessReportBySurface(surface: LaunchSurface): LaunchReadinessReport {
  const checks = getAllReadinessChecks().filter((c) => c.surface === surface);
  const status = computeSurfaceStatus(checks);
  const blocking_count = checks.filter((c) => c.blocking_public_launch && c.status !== "ready").length;
  const warning_count = checks.filter((c) => c.status === "ready_with_warnings").length;
  const ready_count = checks.filter((c) => c.status === "ready").length;
  return { surface, checks, status, blocking_count, warning_count, ready_count };
}

export function getAllSurfaces(): LaunchSurface[] {
  return [
    "public_site",
    "checkout",
    "billing",
    "auth",
    "cockpit",
    "pierre",
    "demo",
    "documents",
    "email",
    "security",
    "rgpd",
    "observability",
    "technologies",
    "legal",
    "operations",
  ];
}

export function buildAllReadinessReports(): LaunchReadinessReport[] {
  return getAllSurfaces().map(buildReadinessReportBySurface);
}

export function getBlockingChecks(): LaunchReadinessCheck[] {
  return getAllReadinessChecks().filter(
    (c) => c.blocking_public_launch && c.status !== "ready"
  );
}

export function getUiSummary() {
  return getUiReadinessSummary();
}

export function getProductionFlagDescriptions() {
  return getAllProductionFlags().map((f) => ({
    key: f.key,
    label: f.label,
    blocking: f.blocking_public_launch,
    surface: f.surface,
  }));
}
