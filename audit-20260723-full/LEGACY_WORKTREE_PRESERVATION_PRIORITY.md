# Legacy Worktree Preservation Priority

## P0 — LOSS_CRITICAL

Fonctionnalité active utilisée par le HEAD ou la production, mais non commitée.

| Famille | Justification |
|---|---|
| ~~`PARTNER_PROGRAM` (122 fichiers)~~ | **CORRIGÉ 2026-07-25 (bloc PARTNER PROGRAM PRESERVATION CLOSURE) — FAUX POSITIF.** La justification P0 ci-dessus reposait sur `git status = *modified`, jamais vérifiée octet-par-octet à l'époque. Vérification blob-par-blob : les 225 fichiers du Partner Program + CloneStory sont **déjà tous dans le HEAD committé** (commits du 2026-07-11). 152/153 fichiers `*modified` ne différaient que par les fins de ligne (CRLF disque vs LF committé) ; 1 seul avait une vraie différence de contenu (une phrase de doc, corrigée). **Aucun risque de perte réel ; retiré de P0.** Voir `PARTNER_PROGRAM_PRESERVATION_VERDICT.md`. |

## P1 — VALIDATED_UNPRESERVED

Le rapport et les tests indiquent une fermeture validée, mais aucun commit ne la conserve.

| Famille | Justification (verdict déjà documenté, mémoire de session) |
|---|---|
| `P17_PIERRE_PRIME` (8) | « GREEN / PIERRE PRIME READY FOR GEO PACKS », build 192/192 |
| `P18_GEO_PACKS` (10) | « GREEN / FOUR GEO PACKS READY », re-vérifié 16/07 |
| `P19_TECHNOLOGIES_PRIME` (25) + `CLONESTORE_TECHNOLOGIES` (9) | « GREEN / TECHNOLOGIES PRIME READY FOR RELEASE GATE », build isolé 196/196 |
| `P9X_P16_HR_CORE` (17) | P8.9-P8.14 VERIFIED/CERTIFIED (100k tenants, canon HR, cognitive runtime) |
| `GO_LIVE` (48) | Gates P11/P15 définis et testés, hard floor `PRODUCTION_AUTHORIZED` déjà vérifié |
| `E1_EXTERNAL_ENABLEMENT` (43) | E1.2 VERIFIED (preflight réel), E1.3 préparé (gate backup) |
| `C1_CLONECHAT` (42) | C1.8 GREEN (torture gate), C1.9 fondation prouvée |
| `MIGRATIONS_DATABASE` (2) | Élevé indépendamment du verdict — toute migration SQL non commitée est un risque de divergence schéma/code irréversible si perdue |
| **Sous-total P1** | **204 fichiers** |

## P2 — ACTIVE_UNVALIDATED

Fonctionnalité active mais non prouvée (dans ce bloc).

| Famille | Justification |
|---|---|
| `PIERRE_RUNTIME_CORE` (344) | Cœur du moteur — actif, mais non re-vérifié spécifiquement dans ce bloc de reproductibilité |
| `CORE_APPLICATION` (736) | Bloc le plus large et le plus hétérogène — nécessite une subdivision future avant toute action |
| `PWA` (17) | Non vérifiée dans ce bloc |
| `CLONESTORY` (25) | Fail-closed par construction (flag désactivé), risque réel plus faible malgré son ampleur |
| **Sous-total P2** | **1122 fichiers** |

## P3 — HISTORICAL_OR_DOCUMENTARY

Rapports, preuves, ou anciennes phases sans nécessité runtime immédiate.

| Famille | Justification |
|---|---|
| `DOCS` (175) | Documentation projet |
| `AUDIT_DOCUMENTATION_LIVE` (18) | Preuves d'audit déjà dupliquées en substance dans `audit-20260723-full/` committé |
| `E2E` (7) | Tests Playwright, non exécutés en CI actuellement |
| `SCRIPTS` (105) | Utilitaires d'exploitation, généralement régénérables |
| `TOOLING_CONFIGURATION` (12) | Déjà analysée en Phase 4 — dérive cosmétique connue et sans impact sur les 5 blocs validés |
| **Sous-total P3** | **317 fichiers** |

## P4 — TEMPORARY_OR_OBSOLETE

Artefacts, scripts de diagnostic, ou duplications.

| Famille | Justification |
|---|---|
| `EXPORTS_ARCHIVES` (12) | Logs/exports historiques, probablement obsolètes |
| `ROOT_UTILITY_SCRIPTS` (6) | Scripts de débogage ponctuels (`test-brain.js`, `send-email.mjs`, etc.) |
| **Sous-total P4** | **18 fichiers** |

## Récapitulatif

| Priorité | Fichiers | % du reliquat |
|---|---|---|
| P0 | 122 | 6,8% |
| P1 | 204 | 11,4% |
| P2 | 1122 | 62,9% |
| P3 | 317 | 17,8% |
| P4 | 18 | 1,0% |
| **Total** | **1783** (+4 LOCAL_ENVIRONMENT +7 TEMPORARY, hors classement de priorité) | 100% |

## Ordre de traitement recommandé pour les blocs de préservation futurs

1. ~~`PARTNER_PROGRAM_PRESERVATION_CLOSURE` (P0, en premier, sans exception).~~ **RETIRÉ
   2026-07-25** — faux positif clos, voir tableau P0 ci-dessus et
   `PARTNER_PROGRAM_PRESERVATION_VERDICT.md`. La famille est déjà committée ; le seul correctif
   réel (1 phrase de doc) a été traité dans ce même bloc.
2. Les 9 blocs P1 (`P17`, `P18`, `P19`+`CLONESTORE_TECHNOLOGIES`, `P9_P16_HR_FOUNDATION`,
   `GO_LIVE_GATES`, `E1_EXTERNAL_ENABLEMENT`, `CLONECHAT`, `DATABASE_MIGRATION`) — ordre
   interne libre, désormais la priorité la plus haute restante, tous à traiter avant les P2.
3. P2 (`PIERRE_ENGINE_CORE`, puis une subdivision dédiée de `CORE_APPLICATION`, puis `PWA`,
   `CLONESTORY`).
4. P3/P4 en dernier — risque de perte faible, traitement quand les ressources le permettent.
