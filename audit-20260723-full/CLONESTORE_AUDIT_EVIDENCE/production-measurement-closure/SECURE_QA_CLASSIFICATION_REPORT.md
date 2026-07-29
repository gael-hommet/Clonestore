# Secure Production QA Classification & Real Funnel Proof — Report

**Statut : `PRODUCTION_MEASUREMENT_ACTIVATED_WITH_BLOCKERS` — NON-PASS contrôlé.**

Les deux tables Analytics canoniques sont actives en Supabase Production (activation réalisée hors
de ce sandbox ; projet `zdoigpfkyhilpzcsrdmc`) et le contrat de l'endpoint Production a été prouvé
en HTTP réel lors du tour précédent. Ce bloc **ferme le hardening** et **corrige le blocker de
classification QA** (code + tests + commits locaux). L'**activation complète de la mesure** reste
bloquée par des accès externes absents de ce sandbox (push, Vercel, base Production) — ce qui, par la
doctrine du bloc (« Ne déclare jamais PASS parce que les tables existent seulement »), impose un
NON-PASS contrôlé.

## 1. Ce qui est FAIT et prouvé dans ce bloc

### Commit 1 — hardening des grants (`e0230ddf`)
- `supabase/migrations/2026-07-29__harden_clonestore_analytics_table_grants.sql` versionné, contenu
  **exact** exigé (revoke all des privilèges directs anon/authenticated sur les deux tables et leurs
  séquences ; RLS reste activée/forcée).
- Harnais `src/lib/pierre/v1/test-runtime-db.ts` : amorce des rôles Supabase `anon`/`authenticated`
  dans PGlite (test-only) pour appliquer la migration **prod-exacte** sur base isolée, **sans jamais
  modifier la migration elle-même**.
- Prouvé sur base isolée PGlite : première application PASS ; seconde application idempotente PASS ;
  grants anon/authenticated après migration = 0 (table + séquence) ; `pierre_rt_app` intact
  (Events: INSERT/SELECT ; Conversion Links: INSERT/SELECT/UPDATE).

### Commit 2 — classification QA authentifiée serveur-uniquement (`75b88d4f`)
Corrige le blocker précédemment identifié : en Production, `x-clonestore-test` seul est **ignoré**
(un en-tête public ne doit jamais permettre à un visiteur de masquer son trafic). Nouveau chemin :

- `src/lib/analytics/qa-auth.ts` (serveur-uniquement, importe `node:crypto`) :
  `constantTimeTokenEqual` (comparaison temps constant, fail-closed sur absence/vide/`<32`/longueur
  différente) et `isAuthenticatedProductionQaRequest` (vrai **uniquement** si environnement réel =
  `production` **ET** secret configuré **ET** `x-clonestore-qa-token` == `CLONESTORE_ANALYTICS_QA_TOKEN`).
- `src/lib/analytics/traffic.ts` : nouvelle entrée `authenticatedProductionQa` ; en Production, la
  classe `test` n'est atteinte **que** par ce booléen (fail-closed sinon). Bot UA l'emporte toujours.
- `src/app/api/analytics/events/route.ts` : lit le secret **côté serveur uniquement**, ne le
  journalise/renvoie/bundle jamais, ne le préfixe jamais `NEXT_PUBLIC`.
- `.env.example` : documentation fail-closed de `CLONESTORE_ANALYTICS_QA_TOKEN` (aucune valeur réelle).

**Périmètre strict prouvé (tests) :** un token QA valide ne produit QUE `traffic_class=test`. Il ne
débride ni la validation de schéma, ni le rejet des vérités serveur (`reservation_created` →
`SERVER_ONLY_EVENT_REJECTED`, `source=server` → `INVALID_SOURCE`), ni le rejet des noms inconnus
(`UNKNOWN_EVENT_NAME`), ni la borne de taille (413), ni le rate limiting (61ᵉ requête → 429). Le
secret ne fuit dans aucune colonne de la ligne persistée.

### Table de classification (prouvée par `qa-auth.test.ts` + `route.test.ts`)
| Cas (Production sauf mention) | Résultat |
| --- | --- |
| aucun token configuré | external |
| token configuré, aucun en-tête | external |
| mauvais en-tête | external |
| token tronqué / longueur ≠ | external |
| token vide | external |
| secret configuré `<32` | external |
| **bon token** | **test** |
| `x-clonestore-test: 1` seul | external |
| `x-clonestore-test` + bon token | test |
| Development, en-tête de test historique | test (préservé) |
| Test (CI), en-tête historique | test (préservé) |
| variables absentes | aucune exception, external |
| en-tête dupliqué/malformé | external |
| bon token + événement invalide | validation de schéma toujours appliquée (422) |
| bon token | rate limiting toujours appliqué (429) |

### Vérification (ce tour)
- **Analytics + route :** 14 fichiers, **168/168** verts (dont 36 nouveaux tests QA/route).
- **Régression adjacente :** 6 fichiers, **73/73** verts (founder request-utils/webhook, partner
  attribution, checkout helpers + pricing serveur, Stripe orders-ledger replay, conversion bloc3).
- **ESLint :** 0 sur les 5 fichiers modifiés/ajoutés.
- **TypeScript :** **0 erreur** dans les fichiers de ce bloc. `tsc --noEmit` projet-entier signale
  2 erreurs, **toutes deux hors périmètre** et dans des fichiers **modifiés par une session
  concurrente** (`src/lib/pierre/v1/cognitive-runtime/proactive-detection.ts` `*modified` + le test
  `p22-legacy-fallback-boundary.itest.ts` qui l'appelle) — dérive de signature « attend 4 arguments,
  reçu 3 ». Non causé par ce bloc ; non « corrigé » (on ne touche pas au travail en cours d'une autre
  session). Condition de dépôt volatile documentée : **pas de certification globale tsc-green**.
- **Endpoint Production (acquis, tour précédent, HTTP réel) :** forged server event → 422
  `SERVER_ONLY_EVENT_REJECTED` ; `source=server` → 422 `INVALID_SOURCE` ; inconnu → 422
  `UNKNOWN_EVENT_NAME` ; oversized → 413. Non re-joués (aucun redéploiement → pas de non-régression à
  vérifier).

## 2. Blockers (accès externes absents de ce sandbox — re-vérifiés ce tour)

1. **Push impossible** : `git.push` → `NO_CREDENTIAL_IN_ENV` (aucun identifiant GitHub dans
   l'environnement). `git.exe` reste OS-bloqué. ⇒ les commits `e0230ddf`/`75b88d4f` existent en local
   sur la branche dédiée `release/production-measurement-closure` mais **ne sont pas poussés**.
2. **Déploiement Vercel impossible** : pas de push → pas de nouveau SHA déployé ; pas de CLI/token
   Vercel. SHA Production réel **inconnu** (non vérifiable).
3. **Secret Vercel non configurable** : `CLONESTORE_ANALYTICS_QA_TOKEN` **non configuré** (aucun accès
   Vercel). Conformément à la consigne : je ne prétends pas l'avoir configuré, et je n'injecte aucun
   test persistant qui serait classé `external`.
4. **Base Production illisible** : ni Supabase CLI, ni `DATABASE_URL`/service-role dans `process.env`
   (secrets uniquement dans `.env.local`, jamais lus). ⇒ persistance/corrélation/dashboard Production
   **non prouvables**.
5. **Conséquence mesure** : sans secret déployé+configuré, tout événement QA en Production serait
   classé `external` et polluerait des métriques **append-only** (non nettoyables). Le bloc l'interdit
   ⇒ **aucun événement persistant ni parcours navigateur Production exécuté**.

## 3. Ce qui reste — par le propriétaire, avec ses identifiants
1. Récupérer les commits `e0230ddf` + `75b88d4f` (branche `release/production-measurement-closure`),
   les rebaser/cherry-pick sur `main`, `git push` → déploiement Vercel Production.
2. Configurer `CLONESTORE_ANALYTICS_QA_TOKEN` (≥ 32 octets aléatoires) **uniquement** dans
   l'environnement Vercel Production (jamais `NEXT_PUBLIC`).
3. Vérifier déploiement READY + SHA attendu, puis exécuter (avec l'en-tête privé) : événement valide
   → 202 `inserted` + ligne `environment=production traffic_class=test`, sans PII ; rejeu → `duplicate` ;
   parcours navigateur desktop/mobile préfixe `qa_prod_measurement_20260729_` sans paiement réel ;
   preuve de corrélation en base ; exclusion des métriques commerciales.

Tant que ces étapes Production ne sont pas exécutées, le statut demeure
`PRODUCTION_MEASUREMENT_ACTIVATED_WITH_BLOCKERS`.
