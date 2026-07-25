# Analytics Runtime Wiring — Test Matrix

Toutes les suites contre PGlite réel (Postgres 16 en process), aucun réseau/Stripe/webhook réel.

## Analytics (bloc courant + précédent) — verts

| Fichier | Tests | Objet |
|---|---:|---|
| `server-events.test.ts` | 12 | API serveur unique, idempotence, source separation, buckets, no-PII |
| `synthetic-funnel-e2e.test.ts` | 12 | funnel synthétique complet + 4 scénarios d'échec |
| `schema.test.ts` | 20 | contrat, rejet server-only côté client |
| `identity.test.ts` | 9 | visitor/session signés |
| `traffic.test.ts` | 12 | classification fermée |
| `attribution.test.ts` | 15 | canal, UTM, first/last-touch |
| `store.test.ts` | 13 | persistance, contraintes, append-only, purge |
| `dashboard-guard.test.ts` | 7 | fail-closed dashboard |
| `founder-access-adapter.test.ts` | 6 | pont founder déterministe, trust par événement |

## Non-régression — 366/366 verts (une seule exécution combinée)

Périmètre : toute la suite `src/lib/analytics/**` + `src/lib/founder-access/__tests__/**` +
`src/app/api/founder-access/**` + `src/app/api/checkout/__tests__/**` +
`src/app/api/webhooks/stripe/__tests__/**` + `src/lib/partner-program/__tests__/**` — **37
fichiers, 366 tests, 0 échec**, ~147 s. Couvre : réservation/confirmation/activation founder,
checkout pays (EUR/CHF), session Stripe, webhook idempotence/réconciliation, Partner
attribution/payout/live-authorization (aucun changement financier), et tous les tests analytics.

## tsc + ESLint

- `tsc --noEmit` : **exit 0** (repo entier, après ajout de `demo_step_completed` au schéma).
- ESLint ciblé (15 fichiers modifiés/nouveaux) : **0 erreur** (1 warning pré-existant sur un
  `eslint-disable` inutilisé dans un `catch` founder non touché).

## Non exécuté dans ce bloc

Playwright navigateur réel (indisponible/instable dans cet environnement — non prétendu). La suite
Vitest complète du dépôt (des dizaines de milliers de tests non liés) — hors périmètre
proportionné ; la non-régression ciblée couvre tous les blocs protégés impactés.
