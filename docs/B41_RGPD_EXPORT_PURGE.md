# B41 — RGPD Export & Purge

**Date:** 2026-05-26  
**Statut:** LIVRÉ (socle technique)  
**Note:** Ce document est technique. La conformité juridique RGPD finale nécessite une revue légale.

---

## 1. Droit à la portabilité — Export

### Route

```
GET  /api/pierre/security/export  → Plan d'export (sans données)
POST /api/pierre/security/export  → Bundle JSON complet (données redactées)
```

### Garanties

| Garantie | Implémentation |
|---------|----------------|
| Auth Bearer obligatoire | Vérification token avant tout |
| company_id jamais depuis client | Résolu depuis auth serveur |
| Pas de secrets dans le bundle | api_key, token → [REDACTED_SECRET] |
| Pas de prompts/completions | [CONTENT_NOT_EXPORTED] |
| Corps email non exporté | email_body → [CONTENT_NOT_EXPORTED] |
| Email recipients masqués | redactEmail() → al***@ex***.com |
| Headers no-store | Cache-Control: no-store sur la réponse |

### Contenu du bundle (metadata uniquement)

```json
{
  "generated_at": "2026-05-26T...",
  "tenant": { "user_id": "...", "company_id": "...", "access_level": "paid_customer" },
  "missions": [...],     // metadata, pas le brief complet
  "tasks": [...],        // status, type, pas le contenu IA
  "documents": [...],    // metadata, pas le HTML
  "emails": [...],       // metadata, pas le corps
  "memory": [...],       // CloneADN exporté (données entreprise)
  "audit_events": [...], // log des actions sécurité
  "cost_events": [...],  // coûts IA sans prompts
  "metadata": { "export_version": "B41", ... }
}
```

### Adapters injectables

```typescript
// Production
const adapters: PierreExportAdapters = {
  fetchMissions: (userId) => supabase.from("pierre_missions").select("*").eq("user_id", userId),
  fetchTasks: (userId) => supabase.from("pierre_tasks").select("*").eq("user_id", userId),
  // ...
};

// Tests (sans Supabase)
const adapters = buildFakeExportAdapters();
```

---

## 2. Droit à l'effacement — Purge

### Route

```
POST /api/pierre/security/purge
```

### Body

```json
{
  "execute": false,                                   // false par défaut = dry_run
  "confirmation_phrase": "CONFIRME SUPPRESSION DONNÉES PIERRE",
  "understand_irreversible": true
}
```

### Conditions pour exécution réelle

1. `PIERRE_RGPD_PURGE_EXECUTE_ENABLED=true` (variable d'environnement)
2. `access_level = internal_admin` (compte administrateur)
3. `confirmation_phrase` correct
4. `user_id` dans la confirmation = user_id du plan
5. `understand_irreversible = true`

### Plan de purge (dry_run response)

```json
{
  "ok": true,
  "dry_run": true,
  "plan": {
    "tenant": { "user_id": "...", "company_id": "..." },
    "dry_run": true,
    "tables": [
      { "table": "pierre_missions", "rows_estimated": 12, "action": "delete" },
      { "table": "orders", "rows_estimated": 2, "action": "retain", "retain_reason": "..." }
    ],
    "rows_estimated_total": 14,
    "requires_confirmation": true,
    "confirmation_phrase": "CONFIRME SUPPRESSION DONNÉES PIERRE",
    "irreversible_after_execution": true
  }
}
```

### Ce qui EST supprimé

- Missions, tâches, logs de tâches
- Artifacts (metadata), documents (metadata)
- Emails envoyés (metadata)
- Mémoire entreprise (CloneADN)
- Événements coût IA
- Événements audit email
- Événements d'audit sécurité

### Ce qui N'EST PAS supprimé

| Table | Raison | Action |
|-------|--------|--------|
| orders (billing) | Obligation légale 7 ans | Anonymisation uniquement |

### Anonymisation orders

```typescript
anonymizeRetainedBillingData(order) → {
  user_id: "[ANONYMIZED]",
  email: "[ANONYMIZED_EMAIL]",
  stripe_customer_id: "[ANONYMIZED]",
  metadata: {},
  anonymized_at: "2026-05-26T..."
}
```

---

## 3. Retention Policy

| Table | Max âge | Action à expiry |
|-------|---------|----------------|
| pierre_missions | Jusqu'à suppression | delete |
| pierre_tasks | Jusqu'à suppression | delete |
| pierre_task_logs | 90 jours | delete |
| pierre_task_artifacts | Jusqu'à suppression | delete |
| pierre_documents | Jusqu'à suppression | delete |
| pierre_outbound_emails | Jusqu'à suppression | delete |
| pierre_company_memory | Jusqu'à suppression | delete |
| cloneos_ai_cost_events | 90 jours | delete |
| cloneos_email_send_events | 90 jours | delete |
| security_audit_events | 1 an | delete |
| orders | 7 ans (légal) | anonymize |

---

## 4. Architecture technique

```
src/lib/pierre/security/
├── pierre-rgpd-export.ts    → buildPierreRgpdExportPlan(), buildFullPierreRgpdExport()
├── pierre-rgpd-purge.ts     → buildPierreRgpdPurgePlan(), executePierreRgpdPurge()
├── pierre-retention.ts      → getRetentionPolicyForResource(), buildRetentionReport()

src/app/api/pierre/security/
├── export/route.ts          → GET (plan) / POST (full export)
├── purge/route.ts           → POST (dry_run par défaut)
└── audit/route.ts           → GET (verdict sécurité)
```

---

## 5. Limites techniques B41

- **Purge réelle** : adapters injectés en prod ne sont pas encore câblés dans la route (utilise `buildFakePurgeAdapters()`). À compléter avant lancement.
- **Export réel** : idem — `buildFakeExportAdapters()` utilisé. Câbler adapters Supabase réels.
- **Nettoyage retention** : aucune tâche cron de nettoyage automatique. À implémenter en B42+.
- **Droit de rectification** : non implémenté. Requis par RGPD art. 16.
- **Notification de violation** : non implémenté. RGPD art. 33.

---

## 6. Note légale

Ce socle technique couvre les mécanismes d'export et de suppression. Il ne constitue pas une conformité RGPD juridiquement complète.

Requis avant lancement public :
- Politique de confidentialité approuvée par un conseil juridique
- DPA (Data Processing Agreement) si applicable
- Registre des traitements (RGPD art. 30)
- Notification CNIL si traitements soumis à la loi française
