# CloneChat — BLOC 12 : CloneAnalytics & Observability

**Verdict local : PASS.** Couche d'analytics, de mesure de qualité et d'observabilité au-dessus du pipeline complet (Brain → CloneContext → Diagnosis → CloneGuide → CloneVoice → CloneCare → CloneActions → Visual Guidance → CloneInspector → Onboarding → Mission Support). Elle **observe** ; elle ne devient **jamais** une autorité métier : ne modifie aucune décision/diagnostic, ne contourne pas CloneGuard, n'accorde aucune permission, ne change aucun tenant, ne confirme/n'exécute aucune action, ne casse jamais la réponse si le sink tombe, ne transforme jamais une absence de donnée en succès, ne prétend jamais qu'un événement a été envoyé s'il ne l'a pas été.

- **Lignée** : `563283a4` (BLOC 12 initial, parent `c5e124b4`) → `163212e0` (correctif **#1** — sémantique honnête : partial/no-op/version/sampling/id-privacy) → **ce commit correctif #2** — `fix(clonechat): enforce valid analytics delivery accounting`.
- **SHA parent** (de ce correctif #2) : `163212e07bebe69994330216534b13c4db7d710c`.
- **SHA final** : le commit correctif #2 (un commit ne peut pas contenir son propre SHA ; il est livré dans le verdict final et devient `origin/main` après `git push`).
- **Objet du correctif #2** : supprimer le dernier bug d'honnêteté des **comptes de livraison**. `createPartialSink()` produisait des comptes impossibles pour un lot d'un événement (`delivered 1 / failed 1` avec `batch.length 1`). Invariant désormais garanti partout : `delivered ≥ 0`, `failed ≥ 0`, `delivered + failed === batch.length`, chacun `≤ batch.length` — imposé **et** revalidé défensivement par le collecteur.
- **Aucun provider externe Production activé.** Sink par défaut = **no-op NON capable** (aucune destination ⇒ statut `disabled`, jamais un faux envoi). Rien n'est déployé, rien n'est câblé dans `/api/assistant/chat`.

## Réutilisation (pas de second système)
- **CloneTrace** (`actions/trace.ts`) + hash FNV (`actions/keys.ts` `truthVersionHash`) réutilisés pour la corrélation et les identifiants ; **CloneCare** `redactText` réutilisé pour la redaction ; clés viewer/tenant SÛRES réutilisées puis **pseudonymisées**.
- Le module généraliste `src/lib/observability/` (domaine Pierre B43) n'est **pas** touché : CloneAnalytics est un module CloneChat distinct `src/lib/clonechat/analytics/`, sans collision de noms.
- Aucun runtime Pierre (`pierre/v1`), aucune mission RH réelle, P22, migration, paiement, Vercel Production ni provider analytics externe touché.

## Fichiers (`src/lib/clonechat/analytics/`)
| Fichier | Rôle |
|---|---|
| `types.ts` | Types versionnés (`analytics-1`) : étapes pipeline, catégories, nature (operational/product/security/quality), base de collecte, résultats SÛRS (aucun `running`/`paid`/`success` représentable), enveloppe, spec d'événement, sink, snapshots d'agrégat/santé. |
| `registry.ts` | Registre CANONIQUE (**53 événements**) : id/version/catégorie/étape/nature/base/sensibilité/méta requise+allowlist/résultats possibles/échantillonnage/déduplication/rétention/provenance/métriques alimentées. Un événement n'existe que s'il correspond à une étape/un résultat réel. Politique d'échantillonnage EXPLICITE par événement (`always` pour tout opérationnel/sécurité ; `rate:1` pour les événements produit Care, sous-échantillonnables via sampler injectable). |
| `privacy.ts` | Minimisation déterministe : allowlist stricte, rejet des clés inconnues/interdites, redaction récursive, bornes taille/profondeur ; pseudonymiseur injectable (viewer **tenant-scopé** ⇒ distinct entre tenants). |
| `envelope.ts` | Construction + **validation STRICTE** de l'enveloppe (événement connu, résultat possible, preuve observable si requise, route réelle, méta minimisée, taille bornée). Temps/identifiants INJECTÉS. |
| `sink.ts` | Sinks abstraits injectables : mémoire (tests), no-op (défaut sûr), failing/timeout/partial (tests). Un sink ne lève jamais et ne renvoie **jamais** des comptes impossibles : `createPartialSink()` renvoie `ok 0/0` (lot vide), `failed 0/1` (lot d'un événement, indivisible) et `partial floor(n/2)/reste` (lot ≥ 2) ; le no-op déclare honnêtement `failed 0/n` s'il était appelé. |
| `collector.ts` | Émetteur : validation → **(sink capable ?)** → consentement → échantillonnage → déduplication → buffer borné (backpressure, priorité opérationnel/sécurité) → sink (retry BORNÉ). **Validation défensive `isValidSinkResult`** : le collecteur ne fait jamais confiance aux comptes du sink (entiers finis ≥ 0, somme === taille du lot, cohérence statut/comptes) ; un résultat incohérent est requalifié en `failed` (`invalid_sink_result`). Résultat HONNÊTE (`accepted/buffered/partial/duplicate/sampled_out/disabled/rejected/failed`) avec des **comptes de livraison** valides ; **jamais de faux succès**. |
| `aggregate.ts` | Agrégateur read-only (snapshots gelés) + santé. Tenant-scopé, division par zéro → null, jamais de classement/score individuel. |
| `instrument.ts` | Dérivation DÉTERMINISTE des événements depuis un résultat de pipeline (ordre stable), sans lire message/réponse/transcript/pièce jointe. |
| `observe-with-context.ts` | Adaptateur global `onboardPrepareMissionAndObserveWithCloneChat()` — additif ; résultat fonctionnel INCHANGÉ ; panne analytics absorbée. |

Ajustement additif BLOC 11 : `onboarding/orchestrator.ts` transmet désormais l'interruption explicite (`interruptedOnboarding`) au moteur (le moteur la supportait déjà).

## Comptes de livraison VALIDES (correctif #2 — cœur de cette fermeture)
`EmitResult` porte désormais **`delivered` / `failed`**, avec un contrat clair, typé et documenté — **jamais des nombres impossibles**, jamais une prétention de livraison sans livraison réelle :

| Statut | delivered / failed (mode immédiat) | Signification |
|---|---|---|
| `accepted` | **1 / 0** | sink CAPABLE, livraison COMPLÈTE |
| `failed` | **0 / 1** | pas de livraison complète (un `partial` sur un lot d'1 y est **normalisé**) |
| `partial` | *(mode manuel, lot ≥ 2 uniquement)* | vraie livraison partielle, `0 < delivered`, `0 < failed`, `delivered + failed === batch.length` |
| `buffered` / `disabled` / `sampled_out` / `duplicate` / `rejected` | **null / null** | livraison NON tentée ⇒ aucun compte inventé |

- **Un lot d'un seul événement est indivisible** : en mode immédiat (qui envoie exactement `[env]`), il n'existe que deux issues honnêtes — `accepted` (1/0) ou `failed` (0/1). Un `partial` annoncé par un sink sur un lot d'un événement (p. ex. l'ancien `delivered 1 / failed 1` avec `batch.length 1`) est **impossible** : il est rejeté par la validation défensive puis **normalisé en `failed`** (`invalid_sink_result`). Une vraie livraison `partial` (`1/1`, `batch.length 2`) n'est atteignable qu'en **mode manuel** sur un lot **≥ 2** via `flush()`.
- **Validation défensive `isValidSinkResult`** (le collecteur ne fait jamais confiance au sink) : `delivered`/`failed` **entiers**, **finis**, **≥ 0**, chacun **≤ batch.length**, **somme === batch.length** ; `ok` ⇒ livraison complète ; `failed`/`timeout` ⇒ aucune livraison complète ; `partial` ⇒ `0 < delivered < batch.length` **et** `0 < failed < batch.length`. Tout résultat incohérent (décimal, négatif, non fini, somme ≠ lot, `ok` avec `failed>0`, `partial` à `delivered===0` ou `failed===0`) est **requalifié en `failed` (`invalid_sink_result`)** — aucune exception ne remonte à CloneChat, aucun faux succès.
- **No-op** : un sink `capable:false` (défaut quand aucun sink n'est configuré) court-circuite en **`disabled` (raison `sink_noop`)** AVANT toute livraison ; jamais présenté comme livré, jamais conservé, `delivered/failed = null`. L'observation additive expose `persisted:false`. Le résultat fonctionnel CloneChat reste totalement inchangé.
- **`ok` avec `failed>0`** viole l'invariant ⇒ **`invalid_sink_result`** (jamais `accepted`, jamais `partial`).

### Rappel — sémantique honnête du correctif #1 (conservée)
- **Version** : `EmitInput.version` facultative ; si fournie et ≠ `analytics-1` → rejet **`invalid_version`** ; un tel événement n'atteint jamais le sink ni l'agrégateur.
- **Échantillonnage** : politique explicite par événement ; le `sampled_out` est réellement produit (événement produit Care `rate:1` + sampler injectable refusant → `sampled_out`, absent du sink, `sampledOut` incrémenté). La télémétrie opérationnelle/sécurité (`always`) n'est **jamais** échantillonnée.
- **requestId / sessionId** : **toujours pseudonymisés** (opaques `rq_`/`ss_`, tenant-scopés, stables) — un e-mail, un user-id brut ou un token ne transite jamais ; le tronquage seul est refusé ; aucune corrélation inter-tenant (même id, tenant différent → pseudonyme différent).

## Événements réellement implémentés (53)
Requête, Brain, contexte résolu/incomplet, diagnostic + clarification, guide produit/bloqué/terminé/escaladé, voix (transcription réussie/refusée/en panne, TTS réussi/fallback), Care (problème connu/résolution/contournement/escalade), actions (planifiée, refus CloneGuard, confirmation demandée/reçue/expirée/invalide, exécutée **avec preuve observable**, échouée, annulée, dédupliquée), guidage visuel (trouvé/stale/fallback), inspection (réussie/partielle/refusée/en panne), onboarding (commencé/repris/interrompu/abandonné/expiré/bloqué/prêt/terminé), mission (intake, clarification, prêt-à-préparer, préparée, indisponible, sensible escaladée), panne provider, refus de sécurité, erreur interne sûre. **Aucun** événement ne représente une mission exécutée (préparée uniquement), un paiement sans preuve, un succès sans condition observable, ou un utilisateur/entreprise/entitlement non résolu.

## Métriques réellement calculées
Nombre de requêtes ; répartition des modes Brain ; taux de contexte incomplet ; taux de clarification ; répartition des diagnostics ; guides prêts/bloqués/escaladés ; latences par étape (min/max/avg) ; pannes (transcription/modèle/TTS/entitlement/support) ; taux de fallback ; refus de sécurité ; états d'action ; confirmations (demandées/reçues/expirées/invalides) ; cibles visuelles ; inspections ; statuts d'onboarding + reprises/abandons ; statuts de mission ; erreurs par code sûr ; routes réellement utilisées. Santé : pipeline/provider disponibles, taux d'erreur, latence, saturation buffer, rejets, dédup, produit désactivé faute de consentement.

## Politique de consentement
Deux bases : **operational** (télémétrie strictement nécessaire + sécurité) — toujours autorisée ; **product** (analytics facultative) — **désactivée par défaut** (`operational_only`) tant qu'un consentement réel (`product_enabled`) ne l'autorise pas. Le consentement n'est jamais simulé ni inventé ; un retrait rebascule immédiatement le produit en `disabled` (jamais faussement envoyé).

## Données EXPLICITEMENT interdites
message brut, prompt/réponse complets, transcript, audio, image/binaire, contenu de pièce jointe, mot de passe, token, cookie, clé API, header d'auth, URL signée, donnée bancaire, e-mail, téléphone, nom de salarié, nom d'entreprise inutile, user/tenant ID brut, stack brute, donnée d'un autre tenant. Mise en œuvre : allowlist stricte des clés + garde de clés interdites (défense en profondeur) + redaction récursive des valeurs + pseudonymisation + bornes taille/profondeur + taille d'enveloppe max.

## Gate local (séquentiel, sans build/tests concurrents)
- **CloneAnalytics : 87/87** (49 initiaux + 19 correctif #1 + **19 correctif #2** : lot immédiat 1 accepté `1/0`, lot immédiat échoué `0/1`, sink `partial 1/1` sur lot d'1 → invalide requalifié `failed` (jamais `partial`/`accepted`), lot manuel 2 réellement partiel `1/1` avec `delivered+failed===2`, invariant somme, nombres négatifs/décimaux/non-finis refusés, somme > lot & somme < lot refusées, `ok` avec `failed>0` refusé, `partial` à `delivered===0` & à `failed===0` refusés, statut inconnu/valeur non-objet refusés, comptes présents & corrects dans `EmitResult`, no-op toujours `disabled` sans compte, `timeout`/`failed` honnêtes `0/1`, résultat fonctionnel **et** `structured` INCHANGÉS même avec un sink aux comptes impossibles).
- **Passe de régression UNIQUE séquentielle** (`--no-file-parallelism --maxWorkers=1`, aucun build en parallèle) sur **19 fichiers = 529/529, 0 échec, 0 timeout** (BLOC 0→11 : 442 + analytics : 87). Détail BLOC 0→11 : onboarding 28, mission 30, evidence-inspector 36, cloneinspector 12, image-sanitizer 13, visual 26, actions 40, care 30, voice 32, transcribe 6, guide 25, diagnosis 25, context 25, brain 27, product-truth 15, context-boundary 51, injection-114 1 (114/114), universal-clonechat 20.
- **tsc --noEmit** : 0 erreur nouvelle (1 pré-existante `embedded-postgres` dans un `.itest.ts`). **ESLint** : 0 (`src/lib/clonechat/analytics/`). **Build Next isolé** (`.next-hotfix`) : **BUILD_EXIT_CODE=0** réel (compilé, table des routes complète imprimée ; ~3 Go libres, aucun processus tué).
- **tsconfig.json** rétabli byte-exact au blob du parent (873 o, `sha256:16 8a88b0410a539280`) après le build ; **index Git valide** (8384 fichiers) ; **aucun `.next-*`, capture ou binaire** committé.

## Preuve navigateur — justification honnête + preuve d'intégration locale déterministe
Une preuve navigateur d'un événement d'analytics n'est **pas raisonnablement possible** sans (a) câbler CloneAnalytics dans le comportement Production servi (`/api/assistant/chat`), interdit par la doctrine additive de ce programme, ou (b) créer une couche/interface de dashboard artificielle uniquement pour Playwright, explicitement interdite. En conséquence, conformément à la clause prévue : **preuve d'intégration locale DÉTERMINISTE** — l'adaptateur `onboardPrepareMissionAndObserveWithCloneChat()` exécute le VRAI pipeline (contexte réel, onboarding + mission réels) et émet les événements opérationnels attendus dans un **collecteur local (sink mémoire)**, corrélés, sans donnée sensible (tests d'intégration « instrumentation du pipeline » + « compatibilité »). Le rendu réel des parcours publics est en outre re-prouvé sur un **build FRAIS** : `e2e/clonechat-onboarding-discovery.spec.ts` via `next start` (`.next-hotfix`) + Playwright chromium — **15/15** (5 étapes publiques × desktop/iPhone/Android). Les analytics ne touchent aucune page rendue ; cette preuve confirme l'absence de régression de rendu. **Aucune requête vers un provider analytics externe** n'est émise (aucun n'est câblé).

## Limites honnêtes / suite
- `onboardPrepareMissionAndObserveWithCloneChat()` n'est **pas** câblé comme comportement Production servi ; aucun effet externe ; aucun provider réel.
- Le coût/les tokens ne sont mesurés que si une source canonique versionnée les fournit — jamais devinés (l'enveloppe ne porte ni champ `cost` ni `tokens` inventé ; `provider`/`model` restent `null` si inconnus).
- Aucune interface de dashboard n'est ajoutée ; l'agrégateur est une bibliothèque read-only.

---

## Gate de synchronisation pré-BLOC 13 — merge NON destructif (démo Production × CloneChat BLOC 12)

**Verdict local : PASS.** `origin/main` a avancé indépendamment vers la **démo Production approuvée** ; elle est intégrée à la lignée locale BLOC 12 par un **merge non destructif à deux parents**, sans réécrire ni supprimer aucun commit.

- **SHA local BLOC 12** : `59237c5150ae9529ffc73f2aa12a13d93bfde869`
- **SHA distant démo** : `340921879774d7dd078b9b2eb0b34f2d09e4734c` (`feat(demo): make approved 14-scene production demo the git source of truth`)
- **Base commune** : `c5e124b4ce0af5aa63e6646c7998752f993b89cc`
- **Commit de merge** : `76331ceafee9583a096d5a5e6d1aaa11a18fcce4` — **deux parents** `[59237c51 (BLOC 12), 34092187 (démo)]`
- **Commit documentaire distinct** (au-dessus, sans amend) : `docs(clonechat): record BLOC 12 and demo integration gate`

### Méthode (git.exe OS-bloqué → isomorphic-git)
`git fetch origin` (pack de 9512 objets ré-indexé via `indexPack` après une coupure du fetch). Merge **3-way par arbre programmatique** : `base × ours × theirs` → commit à deux parents → `refs/heads/main` avancée ; working-tree matérialisé pour les 24 fichiers démo ; index reconstruit. **Aucun** rebase / cherry-pick / amend / force-push / reset --hard / git clean / git add . / git add -A / statusMatrix global. Les deux lignées restent accessibles depuis le merge (vérifié `isDescendent`).

### Conflits : 0 (lignées disjointes)
| Côté | Fichiers | Contenu |
|---|---|---|
| **theirs** (démo) | 24 | `src/app/demo/**`, `src/components/demo/**`, `src/lib/demo/**`, `scripts/demo-*.cjs`, `demo-evidence/PREMIUM_DEMO_RECONSTRUCTION.md`, `src/components/site/site-header.tsx` (ciblé) |
| **ours** (BLOC 12) | 14 | `src/lib/clonechat/analytics/**`, `onboarding/orchestrator.ts`, rapports CloneChat |

Aucun fichier modifié des deux côtés ⇒ aucune résolution manuelle, aucune 3ᵉ version inventée, **aucune capacité perdue**.

### Tests après merge (séquentiels)
- **CloneChat** : Analytics 87/87 ; **passe unique 19 fichiers = 529/529** (0 échec, 0 timeout).
- **Démo** : **30 fichiers = 509/509** (0 échec) — 29 fichiers démo (489 : noyau 14 scènes 373 + pierre-demo 116) + **1 nouveau test de politique navigateur/rate-limit** (`src/lib/demo/qa/__tests__/browser-console-policy.test.ts`, 20 tests).
- **tsc** global 0 erreur nouvelle · **ESLint** 0 erreur (démo + analytics) · **build Next isolé `.next-hotfix` BUILD_EXIT_CODE=0** réel (194 pages, routes `/demo` + `/demo/pierre`).

### Preuve navigateur (build FRAIS) — les 4 scripts officiels terminent à EXIT 0
Serveur `.next-hotfix` frais redémarré (`BUILD_EXIT_CODE=0`, 194 pages), **sans aucun stub réseau** :
- **CloneChat onboarding e2e : 15/15**.
- `demo-first-scene.cjs` → **FIRST_SCENE_ALL_PASS**, exit 0 (8/8 viewports).
- `demo-nav-check.cjs` → **NAV_ALL_PASS**, exit 0 (unexpectedConsole=0 ; expected-telemetry-429=3).
- `demo-visual-matrix.cjs` → **MATRIX_112_112_CLEAN**, exit 0 (112/112 cellules = 8 viewports × 14 scènes ; unexpectedConsole=0, hydration=0, HTTP 5xx=0, unexpected-429=0 ; **expected optional-telemetry 429 = 96**, comptés à part).
- `demo-ch3-interactive.cjs` → **CH3_INTERACTIVE_ALL_PASS**, exit 0 (41 assertions ; unexpectedConsole=0). En séquence enchaînée (fenêtre limiteur chaude), ch3 a classé jusqu'à 34 429 attendus tout en restant exit 0.

### Résolution honnête du gate navigateur sous rate limiting télémétrie
Audit : le seul endpoint qui renvoie 429 est **`/api/analytics/events`** — `distributedRateLimit(db, 'analytics:<hashIp>', 60, 60_000)` = **60 requêtes / 60 s par IP** (65 POST → 49×422 puis 16×429) ; **`/api/conversion/events` = 204, aucun 429**. Les 429 sont donc une **backpressure serveur ATTENDUE** sur un beacon télémétrie fire-and-forget que la page dégrade proprement ; jamais un défaut produit ; absents en déploiement réel (Vercel Preview auteur = 0 console).

Correction (la plus petite et honnête) : une **politique console partagée, testée, injectable** — `scripts/qa/browser-console-policy.cjs` (source unique) — consommée par `demo-visual-matrix.cjs`, `demo-ch3-interactive.cjs` et `demo-nav-check.cjs`. Elle classe **EXACTEMENT `{statut 429} × {/api/analytics/events, /api/conversion/events}`** comme *backpressure attendue* (compteur séparé, non bloquante) et laisse **BLOQUANT tout le reste** : toute autre erreur console, un 429 d'une autre route, un 4xx inattendu (via l'erreur de ressource console), un HTTP 5xx, une pageerror, une hydration, une scène/navigation/CTA incorrecte. Allowlist limitée exactement aux 2 routes optionnelles prouvées et au statut 429 ; **fail-closed** si l'URL n'est pas prouvée ; **opt-in** (`allowOptionalTelemetry429`) et routes **injectables** ; **désactivable** (prouve que les 429 sont réels). **Aucune interception réseau / stub 204, aucun blocage d'analytics, aucune suppression générique d'erreurs console, aucun catch vide, aucun changement de code de sortie sans validation, aucune requalification purement documentaire.** Testée par **20 tests déterministes** (`src/lib/demo/qa/__tests__/browser-console-policy.test.ts`) : JS-error bloquant, pageerror bloquant, 500 bloquant, 429 route inconnue bloquant, 429 optionnel classé attendu seulement si la politique l'autorise, aucune autre route dans l'allowlist, compteurs inattendus à 0 / attendus visibles, politique désactivable. Le rate limiting Production n'est pas désactivé ; aucun événement réel supprimé.

### État Git final
tsconfig.json byte-exact (`8a88b0410a539280`) · index valide · **0** marqueur de conflit · **0** `.orig` · **0** `.next-*` nouvellement suivi · aucune capture/binaire/secret dans le commit. `.next-p10/**` reste suivi = artefact **pré-existant** hérité de la base commune (non introduit ici). Le commit correctif de gate navigateur (`fix(demo): make browser gate honest under telemetry rate limiting`, parent 01eaa2ec) ne touche QUE : `scripts/qa/browser-console-policy.cjs` (nouveau), `scripts/demo-visual-matrix.cjs`, `scripts/demo-ch3-interactive.cjs`, `scripts/demo-nav-check.cjs`, `src/lib/demo/qa/__tests__/browser-console-policy.test.ts` (nouveau), et les 2 rapports. **Analytics fonctionnel / onboarding / contenu & design des 14 scènes / runtime Pierre / P22 / missions RH / migrations / paiements / Vercel : INCHANGÉS.** Rien poussé (push manuel) ; 3 commits locaux en avance. **BLOC 13 non commencé.**
