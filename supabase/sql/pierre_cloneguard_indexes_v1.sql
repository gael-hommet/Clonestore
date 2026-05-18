-- =========================================================
-- Pierre / CloneGuard — Indexes v1 (Bloc 14)
-- Objectif : gouvernance runtime et filtrage à grande échelle
-- Cible architecture : 100k+ clients actifs (non load-testé)
-- Compatible IF NOT EXISTS — idempotent
-- =========================================================

-- -------------------------
-- pierre_tasks — CloneGuard execution gate
-- -------------------------

-- Filtre approbation + statut pour la porte CloneGuard
create index if not exists idx_pierre_tasks_user_agent_approval_status
on public.pierre_tasks (user_id, agent_slug, approval_required, status);

-- Filtre type + statut pour blocage email.send / task types sensibles
create index if not exists idx_pierre_tasks_user_agent_type_status
on public.pierre_tasks (user_id, agent_slug, type, status);

-- Schedule gate : tâches avec execute_at défini
create index if not exists idx_pierre_tasks_user_agent_execute_at_status
on public.pierre_tasks (user_id, agent_slug, execute_at, status)
where execute_at is not null;

-- Tâches actives prêtes à l'exécution (ready/retry)
create index if not exists idx_pierre_tasks_user_agent_ready_retry
on public.pierre_tasks (user_id, agent_slug, created_at desc)
where status in ('ready', 'retry');

-- Index GIN sur payload_json pour recherche employee_id et contexte
create index if not exists idx_pierre_tasks_payload_gin
on public.pierre_tasks using gin (payload_json);

-- -------------------------
-- pierre_missions — CloneGuard context scoring
-- -------------------------

-- Filtre approbation + niveau de risque pour évaluation mission
create index if not exists idx_pierre_missions_user_agent_approval_risk
on public.pierre_missions (user_id, agent_slug, approval_required, risk_level);

-- Missions actives (hors terminales) pour CloneGuard continue
create index if not exists idx_pierre_missions_user_agent_active_risk
on public.pierre_missions (user_id, agent_slug, risk_level, created_at desc)
where status not in ('cancelled', 'done');

-- Index GIN sur context_snapshot_json pour recherche textuelle CloneGuard
create index if not exists idx_pierre_missions_context_snapshot_gin
on public.pierre_missions using gin (context_snapshot_json);

-- -------------------------
-- pierre_task_logs — Audit CloneGuard
-- -------------------------

-- Récupération des logs CloneGuard par user + agent + event_type + date
create index if not exists idx_pierre_task_logs_user_agent_event_type_created
on public.pierre_task_logs (user_id, agent_slug, event_type, created_at desc);

-- Logs CloneGuard filtrés par event_type spécifique
create index if not exists idx_pierre_task_logs_cloneguard_events
on public.pierre_task_logs (user_id, agent_slug, created_at desc)
where event_type in (
  'cloneguard_evaluation',
  'cloneguard_execution_blocked',
  'cloneguard_signal_detected',
  'cloneguard_manual_evaluation',
  'cloneguard_continuity_blocked',
  'cloneguard_continue_evaluated'
);

-- Index GIN sur meta_json pour recherche de décisions CloneGuard
create index if not exists idx_pierre_task_logs_meta_gin
on public.pierre_task_logs using gin (meta_json);
