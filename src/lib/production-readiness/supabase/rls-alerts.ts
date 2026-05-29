// P-FINAL 01 — Phase 3 — RLS Alerts: what to monitor after RLS activation.
// Pure: no Supabase, no Next, no async, no throw.

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertTrigger = "error_rate" | "query_latency" | "missing_policy" | "unexpected_access" | "manual";

export interface RlsAlertRule {
  id: string;
  name: string;
  description: string;
  trigger: AlertTrigger;
  severity: AlertSeverity;
  threshold?: string;
  recommended_action: string;
  monitoring_query?: string;
}

export const RLS_ALERT_RULES: RlsAlertRule[] = [
  {
    id: "rls_403_spike",
    name: "Spike d'erreurs 403 (permission denied)",
    description: "Un pic soudain d'erreurs 403 après activation RLS indique que certaines routes utilisent anon key au lieu de service_role.",
    trigger: "error_rate",
    severity: "critical",
    threshold: "> 5 erreurs 403 / minute",
    recommended_action: "Vérifier que toutes les routes serveur utilisent le client service_role, pas le client anon.",
    monitoring_query: "SELECT count(*) FROM logs WHERE status = 403 AND created_at > NOW() - INTERVAL '1 minute';",
  },
  {
    id: "rls_policy_missing",
    name: "Policy RLS manquante sur table critique",
    description: "Une table critique (employees, tasks, documents) n'a pas de policy RLS active.",
    trigger: "missing_policy",
    severity: "critical",
    threshold: "0 policies sur une table critique",
    recommended_action: "Appliquer immédiatement la policy manquante depuis PFINAL01_RLS_PRODUCTION_PACK.sql.",
    monitoring_query: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false AND tablename IN ('employees', 'tasks', 'documents');",
  },
  {
    id: "rls_cross_company_access",
    name: "Accès cross-company détecté",
    description: "Un utilisateur a pu accéder à des données d'une company différente.",
    trigger: "unexpected_access",
    severity: "critical",
    recommended_action: "Audit immédiat des policies et des logs d'accès. Révoquer les sessions compromises.",
  },
  {
    id: "rls_slow_queries",
    name: "Requêtes lentes dues aux sous-requêtes RLS",
    description: "Les policies avec sous-requêtes (SELECT company_id FROM profiles WHERE id = auth.uid()) peuvent dégrader les performances si mal indexées.",
    trigger: "query_latency",
    severity: "warning",
    threshold: "> 500ms pour les requêtes employees/tasks",
    recommended_action: "Ajouter des index sur profiles.id et les colonnes company_id. Envisager le caching du company_id dans le JWT.",
    monitoring_query: "SELECT query, mean_exec_time FROM pg_stat_statements WHERE query LIKE '%profiles%' ORDER BY mean_exec_time DESC LIMIT 10;",
  },
  {
    id: "rls_anon_data_exposure",
    name: "Données exposées en mode anon",
    description: "Un client anon peut lire des lignes dans des tables protégées.",
    trigger: "unexpected_access",
    severity: "critical",
    recommended_action: "Vérifier que RLS est bien activé (rowsecurity = true) et qu'aucune policy SELECT ne permet l'accès anon sur les tables critiques.",
  },
  {
    id: "rls_audit_log_tampered",
    name: "Tentative de suppression d'audit logs",
    description: "Des tentatives de DELETE sur audit_logs ont été détectées.",
    trigger: "error_rate",
    severity: "warning",
    recommended_action: "Investiguer l'identité de l'utilisateur ayant tenté la suppression. Les audit logs doivent être immuables.",
  },
];

export function getCriticalAlerts(): RlsAlertRule[] {
  return RLS_ALERT_RULES.filter((a) => a.severity === "critical");
}

export function getAlertsByTrigger(trigger: AlertTrigger): RlsAlertRule[] {
  return RLS_ALERT_RULES.filter((a) => a.trigger === trigger);
}

export function getAlertsSummary(): {
  total: number;
  critical_count: number;
  warning_count: number;
} {
  return {
    total: RLS_ALERT_RULES.length,
    critical_count: RLS_ALERT_RULES.filter((a) => a.severity === "critical").length,
    warning_count: RLS_ALERT_RULES.filter((a) => a.severity === "warning").length,
  };
}
