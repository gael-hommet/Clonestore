# Partner Program Preservation Closure — Rapport

Bloc exécuté 2026-07-25, sur HEAD initial `64e12d4b3fa8b741d546c557fe81ba9a0fda2c96`, branche
`main`, dans `C:\Users\homme\clonestore`.

## 1. Mission initiale

Le bloc précédent (Clean Head Reproducibility and Legacy Worktree Triage Closure) avait classé
la famille `PARTNER_PROGRAM` (122 fichiers, Cabinets Fondateurs + CloneStory/Founding Partners)
comme **P0 LOSS_CRITICAL** — hypothèse : ce code tournerait en production réelle
(clonestore.pro) sans aucune sauvegarde Git, sur la seule foi de la mémoire de session. La
mission de ce bloc était de reconstruire la base Git réelle, isoler le delta réel du worktree,
vérifier l'état déployé, auditer exhaustivement la sécurité financière (commission, payout,
Stripe Connect, attribution), et créer des commits minimaux et prouvés — sans jamais présumer
que les 122 fichiers étaient tous nécessaires ni tous absents de Git.

## 2. Hypothèse P0 initiale (rappel)

`ISSUE-42` : « 122 fichiers du programme partenaires restent uniquement sur disque alors que la
mémoire de session documente un déploiement en production réelle. Aucune sauvegarde Git de ce
qui tourne potentiellement en production. »

## 3. Méthode de forensique

- Aucune lecture du worktree comme preuve de contenu committé : uniquement
  `isomorphic-git.readTree()`/`readBlob()` depuis le HEAD réel.
- `git.status({filepath})` pour chaque fichier candidat (unmodified / *modified / *added).
- Pour tout fichier `*modified` : comparaison octet par octet du blob committé et du fichier
  disque, puis comparaison après normalisation `\r\n`→`\n` pour isoler CRLF vs vraie différence
  de contenu — méthode directement reprise de la leçon du bloc Clean Head Reproducibility
  (« presence ≠ completeness », déjà consignée en mémoire de session).
- Scripts et sorties bruts conservés dans
  `CLONESTORE_AUDIT_EVIDENCE/partner-program-preservation/` (`01_GIT_FORENSIC_TIMELINE.md`,
  `02_STATUS_MAP.md` + fichiers `01a_`/`02a_`/`02b_raw_*`).

## 4. Commits historiques retrouvés

Six commits du 2026-07-11 confirmés, chacun contenant déjà ~219 fichiers Partner/CloneStory :
`65c1335e90e62696aeefaefcc65cd447c33064cb`, `1347530234bfb6737a8b6f2dcca9d8583fe254e4`,
`2f8c73830ea41f06ebf5fe21de47c64648782154`, `2cd2dc7238b94ac7a1be026918b87a8694e4d176`,
`cfad1988dab1a0cd42997dae81b6bdd5363c59ed`, `2a36cd804e2851baf14a3530e14a386dee185bfd`.
Classification : `PARTNER_BASE_ALREADY_COMMITTED`.

## 5. Comparaison HEAD ↔ disque (périmètre étendu, 225 fichiers)

| Catégorie | Nombre |
|---|---:|
| Identiques au HEAD | 72 |
| `*modified` — CRLF uniquement | 152 |
| `*modified` — vraie différence de contenu | 1 |
| Jamais committés | 0 |
| Dans HEAD, absents du disque | 0 |

## 6. Dérive CRLF

Aucun `.gitattributes` dans le dépôt. 152 fichiers committés en LF ont été réécrits en CRLF sur
disque par un outil non identifié après le 2026-07-11 (éditeur, formatteur, ou comportement
Windows d'un script). Vérifié : `0` différence de contenu réelle sur ces 152 fichiers après
normalisation. Aucune action requise sur ces fichiers pour ce bloc — ils n'entrent dans aucun
commit (ni allowlist A, ni B, ni C) : la version committée capture déjà 100 % de la logique.

## 7. Seule vraie différence

`docs/clonestory/BLOC_2_INSCRIPTIONS.md`, une phrase sur la date de lancement : committé
« le 5 août » → disque « le 12 août — reporté depuis le 5 août 2026 initial ». Cohérent avec la
source de vérité déjà committée `src/lib/demo/presentation/commercial-state.ts`
(`DEMO_LAUNCH_ISO = "2026-08-12T00:00:00+02:00"`, commentée « verrouillé par le master prompt »).
Version disque confirmée correcte.

## 8. Tests Partner

68/68 tests verts (5 fichiers : `money.test.ts`, `live-authorization.test.ts`,
`payout-p10-floor.test.ts`, `attribution-rules.test.ts`, `payout-rules.test.ts`) — exécutés
avant la correction du faux positif, sur le code déjà committé + disque (identiques hors CRLF).
Non ré-exécutés dans cette reprise : aucun fichier runtime Partner n'a changé depuis.

## 9. Sécurité financière déjà préservée (lecture de code, sans modification)

Confirmé par lecture directe des fichiers déjà committés :
- Dry-run payout = zéro écriture, zéro transfert (`payouts.ts`).
- `paid` uniquement après confirmation Stripe réelle ; échec libère les entrées ; issue inconnue
  → `reconciliation_required`, ne libère ni ne paie rien.
- Autorisation live fail-closed à 9 conditions nommées, testée exhaustivement
  (`live-authorization.ts` + `payout-p10-floor.test.ts`), dominée par
  `PRODUCTION_AUTHORIZED = false as const`.
- Clé d'idempotence déterministe par lot ; lot jamais mixte test/live ni multi-devise
  (`assertHomogeneousBatch`).
- Attribution serveur-autoritaire, anti-auto-parrainage, pas d'attribution rétroactive.
- Stripe Connect : uniquement des booléens de complétion + noms de champs requis stockés,
  jamais de données bancaires/KYC.

## 10. Déploiement

**Non revérifié dans cette reprise** (hors scope de la fermeture documentaire demandée). Statut
documentaire uniquement, non prouvé par une vérification HTTP publique dans ce bloc :
`DEPLOYED_STATE_DOCUMENTED_NOT_PROVED`.

## 11. Configuration Stripe Connect

Inchangée. Toujours en mode test uniquement dans le code (`connect.ts` commenté « TEST MODE
UNIQUEMENT »), aucune activation live déclenchée dans ce bloc.

## 12. Commits créés dans ce bloc

Voir Phase C et D ci-dessous pour les OID exacts — consignés dans
`PARTNER_PROGRAM_PRESERVATION_VERDICT.md` question 14/15.

## 13. Risques résiduels

- La dérive CRLF (152 fichiers) reste non corrigée sur disque — sans impact fonctionnel, mais
  pourrait continuer à générer du bruit `*modified` dans de futurs blocs si un `.gitattributes`
  n'est pas ajouté (hors scope ici, aucune preuve qu'un correctif soit nécessaire).
- L'état réellement déployé sur clonestore.pro n'a pas été re-confirmé par une requête publique
  dans cette reprise.
- Les autres familles P1 (`P9X_P16_HR_CORE`, `P17`–`P19`, `GO_LIVE`, `E1`, `C1_CLONECHAT`,
  migrations) restent le vrai reliquat de préservation prioritaire.

## 14. Verdict

Voir `PARTNER_PROGRAM_PRESERVATION_VERDICT.md`. Statut retenu :
**`PARTNER_PROGRAM_PRESERVED_CONFIGURATION_PENDING`**.
