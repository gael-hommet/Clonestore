# B40 — Multi-Tenant Pierre Guarantee

**Date:** 2026-05-26  
**Statut:** VALIDÉ

---

## 1. Un moteur Pierre partagé

Il n'existe **pas un seul Pierre global**.

Il existe :
- **un moteur Pierre partagé** — le code, les modules, les routes ;
- **un Pierre logique par entreprise** — isolé par `company_id` / `user_id` / `agent_slug`.

Si 5 000 entreprises utilisent Pierre :
- elles exécutent le même code source ;
- mais chacune a **ses propres données, mémoire, missions, tâches, documents, emails, budgets, et configuration** ;
- aucune donnée ne fuit entre tenants.

---

## 2. Un Pierre logique par entreprise

### Isolation technique

| Ressource | Clé d'isolation | Portée |
|-----------|-----------------|--------|
| Missions | `user_id` | par compte |
| Tâches | `user_id` + `mission_id` | par compte + mission |
| Documents / Artifacts | `user_id` + `mission_id` | par compte + mission |
| Mémoire (CloneADN) | `user_id` + `agent_slug = "pierre"` | par compte |
| Logs / Trace | `user_id` | par compte |
| Employés | `user_id` | par compte |
| Budgets IA | `user_id` (B38C Ledger) | par compte |
| Audit email | `company_id` (B39 audit) | par compte |
| Abonnement Pierre | `user_id` + `agent_slug = "pierre"` | par compte |

### Résolution company_id

Le `company_id` est **toujours résolu côté serveur** depuis le Bearer token.

```
Client → Bearer token (JWT Supabase)
Serveur → supabase.auth.getUser(token) → userId
Serveur → hasPierreAccess(supabase, userId) → ownsPierre
Serveur → buildTenantContext({ user_id: userId, company_id: userId, ... })
```

Le `company_id` envoyé par le client dans le body ou les query params est **ignoré et supprimé** par `sanitizeActionPayload()`.

---

## 3. Séparation company_id / organization_id / user_id

| Identifiant | Valeur actuelle | Scope |
|-------------|-----------------|-------|
| `user_id` | UUID Supabase de l'utilisateur | Authentification |
| `company_id` | = user_id (single-user tenancy actuelle) | Isolation données |
| `organization_id` | null (multi-org future — B41+) | Future isolation org |

> **Note B41 :** En B41, `company_id` sera dissocié de `user_id` pour supporter les comptes multi-utilisateurs par entreprise. Pour l'instant, chaque compte = une entreprise = un `user_id`.

---

## 4. Ce que chaque entreprise possède séparément

| Ressource | Séparée par | Garantie |
|-----------|-------------|---------|
| Missions RH | user_id | WHERE user_id = $userId dans toutes les requêtes |
| Tâches générées | user_id + mission_id | Missions appartiennent à user_id |
| Documents / PDF | user_id + mission_id | Idem |
| Emails préparés (B39) | user_id / company_id | Audit B39 scopé par company_id |
| CloneADN (mémoire) | user_id + agent_slug | Table pierre_company_memory |
| Logs / Audit trail | user_id | Toutes les insertions incluent user_id |
| Budget IA (B38C) | user_id | Ledger B38C scopé par user_id |
| Salariés | user_id | Table pierre_company_memory.employees |
| Technologies (B18) | user_id + technology_key | Table clonestore_company_technologies |
| Configuration Pierre | user_id + agent_slug | Table orders + pierre_company_memory |

---

## 5. Anti-leak rules (implémentées en B40)

### Règle 1 : company_id jamais depuis le client

```typescript
// actions.ts
export function sanitizeActionPayload(
  payload: Record<string, unknown>,
  _tenant: PierreTenantContext,
): Record<string, unknown> {
  const sanitized = { ...payload };
  delete sanitized.company_id;        // Stripped — never trusted from client
  delete sanitized.organization_id;   // Stripped
  delete sanitized.user_id;           // Stripped
  delete sanitized.agent_slug;        // Stripped
  return sanitized;
}
```

### Règle 2 : Détection de fuite cross-company

```typescript
// tenant.ts
export function auditSnapshotForLeaks(
  raw: unknown[],
  companyId: string,
): TenantIsolationResult {
  // Détecte les items dont company_id ne correspond pas au tenant actif
}
```

### Règle 3 : Validation d'ownership de snapshot

```typescript
// normalizers.ts
export function validateSnapshotOwnership(
  raw: unknown,
  expectedUserId: string,
): boolean {
  // Retourne false si un user_id différent est présent dans la réponse
}
```

### Règle 4 : Filtrage systématique par company

```typescript
// normalizers.ts
export function filterByCompanyId<T extends Record<string, unknown>>(
  items: T[],
  companyId: string | null | undefined,
): T[] {
  if (!companyId) return [];  // companyId null → 0 items (safe fail)
  return items.filter((item) => {
    const itemCompany = /* ... */;
    return !itemCompany || itemCompany === companyId;  // pass-through si pas de champ
  });
}
```

### Règle 5 : Email cockpit toujours en mock

```typescript
// actions.ts
export function buildEmailPreparePayload(...): ValidatedEmailPayload {
  return {
    ok: true,
    payload: {
      email_mode: "mock",  // Hardcoded — cockpit NEVER sends real email
    },
  };
}
```

### Règle 6 : Permissions 0 pour non-payants

```typescript
// permissions.ts
if (nonPaying || !authorized) {
  return {
    can_submit_mission: false,
    can_approve_task: false,
    can_use_ai: false,
    // ... all false
  };
}
```

---

## 6. Tests d'isolation multi-tenant (B40)

Les tests suivants prouvent l'isolation :

| Test | Ce qu'il prouve |
|------|-----------------|
| T27 — clean snapshot passes | Audit snapshot propre → ok |
| T28 — cross-company leak detected | Item d'une autre entreprise → `leaked_items > 0` |
| T29 — items sans company_id passent | Items server-scoped → ok |
| T30 — multiple leaks comptés | 2 fuites → `leaked_items = 2` |
| T32 — company_id stripped | Payload avec company_id evil → champ supprimé |
| T33 — organization_id stripped | Payload avec org evil → champ supprimé |
| T34 — user_id stripped | Payload avec user evil → champ supprimé |
| T64–T65 — filterByCompanyId | Items A+B mixés → seuls les items A retournés pour tenant A |
| T68 — cross-company simulation | Tenant A ne voit PAS la mission de Tenant B |
| T69–T72 — validateSnapshotOwnership | Snapshot wrong user → false |
| T86 — budgets séparés | company_a != company_b |
| T87 — email audit séparé | email B scoped → filtré pour tenant A |
| T88 — history séparée | history B → filtrée pour tenant A |

---

## 7. Ce qui sera renforcé en B41 RGPD / Security

| Risque | Niveau | Remédiation B41 |
|--------|--------|-----------------|
| RLS Supabase non vérifiées | CRITIQUE | Audit + activation RLS sur toutes tables pierre_* |
| `user_id` WHERE clause non uniformisée | HAUT | Audit de toutes les routes API |
| Cookie fallback dans auth | MOYEN | Uniformiser sur Bearer token uniquement |
| Logs avec métadonnées PII | MOYEN | Redaction systématique (AI_COST_LEDGER_REDACT_METADATA=true déjà actif) |
| Absence de rate limiting API | MOYEN | Rate limiting côté Next.js middleware |
| RGPD — droit à l'oubli | LÉGAL | Route DELETE /api/pierre/data/purge |
| Organisation multi-utilisateurs | FUTUR | Dissocier company_id de user_id |
