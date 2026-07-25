# Validated Worktree Preservation — Risques résiduels

## R1 — `.next-p10/p11/p12/p13/p96` déjà committés dans l'historique (pré-existant, non corrigé)

Découvert en Phase 4 : ces 5 répertoires de build isolé sont déjà présents dans l'arbre Git du
HEAD, committés bien avant ce bloc (probablement lors d'un ancien `git add` trop large). Ce
bloc n'a pas retiré ces entrées historiques (opération destructive — `git rm --cached` en masse
— hors périmètre et non autorisée par le prompt maître, qui interdit toute suppression non
documentée/déduite automatiquement). Une règle `.gitignore` (`.next-*/`) a été ajoutée pour
empêcher toute récidive. **Recommandation au propriétaire** : un nettoyage dédié (`git rm
--cached -r .next-p10 .next-p11 .next-p12 .next-p13 .next-p96` puis commit) serait approprié
dans un futur bloc explicitement autorisé pour cela — pas dans celui-ci.

## R2 — 1768 fichiers `UNRELATED_PREEXISTING` restent non commités

La conséquence directe et déjà documentée du "Git Blocked Gotcha" : des semaines/mois de
travail (P9.x-P20, C1.1-C1.9, T1/T2, E1.x, PARTNER_*, PWA_*, MPA1, etc.) existent uniquement
dans l'arborescence de travail. Ce bloc les a inventoriés et classés (voir
`WORKTREE_FULL_STATUS_MATRIX.md`) mais **ne les a délibérément pas commités** — les committer en
bloc mélangerait des dizaines de chantiers non validés dans ce bloc, contredirait directement
"ne mélange pas arbitrairement les blocs", et representerait un risque d'un tout autre ordre de
grandeur (aucune vérification de gate, de tests ciblés, ni de scan de secrets exhaustif n'a été
faite sur ces 1768 fichiers). **Ces fichiers restent exposés au même risque de perte que celui
qui a coûté P0.1** tant qu'ils ne sont pas committés dans un bloc dédié et explicitement
autorisé à cet effet.

## R3 — `tick`/`run` et autres surfaces hors périmètre gouvernance (rappel, hérité de P0.1)

Voir `P0_1_REMAINING_RISKS.md` R1-R4 — inchangés par ce bloc (aucun code n'a été modifié ici,
seulement committé).

## R4 — Identité de commit — pas de vérification par signature GPG

Les commits de ce bloc utilisent l'identité `user.name`/`user.email` de la configuration Git
globale, sans signature GPG (aucune clé configurée dans cet environnement). Ceci est cohérent
avec l'historique existant du dépôt (aucun commit antérieur signé non plus) — signalé pour
information, pas un risque nouveau introduit par ce bloc.

## R5 — `package.json`/`tsconfig.json`/`next.config.ts`/autres fichiers racine restent non commités

Ces fichiers montrent un statut modifié (`UNRELATED_PREEXISTING`) sans lien identifié avec l'un
des 5 blocs nommés. Le build isolé de ce bloc (Phase 7, `REAL_EXIT_CODE=0`) a utilisé leur état
ACTUEL sur disque avec succès — mais comme ils ne sont pas commités, un clone frais du HEAD créé
par ce bloc n'aura PAS ces changements (quels qu'ils soient). Ce n'est pas un défaut introduit
par ce bloc (ces fichiers étaient déjà dans cet état avant), mais cela signifie que la preuve de
build de ce bloc (Phase 7) **ne garantit pas qu'un clone frais du nouveau HEAD compile de façon
identique** tant que ces fichiers restent hors Git — à vérifier séparément si un clone frais est
un jour nécessaire.

## R6 — Aucun push effectué (rappel, conforme au prompt maître)

Les 6 commits de ce bloc existent uniquement en local. Le remote `origin` reste à son état
d'avant ce bloc. Voir la section Phase 12 de `VALIDATED_WORKTREE_PRESERVATION_REPORT.md`.

## Mise à jour 2026-07-25 (bloc Clean Head Reproducibility and Legacy Worktree Triage Closure)

**R2 confirmé et corrigé** : le bloc suivant a prouvé, par matérialisation stricte depuis les
blobs Git, que le HEAD de ce bloc (`da6d80226562...`) ne compilait en réalité PAS seul — 3
dépendances requises par des fichiers déjà committés (Demo/Mobile, Legal Trust) n'existaient que
sur disque. Corrigé par un commit minimal dédié (`64e12d4b...`, voir
`MISSING_HEAD_DEPENDENCY_FORENSIC_MATRIX.md`). Le HEAD est désormais prouvé reproductible de
façon autonome (`CLEAN_HEAD_FINAL_BUILD_PROOF.md`). **R1 (1768 fichiers UNRELATED_PREEXISTING)
reste ouvert et a été affiné** : reclassé en 1783 fichiers (le nombre a légèrement crû avec la
poursuite de la session) répartis en 20 familles et 5 niveaux de priorité, avec un plan de
préservation par famille — voir `LEGACY_WORKTREE_PRESERVATION_PRIORITY.md` et
`LEGACY_WORKTREE_FUTURE_COMMIT_PLAN.md`. ~~**Découverte critique** : la famille `PARTNER_PROGRAM`
(122 fichiers) est classée P0 LOSS_CRITICAL — code déployé en production réelle
(clonestore.pro) sans aucune sauvegarde Git.~~ **CORRIGÉ 2026-07-25** : faux positif — les 225
fichiers Partner Program + CloneStory sont déjà dans le HEAD committé, vérifié blob-par-blob ;
voir `PARTNER_PROGRAM_PRESERVATION_VERDICT.md`.
