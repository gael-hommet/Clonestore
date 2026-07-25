# Analytics Committed Blob Proof

4 commits créés via isomorphic-git, chacun avec allowlist exacte, secret-scannée avant commit,
blobs relus et comparés octet par octet au disque après commit, et vérification indépendante que
seuls les fichiers de l'allowlist ont réellement changé par rapport au HEAD précédent.

| # | OID | Message | Fichiers | Blobs vérifiés | Fichiers changés vs HEAD précédent |
|---|---|---|---:|---|---:|
| 1 | `022749f7950c4db819c34b2e63c99c4249b1f2b7` | `feat(analytics): add canonical event identities and persistence` | 13 | ✅ tous identiques | 13/13 (exact) |
| 2 | `00bbee3ce6f9574c9bca48e81376709c916a5b49` | `feat(analytics): unify funnel instrumentation and attribution` | 6 | ✅ tous identiques | 6/6 (exact) |
| 3 | `9224d425764449c10f56f3a0237c4d433597ab2b` | `feat(analytics): add owner funnel and measurement health dashboard` | 3 | ✅ tous identiques | 3/3 (exact) |
| 4 | `da935b05664415c43ef75b6aa222edf69d0008f2` | `docs(analytics): close funnel measurement contract and launch criteria` | 24 | ✅ tous identiques | 24/24 (exact) |
| 5 | `697cfb5e80b344f69420591405e331b7d5c0a8cb` | `fix(reproducibility): include missing PWA runtime dependencies required by committed layout` | 22 | ✅ tous identiques | 22/22 (exact) |

**HEAD final : `697cfb5e80b344f69420591405e331b7d5c0a8cb`.**

## Commit 5 — pourquoi il existe

La première tentative de checkout propre (Phase 32) a révélé que `src/app/layout.tsx` — déjà
committé, non modifié par ce bloc sauf l'ajout additif du tracker — importe
`@/components/pwa` (`PwaProvider`), un module **entièrement non committé** (22 fichiers : le
composant PWA complet, `src/app/manifest.ts`, la route `/installer`, et leurs tests déjà
écrits). Bug préexistant, indépendant de ce bloc — `tsc` sur `layout.tsx` échouait déjà avant
toute modification analytics, simplement jamais vérifié depuis un checkout strict Git jusqu'à ce
que ce bloc le fasse. Corrigé par le même type de commit minimal ciblé que
`64e12d4b...` (bloc Clean Head Reproducibility) : allowlist exacte de 22 fichiers formant un
périmètre fonctionnel complet et déjà testé (75 tests existants, 74 verts avant commit — le seul
échec restant est une comparaison de manifestes de fichiers entre blocs propre au worktree
principal, absente et donc non pertinente en checkout propre), aucune valeur secrète, blobs
vérifiés après commit.

## Concurrence détectée et vérifiée non conflictuelle

Entre le relevé de baseline (`9d53a2ddd00ae88a78017745b85e64cc0273eed6`) et la création des
commits, le HEAD réel avait avancé à `1838d450e247a63537a575d1368895ab4cd0bc6d` via 2 commits
externes légitimes (`6ba5ce044` — P22 gaps sémantiques, `1838d450e` — « move prelaunch to
August 12 »), 58 fichiers touchés, aucun analytics/tracker parmi les fichiers réellement
modifiés par ce bloc. Vérifié explicitement : les 2 seuls fichiers modifiés (pas ajoutés) par ce
bloc — `src/app/layout.tsx` et `src/lib/pierre/v1/test-runtime-db.ts` — n'ont **pas** été touchés
par ces commits externes. Le premier commit analytics a pour parent exact `1838d450...` (le HEAD
réel au moment du commit, pas une base périmée) — isomorphic-git a automatiquement basé le commit
sur le HEAD courant.

## Ce qui n'a pas été committé

`.next-analytics-funnel-closure/`, `node_modules`, `.env.local`, tout autre fichier du reliquat
legacy (~9000 entrées) — aucun commit de masse, allowlist stricte à chaque étape.
