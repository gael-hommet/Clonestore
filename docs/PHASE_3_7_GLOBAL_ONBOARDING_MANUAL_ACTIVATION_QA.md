# PHASE 3.7 — Global Onboarding Manual Activation QA

## 1. Objectif

PHASE 3.7 valide manuellement et techniquement l'activation de la persistence serveur de l'onboarding global CloneStore.

Ce bloc :
- prépare et centralise la checklist QA d'activation manuelle ;
- complète le cycle write → read avec un restore serveur safe (read-only) ;
- fournit des scripts et queries SQL exploitables par Gael ;
- verrouille le workflow avec des tests statiques.

**Lancement public externe : non validé.**

## 2. Prérequis

| Prérequis | État |
|-----------|------|
| PHASE 3.6 validée | ✅ |
| SQL PHASE 3.5 appliqué manuellement | ✅ (Gael confirme) |
| RLS enabled (à vérifier) | 🔲 Vérifier via SQL ci-dessous |
| Policy select_own_global_onboarding | 🔲 Vérifier |
| Policy insert_own_global_onboarding | 🔲 Vérifier |
| Policy update_own_global_onboarding | 🔲 Vérifier |
| Pas de policy DELETE | 🔲 Vérifier |

## 3. Vérifications SQL dans Supabase

Lancer dans Supabase Dashboard → **SQL Editor** :

### 3.1 — Table existe et RLS activée

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'clonestore_global_onboarding_drafts';
```

**Résultat attendu :** `rowsecurity = true`

### 3.2 — Policies RLS

```sql
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE tablename = 'clonestore_global_onboarding_drafts'
ORDER BY cmd;
```

**Résultat attendu :**

| policyname | cmd |
|-----------|-----|
| select_own_global_onboarding | SELECT |
| insert_own_global_onboarding | INSERT |
| update_own_global_onboarding | UPDATE |

**Aucune ligne DELETE ne doit apparaître.**

### 3.3 — Contraintes

```sql
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.clonestore_global_onboarding_drafts'::regclass;
```

**Résultat attendu :** contrainte unique sur `(user_id, company_id)`, contrainte check sur `completion_score`.

### 3.4 — Contenu après test (après étape QA)

```sql
SELECT company_id, current_step, completion_score, updated_at
FROM clonestore_global_onboarding_drafts
ORDER BY updated_at DESC
LIMIT 5;
```

**Ne pas afficher de données personnelles dans cette doc.**

## 4. Activation locale

### 4.1 — Vérification avant activation

```bash
npm run check:global-onboarding-readiness
npm run check:global-onboarding-activation-qa
```

### 4.2 — Activer le feature flag

Ajouter dans `.env.local` :

```env
NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true
```

**Important :** Ne pas committer `.env.local`. Ne pas activer en production sans validation QA complète.

### 4.3 — Redémarrer

```bash
npm run dev
```

## 5. Check scripts

### npm run check:global-onboarding-readiness

Vérifie :
- SQL draft présent
- Env vars présentes
- Select read-only sur la table (si env Supabase)

### npm run check:global-onboarding-activation-qa

Vérifie en plus :
- Tous les fichiers PHASE 3.5, 3.6, 3.7 présents
- Contenu SQL draft (RLS, policies)
- Requêtes SQL de vérification manuelle
- Instructions QA étape par étape

**Jamais de write dans ces scripts.**

## 6. QA UI — Cycle complet

### Étape 1 — Connexion

1. Ouvrir `/login`
2. Se connecter avec un compte Supabase valide
3. Vérifier que la session est active (badge auth dans le header)

### Étape 2 — Onboarding

1. Aller sur `/profile/onboarding`
2. Observer le badge de persistence (section Progression)
3. Badge attendu au départ : **"Brouillon local"** (ou **"Brouillon local · Sauvegarde…"** brièvement)

### Étape 3 — Saisie

1. Remplir **Étape 1 — Identité entreprise** :
   - Nom de l'entreprise (ex: "Test QA 3.7")
   - Secteur
   - Taille
2. Observer le badge → doit passer à **"Brouillon local + serveur"**
3. Si badge reste sur **"Brouillon local"** : vérifier flag + auth + table

### Étape 4 — Vérification DevTools

1. DevTools → Application → Local Storage → `clonestore.globalOnboarding.draft.v1`
2. Vérifier que `company.company_name = "Test QA 3.7"`
3. DevTools → Network → rechercher requêtes vers Supabase
4. Vérifier upsert vers `clonestore_global_onboarding_drafts`

### Étape 5 — Vérification Supabase

```sql
SELECT company_id, current_step, completion_score, updated_at
FROM clonestore_global_onboarding_drafts
ORDER BY updated_at DESC
LIMIT 1;
```

**Attendu :** Une ligne avec `company_id = "local_company"` et les données saisies.

### Étape 6 — Refresh + restore

1. Appuyer sur **F5**
2. Attendre le chargement complet
3. Observer : les données saisies doivent réapparaître
4. Si flag activé + auth + table OK : badge → **"Brouillon restauré depuis serveur"** ou **"Brouillon local plus récent"**
5. Si localStorage seul : données présentes (depuis localStorage)

**Résultat attendu :** Données pré-remplies sans ressaisie.

### Étape 7 — Ajout d'humains/documents/règles

1. Aller sur Étape 2 → ajouter un humain (ex: "Marie Test")
2. Observer badge → doit rester **"Brouillon local + serveur"**
3. Vérifier localStorage mis à jour
4. F5 → vérifier restauration

## 7. Rollback

### Désactiver le flag

1. Supprimer de `.env.local` :
   ```
   NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true
   ```
2. Redémarrer : `npm run dev`

### Vérification rollback

1. Aller sur `/profile/onboarding`
2. Badge attendu : **"Brouillon local"** (sans mention serveur)
3. Données toujours présentes (depuis localStorage)
4. Aucun write DB — fallback localStorage seul

**Rollback immédiat — aucune donnée perdue.**

## 8. Critères PASS / FAIL

### PASS

- ✅ Table SQL présente dans Supabase
- ✅ RLS enabled (`rowsecurity = true`)
- ✅ Policies select/insert/update own présentes
- ✅ Aucune policy DELETE
- ✅ Badge "Brouillon local + serveur" après saisie
- ✅ Ligne créée dans `clonestore_global_onboarding_drafts`
- ✅ Refresh restaure les données
- ✅ Rollback → localStorage seul → données toujours présentes

### FAIL

- ❌ Table absente → appliquer le SQL manuellement
- ❌ RLS disabled → activer dans Supabase Dashboard
- ❌ Policies manquantes → vérifier le SQL appliqué
- ❌ Badge reste "Brouillon local" malgré flag actif → vérifier auth + health check logs
- ❌ Ligne non créée → vérifier RLS insert + flag + auth
- ❌ Données perdues au refresh → vérifier localStorage (DevTools)
- ❌ Rollback casse l'UI → bug dans la page (ne devrait pas arriver)

## 9. Ce qui a été fait en PHASE 3.7

| Élément | Créé |
|---------|------|
| `global-onboarding-activation-qa.ts` | ✅ Module pur QA checklist |
| `restoreGlobalOnboardingWithFallback` | ✅ Restore serveur safe (read-only) |
| Restore intégré dans /profile/onboarding | ✅ useEffect sur userId |
| `scripts/check-global-onboarding-activation-qa.mjs` | ✅ |
| `docs/PHASE_3_7_GLOBAL_ONBOARDING_MANUAL_ACTIVATION_QA.md` | ✅ |
| Tests statiques phase3-7 | ✅ |

## 10. Ce qui n'a PAS été fait

- ❌ Migration SQL automatique
- ❌ Modification `.env.local` automatique
- ❌ Flag hardcodé à true
- ❌ Modification moteur Pierre
- ❌ Route API créée
- ❌ Service role côté client
- ❌ Write forcé depuis la page
- ❌ Email envoyé
- ❌ Mission exécutée
- ❌ Document généré
- ❌ Proof auto-validé

## 11. Prochain bloc recommandé

### PHASE 3.8 — Empreinte Entreprise Read/Write QA

Connecter l'onboarding global à la mémoire entreprise (CloneADN) :
- Mapper `GlobalOnboardingDraft` → `GlobalEnterpriseMemory` (TECH-05)
- Tester le cycle : onboarding → mémoire → aperçu CloneADN
- Connecter /profile/agents ↔ onboarding

### PHASE 3.8 — CloneOS History Manual Activation QA

Activer la persistence CloneOS History (PHASE 3.3) :
- Appliquer SQL PHASE_3_2
- Tester `CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true`
- Vérifier intégration /profile/messages

### PHASE 3.8 — Onboarding Multi-Step Persistence QA

QA avancée multi-étapes onboarding :
- Tester le cycle complet 6 étapes
- Vérifier completion_score en DB
- Vérifier step_statuses serialisés
- Tester avec plusieurs comptes

---

*PHASE 3.7 validée côté repo. Lancement public externe non validé. Moteur Pierre intact.*
