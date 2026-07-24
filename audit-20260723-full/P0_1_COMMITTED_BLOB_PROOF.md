# P0.1 — Preuve depuis les blobs Git committés (pas depuis le disque)

Cette vérification lit directement `git.readBlob()` depuis l'arbre du HEAD final
(`b3159c34546f3555869ffe2cfcc6a4d6069086e3`, après les 5 commits de ce bloc) — **jamais depuis
le disque**. C'est la preuve définitive qu'un `git clone` propre à cet instant récupérerait
exactement le même P0.1/P0.2 fonctionnel que celui vérifié dans le bloc précédent, et non plus
seulement une copie de travail susceptible d'être écrasée par un chantier concurrent (voir
`P0_1_GIT_FORENSIC_TIMELINE.md` pour la raison exacte pour laquelle cette preuve est nécessaire).

## Résultat : 14/14 vérifications réussies

| Fichier (hash blob sha256, 16 car.) | Vérification | Résultat |
|---|---|---|
| `src/app/api/pierre/execute/route.ts` (`046b888e0ea46e70`) | Import de `evaluateLegacyExecuteGovernance` | ✅ Présent |
| `src/app/api/pierre/execute/route.ts` | Appel direct `callMake(` | ✅ Absent |
| `src/app/api/pierre/execute/route.ts` | Variable `MAKE_*_WEBHOOK_URL` | ✅ Absente |
| `src/app/api/pierre/execute/route.ts` | Code `GOVERNANCE_BLOCKED` (email.send DENY) | ✅ Présent |
| `src/app/api/pierre/execute/route.ts` | Plancher route dur `hris.sync` → REQUIRE_APPROVAL | ✅ Présent |
| `src/app/api/pierre/execute/route.ts` | Plancher `EXECUTION_NOT_AVAILABLE` (cas ALLOW) | ✅ Présent |
| `src/lib/pierre/legacy-execute-governance.ts` (`8d6d63c1a9eebb38`) | Appelle `evaluatePierreCloneGuard` | ✅ Présent |
| `src/lib/pierre/legacy-execute-governance.ts` | Appelle `evaluateGovernance` | ✅ Présent |
| `src/lib/pierre/hr/cloneguard.ts` (`f965cca67cd27b8e`) | Règle `integration_sync_require` | ✅ Présente |
| `src/lib/pierre/hr/cloneguard.ts` | Kind `integration_sync` | ✅ Présent |
| `src/lib/pierre/__tests__/legacy-execute-governance.test.ts` (`7db9ecd1e1dc508a`) | 8 tests unitaires (structure `describe`) | ✅ Présents |
| `src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts` (`06bed58f1aa8849a`) | 10 tests d'intégration | ✅ Présents |
| `src/app/api/pierre/action/route.ts` (`406b7dc8c22c3fa9`) | P0.2 utilise le module partagé | ✅ Présent |
| `src/app/api/router/route.ts` (`0e86021c8bddb873`) | P0.2 neutralisé 410 | ✅ Présent |

## Correspondance disque ↔ Git

Chaque hash de blob ci-dessus a été comparé bit-à-bit (sha256 complet, tronqué à 16 caractères
pour l'affichage) au hash du fichier correspondant sur disque au moment de la création du
commit — voir `10_commits_0_to_4_log.txt` pour les 27 comparaisons `blob-check ... match=true`
(0 mismatch). Cette double vérification (contenu textuel + hash binaire) élimine toute
possibilité qu'un commit ait capturé un état partiel, tronqué, ou différent de ce qui a été
réellement testé dans le bloc précédent.

## Conséquence directe

Un clone frais du dépôt à ce HEAD, sans aucun accès au disque de travail actuel, retrouverait :
- La route `/api/pierre/execute` gouvernée, sans connecteur Make.
- Le module de gouvernance et sa règle CloneGuard additive.
- Les 18 tests P0.1 + les 10 tests P0.2 correspondants.
- `/api/pierre/action` gouverné et `/api/router` neutralisé.

**P0.1 n'existe plus uniquement dans l'arborescence de travail — il existe désormais dans
l'historique Git réel, vérifiable indépendamment du disque.**
