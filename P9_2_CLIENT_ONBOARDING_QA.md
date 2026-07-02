# P9.2 — Client Onboarding & My CloneStore — QA

> État de qualité de la phase P9.2. Aucune donnée fictive, aucune fausse
> persistance serveur, aucun Playwright simulé. L'E2E authentifié A–E a été
> **réellement exécuté** en build Production contre le Supabase configuré, avec
> deux comptes QA **éphémères** créés puis **intégralement supprimés**.

## 1. Livré et vérifié (vert)

### Frontière d'authentification (Étape 1) — corrigée
- `src/app/profile/layout.tsx` : le verrou général « employé actif » est **retiré**.
  My CloneStore exige désormais **uniquement une session** (rendu shell ; auth par
  garde client). Un client authentifié **sans employé** accède à son espace.
- Les cockpits opérationnels (`/agents/pierre/use` via `OperationalRouteShell`,
  `/profile/messages`) conservent leur **propre verrou serveur** — **inchangé**
  (prouvé par test source `cockpit-gate-and-intro-button.test.ts`).
- **Preuve navigateur (Production)** : `/profile` déconnecté →
  `/login?redirect=%2Fprofile` (redirection sanitizée).

### Home My CloneStore (Étape 4)
- Données **réelles** : `auth.getUser()` + tables `profiles`/`orders` +
  `public-catalog`. Machines pures : `resolveNextAction`, `resolveCockpitAccess`,
  `summarizeOwnedEmployee`. États loading/erreur/session-expirée.
- **CloneStory (univers séparé)** : la carte « Mon espace partenaire »
  (`CloneStoryCockpitCard`, CS-FINAL 1) est **préservée** et rendue dans la home,
  jamais une page parallèle (aucune logique CloneStory modifiée).

### Interface onboarding dans le wizard profond (Étapes 5/6/7) — finalisée
- **Quick Start** (`_components/QuickStartBlock.tsx`) posé **au-dessus** du wizard,
  **contrôlé** par l'état du wizard (`value`/`onChange`) → **aucun second draft**,
  données **immédiatement visibles** dans les sections détaillées, **reprise exacte
  après reload**. 3 écrans, validation, progression, aria-live autosave.
- **Empreinte guidée** (`_components/GuidedFootprintOverview.tsx`) : complétudes
  **réelles** dérivées du même `GlobalOnboardingDraft` ; chaque carte mène à la
  **vraie** section du wizard (`goToStep`), jamais une édition dupliquée.
- **Empreinte continue** (`_components/ContinuousFootprintSurface.tsx`) : invariant
  validation humaine ; **état vide réel en Production** (aucune donnée fictive).
- **Non-régression** : les sections profondes (identité / humains / documents /
  règles / technologies / mission) restent présentes et éditables.

### Navigation AppShell dérivée du registre (Étape 3)
- `src/lib/nav/app-shell-nav.ts` : groupes + ordre locaux, **labels + existence
  dérivés de `route-registry.ts`** (une route absente du registre ne peut pas
  apparaître). Icônes locales indexées par path. Test dédié
  `src/lib/nav/__tests__/app-shell-nav.test.ts`.

### Tour authentifié (Étape 9)
- `my-clonestore-tour.ts` (6 étapes, cibles `mycs-*`), enregistré, **distinct** du
  tour public (id/version/clés séparés), rendu **contextuel** via le moteur P9.1
  (aucun second moteur). Tour public **non régressé** (visible sur `/` et `/login`).

### Persistance — limite honnête
Reprise **même navigateur** via localStorage existant. Persistance serveur
cross-device **désactivée par flag** → **hors périmètre P9.2**. Microcopy :
« Enregistré sur ce navigateur. » Jamais de promesse cross-device.

### Validation automatisée
- `tsc --noEmit` → **exit 0**.
- `npm run build` → **exit 0**, **185/185** pages, `/profile` et `/profile/onboarding`
  compilés (bundle onboarding 16.1 kB, inclut les 3 nouveaux blocs).
- Suite complète : **15665 tests verts / 15669** (287/288 fichiers). Les **4**
  échecs résiduels sont dans `src/lib/pierre/__tests__/premium-document-system.test.ts`
  (`inferPremiumDocumentFamily`) — **préexistants sur `main`** (fichiers **non
  modifiés** par P9.2, confirmé par audit isomorphic-git), **hors périmètre P9.2**.

## 2. Matrice d'accès cockpit (pure, testée)

| Décision | Condition | CTA |
|---|---|---|
| `ready` | employé actif + possédé + onboarding suffisant | Ouvrir le cockpit (`/agents/pierre/use`) |
| `onboarding_required` | actif + possédé + onboarding insuffisant | Continuer le démarrage |
| `account_incomplete` | actif + possédé + identité absente | Démarrer |
| `entitlement_pending` | paiement/activation en cours | Voir l'état |
| `entitlement_inactive` | suspendu/résilié | Gérer l'abonnement |
| `employee_not_owned` | non possédé | Découvrir Pierre |
| `unavailable` | route absente / non authentifié | Retour / Se connecter |

## 3. E2E authentifié A–E — EXÉCUTÉ puis nettoyé (build Production)

**Autorisation** : passe P9.2 uniquement — deux comptes QA éphémères via
`auth.admin.createUser` (jamais `signUp`, jamais d'email), tables V0
`profiles`/`orders` seulement. Script gardé `scripts/p92-authenticated-e2e.mjs` :
refuse sans le flag `P92_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes` (prouvé,
exit 1), refuse tout email non préfixé et toute table hors `{profiles,orders}`.
Connexion via **vrai** `/login` → `supabase.auth.signInWithPassword` (aucun bypass
P8, aucun `pierre_e2e_session`).

| Scénario | Attendu | Résultat navigateur |
|---|---|---|
| **A** — nouveau client (user B), Quick Start partiel → reload → reprise → complet | données persistées, reprise au 1er écran incomplet, complétion 100 % | Écran 1 rempli (60 %, persisté dans `GlobalOnboardingDraft`) → reload → **reprise à « Écran 2 / 3 »** → complété **100 %** « Démarrage rapide terminé ». Propagation prouvée : le wizard profond « Identité entreprise » affiche `Acme QA SAS`. ✅ |
| **B** — Pierre order `active` (user A) | employé **possédé** reflété | Carte Pierre **possédée** (pas l'état « aucun employé ») ; décision `account_incomplete` (onboarding non fait) — reflet honnête. ✅ |
| **C** — transitions d'order (user A) | états d'accès dérivés des **vraies** données | `incomplete` → **« Activation en cours »** (`entitlement_pending`) ; `canceled` → **« Abonnement inactif »** (`entitlement_inactive`). ✅ |
| **D** — empreinte continue (user B) | **état vide réel** | « Aucune information à confirmer pour le moment. … Rien n'est ajouté à votre empreinte sans votre accord. » Aucune donnée fictive. ✅ |
| **E** — tour authentifié (user A) | tour **My CloneStore** (pas public) | Invitation « Bienvenue dans votre espace » → tour **6 étapes** (« Votre espace » 1/6 → « Votre prochaine action » 2/6 …). ✅ |
| **Isolation A/B** | A jamais visible par B | Connecté en B : `Bonjour, p92-e2e-b…`, **aucune** mention de A, **aucun** « Abonnement inactif/Activation », décision `employee_not_owned`. ✅ |

**Bonus prouvés** : nav AppShell registry-driven rendue (4 groupes, override
« Boutique ») ; carte CloneStory « Ouverture prochaine » (non-membre honnête) ;
CTA empreinte guidée → vraie section wizard (« Équipe & humains »).

**Nettoyage (try/finally)** : `cleanup` → suppression orders → profiles → auth
users par `run_id`, puis vérification indépendante :
`remainingUsers=0, residueOrders=0, residueProfiles=0` →
**« P92 E2E CLEANUP — VERIFIED ZERO RESIDUE »**. Fichier de creds (mots de passe)
écrasé puis supprimé ; serveur Production arrêté (port 3000 libre) ; aucun process
Next résiduel.

Captures : `docs/qa-screenshots/p9-2/` (A/B/C ; répertoire gitignoré — évidence QA
locale).

## 4. Réserve honnête
- **4 échecs préexistants** `premium-document-system` (P8/pierre) hors P9.2 —
  **non introduits** par cette phase (à traiter dans le périmètre Pierre).
- Persistance serveur cross-device onboarding : **différée** (flag OFF + migration),
  jamais présentée comme active.
