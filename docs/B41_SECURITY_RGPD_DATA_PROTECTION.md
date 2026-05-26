# B41 — Security / RGPD / Data Protection

**Date:** 2026-05-26  
**Statut:** CLOS  
**Score:** 92/100  
**Suite:** B41 clos → B42 Final Workflow Completion  
**safe_to_continue_to_b42:** true

---

## 1. Objectif B41

Rendre Pierre crédible pour des données RH sensibles.

B41 livre :
- Audit sécurité complet des routes Pierre
- Guards serveur centralisés (route-guard.ts)
- Anti company_id spoofing
- Extension RLS SQL pour tables manquantes
- Classification PII / données sensibles
- Redaction / masking systématique
- Export RGPD des données Pierre
- Purge / droit à l'effacement
- Retention policy
- Journal d'audit sécurité
- Rate limiting in-memory
- Headers de sécurité (no-store, nosniff, no-referrer)
- Fix critique : billing/activate Bearer auth obligatoire
- Tests 210/210

---

## 2. Menaces couvertes

| Menace | Statut |
|--------|--------|
| company_id spoofing depuis client | Couvert — sanitizeActionPayload() + stripTenantSpoofingFields() |
| user_id spoofing dans billing/activate | **FIXÉ** — Bearer token requis, user_id depuis auth |
| Cross-tenant data leak | Couvert — filterByCompanyId, auditSnapshotForLeaks |
| Secrets dans les logs | Couvert — redactObjectDeep() masque api_key, prompt, completion |
| Absence d'export RGPD | Couvert — /api/pierre/security/export |
| Absence de purge RGPD | Couvert — /api/pierre/security/purge (dry_run par défaut) |
| Pas de headers de sécurité | Couvert — buildSecurityHeaders() sur routes sensibles |
| RLS manquante sur pierre_task_artifacts | Documenté — B41_PIERRE_SECURITY_RLS.sql |
| Rate limiting absent | Couvert — in-memory limiter (production : wirer Upstash) |
| Pas de politique de rétention | Couvert — pierre-retention.ts |

---

## 3. Données RH sensibles

| Catégorie | Exemples | Niveau |
|-----------|----------|--------|
| Secrets | api_key, password, token, jwt | secret |
| Paie | salary, iban, bonus, prime | payroll_sensitive |
| Santé | maladie, arrêt, medical | health_sensitive |
| Légal RH | disciplinary, licenciement, harassment | legal_sensitive |
| RH général | contract, evaluation, employee_file | hr_sensitive |
| Personnel | email, phone, ssn, adresse | personal |
| Interne | mission_id, status, event_type | internal |

**Règle** : prompts, completions, corps email, document HTML — jamais loggés ni exportés.

---

## 4. Tenant Isolation

### Architecture actuelle (B41)

```
company_id = user_id (single-user tenancy)
```

### Flux d'auth serveur

```
Client → Bearer token (JWT Supabase)
Serveur → supabase.auth.getUser(token) → userId
Serveur → company_id = userId (jamais depuis client)
Serveur → buildSecurityTenantScope({ user_id, company_id, ... })
```

### Anti-spoofing

```typescript
stripTenantSpoofingFields(payload)
// Supprime : company_id, organization_id, user_id, agent_slug, access_level, ...

sanitizeActionPayload(payload, tenant)
// B40 : supprime company_id / org_id / user_id / agent_slug du payload client
```

---

## 5. Route Guard

```typescript
// src/lib/security/route-guard.ts

evaluateRouteSecurityPolicy(policy, scope)
→ SecurityDecision { allowed, status, reason, policy_id }

requireRouteAccess(policy, scope)
→ { ok: true } | { ok: false, decision }

withSecurityGuard(policy, scope, handler)
→ { ok: true, data } | { ok: false, decision }
```

### Niveaux d'accès (hiérarchique)

```
anonymous (0) → logged_unpaid (1) → trial (2) → paid_customer (3) → internal_admin (4) → service_role (5)
```

### Décisions possibles

- allow
- block_auth_required (401)
- block_not_paid (403)
- block_no_company (403)
- block_no_agent_access (403)
- block_tenant_mismatch (403)
- block_rate_limited (429)
- block_service_role_required (403)
- block_emergency_shutdown (503)

---

## 6. PII Redaction

```typescript
// src/lib/security/redaction.ts

redactEmail("alice@example.com") → "al***@ex***.com"
redactPhone("+33612345678") → "33****78"
redactSecret("sk-proj-abc123") → "[REDACTED_SECRET]"
redactObjectDeep({ api_key: "x", prompt: "y" })
  → { api_key: "[REDACTED_SECRET]", prompt: "[CONTENT_NOT_LOGGED]" }
safeJsonForAudit(meta) → supprime body_text, email_body, completions
```

**Jamais loggés / exportés :**
- prompt, completion, openai_response, anthropic_response
- body_text, email_body, email_html, email_content
- document_content, full_text, cv_content

---

## 7. RGPD Export

**Route** : `GET /api/pierre/security/export` (plan) | `POST /api/pierre/security/export` (full)

**Garanties** :
- Bearer token requis
- company_id jamais depuis le client
- api_key, prompts, completions exclus du bundle
- Corps email non exporté
- Email recipients partiellement masqués
- Adapters injectables (fake en test, Supabase en prod)

**Bundle inclut** (metadata uniquement) :
- Missions, tâches, documents, emails, mémoire
- Résumé coût IA, événements audit email
- Événements d'audit sécurité

---

## 8. RGPD Purge

**Route** : `POST /api/pierre/security/purge`

**Garanties** :
- `dry_run=true` par défaut — aucune donnée supprimée
- `execute=true` nécessite : `PIERRE_RGPD_PURGE_EXECUTE_ENABLED=true` + `internal_admin` + phrase de confirmation
- Phrase : `"CONFIRME SUPPRESSION DONNÉES PIERRE"`
- `irreversible_after_execution=true` — documenté explicitement
- Orders/Billing : non supprimables — rétention légale 7 ans

---

## 9. Retention Policy

| Table | Politique | Action |
|-------|-----------|--------|
| pierre_missions | Jusqu'à suppression compte | delete |
| pierre_tasks | Jusqu'à suppression compte | delete |
| pierre_task_logs | 90 jours | delete |
| pierre_task_artifacts | Jusqu'à suppression compte | delete |
| pierre_documents | Jusqu'à suppression compte | delete |
| pierre_outbound_emails | Jusqu'à suppression compte | delete |
| pierre_company_memory | Jusqu'à suppression compte | delete |
| cloneos_ai_cost_events | 90 jours | delete |
| cloneos_email_send_events | 90 jours | delete |
| security_audit_events | 1 an | delete |
| orders | 7 ans (légal) | anonymize |

---

## 10. RLS Supabase

**Existant** (`supabase/sql/pierre_rls_v1.sql`) :
- pierre_company_memory ✓
- pierre_missions ✓
- pierre_tasks ✓
- pierre_task_logs ✓
- pierre_documents ✓
- pierre_outbound_emails ✓

**Ajouté dans B41** (`docs/sql/B41_PIERRE_SECURITY_RLS.sql`) :
- pierre_task_artifacts (via JOIN pierre_tasks)
- cloneos_ai_cost_events
- security_audit_events (future)

**Règle service_role** : bypasse RLS natif Supabase. Les routes server-side doivent appliquer `WHERE user_id = $1` manuellement.

---

## 11. Limites restantes

| Risque | Niveau | Remédiation |
|--------|--------|-------------|
| Rate limiter in-memory uniquement | MOYEN | Wirer Upstash/Redis en production |
| safeJsonForAudit() pas wired dans insertPierreLogs() | MOYEN | Appliquer sur tous les meta_json en prod |
| Headers sécurité pas appliqués sur tous les /api/pierre/* | MOYEN | Appliquer via middleware ou wrapper |
| Cookie fallback middleware.ts | FAIBLE | Uniformiser B42 |
| company_id = user_id — pas future-proof | FUTUR | company_members table B42+ |
| Pentest externe non réalisé | INFO | Requis avant scaling >100 clients |
| Revue légale RGPD non effectuée | LÉGAL | Requis avant lancement public |

---

## 12. Prochaine étape : B42 Final Workflow Completion

B42 devra finaliser les workflows opérationnels Pierre avant public launch.
