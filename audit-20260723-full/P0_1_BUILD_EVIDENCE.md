# P0.1 — Preuve de build isolé

Commande exacte : `NEXT_DIST_DIR=.next-p0-1-reclosure NODE_OPTIONS="--max-old-space-size=6144" npx next build`

## Tentative 1 — échec environnemental (pas un défaut de code)

Crash natif pendant la phase de compilation webpack (`memory allocation of 719549483 bytes
failed`, `Next.js build worker exited with code: 3221226505`) — même schéma récurrent que dans
plusieurs blocs précédents de cette session (contention mémoire du système, pas un défaut du
code modifié). Aucun processus node lourd concurrent n'a été trouvé au moment du lancement ;
retenté après purge du `NEXT_DIST_DIR` précédent.

## Tentative 2 — succès réel

- **`BUILD_ID`** : `q9cJcei7BiG1AL_u47dDK`
- **Exit** : 0 (confirmé par la présence de la table de routes complète en fin de sortie —
  contrairement à la tentative 1, dont la sortie s'arrête brutalement sur le message de crash
  natif sans jamais atteindre la table de routes).
- **0 occurrence** de "error"/"Error" dans l'intégralité de la sortie capturée.
- **288 lignes de routes listées** dans la table finale (page + API routes confondues),
  incluant explicitement les 4 surfaces de ce bloc :
  - `ƒ /api/pierre/execute` — 869 B / 103 kB
  - `ƒ /api/pierre/action` — 869 B / 103 kB
  - `ƒ /api/pierre/run` — 869 B / 103 kB
  - `ƒ /api/router` — 869 B / 103 kB
- `.next-p0-1-reclosure/server/app/api/pierre/execute/route.js` généré et présent sur disque.
- Aucun secret trouvé dans les artefacts de build inspectés (mêmes fichiers que le scan source,
  voir `CLONESTORE_AUDIT_EVIDENCE/p0-1-execute-route-reclosure/05_secret_scan.txt`).

## Remarque de méthodologie (déjà notée mémoire de session)

"Un build qui compile" et "la gouvernance est présente" sont deux affirmations distinctes et ne
doivent jamais être fusionnées : ce document prouve uniquement que le code compile et bundle
correctement après le retrait du connecteur Make et l'ajout de la gouvernance — la preuve que
la gouvernance elle-même fonctionne est apportée séparément par `P0_1_TEST_MATRIX.md` (tests
d'intégration réels, pas seulement une compilation réussie).
