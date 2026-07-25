# Legacy Worktree Future Commit Plan

Plans autonomes pour des blocs de préservation **futurs** — aucun de ces commits n'est créé
dans ce bloc. Ordre recommandé : voir `LEGACY_WORKTREE_PRESERVATION_PRIORITY.md`.

## ~~PARTNER_PROGRAM_PRESERVATION_CLOSURE (P0 — en premier)~~ — CLOS 2026-07-25, FAUX POSITIF

Ce plan supposait que les 122 fichiers `PARTNER_PROGRAM` n'étaient dans Git nulle part. Le bloc
`PARTNER PROGRAM PRESERVATION CLOSURE` (2026-07-25) a vérifié octet-par-octet depuis les blobs
Git : les 225 fichiers Partner Program + CloneStory sont déjà dans le HEAD committé (commits du
2026-07-11). Sur les 153 fichiers signalés `*modified`, 152 n'étaient que du bruit CRLF vs LF
(0 impact fonctionnel) ; 1 seul avait une vraie différence de contenu, une phrase de doc
(`docs/clonestory/BLOC_2_INSCRIPTIONS.md`), corrigée par un commit dédié. Aucun risque de perte
réel — rien à préserver au sens de ce plan. Voir `PARTNER_PROGRAM_PRESERVATION_VERDICT.md`.

## P17_PRESERVATION_CLOSURE

- **Périmètre** : 8 fichiers `P17_PIERRE_PRIME`.
- **Allowlist** : à établir depuis `P17_PIERRE_PRIME_CLOSURE_REPORT.md` (déjà présent, non
  commité) et son propre inventaire de fichiers.
- **Tests requis** : suite P17 (399/399 selon mémoire) à ré-exécuter.
- **Secrets** : aucun connu (module produit interne).
- **Ordre** : après `PARTNER_PROGRAM`, avant `P18`.
- **Dépendances** : `P9X_P16_HR_CORE` (socle canonique).
- **Risque** : Moyen — verdict GREEN déjà documenté, principal risque = perte silencieuse.
- **Commit attendu** : `fix(pierre-prime): preserve P17 GREEN closure in git`.

## P18_GEO_PACKS_PRESERVATION_CLOSURE

- **Périmètre** : 10 fichiers `P18_GEO_PACKS` (`src/lib/geo/**`).
- **Allowlist** : depuis `P18_GEO_PACKS_CLOSURE_REPORT.md`.
- **Tests requis** : suite geo (45/45 selon mémoire) + non-régression associée.
- **Secrets** : aucun connu.
- **Ordre** : après `P17`, avant `P19`.
- **Dépendances** : `P9X_P16_HR_CORE`, tarification pays (déjà committée via Payment Path — à
  vérifier qu'aucun conflit n'existe entre les deux).
- **Risque** : Moyen — attention à ne pas dupliquer le travail déjà committé dans Payment Path.
- **Commit attendu** : `fix(geo): preserve P18 GREEN closure in git`.

## P19_TECHNOLOGIES_PRESERVATION_CLOSURE

- **Périmètre** : 25 + 9 fichiers (`P19_TECHNOLOGIES_PRIME` + `CLONESTORE_TECHNOLOGIES`).
- **Allowlist** : depuis `P19_TECHNOLOGIES_PRIME_CLOSURE_REPORT.md`.
- **Tests requis** : suite P16E (25/25 selon mémoire) + tests technologies dédiés.
- **Secrets** : aucun connu.
- **Ordre** : après `P18`.
- **Dépendances** : `P9X_P16_HR_CORE`, `P17`, `P18`.
- **Risque** : Moyen.
- **Commit attendu** : `fix(technologies): preserve P19 GREEN closure in git`.

## P9_P16_HR_FOUNDATION_PRESERVATION_CLOSURE

- **Périmètre** : 17 fichiers `P9X_P16_HR_CORE` — **socle canonique dont dépendent P17/P18/P19**.
- **Allowlist** : à établir avec un soin particulier — c'est la fondation de toute la chaîne de
  dépendance des autres blocs de préservation ci-dessus.
- **Tests requis** : P8.9 (100k tenants), P8.13 (certification fonctionnelle 215/215).
- **Secrets** : aucun connu.
- **Ordre** : **avant** P17/P18/P19 dans l'exécution réelle malgré son numéro de bloc historique
  antérieur (P9 < P17) — c'est une dépendance transitive de tous les blocs suivants, donc à
  committer en premier parmi les P1 non-P0.
- **Dépendances** : aucune vers les blocs de préservation listés ici (base de la chaîne).
- **Risque** : Élevé — perte = casse potentielle de P17/P18/P19 s'ils sont committés avant leur
  propre fondation.
- **Commit attendu** : `fix(hr-core): preserve P9-P16 HR foundation in git`.

## GO_LIVE_GATES_PRESERVATION_CLOSURE

- **Périmètre** : 48 fichiers `GO_LIVE` (`production/p11-*.ts`, `p15-*.ts`, dashboards de
  readiness).
- **Allowlist** : vérifier en particulier que `PRODUCTION_AUTHORIZED = false as const` (déjà
  committé, hors de ce périmètre) n'est touché par aucun de ces 48 fichiers avant intégration.
- **Tests requis** : gates P11/P15 (A-G).
- **Secrets** : aucun connu — mais **gate obligatoire** : confirmer qu'aucun de ces fichiers ne
  fait basculer `PRODUCTION_AUTHORIZED` ou n'introduit un chemin de contournement.
- **Ordre** : après le socle HR.
- **Dépendances** : `P9X_P16_HR_CORE`.
- **Risque** : Élevé — surface de sécurité production.
- **Commit attendu** : `fix(go-live): preserve production readiness gates in git`.

## E1_EXTERNAL_ENABLEMENT_PRESERVATION_CLOSURE

- **Périmètre** : 43 fichiers `E1_EXTERNAL_ENABLEMENT`.
- **Allowlist** : depuis les rapports E1.1/E1.2/E1.3 déjà présents.
- **Tests requis** : E1 (150/150 selon mémoire E1.3).
- **Secrets** : **Attention élevée** — ce chantier touche des accès Supabase production réels
  (E1.2 : preflight lecture seule PG17 Supabase) ; vérifier qu'aucune chaîne de connexion réelle
  n'a fuité dans un fichier de preuve.
- **Ordre** : après le socle HR, peut être parallèle à `GO_LIVE`.
- **Dépendances** : `P9X_P16_HR_CORE`.
- **Risque** : Élevé (accès externes réels documentés).
- **Commit attendu** : `fix(e1): preserve external enablement preflight tooling in git`.

## CLONECHAT_PRESERVATION_CLOSURE

- **Périmètre** : 42 fichiers `C1_CLONECHAT`.
- **Allowlist** : depuis C1.8/C1.9 closure reports.
- **Tests requis** : suite CloneChat (922 selon mémoire C1.8).
- **Secrets** : vérifier absence de clés OpenAI/Anthropic réelles dans les fichiers de preuve.
- **Ordre** : après le socle HR.
- **Dépendances** : `P9X_P16_HR_CORE`.
- **Risque** : Élevé — produit actif avec un historique de « CloneChat muet en prod » déjà
  documenté (mémoire : cause = tables P9.4.1 absentes en prod + catch silencieux) ; ce chantier
  de préservation devra explicitement vérifier que le correctif de ce défaut n'est pas perdu.
- **Commit attendu** : `fix(clonechat): preserve C1.8/C1.9 closure work in git`.

## DATABASE_MIGRATION_PRESERVATION_CLOSURE

- **Périmètre** : 2 fichiers `MIGRATIONS_DATABASE`.
- **Allowlist** : les 2 fichiers exacts, après vérification qu'ils ne sont pas déjà appliqués en
  base (voir mémoire E1.2 : P9.4.1 NOT_APPLIED vs partner payout FULLY_APPLIED — statut à
  reconfirmer avant tout commit, une migration déjà appliquée en prod doit rester traçable même
  si son fichier source est enfin commité).
- **Tests requis** : aucun test automatisé de migration connu — vérification manuelle du SQL.
- **Secrets** : vérifier absence de chaîne de connexion réelle.
- **Ordre** : dès que possible (risque de divergence schéma/code).
- **Dépendances** : aucune.
- **Risque** : Élevé — irréversible si perdu (SQL non regénérable de mémoire).
- **Commit attendu** : `fix(database): preserve pending migration files in git`.

## Blocs P2+ (hors périmètre de planification détaillée de ce bloc)

`PIERRE_ENGINE_CORE_PRESERVATION_CLOSURE` (344 fichiers), une subdivision future de
`CORE_APPLICATION` (736 fichiers, trop hétérogène pour un seul plan), `PWA_PRESERVATION_CLOSURE`
(17), `CLONESTORY_PRESERVATION_CLOSURE` (25) — nécessitent chacun leur propre inventaire détaillé
avant qu'un plan de commit fiable puisse être écrit ; prématuré de le faire dans ce bloc sans
audit dédié. `DOCUMENTATION_ARCHIVE_PRESERVATION_CLOSURE` (193, P3) et
`FOUNDATION_CONFIG_PRESERVATION_CLOSURE` (117, P3) peuvent suivre un format documentaire simple
similaire au Commit 5 du bloc précédent, sans gate de sécurité complexe.
