# C1.8 — AI-Assisted Owner Acceptance — Audit (version finale)

Date : 2026-07-21. Exécution finale retenue comme preuve : Chromium réel (Playwright) contre le
build isolé précompilé `.next-c18-final-closure` **reconstruit après le correctif founder-access**,
serveur fail-closed (`e2e/c18-fail-closed-env.cjs`, 27 destinations distantes neutralisées, `0
destination distante` vérifié au démarrage). Aucune production, aucun déploiement, aucune base
distante, aucun paiement, aucun provider externe.

**Ceci est une ASSISTANCE IA à la checklist propriétaire, PAS un remplacement de sa signature.**

## 1. Résultat final retenu comme preuve

**10/10 étapes PASS.** 0 erreur console réelle. 0 requête 404/5xx/externe. Desktop et mobile PASS.
Voir `C18_AI_OWNER_ACCEPTANCE_RESULTS.json` (ce run précis) et les 10 captures `step-01.png` …
`step-10.png`, régénérées par cette exécution.

| # | Action | Verdict |
|---|---|---|
| 1 | Ouvrir `/assistant` anonyme | **PASS** |
| 2 | « je veux acheter Pierre » | **PASS** |
| 3 | Clic CTA → `/reserver/pierre` | **PASS** |
| 4 | Retour `/assistant`, « où sont vos CGV » | **PASS** |
| 5 | « vous êtes disponibles au Canada ? » | **PASS** |
| 6 | « Pierre peut-il licencier tout seul ? » | **PASS** |
| 7 | Annulation jamais demandée | **PASS** |
| 8 | Audit console (étapes 1–7) | **PASS** — 0 erreur réelle |
| 9 | Audit réseau (session) | **PASS** — 0 externe, 0 404, 0 5xx |
| 10 | Mobile 390×844, rejeu étape 2 | **PASS** |

## 2. Le défaut réel — trouvé, corrigé, vérifié

Un run précédent (non retenu comme preuve finale — voir §4) avait révélé : `POST
/api/founder-access/presence` et `POST /api/founder-access/funnel` renvoyaient 500 dans ce
harnais fail-closed. **Corrigé cette session** — voir `C18_FOUNDER_ACCESS_FIX_PLAN.md` et
`C18_FOUNDER_ACCESS_FIX_RESULTS.json` pour l'analyse complète et les preuves de correction :

- **Cause** : `getFounderDb()` jette de façon synchrone (`DATABASE_URL` absente en fail-closed),
  appelé sans protection dans les deux routes, seul point non gardé (`distributedRateLimit` et les
  écritures analytics avaient déjà leur propre protection).
- **Correctif commun** : `getFounderDbForBeacon()` (jamais un throw, dégrade vers 204, journalise en
  interne un nom d'erreur redacted). `getFounderDb()` lui-même **inchangé** — `reservations` et le
  webhook Stripe en dépendent pour rester fail-loud sur une vraie écriture métier.
- **Tests** : 8 cas nouveaux (DB absente, rate-limit/écriture qui jettent, 0 fuite de secret, 0
  appel externe/synchrone, régressions 422/204 préservées) + 1 cas de persistance réelle funnel
  (PGlite). Tous verts. `npx tsc --noEmit` : 0 erreur.
- **Vérifié en navigateur réel** : les étapes 8 et 9 de ce run passent désormais à 0 erreur.

## 3. Défauts de HARNAIS corrigés en cours de route (à distinguer du §2)

1. Renvoi aveugle sur timeout dans `send()` → duplication de message. Corrigé : marge unique 30s.
2. Course de restauration d'historique après navigation. Corrigé : pause de stabilisation.
3. `isVisible({timeout})` ne fait pas de polling (contrairement à `waitFor`). Corrigé.
4. IP fixes réutilisées entre relances → rate-limiter anonyme légitimement déclenché. Corrigé :
   compteur d'IP persisté sur disque.

## 4. Exécutions intermédiaires — non retenues comme preuve finale

Avant ce run propre, 6 exécutions intermédiaires ont eu lieu pendant le diagnostic/correctif
(3 pour isoler puis corriger les 4 bugs de harnais du §3, 3 pour reproduire — 4/4 au total — puis
vérifier la correction du défaut réel du §2). Leurs artefacts (screenshots, JSON) ont été
**écrasés** par ce run final : seul l'état ci-dessus (10/10, 0 erreur) fait foi. Le défaut du §2 a
été reproduit et confirmé stable AVANT correction (4/4 exécutions identiques), condition posée
avant toute correction, conformément à la consigne « reproduis-le une seconde fois, ne le masque
pas ».

## 5. Défaut trouvé, honnêtement rapporté, NON corrigé (hors périmètre explicite)

En exécutant la suite de régression `founder-access` complète (§ validation ciblée), un échec
**pré-existant et sans rapport** est apparu : `src/lib/founder-access/__integration__/
er2-cohort-temporal.itest.ts` (assertion sur `demo_done`, 0 au lieu de 1), reproduit 2/2 fois de
façon identique. **Aucun chevauchement de code** avec ce correctif : ce test insère directement en
SQL et appelle `cohortFunnelSnapshot`/`analytics.ts` — aucun de ces fichiers n'a été touché par
cette session. Le périmètre de cette tâche était strictement les deux 500 de `presence`/`funnel` ;
ce défaut est rapporté ici, non masqué, mais **non corrigé** — corriger un fichier hors périmètre
sans autorisation explicite aurait été une extension non sollicitée.

## 6. Portée honnête

Ce que cette exécution PROUVE : le comportement CloneChat/C1.8 testé est correct dans un vrai
navigateur, sur le build final, ET le défaut founder-access trouvé lors de la première acceptation
assistée est réellement corrigé (reproductible avant, absent après, sur le même harnais). Ce
qu'elle NE remplace PAS : le jugement humain du propriétaire. `C18_OWNER_ACCEPTANCE_10_STEPS.md`
reste disponible pour une confirmation directe.
