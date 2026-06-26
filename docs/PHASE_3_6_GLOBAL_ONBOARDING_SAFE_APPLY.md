# PHASE 3.6 — Global Onboarding Safe Apply

## 1. Objectif

PHASE 3.6 branche la persistence serveur de l'onboarding global de façon sûre.

Le SQL a été appliqué manuellement par Gael dans Supabase Dashboard. PHASE 3.6 :
- crée un health check table/RLS pour vérifier l'état côté DB ;
- crée un runtime bridge qui orchestre localStorage → health → write DB best-effort ;
- intègre ce runtime dans `/profile/onboarding` derrière feature flag ;
- garantit que l'onboarding fonctionne même sans table/RLS/env.

## 2. Rappel PHASE 3.5

PHASE 3.5 a créé :
- Couche onboarding : 10 fichiers (`src/lib/clonestore/onboarding/`)
- Modèle `GlobalOnboardingDraft`
- Abstraction localStorage (`clonestore.globalOnboarding.draft.v1`)
- SQL draft, RLS draft, feature flag, read-only client, storage design
- Intégration `/profile/onboarding` : restauration + sauvegarde localStorage

## 3. SQL appliqué manuellement — vérification requise

Gael a appliqué `supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql` dans Supabase Dashboard.

**Important :** PHASE 3.6 côté repo ne peut pas vérifier automatiquement l'état Supabase de production. Le health check (`global-onboarding-health.ts`) effectue un select read-only au runtime pour détecter :
- Table absente → fallback localStorage
- RLS bloquée → fallback localStorage
- Erreur inconnue → fallback localStorage

Pour vérifier manuellement :
```
npm run check:global-onboarding-readiness
```

## 4. Feature flag

```env
NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true
```

**Par défaut : false** (si non défini dans `.env.local`).

Pour activer la persistence serveur :
1. Vérifier que la table `clonestore_global_onboarding_drafts` existe dans Supabase
2. Vérifier les policies RLS (select_own, insert_own, update_own)
3. Ajouter `NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true` dans `.env.local`
4. Lancer `npm run check:global-onboarding-readiness`
5. Tester `/profile/onboarding` avec un compte connecté

## 5. Modes de fonctionnement

| Mode | Condition | Comportement |
|------|-----------|-------------|
| `localstorage_only` | Flag false OU auth manquante | localStorage uniquement |
| `server_attempted` | Flag true + health check KO | Tentative DB échouée → fallback LS |
| `server_active` | Flag true + health OK + write OK | localStorage + DB |

L'UI affiche le mode actif via un badge discret.

## 6. localStorage first

**Invariant absolu : localStorage est toujours écrit en premier, avant toute tentative DB.**

- Si flag false → localStorage seul, retour immédiat
- Si flag true → localStorage, puis tentative DB
- Si DB échoue → localStorage déjà sauvegardé, UI ne casse pas

## 7. Health check table/RLS

`global-onboarding-health.ts` — `checkGlobalOnboardingTableReadiness(supabase, userId)`

```typescript
type GlobalOnboardingHealthReport = {
  table_available: boolean;    // table présente et accessible
  rls_select_ok: boolean;      // RLS select passe avec userId
  can_attempt_write: boolean;  // write safe à tenter
  error_code: string | null;
  error_message: string | null;
  warning: string | null;
};
```

Le check :
- Fait un `select("id").limit(1)` uniquement (JAMAIS insert/update/delete/upsert)
- Utilise uniquement la clé anon (jamais service role)
- Retourne `can_attempt_write: false` si table absente ou RLS bloquée
- `try/catch` complet — jamais de throw brut

## 8. Runtime safe bridge

`global-onboarding-runtime.ts` — `persistGlobalOnboardingWithFallback(options)`

```typescript
// Flux :
// 1. localStorage TOUJOURS en premier
// 2. Feature flag gate → local_persisted si false
// 3. Auth check → local_persisted_auth_required si userId manquant
// 4. Sanitize + validation → local_persisted_validation_failed
// 5. Health check → local_persisted_server_unavailable si KO
// 6. Write DB best-effort → local_and_server_persisted ou server_write_failed
```

Outcomes possibles :

| Outcome | Signification |
|---------|--------------|
| `local_persisted` | localStorage seul (flag false) |
| `local_persisted_auth_required` | Flag true mais pas d'auth |
| `local_persisted_validation_failed` | Draft invalide |
| `local_persisted_server_unavailable` | Table/RLS absente |
| `local_and_server_persisted` | Succès total |
| `local_persisted_server_write_failed` | Write DB échoué (LS OK) |

## 9. Intégration /profile/onboarding

### Ce qui est branché (PHASE 3.6)

- ✅ `persistGlobalOnboardingWithFallback` remplace `saveGlobalOnboardingDraftToLocalStorage`
- ✅ Supabase client récupéré via `getSessionClient()` avec try/catch
- ✅ `userId` chargé via `supabase.auth.getUser()`
- ✅ État `onboardingPersistenceStatus` — badge dynamique
- ✅ Badge affiché :
  - **"Brouillon local"** (défaut)
  - **"Brouillon local · Sauvegarde…"** (en cours)
  - **"Brouillon local + serveur"** (succès)
  - **"Fallback localStorage · Serveur indisponible"** (fallback)
  - **"Fallback localStorage · Connexion pour serveur"** (auth requise)
- ✅ Bouton "Effacer le brouillon local" conservé

### Ce qui N'EST PAS fait depuis la page

- ❌ Aucun `.insert()` ou `.upsert()` direct Supabase dans la page
- ❌ Aucun "configuration enregistrée serveur" si write non confirmé
- ❌ Aucune mission exécutée
- ❌ Aucun email envoyé

## 10. Check script

```bash
npm run check:global-onboarding-readiness
```

`scripts/check-global-onboarding-readiness.mjs` :
- Vérifie SQL draft
- Vérifie env vars
- Tente un select read-only sur la table (si env Supabase présent)
- Affiche le statut et les prochaines étapes
- JAMAIS insert/update/delete/upsert

## 11. Ce qui est activé maintenant

| Élément | Activé |
|---------|--------|
| Health check table/RLS | ✅ |
| Runtime bridge (localStorage first) | ✅ |
| Feature flag gate | ✅ (default false) |
| Intégration page /profile/onboarding | ✅ |
| Badge dynamique persistence | ✅ |
| Check script | ✅ |
| localStorage fallback | ✅ (toujours) |

## 12. Ce qui dépend encore de env/Supabase

| Élément | Dépendance |
|---------|-----------|
| Write DB | `NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true` |
| Health check réel | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Auth userId | Session Supabase active |
| Table disponible | Migration SQL appliquée par Gael ✓ (à vérifier via check script) |
| RLS valide | Policies vérifiables via check script |

## 13. Rollback

Si la persistence serveur pose problème :

1. Supprimer `NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true` de `.env.local`
2. Relancer l'app — localStorage reprend automatiquement
3. Aucune donnée perdue — localStorage est toujours écrit en premier

## 14. Ce qui n'a PAS été fait

- ❌ Migration SQL automatique
- ❌ Modification moteur Pierre
- ❌ Modification APIs Pierre
- ❌ Création d'employés IA actifs
- ❌ Activation public launch
- ❌ Service role côté client
- ❌ Modification RLS existante directement
- ❌ Suppression du fallback localStorage
- ❌ Appel OpenAI / Anthropic / Stripe live
- ❌ Envoi d'email
- ❌ Exécution de mission
- ❌ Génération de document réel
- ❌ Déclaration de lancement public anticipé

## 15. Prochain bloc recommandé

### PHASE 3.7 — Global Onboarding Manual Activation QA

QA manuelle de la persistence serveur après activation du feature flag :
- Tester le cycle : saisie → localStorage → DB → restore
- Vérifier les logs Supabase (RLS, audit)
- Tester le rollback (désactiver flag → vérifier localStorage intact)
- Comparer draft server vs draft local

### PHASE 3.7 — Empreinte Entreprise Read/Write QA

QA complète du cycle onboarding → CloneADN → mémoire entreprise :
- Mapper draft → memory → snapshot
- Tester les scores de couverture
- Préparer la connexion /profile/agents ↔ onboarding

### PHASE 3.7 — CloneOS History Manual Activation QA

Activer la persistence CloneOS History (conçue en PHASE 3.3) :
- Appliquer le SQL PHASE_3_2
- Tester `CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true`
- Vérifier l'intégration /profile/messages

**Recommandation :** PHASE 3.7 Global Onboarding Manual Activation QA — valider que le cycle write/read serveur fonctionne end-to-end avant de connecter d'autres composants.

---

*PHASE 3.6 validée côté repo. Lancement public externe : non activé. Moteur Pierre intact.*
