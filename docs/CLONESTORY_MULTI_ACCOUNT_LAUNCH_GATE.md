# CloneStory — Gate de lancement public multi-comptes

Vérifie que CloneStory est une **vraie version publique généralisée** (nombre arbitraire de
partenaires/comptes/entreprises/introductions/attributions/contributions), pas un produit
dépendant des fixtures smoke. Inscriptions **restées fermées** pendant toute la validation.

## Audit multi-comptes (résultat)
**Zéro BLOCKER de correction multi-comptes.** Forces confirmées :
- **RLS** : 20 tables `clonestory_fp_*` `enable` + **`force`** + politique ; `withPartner`
  bascule sur `pierre_rt_app` (non-superuser → FORCE s'applique). Partenaire A ne lit jamais B.
  Service sans GUC = fail-closed (0 ligne).
- **Atomicité/concurrence** : `registry_number` alloué sous `pg_advisory_xact_lock` + index
  unique partiel (filet anti-course) ; codes personnels uniques (`code_lookup_hash` unique +
  retry) ; distinctions `unique(partner_id, distinction_code)` (jamais 2×) ; attribution
  no-steal (index actifs uniques compte/entreprise/visiteur) ; outbox `idempotency_key` unique ;
  ledger Stripe `stripe_event_id` unique.
- **Aucune identité codée en dur** dans les chemins production (la seule constante e-mail est
  l'expéditeur public ; en prod un secret manquant lève). Aucun `limit 1` injustifié (tous
  résolvent THE partenaire/ligne par clé unique).
- **Modèle d'inscription** : **AUTOMATIQUE et non ambigu** — `registered → (email vérifié) →
  email_verified = membre actif`, sans étape admin. Le **titre public** `founding_partner` +
  `registry_number` est **mérité** (uniquement après une 1ʳᵉ contribution commerciale vérifiée),
  jamais automatique.

## Corrections d'échelle appliquées (FINAL PUBLIC)
| Correctif | Détail |
|---|---|
| Migration `_09` | Index manquants sur chemins chauds : `introductions.prospect_email_normalized` (capture d'attribution à chaque `/profile`), `commercial_contributions.stripe_payment_intent_id` + `stripe_invoice_id` (remboursements/litiges). Additif, idempotent. |
| Cockpit `/profile` | Stats funnel calculées par **agrégat `COUNT FILTER`** (indexé par `partner_id`) — fini le chargement de TOUTES les introductions à chaque vue. |
| `getMyRegistry` | Affichage **borné à 200** introductions récentes + **stats exactes par agrégat** (indépendantes de l'affichage). |
| Admin | `adminGetPartnerDetail` (intros/events/audit) + `adminListConflicts` **bornés à 500**. |

## Preuve multi-comptes (tests, PGlite réel)
`__integration__/multi-account.itest.ts` — **6 tests** :
- **22 partenaires distincts** : ids + codes personnels **tous uniques** (format normalisé 8) ;
- **isolation RLS croisée** sur les 22 (A ne voit aucune ligne d'autrui ; service sans GUC = 0) ;
- **6 contributions vérifiées → 6 `registry_number` uniques et séquentiels** (aucun trou/doublon) ;
  distinction jamais attribuée 2× ;
- **pagination** : partenaire à **250 introductions** → affichage **200**, stats **250** (exactes) ;
- **CHARGE paramétrable** (`CLONESTORY_LOAD_N`/`_M`, défaut **1 000 partenaires / 10 000
  introductions**) : insertion en masse, **0 doublon de code**, requête chemin chaud (funnel
  d'un partenaire) **< 2 s** à l'échelle.

## Gate (tout vert, local)
`tsc` 0 · unit+structural+profil **908** · intégration **111** (dont multi-account 6) · RLS **OK** ·
build **0** · scan secrets propre · migrations base vierge + double application (idempotentes,
`_09` index 3/3). Production (lecture seule) : `register` 503, `/health` `regOpen=false`,
`_05..08=true`, dead 0/0/0, `alerts=[]` — **inchangée ce tour**.

## Limites honnêtes
- Le code FINAL (`_09` + agrégats cockpit/registre + bornes admin) est **validé mais NON
  déployé** (l'agent ne peut pas déployer Vercel). La prod actuelle (CS-FINAL 4) est déjà
  **multi-comptes-correcte** (RLS/atomicité/isolation/modèle d'inscription) ; `_09` + agrégats =
  **optimisations d'échelle** à appliquer/déployer par l'opérateur avant trafic significatif.
- Concurrence vraie (course `registry_number` multi-connexions) non rejouable sous PGlite
  (connexion unique) → garantie par l'index unique + verrou d'avis (prouvé structurellement) ;
  l'unicité séquentielle est prouvée sur 6 allocations.
- a11y navigateur réelle non rejouée (Chromium/Playwright bloqué env agent) ; textes juridiques ⚖️.
- MINOR cosmétique : un `registered` dérivé (avec `email_verified_at`) tomberait en
  « ineligible » dans `mapStatus` (impossible via le flux normal).

## Action opérateur pour l'ouverture
1. Appliquer `_09` en prod : `MIGRATIONS_FILTER=clonestory_fp DATABASE_URL=… npm run db:migrate:pg`.
2. Déployer le code final (`vercel deploy --prod`).
3. (Optionnel) smoke commercial Stripe **test** du 1er client = preuve E2E commerciale finale.
4. Ouvrir : `CLONESTORY_REGISTRATION_OPEN=true` (décision opérateur, après 1-3).
