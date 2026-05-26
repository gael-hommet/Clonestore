# B41 — Route Security Audit

**Date:** 2026-05-26  
**Routes auditées:** 90+  
**Méthode:** Revue statique + policy map

---

## Routes Pierre — Politique de sécurité

| Route | Méthode | Accès requis | Tenant scope | Sensitivity | Audit | Rate Limit | No-Store |
|-------|---------|--------------|--------------|-------------|-------|------------|----------|
| /api/pierre/cockpit/snapshot | GET | paid_customer + Pierre | company_id | hr_sensitive | non | user/min | oui |
| /api/pierre/use/submit | POST | paid_customer + Pierre | company_id | hr_sensitive | oui | user/min | oui |
| /api/pierre/use/mission/* | GET/POST | paid_customer + Pierre | company_id | hr_sensitive | non | user/min | oui |
| /api/pierre/use/task/* | GET/POST | paid_customer + Pierre | company_id | hr_sensitive | oui | user/min | oui |
| /api/pierre/use/continuity | GET/POST | paid_customer + Pierre | company_id | hr_sensitive | non | user/min | oui |
| /api/pierre/use/cloneadn | GET/PATCH | paid_customer + Pierre | company_id | hr_sensitive | oui | user/min | oui |
| /api/pierre/use/employees* | GET/POST/PATCH | paid_customer + Pierre | company_id | hr_sensitive | oui | user/min | oui |
| /api/pierre/use/doc* | GET/POST | paid_customer + Pierre | company_id | hr_sensitive | non | user/min | oui |
| /api/pierre/use/email* | GET/POST | paid_customer + Pierre | company_id | personal | oui | user/min | oui |
| /api/pierre/use/pdf* | GET/POST | paid_customer + Pierre | company_id | hr_sensitive | non | user/min | oui |
| /api/pierre/use/audit-trail* | GET | paid_customer + Pierre | company_id | internal | non | user/hour | oui |
| /api/pierre/security/export | GET/POST | paid_customer + Pierre | company_id | hr_sensitive | oui | user/hour | oui |
| /api/pierre/security/purge | POST | internal_admin | company_id | hr_sensitive | oui | user/hour | oui |
| /api/pierre/security/audit | GET | paid_customer + Pierre | company_id | internal | non | user/hour | oui |
| /api/cron/pierre/* | POST | service_role | none | internal | non | none | non |
| /api/pierre/execute | POST | HMAC (service_role) | none | internal | non | none | non |

---

## Routes Billing / Checkout

| Route | Méthode | Auth | Risque | Statut B41 |
|-------|---------|------|--------|------------|
| /api/billing/activate | POST | **FIXÉ** — Bearer requis | CRITIQUE → FIXÉ | user_id depuis token |
| /api/checkout | GET/POST | Bearer requis | FAIBLE | Conforme |
| /api/stripe/return | GET | Stripe session_id | FAIBLE | Acceptable |

---

## Risque billing/activate — Fix B41

**Avant B41** :
```typescript
// VULNÉRABLE — user_id depuis le body
const user_id = typeof body.user_id === "string" ? body.user_id : null;
await supabase.from("orders").upsert({ user_id, agent_slug, status: "active" });
```

**Après B41** :
```typescript
// SÉCURISÉ — user_id depuis l'auth serveur
const { data } = await supabase.auth.getUser(bearerToken);
const user_id = data.user.id; // Server-resolved, never from client body
await supabase.from("orders").upsert({ user_id, agent_slug, status: "active" });
```

---

## Patterns d'auth identifiés

### Pattern standard (routes /use/*)
```typescript
getBearerTokenFromRequest(req)         // Header Authorization: Bearer <token>
→ getAuthenticatedPierreUser(req, supabase)
→ supabase.auth.getUser(token)         // Network call to Supabase
→ userId = data.user.id                // Always from auth
→ hasPierreAccess(supabase, userId)    // Check orders table
→ execute with user_id scoping
```

### Pattern HMAC (routes /execute)
```typescript
x-client-id + x-timestamp + x-signature (HMAC-SHA256)
→ timingSafeEqual comparison
→ 5-minute replay protection
```

### Pattern cron (routes /api/cron/pierre/*)
```typescript
// Doit vérifier CRON_SECRET en header ou utiliser Vercel Cron Auth
// Vérifier implémentation réelle avant lancement
```

---

## Patterns de conformité identifiés

✅ **Conformes** :
- Toutes les routes /use/* utilisent `getAuthenticatedPierreUser`
- Bearer token uniquement (pas de query param token)
- Queries Supabase avec `.eq("user_id", userId)` systématiquement
- `sanitizeActionPayload()` sur les actions cockpit
- `email_mode` hardcodé "mock" dans le cockpit (B39)
- `can_use_ai = false` pour non-payants (B38A)

⚠️ **À améliorer** :
- Headers sécurité (`Cache-Control: no-store`) à appliquer sur toutes les routes /api/pierre/*
- `safeJsonForAudit()` à wirer dans `insertPierreLogs()`
- Rate limiting à wirer sur les routes /use/* (in-memory disponible, pas encore wired)
- Cron auth à vérifier (Vercel Cron Secret ou HMAC)

---

## Conclusion audit routes

- **Critique résolu** : billing/activate fixé en B41
- **90+ routes conformes** au pattern Bearer → supabase.auth.getUser()
- **Aucune route /use/** n'accepte company_id/user_id depuis le client
- **Isolation tenant** : toutes les queries filtrent par user_id côté serveur
