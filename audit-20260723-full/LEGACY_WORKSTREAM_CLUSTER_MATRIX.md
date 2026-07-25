# Legacy Workstream Cluster Matrix

Regroupement des **1783 fichiers non commités** restants (hors les 47+10=57 fichiers désormais
committés dans les 6 blocs de ce bloc et du précédent, hors 4 `LOCAL_ENVIRONMENT`, hors 7
`TEMPORARY`) en 20 familles réelles. Méthode : préfixes de répertoire + mots-clés de nom de
fichier + recoupement avec la mémoire de session (verdicts de blocs antérieurs déjà connus :
P17/P18/P19 GREEN, E1.2 VERIFIED, Partner Program DEPLOYED, etc.) — pas seulement le nom du
fichier isolément.

| Famille | Fichiers | Code | Tests | Docs | Validée ? | Risque | Bloc de préservation proposé |
|---|---|---|---|---|---|---|---|
| `PIERRE_RUNTIME_CORE` | 344 | Oui (majorité) | Oui | Non | **Partiellement** — sous-ensembles validés par des blocs P8.x/P9.x antérieurs (mémoire), mais aucune ré-vérification dans CE bloc | Élevé — cœur du moteur RH, la plus grande masse de code non commité | `PIERRE_ENGINE_CORE_PRESERVATION_CLOSURE` (nouveau, à créer) |
| `CORE_APPLICATION` | 736 | Oui (majorité) | Oui (mêlé) | Non | **Non vérifiée dans ce bloc** — trop hétérogène (checkout adjacents, cloneos, auth, billing, site-health, observabilité, etc.) | Moyen à élevé — fonctionnalités actives potentiellement utilisées en pratique | À subdiviser lors d'un futur audit dédié (hors périmètre de nommage de ce bloc — trop large pour un seul plan) |
| `DOCS` | 175 | Non | Non | Oui | N/A (documentation) | Faible | `DOCUMENTATION_ARCHIVE_PRESERVATION_CLOSURE` |
| ~~`PARTNER_PROGRAM`~~ | ~~122~~ 0 réel | Non — déjà committé (vérifié blob-par-blob 2026-07-25) | Oui | Oui (mêlé) | **Faux positif corrigé** — les 225 fichiers Partner Program + CloneStory sont déjà dans le HEAD (commits 2026-07-11) ; 152/153 `*modified` = CRLF seul, 1 vraie diff (doc, corrigée) | Faible — aucune perte réelle, voir `PARTNER_PROGRAM_PRESERVATION_VERDICT.md` | ~~`PARTNER_PROGRAM_PRESERVATION_CLOSURE`~~ CLOS |
| `SCRIPTS` | 105 | Oui (utilitaires) | Non (généralement) | Non | N/A | Faible à moyen | `FOUNDATION_CONFIG_PRESERVATION_CLOSURE` (scripts d'exploitation) |
| `GO_LIVE` | 48 | Oui | Oui | Oui (mêlé) | **Oui** — mémoire : P11/P15 gates définis, `production/p11-*.ts`/`p15-*.ts`, `PRODUCTION_AUTHORIZED` hard floor déjà vérifié | Élevé — gate de sécurité production | `GO_LIVE_GATES_PRESERVATION_CLOSURE` |
| `E1_EXTERNAL_ENABLEMENT` | 43 | Oui | Oui | Oui (mêlé) | **Oui** — mémoire : E1.2 VERIFIED (preflight lecture seule réel), E1.1 BLOCKED (mesure volatile refusée) | Moyen — dépend d'accès externes (Supabase prod, Stripe) | `E1_EXTERNAL_ENABLEMENT_PRESERVATION_CLOSURE` |
| `C1_CLONECHAT` | 42 | Oui | Oui | Oui (mêlé) | **Oui, majoritairement** — mémoire : C1.8 GREEN (torture gate), C1.9 fondation prouvée | Élevé — produit CloneChat actif, risque de perte d'une fermeture GREEN documentée | `CLONECHAT_PRESERVATION_CLOSURE` |
| `CLONESTORY` | 25 | Oui | Oui | Oui | **Partiellement** — mémoire : univers séparé, migrations _05–_08 NON appliquées (flag-gated fail-closed) | Moyen — fail-closed par construction, risque limité si perdu | `CLONESTORY_PRESERVATION_CLOSURE` |
| `P19_TECHNOLOGIES_PRIME` | 25 | Oui | Oui | Oui | **Oui** — mémoire : « GREEN / TECHNOLOGIES PRIME READY FOR RELEASE GATE », build isolé 196/196 | Élevé — verdict GREEN documenté, perte = régression silencieuse d'un résultat déjà prouvé | `P19_TECHNOLOGIES_PRESERVATION_CLOSURE` |
| `AUDIT_DOCUMENTATION_LIVE` | 18 | Non | Non | Oui | N/A | Faible | Inclus dans un futur commit documentaire (comme le Commit 5 du bloc précédent) |
| `P9X_P16_HR_CORE` | 17 | Oui | Oui | Oui | **Oui, majoritairement** — mémoire : P8.9-P8.14 VERIFIED/CERTIFIED, P16A/P16C/P16E fermés | Élevé — socle HR canonique, base de tout le moteur Pierre | `P9_P16_HR_FOUNDATION_PRESERVATION_CLOSURE` |
| `PWA` | 17 | Oui | Non identifié | Oui | **Non vérifiée dans ce bloc** | Faible à moyen | `PWA_PRESERVATION_CLOSURE` |
| `P18_GEO_PACKS` | 10 | Oui | Oui | Oui | **Oui** — mémoire : « GREEN / FOUR GEO PACKS READY », re-vérifié 16/07 | Élevé — verdict GREEN documenté | `P18_GEO_PRESERVATION_CLOSURE` |
| `CLONESTORE_TECHNOLOGIES` | 9 | Oui | Oui | Non | Lié à `P19_TECHNOLOGIES_PRIME` | Moyen | Fusionner avec `P19_TECHNOLOGIES_PRESERVATION_CLOSURE` |
| `P17_PIERRE_PRIME` | 8 | Oui | Oui | Oui | **Oui** — mémoire : « GREEN / PIERRE PRIME READY FOR GEO PACKS » | Élevé — verdict GREEN documenté | `P17_PRESERVATION_CLOSURE` |
| `TOOLING_CONFIGURATION` | 12 | Config | N/A | N/A | N/A | **Élevé si perdu silencieusement** — `package.json`/`tsconfig.json`/`next.config.ts` etc., déjà analysés en Phase 4 (dérive cosmétique uniquement pour les 5 blocs validés, mais le contenu complet n'a pas été audité ligne à ligne pour d'AUTRES changements potentiels) | `FOUNDATION_CONFIG_PRESERVATION_CLOSURE` |
| `EXPORTS_ARCHIVES` | 12 | Non | Non | Logs/exports | N/A — probablement obsolète | Faible | `DUPLICATE_OR_OBSOLETE` — candidat à un nettoyage, pas une préservation |
| `E2E` | 7 | Non | Oui (Playwright) | Non | Non vérifiée dans ce bloc | Faible à moyen | Inclus dans le bloc du produit testé (pas une famille autonome) |
| `ROOT_UTILITY_SCRIPTS` | 6 | Scripts ponctuels | Non | Non | Non | Faible — scripts de diagnostic ponctuels (`test-brain.js`, `send-email.mjs`, etc.) | `DUPLICATE_OR_OBSOLETE` — probablement des scripts de débogage superflus |
| `MIGRATIONS_DATABASE` | 2 | SQL | N/A | Non | Non vérifiée dans ce bloc | **Élevé** — toute migration non commitée est un risque de divergence schéma/code | `DATABASE_MIGRATION_PRESERVATION_CLOSURE` |

**Total : 1783 fichiers classés en 20 familles, 0 restant sans famille.**

Méthodologie détaillée, limites, et liste brute complète (1 ligne par fichier, famille +
chemin + statut) : voir
`CLONESTORE_AUDIT_EVIDENCE/clean-head-reproducibility/09_legacy_classified_full.tsv`.
