# Analytics Clean Checkout Build Proof

Deux matérialisations propres effectuées dans ce bloc (une diagnostique, une finale — jamais
réutilisées entre elles), toutes deux strictement depuis les blobs Git
(`isomorphic-git.readTree()`/`readBlob()`, aucune lecture du worktree principal).

## Matérialisation diagnostique (a révélé le gap PWA)

HEAD `da935b05664415c43ef75b6aa222edf69d0008f2` (avant le commit 5), 8111 blobs, 0 mismatch.
`tsc --noEmit` → 2 erreurs réelles : `@/components/pwa` introuvable (bug préexistant, voir
`ANALYTICS_COMMITTED_BLOB_PROOF.md` §Commit 5) + `embedded-postgres` (résidu déjà connu). Tests :
172/173 (`.env.example` absent, préexistant). Corrigé par le commit 5.

## Matérialisation finale (preuve retenue)

**Répertoire** : `C:\Users\homme\clonestore-clean-analytics-final`, vierge, recréé à zéro.
**HEAD matérialisé** : `697cfb5e80b344f69420591405e331b7d5c0a8cb` (HEAD final du bloc, 5 commits).

| Étape | Résultat |
|---|---|
| Blobs écrits | 8133 |
| Mismatches sha256 | **0** |
| Octets totaux | 919 624 645 |
| `node_modules` réutilisé ? | Non — jamais copié |
| `.env.local` copié ? | Non — entièrement fictif, reconstruit à partir des seuls **noms** de variables (`grep -oE "^[A-Z_][A-Z0-9_]*=" .env.local`, jamais les valeurs) |
| `npm ci --prefer-offline --no-audit` | ✅ 531 paquets, exit 0 |
| `tsc --noEmit` | 1 seul résidu (`embedded-postgres`), déjà classé `UNRELATED_PREEXISTING` par le bloc Clean Head Reproducibility |
| Tests (analytics 84 + PWA 75 + P0.1 + Partner Program + Payment Path) | **247/248 verts** — seul échec : `.env.example` absent (gitignoré, jamais tracké, préexistant, indépendant de ce bloc) |
| Build | `NEXT_DIST_DIR=.next-analytics-final`, `NODE_OPTIONS=--max-old-space-size=6144` |
| `REAL_EXIT_CODE` | **0** |
| `BUILD_ID` | **`TFw9A1Kw0cuEn80tHPZX4`** |
| Routes canoniques compilées | `/api/analytics/events` (866 B), `/internal/[slug]/command-center/analytics` (2.1 kB) — confirmées présentes dans la sortie de build |
| Routes protégées intactes | `/api/pierre/execute`, `/api/pierre/action`, `/api/router`, `/api/checkout`, `/api/webhooks/stripe`, `/partenaires`, toutes présentes dans la sortie de build (196 routes au total, cohérent avec les blocs précédents) |

## Conclusion

Le HEAD final (`697cfb5e...`) est réellement autonome par rapport au worktree historique :
preuve indépendante complète (matérialisation stricte, installation propre, environnement
fictif, TypeScript, 247/248 tests, build) sans dépendance résiduelle sur le disque de travail
principal, à l'exception des deux gaps préexistants documentés (`embedded-postgres`,
`.env.example`) — aucun des deux introduit par ce bloc.
