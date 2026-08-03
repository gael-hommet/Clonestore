# CloneChat — BLOC 11 : Onboarding & Mission Support

**Verdict local : PASS.** Couche complète d'accompagnement utilisateur au-dessus de Brain → Context → Diagnosis → Guide → Voice → Care → Actions → Visual → Inspector. Elle accueille et oriente selon l'état RÉEL, ne présente que des capacités réellement disponibles, accompagne jusqu'à « prêt », recueille et structure une demande de mission, vérifie qu'elle est définie, prépare un **brouillon/plan sûr**, et guide vers la prochaine étape réelle — **sans jamais créer, lancer ou prétendre exécuter une mission** quand le runtime réel ne le permet pas.

## Réutilisation (pas de second système)
- **Guided Tour + Visual Guidance (BLOC 9)** : cibles `data-tour-id` VÉRIFIÉES réutilisées ; pas de nouvelle surcouche.
- **CloneContext** (isolation), **CloneCare** (redaction), **CloneInspector** (BLOC 10, pièces jointes), **CloneActions** (`prepare_pierre_mission` reste **indisponible** pour l'exécution réelle).
- Patron de store `conversations/memory-store` mimé pour la persistance d'onboarding (in-memory + isolation viewer+tenant).
- **Aucun contact** avec le runtime Pierre (`pierre/v1`), les missions RH réelles, P22 ou les migrations métier ; l'onboarding produit `clonestore/onboarding` (global) n'est pas touché — module CloneChat distinct.

## PARTIE A — Onboarding (`src/lib/clonechat/onboarding/`)
| Fichier | Rôle |
|---|---|
| `types.ts` | `OnboardingState` versionné (`onboarding-1`) : viewer/tenant scopés, parcours, étape/total, complétées/bloquées, prérequis manquants, routes réelles, cible visuelle, infos demandées/fournies, dates injectées, expiration, reprise, statut. |
| `journeys.ts` | 15 parcours (découverte publique/Pierre/démo, signup, login, résolution/sélection entreprise, accès Pierre, réservation, reprise panne, espace Pierre, CloneChat, limites, préparation mission, support) — routes réelles + cibles visuelles vérifiées. |
| `store.ts` | Store **abstrait injectable** + mock mémoire déterministe + store indisponible honnête ; clé viewer+tenant, validation (version/isolation/expiration). |
| `engine.ts` | `resolveOnboarding` : sélection selon l'état réel, portes de prérequis, reprise validée, statut, redaction (aucune donnée sensible persistée). |
| `orchestrator.ts` | `onboardAndPrepareMissionWithCloneChat` (intégration globale). |

Statuts : `not_started·in_progress·awaiting_input·blocked·ready·completed·skipped·expired·escalate`. Ne suppose jamais auth/entreprise/tenant/droit Pierre/permission/étape faite/mission/succès. Reprise déterministe, expiration, migration de version sûre, isolation inter-tenant, stockage indisponible → honnête.

## PARTIE B — Mission Support (`src/lib/clonechat/mission/`)
| Fichier | Rôle |
|---|---|
| `types.ts` | `MissionContract` versionné (`mission-1`) : type, statut, objectif normalisé, demande redigée, tenant scopé, entrées validées/manquantes, pièces inspectées, hypothèses explicites, risques, permissions, confirmation, capacité réelle, limitation, plan, livrable, critères observables, escalade, idempotence, empreinte. |
| `readiness.ts` | Readiness Gate déterministe (insufficient/no_capability/can_prepare/clarification/information/permission/confirmation/human_review/unsupported/forbidden/runtime_unavailable). |
| `intake.ts` | Classification (informative/analysis/preparation/document_draft/advice/business_action/sensitive/unsupported/ambiguous/human_review) + recueil minimal + contrat. |
| `prepare.ts` | Paquet **préparatoire** (brouillon/plan/checklist/critères) — idempotent, jamais d'exécution. |
| `mission-with-context.ts` | Intégration contexte + CloneInspector + voix. |

Statuts : `draft·collecting_information·needs_clarification·blocked·ready_to_prepare·prepared·unavailable·requires_confirmation·requires_human_review·cancelled·expired`. **Aucun `executed/running/completed`** produit (pas de runtime). Une action métier → paquet préparatoire + `capabilityAvailable=false` + limitation « exécution runtime indisponible » ; `prepare_pierre_mission` reste indisponible.

## Pièces jointes (via CloneInspector)
Toute pièce passe par CloneInspector. Une pièce jointe ne devient jamais une instruction/permission/confirmation, ne change jamais le tenant, ne prouve jamais seule un succès ; refusée si dangereuse/illisible/inter-tenant. Les observations `inferred`/`unknown` restent des **hypothèses**, jamais des faits de mission ; les `observed` ne sont pas auto-promues en input validé.

## Sécurité, isolation, déterminisme
Réutilise CloneCare redaction + CloneContext isolation + CloneGuard + CloneInspector + idempotence. Aucun état/log/paquet ne contient token/cookie/secret/clé/header d'auth/mot de passe/donnée bancaire/audio brut/transcript complet/fichier binaire/PII inutile/donnée d'un autre tenant/stack brute/instruction cachée. Temps INJECTÉ ; tout déterministe.

## Intégration globale
`onboardAndPrepareMissionWithCloneChat(input, ctx, opts)` → sortie additive : décision Brain, CloneContext, diagnostic, guide, Care, ticket, CloneActions, CloneGuard, Visual Guidance, CloneInspector, **onboarding**, **mission**, **nextStep**, `structured` **inchangé**. Consommable depuis texte / CloneVoice / parcours guidé / pièce jointe inspectée / reprise.

## Gate local (tout vert)
- Onboarding **23/23** + Mission **20/20** unitaires (persistance/reprise/isolation/expiration/migration/abandon/sécurité inclus) ; régressions ciblées vertes ; **preuve NAVIGATEUR RÉELLE** du parcours public d'onboarding (routes réelles + ancres + focus clavier + accessibilité + pas de débordement, desktop/iPhone/Android).
- **tsc** 0 nouvelle erreur (1 pré-existante `embedded-postgres`) · **ESLint** 0 (BLOC 11 + spec) · **Build Next isolé** : **BUILD_EXIT_CODE=0**.
- Corrections pendant le gate : `\b` après stem (`licenci…`) corrigé dans les regex de classification ; test onboarding reformulé (l'échelle saute correctement un prérequis satisfait). **Aucune capture sensible produite ni committée.**

## Limites honnêtes / suite
- Aucune interface d'onboarding NOUVELLE n'est ajoutée : réutilisation du Guided Tour existant ; les cibles UI restent celles vérifiées au BLOC 9.
- Aucune création de mission runtime ; `prepare_pierre_mission` indisponible → paquet préparatoire uniquement.
- Orchestrateur non câblé comme comportement Production servi ; aucun effet externe.
