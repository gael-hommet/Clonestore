# Analytics Test Matrix

Exécuté 2026-07-25 contre HEAD réel du bloc (voir `00_BASELINE.md` pour la chaîne de commits).
Toutes les suites ci-dessous sont réelles (PGlite Postgres 16 pour les tests DB), aucun mock de
la couche de persistance elle-même.

## Suite Analytics complète — 84/84 verts

| Fichier | Tests | Objet |
|---|---:|---|
| `src/lib/analytics/__tests__/schema.test.ts` | 20 | contrat d'événement, validation, allowlist de propriétés |
| `src/lib/analytics/__tests__/identity.test.ts` | 9 | visitor_id/session_id signés, falsification rejetée |
| `src/lib/analytics/__tests__/traffic.test.ts` | 12 | classification fermée, bot toujours prioritaire |
| `src/lib/analytics/__tests__/attribution.test.ts` | 15 | canal d'attribution, UTM, first/last-touch |
| `src/lib/analytics/__tests__/store.test.ts` | 13 | persistance PGlite réelle, contraintes DB, append-only, purge |
| `src/lib/analytics/__tests__/dashboard-guard.test.ts` | 7 | fail-closed dashboard (notfound/locked/jamais ready sans preuve) |
| `src/lib/analytics/adapters/__tests__/founder-access-adapter.test.ts` | 6 | pont founder-access déterministe, idempotent |
| **Total** | **84** | **0 échec** |

Preuve de reproductibilité : ré-exécuté deux fois lors de ce bloc (un run initial ayant révélé
un bug de test légitime dans le scénario de purge — corrigé, voir `store.test.ts` history — puis
un run 100% vert, puis re-confirmé dans le passage de non-régression ci-dessous).

## Non-régression — 224/224 verts (analytics inclus)

| Périmètre | Fichiers | Tests |
|---|---:|---:|
| P0.1 (`/api/pierre/execute` gouvernance) | 1 | inclus |
| P21/P22 Pierre (queue, statuts canoniques, benchmark élite) | 4 | inclus |
| Partner Program (`money`, `live-authorization`, `payout-rules`, `attribution-rules`) | 4 | inclus |
| Analytics (ce bloc) | 7 | 84 |
| Payment Path (`checkout`, webhook Stripe) | 6 | inclus |
| Demo/Mobile (`cine`, `PierreModes`, `value-model`, `capacity-calculator-hydration`) | 4 | inclus |
| **Total combiné (2 runs)** | **26 fichiers** | **165 + 59 = 224, 0 échec** |

## `tsc --noEmit`

`TSC_EXIT=0`, aucune erreur (repo entier, y compris tout le nouveau code analytics).

## Checkout propre final (Phase 32-34)

Matérialisation stricte depuis les blobs Git (8133 blobs, 0 mismatch, `C:\Users\homme\clonestore-clean-analytics-final`), `npm ci` propre (531 paquets), `.env.local` entièrement fictif.

- `tsc --noEmit` : **1 seul résidu, `embedded-postgres`** — déjà documenté comme
  `UNRELATED_PREEXISTING` par le bloc Clean Head Reproducibility, confirmé encore présent et
  toujours hors périmètre.
- Tests (analytics + PWA + non-régression P0.1/Partner/Payment Path) : **247/248 verts** — le
  seul échec est `.env.example` absent (fichier gitignore, jamais tracké, préexistant,
  indépendant de ce bloc — vérifié via `git status` = `ignored`).
- Voir `ANALYTICS_CLEAN_CHECKOUT_BUILD_PROOF.md` pour le résultat du build final.

## Non exécuté dans ce bloc

Suite Vitest complète du dépôt (des dizaines de milliers de tests, plusieurs blocs non liés) —
hors périmètre proportionné pour une fermeture Analytics ; la non-régression ciblée ci-dessus
couvre les 6 blocs explicitement listés comme protégés par le master prompt. Tests E2E Playwright
navigateur réel du nouveau tracker (page-view réelle, bfcache) — non exécutés, la garantie
« une seule vue » repose sur la lecture de code + les tests unitaires du composant, pas sur un
test navigateur bout-en-bout dans ce bloc.
