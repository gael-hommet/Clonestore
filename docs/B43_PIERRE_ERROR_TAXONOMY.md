# B43 — Pierre Error Taxonomy

## Les 21 codes d'erreur Pierre

Tous les codes Pierre suivent la convention `PIERRE_<DOMAIN>_<CONDITION>`.

### Couche Mission

| Code | Severity | Retryable | Description |
|------|----------|-----------|-------------|
| `PIERRE_MISSION_NOT_FOUND` | error | non | Mission introuvable par ID |
| `PIERRE_MISSION_ALREADY_CLOSED` | warning | non | Mission déjà clôturée |
| `PIERRE_MISSION_COMPANY_MISMATCH` | **critical** | non | Cross-tenant access — sécurité |

### Couche Task

| Code | Severity | Retryable | Description |
|------|----------|-----------|-------------|
| `PIERRE_TASK_EXECUTION_FAILED` | error | **oui** | Échec d'exécution récupérable |
| `PIERRE_TASK_APPROVAL_REQUIRED` | info | non | Validation humaine requise |
| `PIERRE_TASK_BLOCKED_SENSITIVE` | warning | non | Cas sensible RH — bloqué |
| `PIERRE_TASK_NOT_FOUND` | error | non | Tâche introuvable |

### Couche Workflow

| Code | Severity | Retryable | Description |
|------|----------|-----------|-------------|
| `PIERRE_WORKFLOW_HARD_FAIL` | **critical** | non | Violation contrainte B42 |
| `PIERRE_WORKFLOW_NO_TASKS` | error | non | Aucune tâche générée |
| `PIERRE_WORKFLOW_DOMAIN_MISMATCH` | error | non | Domaine mal classifié |

### Couche Email

| Code | Severity | Retryable | Description |
|------|----------|-----------|-------------|
| `PIERRE_EMAIL_BLOCKED_BY_POLICY` | warning | non | Bloqué par B39 email policy |
| `PIERRE_EMAIL_SEND_FAILED` | error | **oui** | Échec provider email |
| `PIERRE_EMAIL_RECIPIENT_INVALID` | error | non | Adresse invalide |

### Couche IA

| Code | Severity | Retryable | Description |
|------|----------|-----------|-------------|
| `PIERRE_AI_CALL_FAILED` | error | **oui** | Provider IA erreur 5xx |
| `PIERRE_AI_BUDGET_EXCEEDED` | error | non | Quota IA épuisé |
| `PIERRE_AI_TIMEOUT` | warning | **oui** | Timeout provider IA |

### Couche Document

| Code | Severity | Retryable | Description |
|------|----------|-----------|-------------|
| `PIERRE_DOCUMENT_GENERATION_FAILED` | error | **oui** | Génération document échouée |
| `PIERRE_PDF_RENDER_FAILED` | error | **oui** | Rendu PDF échoué |

### Couche RGPD

| Code | Severity | Retryable | Description |
|------|----------|-----------|-------------|
| `PIERRE_RGPD_PURGE_BLOCKED` | **critical** | non | Purge bloquée — legal hold |

### Couche Sécurité

| Code | Severity | Retryable | Description |
|------|----------|-----------|-------------|
| `PIERRE_SECURITY_VIOLATION` | **critical** | non | Violation CloneGuard ou RGPD |

## Messages utilisateur (safe_message)

Tous les codes ont un message sécurisé sans détail technique :
- `PIERRE_SECURITY_VIOLATION` → "Une violation de sécurité a été détectée. L'action a été bloquée."
- `PIERRE_AI_BUDGET_EXCEEDED` → "Quota IA atteint — contactez votre administrateur."
- `PIERRE_TASK_APPROVAL_REQUIRED` → "Cette tâche nécessite une validation humaine avant d'être exécutée."
- `PIERRE_MISSION_COMPANY_MISMATCH` → "Erreur d'accès — contactez le support."

## Règles d'escalade

| Condition | Action |
|-----------|--------|
| severity=critical | Dead-letter + escalade sécurité |
| user_action_required | Surface cockpit (pas de dead-letter) |
| retry exhausted | Dead-letter |
| PIERRE_RGPD_PURGE_BLOCKED | DPO immediate |
| PIERRE_MISSION_COMPANY_MISMATCH | Sécurité immédiate |

## Lookup API

```typescript
import { getPierreErrorMeta, isPierreErrorCode, getPierreSafeMessage } from "@/lib/pierre/observability/pierre-error-taxonomy";

const meta = getPierreErrorMeta("PIERRE_AI_CALL_FAILED");
// { code, domain: "ai", severity: "error", retryable: true, safe_message: "..." }

const msg = getPierreSafeMessage("PIERRE_AI_BUDGET_EXCEEDED");
// "Quota IA atteint — contactez votre administrateur."
```
