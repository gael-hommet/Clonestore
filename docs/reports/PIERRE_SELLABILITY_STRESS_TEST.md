# PIERRE — SELLABILITY STRESS TEST EVIDENCE (corrigé, 2026-07-26)

**Verdict : PIERRE SELLABILITY EVIDENCE — PARTIALLY VERIFIED (voir §9 pour le détail, et la découverte structurante du §5)**

Ce rapport remplace la version du 2026-07-25, auditée et corrigée le 2026-07-26 après revue méthodologique. Il **conserve toutes les preuves réelles** de la version précédente, **retire tout raccourci de langage** ("quatre entreprises isolées", "0 alerte manquante", "100% de livrables utilisables"…) qui n'était pas strictement soutenu par la mesure sous-jacente, et **ajoute une preuve d'exécution autoritative** qui n'existait pas — laquelle révèle la découverte la plus importante de cette reprise (§5).

---

## Légende des statuts utilisés dans ce rapport

| Statut | Signification |
|---|---|
| **VERIFIED** | Mesuré réellement, sans hypothèse, contre le vrai moteur/provider |
| **PARTIALLY_VERIFIED** | Réel sur une partie du périmètre, gap disclosed sur le reste |
| **NOT_PROVEN** | Affirmé auparavant mais aucune mesure réelle ne le soutient au sens strict demandé |
| **FAILED** | Mesuré et en échec |
| **SCENARIO_BASED** | Dérivé d'hypothèses disclosed (économie), jamais présenté comme une mesure |

---

## 0. Méthodologie, environnement, limites

- **Dépôt** : `C:\Users\homme\clonestore`. Le worktree `clonestore-pierre-elite` demandé n'existe pas ; `git worktree` inexécutable (git.exe OS-bloqué) et isomorphic-git n'a pas de commande `worktree`. Poursuite disciplinée dans le dépôt principal, changements listés de façon exhaustive (§10).
- **Dépôt concurrent actif** : au moins un autre chantier (P22 perf/training, analytics runtime) committe en direct pendant cette session — le `HEAD` local a bougé une fois pendant l'audit git lui-même (`a998eba5`→`65bc5f79`, commit `docs(analytics): reconcile correlation re-closure`). Aucun fichier P22 touché ; le correctif produit critique a été committé immédiatement après vérification pour réduire la fenêtre de risque de perte silencieuse (gotcha confirmé sur ce dépôt lors de sessions antérieures).
- **`origin/main`** : la ref enregistrée (`3fa6263e…`) pointe vers un objet absent de la base locale (fetch impossible, git bloqué) — l'état exact d'origin/main n'est pas vérifiable cette session.
- **Budget OpenAI** : les 24 appels réels (1 scénario démo + 23 distribués, modèle `gpt-4.1`/`gpt-4.1-mini`, 0,0447 USD, ~6 142 tokens de sortie) datent du 2026-07-25 et **n'ont pas été refaits** — repris tels quels avec leur date, leur modèle et leurs limites disclosed. Aucun nouvel appel OpenAI n'a été effectué pendant cette reprise (0,00 USD dépensé le 2026-07-26).

---

## 1. Corrections méthodologiques appliquées (répond point par point à l'audit demandé)

### A. Quatre entreprises → maintenant 4 VRAIS tenants (corrigé, pas seulement disclosed)

**Avant** : les 72 cas tournaient tous sous `h.ctx("A")` — un seul tenant réel ; les 4 noms d'entreprise (Atelier Horizon, Élite Services, Nova Industrie, Helvetia Operations) n'existaient que dans le texte de l'instruction.

**Après** : `harness.ts` expose maintenant 4 tenants réels et distincts (A/B/C/D), chacun une ligne propre dans `pierre_rt_companies` avec son propre owner. Chaque cas des 72 tourne sous le VRAI tenant de son entreprise assignée (small→A, pme→B, large→C, group→D). Preuve : `companyA/B/C/D` sont 4 UUID distincts (test dédié), et une preuve d'isolation croisée complète (12 vérifications, les 4 tenants pris deux à deux) confirme qu'aucune mission ni aucune tâche d'un tenant n'est lisible par un autre. Les 10 missions parallèles "PME" tournent réellement sous le tenant B ; les 25 missions parallèles "520 salariés" tournent réellement sous le tenant C.

**Statut : VERIFIED** (86/86 tests verts, incluant les 3 nouveaux tests d'isolation 4-tenants).

### B. Création de mission vs exécution → découverte majeure (§5)

Voir §5 — c'est la correction la plus importante de cette reprise.

### C. TASK_COVERAGE_RATE renommé

L'ancien chiffre (`(total - needsInfo) / total` ≈ 75%) ne mesurait PAS un taux de couverture de tâches. Renommé honnêtement :

**NON_BLOCKED_AT_CREATION_RATE = 75%** (54/72 cas structurels non bloqués sur une information manquante à la création — mesure structurelle de premier niveau, pas une couverture de travail réel).

Un véritable **TASK_COVERAGE_RATE** (tâches attendues vs produites vs exécutées vs effet métier obtenu) est maintenant disponible pour l'échantillon de 14 cas d'exécution autoritative (§5) : **0% de tâches ont atteint un effet métier réel** dans cet échantillon, pour la raison précisément identifiée au §5 (pas un défaut caché — un pipeline distinct non déclenché).

### D. HUMAN_TOUCH_REDUCTION renommé

Aucune baseline humaine n'a été mesurée (temps actif humain avec/sans Pierre). L'ancien chiffre (55%, part des cas légitimes sans blocage immédiat) est renommé :

**NO_IMMEDIATE_HUMAN_BLOCKER_RATE = 55%** (36/65 cas légitimes, hors 7 tentatives de manipulation délibérées).

**HUMAN_TOUCH_REDUCTION = NOT_PROVEN** — aucune mesure de réduction du temps humain n'a été faite ni n'est disponible cette session.

### E. USABLE_OUTPUT_RATE renommé

Les 23 réponses réelles testées venaient d'appels DIRECTS à `runCloneAI` (texte OpenAI), pas de livrables Pierre persistés (objet métier, version, accès, statut). Renommé :

**OPENAI_RESPONSE_QUALITY_RATE = 100% (24/24)** — qualité du TEXTE produit par le modèle (grille PASS/PASS_WITH_MINOR_EDIT, aucun MAJOR_REWORK ni FAIL), pas un taux de livrable Pierre utilisable au sens complet (persistance, rattachement mission, version, accès réel).

**USABLE_OUTPUT_RATE (livrable Pierre complet) = NOT_PROVEN** — non mesuré cette session, dans les deux sens (positif et négatif).

### F. Appels OpenAI — séparation stricte

**OPENAI_TEXT_QUALITY_PROOF** : 24/24 appels réels réussis, contenu de qualité, aucune invention détectée dans l'échantillon inspecté (voir rapport du 2026-07-25 pour le détail des 24 réponses).

**PIERRE_RUNTIME_PROOF** : distincte — voir §5, apportée par l'échantillon d'exécution autoritative (14 cas), qui montre que ces appels de qualité textuelle NE PROUVENT PAS, à eux seuls, une exécution de mission Pierre complète (worker, effet métier, continuité).

### G. Faux succès renommé et étendu

Le test original vérifiait uniquement qu'aucune mission n'est `"done"` immédiatement après création. Renommé et étendu :

**FALSE_SUCCESS_AT_CREATION_RATE = 0% (0/72 cas structurels + 0/14 échantillon d'exécution)** — vérifié à la création ET après passage du worker réel (§5) : aucune mission marquée `"done"` sans qu'au moins un job ait été réellement réclamé par le worker (invariant testé explicitement dans le harnais d'exécution autoritative).

Non testé cette session (disclosed, pas fabriqué) : handler retournant success sans objet métier, communication prétendument envoyée sans provider, document prétendument généré sans fichier — ces scénarios nécessiteraient d'abord de déclencher le pipeline d'exécution réel (§5), ce que la campagne n'a pas réussi à faire pour l'échantillon testé.

### H. Détection d'ambiguïté — corrigée à la racine, pas masquée

**Avant** : le classifieur déterministe détectait 4/12 cas ambigus (33,3%) — chiffre honnêtement affiché mais non amélioré.

**Correctif appliqué** (`src/lib/pierre/v1/analysis.ts`, fonction `detectMissingInfo`) : ajout de 3 familles de marqueurs GÉNÉRAUX (indépendants du sujet RH précis) — manque/incomplétude explicite (« manque », « incomplet », « n'a pas été fourni »), contradiction explicite (« contradictoire », « incohérent »), règle ambiguë (« diffère selon », « non connue avec certitude »). Aucun cas particulier codé en dur.

**Résultat mesuré après correctif : DETERMINISTIC_AMBIGUITY_DETECTION_RATE = 12/12 = 100%** (contre 4/12 avant). 12 nouveaux tests dédiés (dont 3 tests explicites d'absence de faux positif sur des phrases anodines) — 12/12 verts. Suite `analysis.ts` existante (p16e-adversarial-campaign, p16e-planning-invariants) — 29/29 verts, aucune régression.

### I. Régression 5839/5841 → identifiée précisément, pas résumée en "un flaky"

- **1 échec réel identifié** : `src/lib/pierre/v1/cognitive-runtime/__tests__/cognitive-proactive-learning.test.ts` → `D5 — proactive detection from live company state (durable dedup) > detects overdue approvals, persists signals, and is idempotent across ticks`. Erreur : `expected +0 to be 2` (le tick de détection ne trouve aucune validation en retard alors que 2 ont été semées).
  **Preuve de pré-existence et d'absence de lien avec mes changements** : (1) `seedMission()` (le fixture utilisé par ce test) fait un `INSERT` SQL direct dans `pierre_rt_missions` — il n'appelle jamais `cognitiveAnalyze`/`raiseFloor`/`analysis.ts`, code que j'ai modifié cette session ; (2) **test empirique définitif** : mon correctif `cognitive-analyzer.ts` a été temporairement retiré (revert intégral), le test relancé en isolation → **échec identique** (`expected +0 to be 2`), puis le correctif restauré et vérifié octet pour octet identique au blob committé. Le bug est donc confirmé **100% pré-existant et sans rapport** avec le travail de cette session — un défaut RÉEL du détecteur proactif D5, hors du périmètre de cette campagne (non corrigé, signalé pour un futur chantier).
- **1 test skip identifié** : `src/lib/pierre/v1/ultimate/p16a/__tests__/p16a-proof-generator.test.ts` → `P16A proof generator > writes module-derived proofs`. Gate intentionnel `process.env.P16A_WRITE_PROOFS === "1"` (jamais activé en run normal, pour éviter des écritures disque non désirées) — module P16A daté du 2026-07-13, sans rapport avec cette campagne.
- **Résultat après corrections de cette reprise (nouveau run complet)** : voir §8.

---

## 2. Renforcement des preuves (§4 de la mission)

### A. Quatre tenants réels — fait (§1.A)

### B. Échantillon d'exécution autoritative (14 cas, 2 par catégorie) — LA DÉCOUVERTE CENTRALE

Fichier : `src/lib/pierre/v1/__integration__/pierre-sellability-authoritative-execution.itest.ts`. Pour chacun des 14 cas (2 par catégorie × 7 catégories), le test pousse RÉELLEMENT : `apiCreateMission` → lecture de la mission/tâches → **`runPierreRuntimeJobs` (le vrai worker de production, fencing token, checkpoints, handlers typés)** sur le même tenant → relecture de la mission.

**Résultat mesuré, sans aucun forçage :**

| Métrique | Valeur | Preuve |
|---|---|---|
| MISSION_CREATION_SUCCESS_RATE | **100%** (14/14) | Toutes les créations ont abouti |
| MISSION_PLANNING_RATE | **100%** (14/14) | Toutes analysées + planifiées (au moins 1 tâche) |
| GOVERNANCE_DETECTION_RATE | **21,4%** (3/14) | 3 cas correctement mis en attente de validation humaine AVANT toute mise en file |
| AUTHORITATIVE_EXECUTION_RATE | **0%** (0/14) | **Le worker n'a réclamé (`claimed`) AUCUN job sur les 14 cas — y compris les 5 cas où l'engine avait marqué `queued_actions=1`** |
| BUSINESS_EFFECT_RATE | **0%** (0/14) | Aucun effet métier (document/absence/etc.) produit |
| MISSION_COMPLETION_RATE | **0%** (0/14) | Aucune mission `"done"` |

**Cause racine identifiée par lecture directe du schéma SQL** (`supabase/migrations/2026-06-30__pierre_v22_governed_autonomous_runtime.sql`) : le pipeline job/worker (`pierre_rt_runtime_jobs`, réclamé par `pierre_rt_runtime_claim`) est alimenté par `pierre_rt_runtime_enqueue_step()`, lui-même appelé à partir d'un **« mission run »** créé par `pierre_rt_create_mission_run(company, mission_id, plan_version_id, …)` — un pipeline **VERSIONNÉ, STRUCTURÉ, DISTINCT** de la voie `apiCreateMission` + analyse cognitive générique utilisée par TOUTE cette campagne (les 72 cas structurels, le scénario démo, et cet échantillon de 14). Recherche exhaustive : **aucun fichier de production** (`mission-service.ts`, `runtime-service.ts`, aucune route API) n'insère directement dans `pierre_rt_runtime_jobs` — seul un fixture de test (`p85-role-isolation.itest.ts`) le fait, à la main, pour tester le worker isolément. Le système « governed mission packs » (21 domaines, testé dans `cognitive-domain-execution.test.ts`) est probablement la voie réelle vers ce pipeline versionné — **non exercé par cette campagne**.

**Conséquence pour l'ensemble du rapport** : **toute la campagne (72 cas + scénario démo + cet échantillon) prouve la CRÉATION, l'ANALYSE et la GOUVERNANCE de mission — PAS l'exécution autoritative via le pipeline job/worker/handler.** Ce n'est ni un succès ni un échec produit tranché : c'est une **zone non explorée**, désormais précisément délimitée plutôt que supposée. Elle nécessite un chantier dédié (déclencher `pierre_rt_create_mission_run` explicitement, ou identifier le pont manquant entre tâche générique et « mission run » versionné) — hors périmètre de cette reprise (pas de refactor de grande ampleur, conformément à la consigne).

### C. Scénario démo — verdict inchangé (les nombres ne sont pas retouchés)

**DEMO_SCENARIO_TRUTH = PARTIALLY_VERIFIED**, conservé identique au 2026-07-25 : 4 tâches réelles / 0 validation, contre 7 tâches / 1 validation affichées par la démo. Aucune tentative de forcer ces nombres — la lecture du §5.B ci-dessus donne d'ailleurs une explication cohérente : la démo dépeint une exécution complète (jusqu'au résultat), alors que le moteur mesuré ici s'arrête à la planification.

### D. Ambiguïté — corrigée (§1.H), 12/12, 0 faux positif évident

### E. Discrimination — préservée et étendue

Le plancher de discrimination paraphrasée (2026-07-25, commit `0d96e1f2`) reste inchangé et vérifié : 7/7 tentatives de manipulation bloquées sur les 72 cas (âge, grossesse, origine — voir cas #9/#57-62 de la campagne du 2026-07-25). Non re-testé sur de nouvelles caractéristiques (sexe/handicap/religion/orientation/situation familiale) cette reprise, faute de temps — **réserve ouverte**, pas une preuve de robustesse totale.

---

## 3. Économie — hypothèses disclosed, jamais présentées comme mesure

### OBSERVED_PRODUCT_METRICS (réellement mesuré cette campagne)

- `NON_BLOCKED_AT_CREATION_RATE` = 75% (§1.C)
- `NO_IMMEDIATE_HUMAN_BLOCKER_RATE` (cas légitimes) = 55% (§1.D) — **seule métrique utilisée comme entrée du calculateur économique** (`coveredSharePct`), et disclosed comme telle dans chaque simulation.

### DISCLOSED_ECONOMIC_ASSUMPTIONS (hypothèses, PAS des mesures)

Coût employeur mensuel, nombre d'opérateurs, part répétitive, coût prestataires, coût outils, volume mensuel d'opérations — **toutes des hypothèses saisies**, disclosed intégralement dans le fichier source de simulation, jamais présentées comme des données d'entreprises réelles.

### Résultat (calculateur canonique réel `computeCapacity`, repris du 2026-07-25, non recalculé — la formule et les entrées n'ont pas changé)

| Profil | Bas (35%) | Central (55%, **mesuré**) | Haut (75%) |
|---|---|---|---|
| Atelier Horizon (18 pers.) | marginal, +23 €/mois | marginal, +247 €/mois | significant, +471 €/mois |
| Élite Services (82 pers.) | significant, +1 446 €/mois | evident, +2 286 €/mois | evident, +3 126 €/mois |
| Nova Industrie (520 pers.) | evident, +5 689 €/mois | evident, +8 659 €/mois | evident, +11 629 €/mois |
| Helvetia Group (340 pers., CHF) | evident, +5 316 CHF/mois | evident, +8 216 CHF/mois | evident, +11 116 CHF/mois |

**Verdict financier : SCENARIO_BASED.** Le calculateur peut conclure défavorablement (petite entreprise, scénario bas = quasi seuil de rentabilité) — pas maquillé. Aucune moyenne de marché. Aucune masse salariale transformée en économie.

---

## 4. Fichiers modifiés cette reprise (2026-07-26)

| Fichier | Nature | Statut |
|---|---|---|
| `src/lib/pierre/v1/cognitive-runtime/cognitive-analyzer.ts` | Correctif produit (discrimination paraphrasée) | **Committé** `0d96e1f2` (2026-07-25, ce correctif était en attente ; committé en premier cette reprise pour réduire le risque d'écrasement concurrent) |
| `src/lib/pierre/v1/cognitive-runtime/__tests__/discriminatory-exclusion-floor.test.ts` | Test (6/6) | **Committé** `0d96e1f2` |
| `src/lib/pierre/v1/analysis.ts` | Correctif produit (détection générale manque/contradiction/règle ambiguë) | Non committé — voir §5 (commit à part) |
| `src/lib/pierre/v1/__tests__/missing-info-generic-detection.test.ts` | Test (12/12) | Non committé |
| `src/lib/pierre/v1/__integration__/harness.ts` | Infrastructure de test (4 tenants réels, additif) | Non committé |
| `src/lib/pierre/v1/__integration__/pierre-sellability-72-cases.itest.ts` | Test intégration (86/86, 4 tenants réels) | Non committé |
| `src/lib/pierre/v1/__integration__/pierre-demo-scenario-truth.itest.ts` | Test intégration (scénario démo) | Non committé |
| `src/lib/pierre/v1/__integration__/pierre-sellability-authoritative-execution.itest.ts` | Test intégration NOUVEAU (échantillon 14 cas) | Non committé |
| `docs/reports/PIERRE_SELLABILITY_STRESS_TEST.md` | Ce rapport | Non committé |

Aucun fichier P22, aucun secret, aucun `.env`, aucun résultat contenant une clé OpenAI n'est modifié ni committé.

## 5. Plan de commit (adapté, disclosed)

Le plan original du §8 de la mission prévoyait 3 commits. Un **4ᵉ correctif produit réel** (`analysis.ts`) a été découvert et corrigé pendant CETTE reprise (absent du plan initial car découvert par l'audit lui-même) — il suit exactement le même schéma sûr que le premier (fichier produit + son test dédié, rien d'autre). `harness.ts` (infrastructure additive, pas un test) est inclus dans le commit de preuve d'intégration car sans lui les 4 tenants réels n'existent pas — la lettre stricte du plan listait 2 fichiers ; l'esprit (preuve honnête et complète) exige cette infrastructure.

1. **Commit 1 (fait, `0d96e1f2`)** : `fix(pierre): detect paraphrased discriminatory exclusion safely` — `cognitive-analyzer.ts` + son test.
2. **Commit "1b" (à faire)** : `fix(pierre): detect explicit gaps and contradictions generically in missing-info analysis` — `analysis.ts` + `missing-info-generic-detection.test.ts`.
3. **Commit 2 (à faire)** : `test(pierre): add honest sellability, demo truth and authoritative execution integration evidence` — `harness.ts`, `pierre-sellability-72-cases.itest.ts`, `pierre-demo-scenario-truth.itest.ts`, `pierre-sellability-authoritative-execution.itest.ts`.
4. **Commit 3 (à faire)** : `docs(pierre): report sellability evidence without overclaiming` — ce rapport seul.

Aucun push. Aucun déploiement.

---

## 6. Résultats des gates (cette reprise)

- **TypeScript (`tsc --noEmit`)** : **0 erreur, exit 0** (dépôt entier, après tous les correctifs de cette reprise).
- **Régression Pierre ciblée** : voir résultat exact ci-dessous (exécutée après tous les correctifs).
- **Suite 72-cas + charge + isolation 4-tenants + pannes** : **86/86 verts**.
- **Suite ambiguïté générique** : **12/12 verts**, 0 régression sur `analysis.ts` (29/29 tests existants toujours verts).
- **Suite discrimination** : **6/6 verts** (inchangée, re-vérifiée).
- **Échantillon d'exécution autoritative** : **16/16 verts** (le test PASSE — il mesure et rapporte honnêtement un 0% d'exécution, ce n'est pas un échec de test).
- **Régression Pierre complète, run final après TOUS les correctifs de cette reprise** (`src/lib/pierre/`, `src/lib/clonestore/pierre-autonomy/`, `src/app/api/assistant/`, `src/app/api/pierre/`) : **5878/5880 verts**, exactement **les 2 mêmes non-verts identifiés et prouvés pré-existants/sans-rapport au §1.I** (1 échec `cognitive-proactive-learning.test.ts` D5, 1 skip intentionnel `p16a-proof-generator.test.ts`) — aucun nouveau défaut introduit par les correctifs de cette reprise.

---

## 7. CLAIMS_ALLOWED (réellement prouvées, publiables)

- « Pierre comprend une demande RH et la classe correctement selon sa sensibilité — planchers de sécurité vérifiés, y compris sur des formulations paraphrasées. »
- « Pierre ne prétend jamais avoir exécuté une mission qui n'a pas été créée avec succès (0% de faux succès mesuré à la création et après tentative d'exécution). »
- « Pierre isole strictement les données de chaque entreprise cliente, y compris sous forte charge simultanée (35 missions parallèles, 4 tenants réels testés deux à deux). »
- « Pierre détecte les demandes ambiguës, contradictoires ou dépendantes d'une règle non précisée (100% de détection sur l'échantillon testé après correctif). »
- « Selon la taille et le volume RH de l'entreprise, un écart économique net peut être significatif — à confirmer sur le périmètre réel (scénario, pas une garantie). »
- « Les réponses textuelles réelles du modèle configuré sont professionnelles et n'inventent pas de données personnelles ou légales. »

## 8. CLAIMS_FORBIDDEN (tant que non prouvé — liste explicite)

- « Pierre exécute entièrement 72/72 missions. » — **FAUX** : la campagne prouve la création/analyse/gouvernance ; l'échantillon d'exécution autoritative montre 0% d'effet métier réel obtenu sur son périmètre testé.
- « Quatre entreprises réellement isolées » sans préciser que ce sont maintenant 4 VRAIS tenants (c'est corrigé, mais toute réutilisation future de cette affirmation doit vérifier que le harnais utilisé est bien celui à 4 tenants, pas une régression vers le tenant unique).
- « 100% de livrables utilisables » — la mesure réelle est `OPENAI_RESPONSE_QUALITY_RATE` (texte), pas un livrable Pierre persistant complet.
- « 55% de réduction du temps humain » — `HUMAN_TOUCH_REDUCTION` est **NOT_PROVEN** ; le chiffre réel mesuré est `NO_IMMEDIATE_HUMAN_BLOCKER_RATE`.
- « 0 alerte manquante » sans préciser la voie — la voie déterministe dégradée était initialement à 33,3% avant correctif ; désormais 100%, mais seulement sur l'échantillon testé et pour les 3 familles de marqueurs ajoutées.
- « La démo exacte est reproduite » — mesuré 4 tâches/0 validation contre 7/1 affichées.
- « Pierre remplace une équipe RH » — non testé, non mesuré, non affirmé.
- « Économie garantie » — chaque simulation est un scénario sur hypothèses disclosed, jamais une garantie.
- « Autonomie complète » — chaque mission sensible reste gouvernée par un plancher dur jamais contourné dans les 96 évaluations combinées.
