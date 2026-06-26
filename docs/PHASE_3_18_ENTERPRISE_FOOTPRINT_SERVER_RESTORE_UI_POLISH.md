# PHASE 3.18 — Enterprise Footprint Server Restore UI Polish

## Objectif

Améliorer l'UI de restauration / synchronisation serveur de l'Empreinte Entreprise
dans `/profile/onboarding`. Rendre lisibles la source effective (local/serveur),
le statut, la dernière tentative et le résultat — **sans changer la logique métier
safe apply (P3.14)**.

PHASE 3.18 = UI Polish / observabilité client, **pas** une nouvelle persistance.

---

## État avant PHASE 3.18

- P3.14 : runtime safe apply localStorage-first + restore. Outcomes riches.
- `/profile/onboarding` : statut sync affiché en `<span>` discret (fourre-tout),
  sans distinction claire local / serveur / désactivé / table / RLS / auth.
- Seul `result.ui_status` était stocké (pas le résultat complet).

---

## Restore UI model

Fichier : `src/lib/clonestore/enterprise-footprint/enterprise-footprint-restore-ui.ts`

Module **pur** — transforme les résultats persist/restore en labels UI.

Fonctions :
- `buildEnterpriseFootprintRestoreUiSnapshot(options)`
- `buildEnterpriseFootprintRestoreUiBadges(snapshot)`
- `buildEnterpriseFootprintRestoreUiCards(snapshot)`
- `buildEnterpriseFootprintRestoreUiTimeline(snapshot)`
- `buildEnterpriseFootprintRestoreUiActions(snapshot)`
- `getEnterpriseFootprintRestoreUiStatusLabel(status)`
- `getEnterpriseFootprintRestoreUiSourceLabel(source)`
- `getEnterpriseFootprintRestoreUiTone(status)`
- `explainEnterpriseFootprintRestoreUiStatus(snapshot)`

Le snapshot accepte : `lastPersistResult`, `lastRestoreResult`, `currentFootprint`,
`featureFlagEnabled`, `serverHealth`, `lastAttemptAt`, `localUpdatedAt`, `serverUpdatedAt`.

---

## Outcomes supportés

### Statuts UI (10)
`local_only` · `server_synced` · `server_restored` · `local_newer` ·
`server_disabled` · `server_unavailable` · `auth_required` · `validation_failed` ·
`empty` · `pending`

### Sources (10)
`localstorage` · `server` · `local_newer_than_server` · `server_newer_than_local` ·
`server_disabled` · `auth_required` · `table_unavailable` · `rls_failed` ·
`validation_failed` · `unknown`

---

## Source local / server

La source effective est dérivée du résultat persist (driver principal côté
onboarding) ou restore :
- `localStorage` : fallback actif (toujours sauvegardé en premier).
- `Serveur` : synchronisation réussie.
- `Local plus récent que serveur` / `Serveur plus récent que local`.
- `Table indisponible` / `RLS/permissions à vérifier` / `Session requise` /
  `Validation bloquée` / `Serveur désactivé`.

---

## Intégration /profile/onboarding

Panneau **"Statut Empreinte"** ajouté après l'aperçu Empreinte :
- Titre + statut + tone.
- Badges (statut, source, fallback, no-action, flag).
- Cards (source effective, statut, persistance serveur, dernière tentative).
- Timeline (sauvegarde locale d'abord, puis tentative serveur).
- Warning table/RLS si présent.
- Microcopy fallback / flag / aucune action.

Logique métier P3.14 **inchangée** : `persistEnterpriseFootprintWithFallback`
conservé, seul le résultat complet + `lastAttemptAt` sont désormais stockés pour
l'observabilité.

---

## Badges / cards / timeline

- **Badges** : statut, source, "localStorage reste le fallback actif",
  "Aucune action exécutée", état du flag.
- **Cards** : Source effective · Statut · Persistance serveur · Dernière tentative.
- **Timeline** : Sauvegarde locale (toujours en premier) → Synchronisation /
  Restauration / Fallback / Désactivé selon le résultat.

---

## Microcopy

Présents dans la page :
- `"Statut Empreinte"`
- `"localStorage reste le fallback actif"`
- `"Synchronisation serveur uniquement si activée"`
- `"Aucune action exécutée"`
- `"SQL/RLS à vérifier manuellement"`

---

## Fallback localStorage

`fallback_local_active: true` invariant dans le snapshot. localStorage est toujours
la source de vérité prioritaire — sauvegardé en premier, conservé en cas de
serveur indisponible.

---

## Feature flag

Lu via `isEnterpriseFootprintServerPersistenceEnabled()` (default false).
Aucun hardcode. `.env.local` non modifié. Le flag n'est jamais activé par le code.

---

## Table / RLS warnings

Quand le résultat indique `table_unavailable` ou `rls_failed`, le snapshot expose
un `warning` lisible rappelant "SQL/RLS à vérifier manuellement".

---

## Read-only / controlled invariant

- `/profile/onboarding` ne fait **aucun** nouveau write serveur.
- **Aucun** appel POST direct ajouté.
- **Aucun** import Supabase ajouté pour l'observabilité.
- **Aucun** import `src/lib/pierre`.
- `/profile/agents`, `/profile/messages`, `/agents/pierre/setup`,
  `/agents/pierre/use` **non modifiés**.

---

## Ce qui est activé maintenant

✅ Restore UI model (module pur).  
✅ 10 statuts + 10 sources mappés en labels.  
✅ Badges / cards / timeline / actions.  
✅ QA module (17 étapes).  
✅ Panneau "Statut Empreinte" dans `/profile/onboarding`.  
✅ Warning table/RLS lisible.  
✅ Exports `index.ts`.  

---

## Ce qui reste non activé

- Table SQL `clonestore_enterprise_footprints` non créée (P3.15 manuel requis).
- Feature flag = false.
- Sync serveur non opérationnelle jusqu'à activation manuelle.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 3.18

- Nouvelle persistance / nouveau write serveur.
- Appel POST direct vers `/api/profile/enterprise-footprint`.
- Application automatique du SQL.
- Modification de `.env.local` / hardcode du flag.
- Modification du moteur Pierre.
- Modification des pages agents / messages / Pierre.
- Appel OpenAI / Anthropic.
- Modification de `go-live-proofs.local.json`.

---

## Prochain bloc recommandé

**PHASE 3.19 — CloneOS History Manual Activation QA**

Procédure QA manuelle pour la persistance serveur de l'historique CloneOS
(mêmes garanties que l'Empreinte P3.15 : SQL manuel, evidence template, read-only).

Alternatives :
- PHASE 3.19 — Enterprise Footprint Manual Activation Evidence UI
- PHASE 3.19 — Global Employee Context Registry Design
