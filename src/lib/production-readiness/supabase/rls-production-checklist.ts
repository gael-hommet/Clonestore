// P-FINAL 01 — Phase 3 — RLS Production Checklist.
// 12+ items, categorized, manually verifiable.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: This is a human-execution checklist, not automated enforcement.

export type ChecklistCategory =
  | "pre_migration"
  | "migration_execution"
  | "post_migration_verification"
  | "monitoring"
  | "rollback";

export type ChecklistStatus = "pending" | "done" | "skipped" | "failed";

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  title: string;
  description: string;
  critical: boolean;
  verification_query?: string;
  rollback_action?: string;
}

export interface ChecklistReport {
  items: ChecklistItem[];
  total: number;
  critical_count: number;
  categories: ChecklistCategory[];
}

export const RLS_PRODUCTION_CHECKLIST: ChecklistItem[] = [
  // ── Pre-migration ──────────────────────────────────────────────────────────
  {
    id: "backup_before_rls",
    category: "pre_migration",
    title: "Créer un snapshot/backup avant d'appliquer le SQL RLS",
    description: "Effectuer un backup complet de la base de données Supabase production avant d'appliquer toute migration RLS.",
    critical: true,
    rollback_action: "Restaurer depuis le backup",
  },
  {
    id: "review_sql_file",
    category: "pre_migration",
    title: "Relire intégralement PFINAL01_RLS_PRODUCTION_PACK.sql",
    description: "Un second pair d'yeux doit valider chaque policy SQL avant application. Vérifier notamment les clauses USING et WITH CHECK.",
    critical: true,
  },
  {
    id: "check_rls_enabled",
    category: "pre_migration",
    title: "Vérifier que RLS est activé sur toutes les tables cibles",
    description: "ALTER TABLE ... ENABLE ROW LEVEL SECURITY doit précéder toute policy. Vérifier dans Supabase Dashboard > Table Editor.",
    critical: true,
    verification_query: "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;",
  },
  {
    id: "staging_test_first",
    category: "pre_migration",
    title: "Appliquer et tester sur un environnement de staging d'abord",
    description: "Ne jamais appliquer en production sans avoir testé l'ensemble du pack RLS sur un Supabase de staging avec données réalistes.",
    critical: true,
  },
  {
    id: "check_service_role_exempt",
    category: "pre_migration",
    title: "Confirmer que service_role contourne RLS pour les appels serveur",
    description: "Les appels serveur (routes API, cron, webhooks) doivent utiliser le service_role key, pas l'anon key, pour contourner RLS sans violer les policies.",
    critical: true,
    verification_query: "SELECT current_setting('role');  -- Doit retourner 'service_role' pour les appels serveur",
  },
  {
    id: "anon_access_blocked",
    category: "pre_migration",
    title: "Vérifier que les tables critiques sont inaccessibles en anon",
    description: "Après application du RLS, tester avec un client Supabase anon que les tables employees, tasks, documents renvoient 0 résultats.",
    critical: true,
    verification_query: "SELECT count(*) FROM employees;  -- Doit retourner 0 avec anon key",
  },

  // ── Migration execution ────────────────────────────────────────────────────
  {
    id: "apply_in_transaction",
    category: "migration_execution",
    title: "Appliquer le SQL dans une transaction (BEGIN ... COMMIT)",
    description: "Encapsuler l'ensemble du SQL RLS dans une transaction pour permettre le rollback en cas d'erreur.",
    critical: true,
    rollback_action: "ROLLBACK;",
  },
  {
    id: "check_no_syntax_errors",
    category: "migration_execution",
    title: "Vérifier l'absence d'erreurs SQL lors de l'exécution",
    description: "Le SQL Editor Supabase ou psql doit signaler 0 erreur après exécution. Inspecter chaque ligne de sortie.",
    critical: true,
  },

  // ── Post-migration verification ────────────────────────────────────────────
  {
    id: "verify_policies_created",
    category: "post_migration_verification",
    title: "Lister les policies créées dans pg_policies",
    description: "Après migration, vérifier que toutes les policies attendues apparaissent dans pg_policies.",
    critical: true,
    verification_query: "SELECT schemaname, tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;",
  },
  {
    id: "test_authenticated_isolation",
    category: "post_migration_verification",
    title: "Tester l'isolation company_id avec deux comptes de test distincts",
    description: "Créer deux comptes appartenant à des companies différentes. Vérifier qu'aucun ne peut voir les données de l'autre.",
    critical: true,
  },
  {
    id: "test_pierre_routes_post_rls",
    category: "post_migration_verification",
    title: "Exécuter une mission Pierre de bout en bout post-RLS",
    description: "Lancer une mission RH via Pierre (ex: création tâche, document) et vérifier que les routes API fonctionnent correctement avec service_role.",
    critical: true,
  },
  {
    id: "verify_audit_logs_immutable",
    category: "post_migration_verification",
    title: "Vérifier que les audit_logs ne sont pas supprimables par les users",
    description: "Tester que DELETE FROM audit_logs retourne 0 lignes supprimées pour un utilisateur authentifié.",
    critical: false,
    verification_query: "DELETE FROM audit_logs WHERE id = 'test';  -- Doit retourner 0 rows affected",
  },

  // ── Monitoring ─────────────────────────────────────────────────────────────
  {
    id: "setup_rls_alerts",
    category: "monitoring",
    title: "Activer les alertes sur les erreurs Supabase RLS (403/permission denied)",
    description: "Configurer les alertes Supabase ou l'observabilité applicative pour détecter les erreurs 403 inattendues post-RLS.",
    critical: false,
  },
  {
    id: "monitor_query_performance",
    category: "monitoring",
    title: "Surveiller la performance des requêtes après activation RLS",
    description: "Les policies avec sous-requêtes (SELECT company_id FROM profiles WHERE id = auth.uid()) peuvent impacter les performances. Vérifier les slow queries.",
    critical: false,
  },

  // ── Rollback ──────────────────────────────────────────────────────────────
  {
    id: "document_rollback_procedure",
    category: "rollback",
    title: "Documenter la procédure de rollback RLS",
    description: "Préparer le SQL DROP POLICY pour chaque policy créée, à appliquer en cas de rollback urgent.",
    critical: false,
    rollback_action: "DROP POLICY IF EXISTS policy_name ON table_name;",
  },
];

export function getChecklistReport(): ChecklistReport {
  const categories = [...new Set(RLS_PRODUCTION_CHECKLIST.map((i) => i.category))];
  return {
    items: RLS_PRODUCTION_CHECKLIST,
    total: RLS_PRODUCTION_CHECKLIST.length,
    critical_count: RLS_PRODUCTION_CHECKLIST.filter((i) => i.critical).length,
    categories,
  };
}

export function getItemsByCategory(category: ChecklistCategory): ChecklistItem[] {
  return RLS_PRODUCTION_CHECKLIST.filter((i) => i.category === category);
}

export function getCriticalChecklistItems(): ChecklistItem[] {
  return RLS_PRODUCTION_CHECKLIST.filter((i) => i.critical);
}

export function areAllCriticalItemsDone(doneIds: string[]): boolean {
  const doneSet = new Set(doneIds);
  return getCriticalChecklistItems().every((item) => doneSet.has(item.id));
}
