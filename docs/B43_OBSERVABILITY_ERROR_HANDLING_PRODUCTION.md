# B43 — Observability / Error Handling Production

## Objectif

Donner à Pierre un système d'observabilité production-ready permettant de :
- Capturer les erreurs proprement et les classifier par domaine
- Redacter automatiquement les secrets et données sensibles
- Tracer toutes les opérations via correlation IDs
- Décider du retry/blocage/escalade/dead-letter automatiquement
- Produire des diagnostics exploitables dans le cockpit
- Éviter les boucles infinies, les fuites de secrets, les crashes silencieux

## Modules core (`src/lib/observability/`)

| Module | Rôle |
|--------|------|
| `types.ts` | Tous les types canoniques (ObservableEvent, ObservableError, RetryDecision, etc.) |
| `redaction.ts` | Redaction secrets/contenu — stripSensitiveKeys, redactErrorMessage, containsForbiddenSecretLeak |
| `correlation.ts` | Génération correlation ID, causation ID, propagation headers HTTP |
| `errors.ts` | Création et normalisation d'erreurs, assertNoSecretInError |
| `event-log.ts` | ObservableEventSink interface + implémentation in-memory + no-op |
| `retry-policy.ts` | Config retry par domaine, calculateBackoffMs, decideRetry, shouldDeadLetter |
| `dead-letter.ts` | DeadLetterSink interface + in-memory + résolution manuelle |
| `health.ts` | buildHealthCheckResult, combineHealthChecks, timedHealthCheck, checkRequiredEnvPresence |
| `runbook.ts` | 17 entrées runbook par code d'erreur, getRunbookForDomain, shouldEscalate |
| `runtime.ts` | withObservableRuntime (async) + withObservableRuntimeSync — wrapper principal |

## Modules Pierre (`src/lib/pierre/observability/`)

| Module | Rôle |
|--------|------|
| `pierre-error-taxonomy.ts` | 21 codes PIERRE_* avec domain/severity/retryable/safe_message |
| `pierre-observable-event.ts` | Builders d'événements Pierre (mission, task, ai, email, security, document, rgpd) |
| `pierre-runtime-guard.ts` | withPierreObservableRuntime, assertPierreCompanyId, assertNoTenantMismatch |
| `pierre-retry-policy.ts` | decidePierreRetry, isPierreUserActionRequired, shouldPierreDeadLetter |
| `pierre-dead-letter.ts` | createPierreDeadLetterEntry, summarizePierreDeadLetters, createPierreDeadLetterSink |
| `pierre-health.ts` | 7 checks service + buildPierreHealthReport |
| `pierre-diagnostics.ts` | buildPierreDiagnosticsReport, canPierreOperateSafely — matrice 15 areas |
| `pierre-observability-verdict.ts` | buildB43ObservabilityVerdict, formatB43VerdictReport |

## Routes (`src/app/api/pierre/observability/`)

| Route | Accès | Description |
|-------|-------|-------------|
| `GET /api/pierre/observability/health` | Public | Statut des 8 services (ok/degraded/down) |
| `GET /api/pierre/observability/diagnostics` | Secret interne | Rapport complet avec areas, dead-letters, runbook |
| `GET /api/pierre/observability/events` | Secret interne | Événements récents filtrables (domain, severity, status, limit) |

## Retry policy par domaine

| Domaine | max_retries | backoff_base | jitter |
|---------|-------------|--------------|--------|
| `workflow` | 0 | — | — |
| `security` | 0 | — | — |
| `rgpd` | 0 | — | — |
| `email` | 1 | 5s | non |
| `ai` | 2 | 2s | oui |
| `document` | 2 | 1s | oui |
| `task` | 3 | 1s | oui |

## Codes non-retryables

`tenant_mismatch`, `security_violation`, `budget_exceeded`, `ai_budget_exceeded`, `validation_missing`, `sensitive_blocked`, `email_blocked_by_policy`, `rgpd_purge_blocked`, `workflow_hard_fail`, `unauthorized`, `forbidden`, `approval_required`, `user_action_required`

## Dead-letter vs cockpit

- **Dead-letter** : erreurs critiques, violations sécurité, retry épuisé → `DeadLetterSink`
- **Cockpit** : approbation requise, actions sensibles bloquées → surface à l'humain
- Jamais de retry auto pour `user_action_required`

## Redaction garanties

- `FORBIDDEN_SECRET_KEYS` : api_key, token, password, authorization, bearer, service_role_key, etc.
- `FORBIDDEN_CONTENT_KEYS` : prompt, completion, email_body, document_raw, ai_response, etc.
- `stripSensitiveKeys()` : récursif, depth limit 5, redacte `[REDACTED]`
- `redactErrorMessage()` : retire les patterns sk-*, sk-ant-*, Bearer, api_key=
- `containsForbiddenSecretLeak()` : détection active dans tous les error logs

## Tests

- `src/lib/observability/__tests__/observability-b43-core.test.ts` : 80+ tests
- `src/lib/pierre/observability/__tests__/pierre-observability-b43.test.ts` : 80+ tests
- `src/app/api/pierre/observability/__tests__/pierre-observability-routes-b43.test.ts` : 40+ tests

Total : **200+ tests**

## Variables d'environnement

```
PIERRE_INTERNAL_DIAGNOSTICS_SECRET=     # Requis pour /diagnostics et /events
PIERRE_OBSERVABILITY_ENABLED=true       # Feature flag observabilité (défaut: true)
PIERRE_DEAD_LETTER_ENABLED=false        # Feature flag dead-letter (défaut: false)
PIERRE_CLONE_GUARD_ENABLED=true         # Garde sécurité (défaut: true)
PIERRE_MAX_AI_BUDGET_EUR=               # Budget IA maximum en euros
```
