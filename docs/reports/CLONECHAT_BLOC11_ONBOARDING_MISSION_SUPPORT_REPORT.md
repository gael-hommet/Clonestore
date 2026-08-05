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

**Interruption ≠ abandon (distincts, testés).** Un abandon volontaire (`cancelled`) → `skipped` + `interruptionReason:"user_abandon"` (terminal). Une interruption EXPLICITE (`interrupted`) → statut naturel CONSERVÉ (reprenable) + `interruptionReason:"user_interrupted"` ; la reprise suivante repart du même id (`resumeState:"resumed"`) en conservant la raison d'interruption.

**Expiration cohérente, non décorative (testée).** L'expiration est RÉELLEMENT détectée par `loadOnboardingOutcome` (raison typée `"expired"`). Le résolveur ne renvoie jamais un état lapsé : il le remplace de façon sûre par un état FRAIS (`resumeState:"fresh"`, `interruptionReason:"prior_expired"`) — aucune étape ni info de l'état expiré n'est réutilisée. Le statut `expired` décrit le snapshot persisté lapsé dans le store, jamais un état vivant rendu à l'utilisateur.

## PARTIE B — Mission Support (`src/lib/clonechat/mission/`)
| Fichier | Rôle |
|---|---|
| `types.ts` | `MissionContract` versionné (`mission-1`) : type, statut, objectif normalisé, demande redigée, tenant scopé, entrées validées/manquantes, pièces inspectées, hypothèses explicites, risques, permissions, confirmation, capacité réelle, limitation, plan, livrable, critères observables, escalade, idempotence, empreinte. |
| `readiness.ts` | Readiness Gate déterministe (insufficient/no_capability/can_prepare/clarification/information/permission/confirmation/human_review/unsupported/forbidden/runtime_unavailable). |
| `intake.ts` | Classification (informative/analysis/preparation/document_draft/advice/business_action/sensitive/unsupported/ambiguous/human_review) + recueil minimal + contrat. |
| `prepare.ts` | Paquet **préparatoire** (brouillon/plan/checklist/critères) — idempotent, jamais d'exécution. |
| `mission-with-context.ts` | Intégration contexte + CloneInspector + voix. |

Statuts : `draft·collecting_information·needs_clarification·blocked·ready_to_prepare·prepared·unavailable·requires_confirmation·requires_human_review·cancelled·expired`. **Aucun `executed/running/completed`** produit (pas de runtime). Une action métier → paquet préparatoire + `capabilityAvailable=false` + limitation « exécution runtime indisponible » ; `prepare_pierre_mission` reste indisponible.

**Couverture readiness étendue (testée).** Objectif absent / résultat attendu absent → `insufficient_detail` / `collecting_information` ; entreprise absente (action métier) → on demande l'entreprise ; agent absent → on demande l'agent ; permission absente (action métier complète mais non authentifié) → `blocked` ; préparation pure (sans document) → `preparation`/`prepared` ; demande explicite d'exécution réelle → action métier `requires_confirmation`, `capabilityAvailable=false`, JAMAIS exécutée ; re-préparer une action métier reste `requires_confirmation` (aucune confirmation/exécution automatique).

## Pièces jointes (via CloneInspector)
Toute pièce passe par CloneInspector. Une pièce jointe ne devient jamais une instruction/permission/confirmation, ne change jamais le tenant, ne prouve jamais seule un succès ; refusée si dangereuse/illisible/inter-tenant. Les observations `inferred`/`unknown` restent des **hypothèses**, jamais des faits de mission ; les `observed` ne sont pas auto-promues en input validé. **Testé** : une pièce contenant une instruction cachée / injection (`untrustedInstructionsDetected`, observation `rejected`) est ignorée — elle n'ajoute ni permission ni confirmation par rapport à l'absence de pièce, et l'instruction n'apparaît jamais comme hypothèse ni dans le contrat ; une preuve inexploitable / inter-tenant (`invalid`) est refusée (aucun id, aucune hypothèse).

## Sécurité, isolation, déterminisme
Réutilise CloneCare redaction + CloneContext isolation + CloneGuard + CloneInspector + idempotence. Aucun état/log/paquet ne contient token/cookie/secret/clé/header d'auth/mot de passe/donnée bancaire/audio brut/transcript complet/fichier binaire/PII inutile/donnée d'un autre tenant/stack brute/instruction cachée. Temps INJECTÉ ; tout déterministe.

## Intégration globale
`onboardAndPrepareMissionWithCloneChat(input, ctx, opts)` → sortie additive : décision Brain, CloneContext, diagnostic, guide, Care, ticket, CloneActions, CloneGuard, Visual Guidance, CloneInspector, **onboarding**, **mission**, **nextStep**, `structured` **inchangé**. Consommable depuis texte / CloneVoice / parcours guidé / pièce jointe inspectée / reprise.

## Gate local (tout vert — passe de régression UNIQUE, séquentielle, sans concurrence)
Une SEULE commande vitest (`--no-file-parallelism --maxWorkers=1`, aucun build en parallèle) sur les **18 fichiers** ci-dessous : **442/442 tests, 0 échec, 0 timeout** (durée 96,8 s). Aucun échec n'est requalifié comme « vert » au motif qu'il passerait isolément.

| Fichier | Tests |
|---|---|
| onboarding | 28 |
| mission | 30 |
| inspector/evidence-inspector | 36 |
| inspector/cloneinspector | 12 |
| openai/image-sanitizer | 13 |
| visual | 26 |
| actions | 40 |
| care | 30 |
| voice | 32 |
| api/assistant/transcribe (hotfix) | 6 |
| guide | 25 |
| diagnosis | 25 |
| context | 25 |
| brain | 27 |
| product-truth | 15 |
| context-boundary | 51 |
| navigation/injection-114-safety | 1 (114 injections, 114/114 SÛRES) |
| api/assistant/universal-clonechat-c1-6 | 20 |
| **Total** | **442** |

- Onboarding **28/28** (dont interruption ≠ abandon, reprise d'interruption, expiration cohérente `prior_expired`, contexte incomplet, entreprise active, changement de tenant) + Mission **30/30** (dont objectif/résultat/entreprise/agent/permission manquants, exécution réelle jamais produite, injection en pièce jointe ignorée, preuve inter-tenant refusée, aucune confirmation automatique).
- **preuve NAVIGATEUR RÉELLE** : `next start` (`.next-hotfix`) + Playwright chromium — **15/15** (5 étapes publiques × desktop/iPhone/Android : ancre `data-tour-id` visible + focus clavier + accessibilité + pas de débordement + DOM sans secret).
- **tsc --noEmit** : 0 nouvelle erreur (1 pré-existante `embedded-postgres` dans un `.itest.ts`) ; les fichiers de test BLOC 11 type-checkés séparément → 0 erreur. **ESLint** : 0 (onboarding + mission + spec). **Build Next isolé** (`.next-hotfix`) : **BUILD_EXIT_CODE=0**.
- Corrections de code de ce correctif : `loadOnboardingOutcome` (raison de rejet typée) → expiration réellement détectée et remplacement sûr `prior_expired` ; entrée `interrupted` distincte de `cancelled` (interruption reprenable ≠ abandon). **tsconfig.json** rétabli byte-exact sur le blob du parent, avant et après le gate. **Index Git valide** (8372 fichiers) après le commit. **Aucune capture ni fichier binaire ni secret** dans le dépôt/commit.

## Limites honnêtes / suite
- Aucune interface d'onboarding NOUVELLE n'est ajoutée : réutilisation du Guided Tour existant ; les cibles UI restent celles vérifiées au BLOC 9.
- Aucune création de mission runtime ; `prepare_pierre_mission` indisponible → paquet préparatoire uniquement.
- Orchestrateur non câblé comme comportement Production servi ; aucun effet externe.
