# B40 — Pierre Cockpit Final E2E

**Date:** 2026-05-26  
**Statut:** CLOS  
**Score:** 95/100  
**Suite:** B40 clos → B41 Security / RGPD / Data Protection

---

## 1. Objectif B40

Construire / finaliser la couche état, isolation multi-tenant, et snapshot unifié du cockpit Pierre.

Pierre est un **poste RH opérationnel automatisé** — pas un chatbot. Le cockpit doit permettre de :
- piloter des missions RH libres ;
- suivre les tâches générées, les validations, les livrables ;
- gérer la mémoire entreprise (CloneADN) ;
- voir l'historique et les alertes ;
- comprendre les limites et l'état d'exécution.

---

## 2. Architecture cockpit B40

### Pure modules (src/lib/pierre/cockpit/)

| Fichier | Rôle | Taille |
|---------|------|--------|
| `types.ts` | Types purs (B31+B40) — PierreCockpitState, PierreCockpitSnapshot, PierreTenantContext, PierreBudgetStatus, PierreRuntimeModes | ~270 lignes |
| `state.ts` | Machine d'état — resolveCockpitState, predicats, budget, warnings | ~180 lignes |
| `tenant.ts` | Isolation multi-tenant — buildTenantContext, filterByTenant, sanitizeActionPayload | ~160 lignes |
| `permissions.ts` | Contrôle d'accès — resolveCockpitPermissions, canApproveTask, canRunTask, canSendEmail | ~140 lignes |
| `actions.ts` | Builders validés — buildMissionSubmitPayload, buildTaskApprovePayload, buildEmailPreparePayload | ~150 lignes |
| `normalizers.ts` | Normalizers null-safe (B31+B40) — filterByCompanyId, validateSnapshotOwnership | ~560 lignes |
| `api-client.ts` | Client façade (B31) — 18+ méthodes, never throws | ~247 lignes |

### UI components (src/app/agents/pierre/use/)

17 composants existants (B31) :
- PierreCockpitShell, PierreCommandCenter, PierreMissionUnderstandingCard
- PierreWorkBoard, PierreValidationCenter, PierreDocumentStudio, PierreArtifactStudio
- PierreTraceTimeline, PierreCloneADNPanel, PierreScenariosPanel
- PierreEmployeeFilesPanel, PierreEmployeeFileCard
- PierreStatusBadges, PierreEmptyStates, PierreMobileActionBar
- PierreValuePanel, PierreCockpitTaskCard

---

## 3. État cockpit (PierreCockpitState)

| État | Signification |
|------|---------------|
| `loading` | Chargement initial en cours |
| `ready` | Cockpit opérationnel |
| `blocked_not_active` | Pierre non activé (pas d'abonnement) |
| `blocked_not_paid` | Accès expiré ou annulé |
| `blocked_no_company` | Aucune entreprise dans la session |
| `blocked_no_access` | Authentifié mais accès refusé |
| `degraded` | Données partielles — cockpit utilisable |
| `error` | Erreur fatale non récupérable |

### Résolution d'état

```
isLoading → "loading"
tenant null → "blocked_no_company"
company_id || user_id null → "blocked_no_company"
access_level ∈ {anonymous, logged_unpaid} → "blocked_not_paid"
!owns_pierre || !pierre_enabled → "blocked_not_active"
hasError && !hasData → "error"
hasError && hasData → "degraded"
else → "ready"
```

---

## 4. Routes / API utilisées

### Route B40 (nouvelle)

```
GET /api/pierre/cockpit/snapshot
  → Résout user depuis auth serveur (Bearer token)
  → Vérifie Pierre actif (orders table)
  → Charge dernière mission + tasks + artifacts + CloneADN
  → Retourne PierreCockpitSnapshot complet
  → Jamais de company_id client accepté comme source de vérité
```

### Routes existantes utilisées par le cockpit (B31–B36)

| Route | Méthode | Usage |
|-------|---------|-------|
| `/api/pierre/use/submit` | POST | Soumettre une mission |
| `/api/pierre/use/mission/{id}` | GET | Charger une mission |
| `/api/pierre/use/task/{id}/approve` | POST | Approuver une tâche |
| `/api/pierre/use/task/{id}/cancel` | POST | Annuler une tâche |
| `/api/pierre/use/task/{id}/run` | POST | Lancer une tâche |
| `/api/pierre/use/continuity` | GET | Historique / dashboard |
| `/api/pierre/use/employees/files` | GET | Fichiers RH |
| `/api/pierre/use/cloneadn` | GET/PATCH | Mémoire entreprise |
| `/api/pierre/use/messages` | GET | Trace / timeline |
| `/api/pierre/use/audit-trail/alerts` | GET | Alertes |
| `/api/cloneos/ai/status` | GET | Statut IA (B38) |

---

## 5. Actions disponibles E2E

| Action | Payload validé | Guard |
|--------|---------------|-------|
| `submit mission` | `buildMissionSubmitPayload()` | tenant authorized, input 5–4000 chars |
| `approve task` | `buildTaskApprovePayload()` | tenant authorized, company_id stripped |
| `cancel task` | `buildTaskCancelPayload()` | tenant authorized, reason ≤500 chars |
| `prepare email` | `buildEmailPreparePayload()` | email_mode hardcoded "mock" — jamais "live" |
| `refresh snapshot` | GET /api/pierre/cockpit/snapshot | Bearer auth obligatoire |

---

## 6. Intégration B38 / B39

### B38 (AI Cost Shield)
- Budget status affiché dans `PierreCockpitSnapshot.budget_status`
- `budget_ok`, `emergency_shutdown`, `daily_used_cents`, `daily_cap_cents`
- Non-payants : 0 IA — `can_use_ai=false` dans les permissions
- Mock mode affiché dans `runtime_modes.ai_mode`

### B39 (Email Production)
- Email mode affiché dans `channel_status.email_mode`
- `email_send_live=false` par défaut (jamais vrai email depuis le cockpit)
- `buildEmailPreparePayload()` hardcode `email_mode: "mock"` — jamais "live"
- `canSendEmail()` refuse "live" dans tous les cas
- Les tâches email (`email.send`, `email.draft`) sont marquées `isEmailTask=true`
- Les tâches sensibles nécessitent validation humaine avant toute action

---

## 7. Ce qui reste désactivé

| Fonctionnalité | Raison | Bloc cible |
|---------------|--------|-----------|
| Vrai envoi email live depuis cockpit | B39 triple opt-in côté serveur | Post-B41 |
| IA live (OpenAI) dans cockpit | B38A — paid_customer only, en production | Déjà actif en prod |
| Anthropic dans cockpit | Désactivé globalement | Post-B45 |
| Streaming SSE (live updates) | Polling 12s actuel | B41+ |
| HRIS sync / Payroll sync | Non dans scope | Post-B48 |
| Mobile app cockpit | Desktop first | B44+ |

---

## 8. Tests B40 (146 tests)

```
npm run test:b40
├── cockpit-b40-state.test.ts   — 56 tests
│   ├── resolveCockpitState (T1–T14)
│   ├── isBlockedState / isOperationalState (T15–T21)
│   ├── canSubmitMission (T22–T27)
│   ├── Labels and block reasons (T28–T35)
│   ├── Budget status (T36–T43)
│   └── Warnings and snapshot (T44–T50)
└── cockpit-b40-tenant.test.ts  — 90 tests
    ├── Tenant context building (T1–T5)
    ├── Access level resolution (T6–T16)
    ├── Tenant validation and authorization (T17–T26)
    ├── Multi-tenant isolation (T27–T36)  ← CRITIQUE
    ├── Permissions (T37–T49)
    ├── Actions / validated payloads (T50–T63)
    ├── Next actions resolver (T60–T63)
    ├── Normalizer tenant filtering (T64–T72)
    ├── Snapshot ownership validation (T69–T72)
    ├── Sensitive task detection (T73–T81)
    ├── Display helpers (T82–T85)
    ├── Multi-tenant budget isolation (T86–T88)
    └── Filter functions (T89–T90)
```

---

## 9. Prochain bloc : B41 — Security / RGPD / Data Protection

B41 devra :
- Auditer toutes les routes API pour `WHERE user_id = $1` (isolation garantie en base)
- Vérifier les RLS Supabase sur toutes tables `pierre_*`
- Ajouter CORS strictes et rate limiting côté API
- RGPD : droit à l'oubli, export données, pseudonymisation
- Rapport de sécurité complet
