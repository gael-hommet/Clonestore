# B43 — Pierre Production Runbook

## Accès diagnostics

```bash
# Health (public)
curl https://your-domain.com/api/pierre/observability/health

# Diagnostics (secret interne)
curl -H "x-internal-secret: $PIERRE_INTERNAL_DIAGNOSTICS_SECRET" \
  https://your-domain.com/api/pierre/observability/diagnostics

# Événements récents (secret interne)
curl -H "x-internal-secret: $PIERRE_INTERNAL_DIAGNOSTICS_SECRET" \
  "https://your-domain.com/api/pierre/observability/events?domain=ai&limit=20"
```

## Runbook par type d'incident

### 🔴 PIERRE_SECURITY_VIOLATION

1. **Ne pas retenter** — blocage définitif
2. Identifier la correlation_id dans les logs
3. Examiner toute la trace corrélée
4. Alerter l'équipe sécurité dans les 15 minutes
5. Geler la session utilisateur si possible
6. Dead-letter automatique — vérifier le cockpit

### 🔴 PIERRE_MISSION_COMPANY_MISMATCH

1. Tentative d'accès cross-tenant — **incident sécurité**
2. Bloquer immédiatement l'accès
3. Identifier l'utilisateur et la resource concernée
4. Alerter l'équipe sécurité
5. Audit complet de la session

### 🟡 PIERRE_AI_CALL_FAILED

1. Vérifier le statut du provider IA (Anthropic/OpenAI)
2. Retry automatique (max 2 fois, backoff exponentiel 2s + jitter)
3. Si persistant : vérifier la clé ANTHROPIC_API_KEY / OPENAI_API_KEY
4. Alerter si taux d'erreur > 10% des appels IA

### 🟡 PIERRE_AI_BUDGET_EXCEEDED

1. **Pas de retry** — quota épuisé
2. Notifier l'account manager
3. Message utilisateur : "Quota IA atteint — contactez votre administrateur."
4. Bloquer tous les nouveaux appels IA jusqu'à reset du budget

### 🟡 PIERRE_EMAIL_SEND_FAILED

1. Retry une fois après 5s
2. Si hard bounce (adresse invalide) : pas de retry
3. Si persistant : vérifier statut Resend
4. Dead-letter si retry épuisé → surface cockpit

### 🟡 PIERRE_EMAIL_BLOCKED_BY_POLICY (B39)

1. **Comportement attendu** — pas une erreur système
2. L'email attend une validation humaine
3. Surface dans le cockpit pour décision
4. Ne pas contourner la policy B39

### 🟡 PIERRE_TASK_APPROVAL_REQUIRED

1. Comportement attendu pour les actions sensibles
2. Notification au manager RH responsable
3. Ne pas auto-exécuter — attendre approbation explicite
4. Timeout d'approbation si configurable

### 🔴 PIERRE_RGPD_PURGE_BLOCKED

1. **Escalade immédiate au DPO**
2. Documenter le blocage dans le registre RGPD
3. Identifier la raison du blocage (legal hold actif ?)
4. Ne pas retenter sans autorisation DPO

### 🟡 PIERRE_WORKFLOW_HARD_FAIL

1. Violation contrainte B42 — incident intégrité système
2. Escalader à l'ingénierie
3. Examiner les hard_fail_conditions dans le résultat workflow
4. Ne jamais contourner — il s'agit d'une protection intentionnelle

## Health checks

| Service | Impact si down |
|---------|----------------|
| `ai_provider` | Pierre ne peut plus générer de documents/emails |
| `email_provider` | Envoi email impossible |
| `supabase` | Pas de persistence, cockpit inaccessible |
| `security_guard` | **Ne pas opérer** — safe_to_operate=false |
| `pierre_runtime` | Budget guard inactif |
| `observability` | Pas de trace des erreurs |

## Dead letters

Les dead letters sont des messages qui ont échoué de façon permanente.

```typescript
// Consulter les dead letters
import { getDefaultDeadLetterSink } from "@/lib/observability/runtime";
const dlSink = getDefaultDeadLetterSink();
const unresolvedDl = dlSink.list({ resolved: false });

// Résoudre manuellement
dlSink.resolve(entryId, { resolved_by: "admin@company.com", note: "Traité manuellement" });
```

## Variables d'environnement critiques

| Variable | Requis | Description |
|----------|--------|-------------|
| `PIERRE_INTERNAL_DIAGNOSTICS_SECRET` | Oui | Secret pour /diagnostics et /events |
| `ANTHROPIC_API_KEY` | Oui | Clé API Anthropic |
| `RESEND_API_KEY` | Oui | Clé API Resend |
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui | Clé service Supabase |
| `PIERRE_MAX_AI_BUDGET_EUR` | Recommandé | Budget IA max en euros |
| `PIERRE_OBSERVABILITY_ENABLED` | Optionnel | Activer l'observabilité (défaut: true) |
| `PIERRE_CLONE_GUARD_ENABLED` | Optionnel | Activer CloneGuard (défaut: true) |

## Garanties absolues B43

- Aucun secret ne sort dans les logs (redaction systématique)
- Aucune stack trace complète côté client
- Aucun prompt/completion IA loggé brut
- Aucun corps email complet dans les événements
- Aucun document RH brut dans les métadonnées
- Aucun retry pour les violations sécurité
- Aucun retry automatique pour les actions nécessitant une validation humaine
