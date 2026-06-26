# PHASE 3.5 — Global Onboarding Persistence Draft

## 1. Objectif

PHASE 3.5 crée la première couche de persistence draft pour l'onboarding global CloneStore / CloneADN.

Le wizard `/profile/onboarding` (PHASE 2.6) prépare la mémoire entreprise globale mais les données disparaissaient au refresh. PHASE 3.5 résout ça avec localStorage comme fallback actif, prépare le schéma SQL, et conçoit le write serveur derrière un feature flag désactivé par défaut.

## 2. État actuel avant PHASE 3.5

| Composant | État |
|-----------|------|
| `/profile/onboarding` wizard | ✅ Fonctionnel (local state uniquement) |
| CloneADN Global mappings | ✅ Local (computeCoverageScore, validateGlobalEnterpriseMemory) |
| Persistence localStorage | ❌ Non branchée |
| Persistence serveur | ❌ Non conçue |
| Brouillon repris au refresh | ❌ Données perdues |

## 3. Modèle GlobalOnboardingDraft

Le type central `GlobalOnboardingDraft` dans `global-onboarding-types.ts` :

```typescript
type GlobalOnboardingDraft = {
  id: string;                           // "local:timestamp" en localStorage
  user_id?: string;                     // optionnel en localStorage
  company_id: string;                   // requis — "local_company" par défaut
  status: GlobalOnboardingDraftStatus;  // "local_draft" | "server_draft" | ...
  current_step: GlobalOnboardingStepId;
  completion_score: number;             // 0–100
  step_statuses: Record<...>;
  company: GlobalOnboardingCompanyDraft;
  humans: GlobalOnboardingHumanDraft[];
  documents: GlobalOnboardingDocumentDraft[];
  rules: GlobalOnboardingRuleDraft[];
  technologies: GlobalOnboardingTechnologyDraft[];
  first_mission: GlobalOnboardingFirstMissionDraft | null;
  cloneadn_preview: Record<string, unknown>;  // aperçu local non persisté serveur
  created_at: string;
  updated_at: string;
  source: "localstorage" | "server" | "demo";
  read_only: boolean;
  metadata: Record<string, unknown>;
};
```

Invariants immuables :
- `first_mission.employee_slug` = `"pierre"` toujours
- `first_mission.plan_only` = `true` toujours
- `email` des humains non persisté (PII)
- `metadata` redacté avant toute persistence

## 4. Mapping vers CloneADN Global

`global-onboarding-mappers.ts` contient :

| Fonction | Usage |
|----------|-------|
| `mapGlobalOnboardingDraftToEnterpriseMemory(draft)` | Draft → GlobalEnterpriseMemory (TECH-05) |
| `mapEnterpriseMemoryToGlobalOnboardingDraft(memory)` | Memory → Draft partiel (restauration) |
| `buildCloneADNPreviewFromOnboardingDraft(draft)` | Aperçu local CloneADN depuis draft |
| `computeGlobalOnboardingCompletionScore(draft)` | Score de complétion pondéré |
| `summarizeGlobalOnboardingDraft(draft)` | Résumé human-lisible |
| `redactGlobalOnboardingMetadata(metadata)` | Supprime secrets/tokens de metadata |

Le mapping utilise les types TECH-05 (`GlobalEnterpriseMemory`, `EnterpriseIdentityProfile`, etc.) et les fonctions ADN (`buildEmptyGlobalEnterpriseMemory`, `validateGlobalEnterpriseMemory`, `computeCoverageScore`).

## 5. LocalStorage — Fallback actif

### Clé

```
clonestore.globalOnboarding.draft.v1
```

### Fonctions

| Fonction | Fichier |
|----------|---------|
| `loadGlobalOnboardingDraftFromLocalStorage()` | `global-onboarding-localstorage.ts` |
| `saveGlobalOnboardingDraftToLocalStorage(draft)` | `global-onboarding-localstorage.ts` |
| `clearGlobalOnboardingDraftLocalStorage()` | `global-onboarding-localstorage.ts` |
| `migrateLegacyGlobalOnboardingPayload(payload)` | Migration future |
| `normalizeGlobalOnboardingPayload(payload)` | Normalisation à la lecture |

### Règles

- `typeof window` checks partout (SSR safe)
- `try/catch` complet — jamais throw brut
- Email des humains supprimé avant save (`sanitizeGlobalOnboardingDraft`)
- Si quota dépassé ou mode privé : silent fail, données non sauvegardées

### Intégration dans /profile/onboarding

PHASE 3.5 branche `/profile/onboarding` au localStorage :

- Au chargement (`useEffect`), tente de restaurer le brouillon localStorage
- À chaque update significatif de state (`useEffect`), sauvegarde en localStorage
- Badge discret affiché : **"Brouillon local"** + **"Non persisté serveur"** + **"Aucune action exécutée"**
- Bouton **"Effacer le brouillon local"** disponible
- Aucun DB write, aucun API call

## 6. SQL Draft — Table clonestore_global_onboarding_drafts

Fichier : `supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql`

**IMPORTANT : NON appliqué automatiquement.**

### Structure principale

```sql
create table if not exists public.clonestore_global_onboarding_drafts (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  company_id            text        not null,
  status                text        not null default 'server_draft',
  current_step          text        not null default 'company_identity',
  completion_score      integer     not null default 0,
  company_json          jsonb       not null default '{}'::jsonb,
  humans_json           jsonb       not null default '[]'::jsonb,
  documents_json        jsonb       not null default '[]'::jsonb,
  rules_json            jsonb       not null default '[]'::jsonb,
  technologies_json     jsonb       not null default '[]'::jsonb,
  first_mission_json    jsonb       not null default '{}'::jsonb,
  cloneadn_preview_json jsonb       not null default '{}'::jsonb,
  metadata              jsonb       not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
```

### Contraintes

- `unique(user_id, company_id)` — un brouillon par entreprise/user
- `completion_score between 0 and 100`
- `status in ('local_draft','server_draft','completed','archived')`
- `length(trim(company_id)) > 0`

## 7. RLS Draft

Les politiques RLS sont définies dans le SQL draft (`PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql`) mais **non appliquées en PHASE 3.5**.

| Politique | Condition |
|-----------|-----------|
| `select_own_global_onboarding` | `auth.uid() = user_id` |
| `insert_own_global_onboarding` | `auth.uid() = user_id` |
| `update_own_global_onboarding` | `auth.uid() = user_id` |
| DELETE | **Désactivée** — pas de suppression des brouillons |

## 8. Feature Flag

```env
NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true
```

**Par défaut : non défini = false.**

Fichier : `global-onboarding-flags.ts`

```typescript
isGlobalOnboardingServerPersistenceEnabled()  // → false par défaut
getGlobalOnboardingPersistenceMode()           // → "server_draft" (design prêt, non activé)
explainGlobalOnboardingPersistenceMode()       // → explication lisible
```

Pour activer en PHASE 3.6 :
1. Appliquer le SQL dans Supabase Dashboard
2. Vérifier table + RLS + policies
3. Tester E2E
4. `NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true` dans `.env.local`

## 9. Client Read-Only

`global-onboarding-readonly-client.ts` — design PHASE 3.6.

```typescript
// select only — jamais insert/update/delete/upsert
loadGlobalOnboardingDraftReadOnly(supabase, userId, companyId?)
mapGlobalOnboardingRowToDraft(row)
sortGlobalOnboardingDrafts(drafts)
```

Fallback localStorage automatique si :
- table absente (PHASE 3.5)
- supabase null
- userId null
- erreur DB

## 10. Safe Storage Design

`global-onboarding-storage.ts` — non activé depuis l'UI en PHASE 3.5.

```typescript
buildGlobalOnboardingPersistablePayload(draft, userId)  // Build payload sanitisé
canPersistGlobalOnboarding()                             // Feature flag gate
persistGlobalOnboardingDraftSafely(supabase, userId, draft)  // Write best-effort
```

Flux `persistGlobalOnboardingDraftSafely` :
1. localStorage toujours en premier
2. Feature flag gate → retour immédiat si false
3. Validation → refuse si invalide
4. Write Supabase best-effort
5. Fallback localStorage si write DB échoue

**NE PAS appeler depuis `/profile/onboarding` en PHASE 3.5.**

## 11. Intégration /profile/onboarding

### Ce qui est branché (PHASE 3.5)
- ✅ Import de `GLOBAL_ONBOARDING_LOCALSTORAGE_KEY`
- ✅ Import de `saveGlobalOnboardingDraftToLocalStorage`
- ✅ Import de `loadGlobalOnboardingDraftFromLocalStorage`
- ✅ Import de `clearGlobalOnboardingDraftLocalStorage`
- ✅ Restauration au mount depuis localStorage
- ✅ Sauvegarde sur chaque update de state
- ✅ Badge "Brouillon local — Non persisté serveur"
- ✅ Bouton "Effacer le brouillon local"

### Ce qui n'est PAS branché (PHASE 3.5)
- ❌ Aucun DB write depuis la page
- ❌ Aucun API call depuis la page
- ❌ `persistGlobalOnboardingDraftSafely` non appelé
- ❌ Feature flag non activé

## 12. Ce qui est activé maintenant (PHASE 3.5)

| Élément | Activé |
|---------|--------|
| Types GlobalOnboardingDraft | ✅ |
| Defaults / builders | ✅ |
| Mappers → CloneADN | ✅ |
| Validation / redaction | ✅ |
| LocalStorage abstraction | ✅ |
| Schéma TypeScript | ✅ |
| Feature flags | ✅ (default false) |
| Client read-only | ✅ (design + fallback LS) |
| Storage design | ✅ (non activé UI) |
| Index exports | ✅ |
| Intégration /profile/onboarding → localStorage | ✅ |
| SQL draft | ✅ (non appliqué) |
| Documentation | ✅ |
| Tests | ✅ |

## 13. Ce qui reste non activé (PHASE 3.6+)

| Élément | Raison |
|---------|--------|
| Persistence serveur | Feature flag = false. SQL non appliqué. |
| RLS en production | Migration non appliquée |
| `persistGlobalOnboardingDraftSafely` depuis UI | Bloqué par flag + table inexistante |
| Read-only DB | Table non créée → fallback LS |

## 14. Ce qui n'a PAS été fait

- ❌ Migration SQL automatique
- ❌ Modification moteur Pierre
- ❌ Modification APIs Pierre
- ❌ Création d'employés IA actifs (Emma, Lucas, Sophie)
- ❌ Activation public launch
- ❌ DB write depuis /profile/onboarding
- ❌ Service role côté client
- ❌ Suppression des fallbacks locaux
- ❌ Modification RLS existante
- ❌ Appel OpenAI / Anthropic / Stripe live
- ❌ Envoi d'email
- ❌ Exécution de mission
- ❌ Génération de document réel

## 15. Prochain bloc recommandé

### Option A : PHASE 3.6 — Global Onboarding Safe Apply

Activer la persistence serveur après migration manuelle :
- Valider la table en env de test
- Valider les policies RLS
- Activer le feature flag
- Brancher `persistGlobalOnboardingDraftSafely` depuis la page
- Tests E2E onboarding → DB → restore

### Option B : PHASE 3.6 — Empreinte Entreprise Read/Write QA

QA complète du cycle onboarding → CloneADN → mémoire :
- Vérifier que les mappings draft → memory sont exacts
- Tester le cycle write/read localStorage
- Comparer avec les données Pierre réelles
- Préparer la connexion /profile/agents ↔ onboarding

### Option C : PHASE 3.6 — CloneOS History Manual Activation QA

Activer la persistence CloneOS History (conçue en PHASE 3.3) :
- Appliquer le SQL PHASE_3_2
- Tester le flag CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED
- Vérifier l'intégration /profile/messages

**Recommandation selon audit :** Option A ou B — l'onboarding est la fondation de CloneADN Global, la persistence serveur débloquera /profile/agents et /agents/pierre/setup côté données.

---

*PHASE 3.5 validée — brouillon local onboarding actif. Aucune migration appliquée. Moteur Pierre intact.*
