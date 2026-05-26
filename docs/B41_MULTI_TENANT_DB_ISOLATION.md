# B41 — Multi-Tenant Database Isolation

**Date:** 2026-05-26  
**Statut:** DOCUMENTÉ  
**Niveau de garantie actuel:** Single-user tenancy (company_id = user_id)

---

## 1. Modèle actuel — Single-user tenancy

```
user_id (UUID Supabase auth) = company_id = tenant identifier
```

### Pourquoi company_id = user_id aujourd'hui

- Chaque compte CloneStore = un utilisateur unique
- Pas encore de support multi-utilisateur par entreprise
- Simplifie le RLS : `auth.uid() = user_id` suffit
- Pas de risque de cross-company leak dans le modèle actuel

### Isolation garantie

```sql
-- RLS : chaque utilisateur voit uniquement ses propres données
CREATE POLICY "pierre_missions_select_own"
ON public.pierre_missions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
```

```typescript
// Application layer : isolation double couche
const { data } = await supabase
  .from("pierre_missions")
  .select("*")
  .eq("user_id", userId)  // Explicit WHERE clause (defense in depth)
```

---

## 2. Résolution tenant — Flux serveur

```
Client → Authorization: Bearer <JWT>
   ↓
Server → supabase.auth.getUser(token)
   ↓
userId = data.user.id  (ALWAYS from auth)
   ↓
company_id = userId   (current: company_id = user_id)
   ↓
SecurityTenantScope { user_id, company_id, ... }
   ↓
All queries: .eq("user_id", userId)
```

### Ce qui est TOUJOURS ignoré depuis le client

```typescript
// stripTenantSpoofingFields() — B41
// sanitizeActionPayload() — B40
delete payload.company_id;        // Stripped
delete payload.organization_id;   // Stripped
delete payload.user_id;           // Stripped
delete payload.agent_slug;        // Stripped
delete payload.access_level;      // Stripped
```

---

## 3. RLS Supabase — Architecture

### Principe

```
Authenticated users → RLS → auth.uid() = user_id
Service role → RLS bypass → manual WHERE user_id = $1
```

### Tables protégées

| Table | RLS activé | Politique |
|-------|-----------|-----------|
| pierre_company_memory | ✓ v1 | auth.uid() = user_id |
| pierre_missions | ✓ v1 | auth.uid() = user_id |
| pierre_tasks | ✓ v1 | auth.uid() = user_id |
| pierre_task_logs | ✓ v1 | auth.uid() = user_id |
| pierre_documents | ✓ v1 | auth.uid() = user_id |
| pierre_outbound_emails | ✓ v1 | auth.uid() = user_id |
| pierre_task_artifacts | ✓ B41 | JOIN pierre_tasks WHERE user_id |
| cloneos_ai_cost_events | ✓ B41 | auth.uid() = user_id |
| security_audit_events | future | actor_user_id (B42+) |

### Service role — règle obligatoire

```typescript
// Service role bypasse le RLS — TOUJOURS ajouter WHERE user_id
const supabase = makePierreServerSupabase(); // service_role_key
const { data } = await supabase
  .from("pierre_missions")
  .select("*")
  .eq("user_id", userId);  // OBLIGATOIRE — RLS ne s'applique pas
```

---

## 4. Anti-spoofing multi-couches

### Couche 1 — Auth (Bearer token)
Le `user_id` ne peut jamais être injecté depuis le client. Il vient uniquement de `supabase.auth.getUser(token)`.

### Couche 2 — Payload sanitization (B40 + B41)
```typescript
sanitizeActionPayload(payload, tenant) // B40
stripTenantSpoofingFields(payload)     // B41
```

### Couche 3 — Query scoping
```typescript
.eq("user_id", userId) // Toutes les queries server-side
```

### Couche 4 — RLS (database)
```sql
USING (auth.uid() = user_id) -- Authenticated user queries only
```

### Couche 5 — Snapshot audit (B40)
```typescript
auditSnapshotForLeaks(items, companyId) // Détecte les fuites cross-company
filterByCompanyId(items, companyId)     // Filtre client-side en dernier recours
```

---

## 5. Chemin vers multi-user company (B42+)

### Problème actuel
```
Company A : user_a@example.com → user_id = "uuid-a" = company_id
Company B : user_b@example.com → user_id = "uuid-b" = company_id
```

### Futur (B42+)
```
Company X : company_id = "company-uuid-x"
  ├── admin@company-x.com → user_id = "uuid-1", role = "owner"
  └── rh@company-x.com   → user_id = "uuid-2", role = "member"
```

### Table company_members (future)
```sql
CREATE TABLE company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);
```

### Impact RLS
```sql
-- Future: membre d'une company peut voir les missions de la company
CREATE POLICY "pierre_missions_company_member"
ON public.pierre_missions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = pierre_missions.company_id
    AND cm.user_id = auth.uid()
  )
);
```

### Impact sur le code
- `buildTenantContext()` : company_id ≠ user_id
- `hasPierreAccess()` : checker orders par company_id
- Toutes les queries : `.eq("company_id", companyId)` au lieu de `.eq("user_id", userId)`
- RLS : mettre à jour toutes les policies v1

---

## 6. Verdict isolation B41

| Garantie | Niveau |
|---------|--------|
| Aucune fuite entre utilisateurs | FORT — RLS v1 + WHERE user_id |
| Anti-spoofing client | FORT — Bearer + stripTenantSpoofingFields() |
| billing/activate sécurisé | FIXÉ en B41 |
| Tables manquantes RLS | DOCUMENTÉ — B41_PIERRE_SECURITY_RLS.sql |
| Future multi-user | PRÉPARÉ — chemin documenté |
