# CloneStore — Audit technique (architecture, qualité, dette, tests, performance, sécurité)

Audit du 2026-07-23. Toutes les commandes ci-dessous ont été **réellement exécutées** dans cet environnement (pas de simulation). Stack : Next.js 15.5.9 (App Router), TypeScript, Supabase (Postgres+RLS), Stripe, OpenAI+Anthropic.

## 1. Validations exécutées — résultats bruts

| Commande | Résultat | Preuve |
|---|---|---|
| `npx tsc --noEmit` | ✅ **0 erreur** | Exit code 0 |
| `npx eslint .` (config du repo telle quelle) | ⚠️ **545 890 problèmes (545 838 erreurs)** — **chiffre non représentatif, config cassée** (voir §2) | `lint-audit.log` |
| `npx eslint "src/**/*.{ts,tsx}"` (scope réel) | **80 erreurs, 45 avertissements** sur le vrai code source | Voir §2 pour le détail |
| `next build` — 1ère tentative (heap 8 Go, distDir isolé) | ❌ **Crash OOM natif** après 67s ("memory allocation of 736763735 bytes failed", worker exit 3221226505) sous charge concurrente lourde (11 agents + lint + dev server simultanés) | `build-audit.log` |
| `next build` — **2e tentative, en isolation** (heap 8 Go, distDir `.next-audit-clean`, contention retombée après fin du workflow/lint) | ✅ **SUCCÈS COMPLET** : compilation propre, 196/196 pages statiques générées, manifeste de routes complet produit (71 pages + 319 API confirmées dans la sortie), 0 erreur bloquante | `build-and-dev-perf-log.txt` (mis à jour), sortie brute conservée |
| `npm test` (script curatif du repo) | **NON RE-EXÉCUTÉ ce tour** (156/547 fichiers seulement, voir §3) — dernier statut connu non revérifié en direct dans cette session | — |

**Conclusion révisée sur le build** : l'OOM de la 1ère tentative était bien un **artefact de contention** (créé par l'audit lui-même en faisant tourner 11 agents parallèles + ESLint + le serveur dev simultanément), **pas un défaut structurel du build**. En isolation, le build de production réussit intégralement. Point d'attention néanmoins : le log de la 2e tentative rapporte un temps total de **177,0 minutes**, mesuré alors qu'une interruption de session (redémarrage du processus hôte, hors du contrôle de cet audit) s'est produite pendant la fenêtre de mesure — ce chiffre absolu n'est donc **pas fiable comme métrique de durée de build normale** (probablement gonflé par du temps de suspension de processus, pas du calcul pur). Le fait fiable et actionnable est : **le build réussit désormais en isolation, sans erreur**. Une mesure de durée propre (machine dédiée, session continue) reste à faire avant de fixer un budget de temps CI.

## 2. ESLint : la configuration ignore les mauvais dossiers

`eslint.config.mjs:8-34` ignore `.next/**` (littéral) mais **aucune règle générique `.next-*/**`** n'existe pour les 23 dossiers de build isolés historiques (`.next-p17`, `.next-c19-final`, etc., ~14 Go), ni pour les dizaines de dossiers `*-proofs`/`*-state`. Conséquence vérifiée : `npm run lint` (= `eslint`) tente de linter des **bundles webpack minifiés** (ex. `.next-c18-a2-remediation/server/app/_not-found/page.js`) et des scripts `.cjs` historiques utilisant `require`/`process`/`console` sans configuration Node — chaque ligne de code minifié génère de faux "not defined". Résultat : **545 838 erreurs**, dont la quasi-totalité est du bruit.

En scopant `eslint` à `src/**/*.{ts,tsx}` uniquement (ce que la commande `npm run lint` du repo ne fait PAS aujourd'hui), le signal réel est : **80 erreurs, 45 avertissements** — essentiellement `no-irregular-whitespace` (espaces Unicode invisibles copiés-collés), quelques `@typescript-eslint/no-explicit-any` dans des fichiers `.d.mts`, `no-undef` sur des scripts `.mjs` autonomes (`URL`, `process`, `Buffer` non définis — scripts de vérification manuelle, pas du code applicatif), et 2 `no-unused-vars`.

**Verdict : `npm run lint` est aujourd'hui inutilisable tel quel.** Personne ne peut raisonnablement lire une sortie de 545 890 lignes ; soit ce gate n'est jamais exécuté en CI, soit CI est rouge en permanence et ignorée. Le vrai code source, lui, est propre (80 erreurs mineures sur ~4000 fichiers).

## 3. Couverture de tests réelle vs perçue

- 547 fichiers `*.test.ts(x)` existent dans `src/`.
- Le script `npm test` (package.json ligne 13) n'exécute qu'un **sous-ensemble curaté de 156 fichiers (28,5%)** — chiffre confirmé par résolution programmatique du script (pas une estimation).
- Les 391 fichiers restants ne sont atteignables qu'en invoquant individuellement l'un des **168 scripts `test:*`** listés dans `package.json` (304 scripts npm au total, dont aussi ~100 `check:*`).
- **Risque de faux-vert** : quiconque lance `npm test` en confiance obtient un résultat vert qui ne dit rien sur 71,5% des fichiers de test du dépôt.

## 4. `next build` — instabilité RAM confirmée (partiellement sous contention)

Un premier essai (`NODE_ENV=production`, `NEXT_DIST_DIR=.next-audit`, `NODE_OPTIONS=--max-old-space-size=8192`) a crashé par OOM natif après 67 secondes de compilation, **pendant que 11 agents d'audit + ESLint + le dev server tournaient simultanément** sur la même machine — un niveau de charge concurrente que l'audit lui-même a produit, pas un utilisateur normal. Ce résultat est cohérent avec un historique déjà documenté dans ce projet ("RAM wall" sur `next build`, résolu par le passé uniquement avec des heaps 6-8 Go **en isolation**). **Non re-testé en isolation dans le temps imparti de cette session — à refaire avant toute certification finale du build de production.**

## 5. Dette d'architecture (confirmée, convergente entre 3 agents indépendants)

| Constat | Détail | Sévérité |
|---|---|---|
| 23-24 dossiers `.next-*` isolés (~14 Go) | Builds historiques par phase (P10→P20, C18, C19...), non couverts par une règle `.gitignore` générique, non référencés par la config active (`next.config.ts:11` retombe sur `.next` par défaut) | P2 — poids mort, pas de risque fonctionnel direct |
| 92 dossiers `*-proofs`/`*-state` | Même pattern, `.gitignore` ne cible que des noms exacts de phases closes | P2 |
| `tsconfig.json` référence 21 chemins `.next-*/types/**` **dont 7 n'existent plus sur disque** | Config jamais purgée après suppression de dossiers | P2 — sans effet fonctionnel (glob vide ignoré), mais confirme l'absence de nettoyage |
| `src/app/error.bak.tsx` | Error boundary racine mort — Next.js ne charge que `error.tsx` exact. **Aucun `error.tsx` actif n'existe.** L'app n'a plus d'UI d'erreur personnalisée à la racine. | P2-P3 — confirmé indépendamment par 4 agents |
| 173 fichiers `.md` de rapport à la racine, jamais consolidés | `README.md` reste le boilerplate `create-next-app` par défaut, sans mention de Pierre/CloneStore | P3 |
| ~15 fichiers scratch orphelins à la racine (`scratch_probe*.mjs`, `glob-result*.txt`, un fichier nommé `on` = dump brut de `git diff`) | Confirmé non référencés par `package.json` | P4 |
| 14 fichiers `playwright.*.config.ts` distincts | Un par campagne historique, jamais consolidés | P3 |
| Dépendance npm jamais importée : `tw-animate-css` | Grep exhaustif = 0 résultat | P4 |
| Cycles d'import (4-5 fichiers) entre `cloneos-history` et `messages` | `graphify-out/GRAPH_REPORT.md:1435-1442`, 6 cycles listés | P2 |
| Architecture parallèle CloneChat au niveau routage : `POST /api/assistant` (déterministe, sans IA) vs `POST /api/assistant/chat` (pipeline OpenAI gouverné réel) | La route "nue" reste un endpoint HTTP live, appelée par aucun code frontend vérifié (seul un test l'importe) — risque de réponse divergente silencieuse si un futur appelant se trompe de route | P2 |
| **Point positif** : dépendances tierces compactes (23 `dependencies`, 17 `devDependencies`), aucun doublon (pas deux libs UI, pas deux libs de dates) pour 71 pages / 319 routes API | Le cœur métier est très majoritairement first-party (`src/lib/pierre`, `cloneos`, `clonechat`...) | — |
| **Point positif** : migrations Supabase à 3 niveaux réellement enforced par le runner (`scripts/db/migrate.mjs:17` chemin en dur, exclut `migrations-draft/` et `migrations-p941/`) | Séparation apply/no-apply délibérée et outillée, pas un oubli | — |

## 6. Sécurité (niveau code, lecture seule — aucune exploitation)

| Constat | Sévérité |
|---|---|
| **Fuite systémique de messages d'erreur internes bruts** (`e.message` renvoyé tel quel au client) sur ~31 fichiers API legacy (`/api/checkout`, `/api/billing/*`, `/api/orders/*`, `/api/pierre/onboarding`...) — alors qu'une couche plus récente (`src/app/api/pierre/v1/_runtime.ts`) redacte déjà proprement les erreurs | P2 |
| `/api/router` : URL de webhook Make.com **codée en dur** dans le source (pas en variable d'env) + auth par **token en clair** sur une table `api_tokens` **introuvable dans les migrations suivies** ; coexiste avec une seconde table d'entitlement legacy `agents_owned` toujours interrogée par une page active, en parallèle de la table `orders` utilisée partout ailleurs (deux sources de vérité d'entitlement qui peuvent diverger silencieusement) | P2 |
| `/api/pierre/generate` (génération de document via GPT-5) : accessible à **tout utilisateur Supabase authentifié**, sans vérification d'abonnement Pierre actif ni rate limiting — contrairement aux autres routes `/api/pierre/use/**` qui vérifient l'accès payant | P2 — risque d'abus de coût OpenAI |
| Couche de sécurité centralisée B41 (`route-guard`/`tenant-scope`/`rate-limit`, bien conçue et testée) **branchée sur seulement 3 routes API sur ~313** — le reste réimplémente son auth fichier par fichier (correct dans les échantillons lus, non garanti sur l'ensemble) | P3 — risque structurel, pas un bug isolé |
| Scanner antivirus des uploads **non fonctionnellement câblé** : l'adaptateur ClamAV est un stub qui ne scanne jamais réellement (`not_wired`), le scanner par défaut est un scanner de test (détection MIME+taille+chaîne EICAR seulement) | P3 — auto-documenté comme WIP dans le code |
| `/profile/**` protégée **seulement côté client** (hook `useEffect` asynchrone), contrairement à `/cockpit` et `/mon-clonestore` gérées au edge (middleware) | P3 |
| Composant `PierreDocumentPanel.tsx` fait un `dangerouslySetInnerHTML` sans passer par le sanitizer HTML existant ailleurs dans le repo — **mais ce composant n'est actuellement importé nulle part** (code mort, non exploitable en l'état) | P3 — latent, pas actif |
| **Point positif** : aucun secret réel (clé API, mot de passe) trouvé en dur dans le code source (hors chaînes de test factices dans `__tests__`) | — |
| **Point positif** : RLS et fonctions `SECURITY DEFINER` bien présentes (32/50 fichiers de migration), aucune policy permissive `USING (true)` trouvée | — |
| **Point positif** : vérification de signature webhook Stripe réellement obligatoire (double secret compte+Connect), fail-closed | — |
| **Point positif** : hard floor `PRODUCTION_AUTHORIZED = false as const` (P10) réellement câblé et court-circuite le checkout **avant** tout appel réseau Stripe | — |

## 7. Git — statut non fiable sur cette machine

`git.exe` est bloqué au niveau OS sur cet environnement (permission refusée, PowerShell et Git Bash, avec ou sans sandbox). Le statut "clean" annoncé par le harnais en début de session **est donc faux par construction** — confirmé via `node gittool/gitaudit.cjs` (isomorphic-git) : branche `main`, HEAD `3f25febfa` ("feat(clonestore): complete master product acceptance"), mais **27 045 fichiers modifiés/non suivis** (majoritairement du bruit — proofs JSON historiques). Le contournement isomorphic-git a lui-même planté en tentant un parcours complet de l'arbre de travail (`TypeError` dans `GitWalkerFs.content`) — le statut de suivi réel des 23 dossiers `.next-*` (commités ou non) **n'a pas pu être établi avec certitude** dans cette session.

## 8. Performance dev-mode (mesures réelles, avec mise en garde forte)

Toutes les mesures ci-dessous ont été prises en **mode développement (`next dev`)**, sous une charge concurrente artificiellement élevée créée par l'audit lui-même (11 agents parallèles + ESLint + tentative de build + serveur dev, tous simultanés). **Ce ne sont PAS des mesures de performance de production** — la production sert des bundles pré-construits, sans compilation à la demande. Elles documentent la fragilité de l'environnement de développement local, pas l'expérience utilisateur finale.

| Route | 1ère compilation | Requête complète (froid) | Requête (chaud, cache mémoire) |
|---|---|---|---|
| `/` (homepage) | 1908s (~32 min), 1601 modules | 47m31s bout-en-bout (curl) | 2,7s |
| `/demo` | ~195s (curl warm-up) | — | domContentLoaded 30,6s (encore sous charge) |
| `/agents/pierre` | ~145-162s | — | 1,1-6s selon charge concurrente |
| `/paiement` | 86,3s | 1 requête a résulté en **500** transitoire (voir CLONESTORE_ISSUE_REGISTER.md) | 0,6-2,7s une fois stabilisé |

Aucun outil Lighthouse CLI confirmé disponible dans cet environnement — non installé, non testé. **Section performance de production NON TESTÉE** : nécessiterait un build de production stable (§4) servi et mesuré en isolation, hors du périmètre atteint dans cette session.

## 8ter. Payment Path Closure (2026-07-24)

CTA Suisse câblé, tarification pays (FR/BE/LU/CH) révélée par défaut et testée, prix Stripe test CHF créé et vérifié via l'API réelle, réconciliation pays webhook révélée par défaut. Le 500 historique sur `/paiement` a été **requalifié en artefact d'environnement `next dev`** (boucle de recompilation continue accumulée sur une session de 12h+) — non reproductible sur un build de production stable (200 constant, 4/4, ~25-50ms). `tsc` propre après suppression d'un `tsconfig.tsbuildinfo` gonflé à 6,1 Mo (cause du seul crash OOM rencontré). ESLint scopé = 0 erreur. 36 tests nouveaux + ~5946 tests de non-régression exécutés en direct, tous verts. Build de production isolé : voir `PAYMENT_PATH_CLOSURE_REPORT.md` pour le résultat définitif. Détail complet : `PAYMENT_PATH_CLOSURE_REPORT.md`, `PAYMENT_COUNTRY_PRICE_MATRIX.md`, `PAYMENT_ROUTE_AND_STATE_MATRIX.md`, `PAYMENT_TEST_MATRIX.md`, `PAYMENT_STRIPE_TEST_EVIDENCE.md`, `PAYMENT_REMAINING_RISKS.md`.

## 8quinquies. Demo and Mobile Conversion Closure (2026-07-24)

Bloc exécuté en parallèle d'un chantier externe concurrent (4 commits de build légitimes intégrés en cours de bloc, HEAD `7e37d715f`→`0b3d79e61`, jamais annulés, jamais attribués à ce bloc). Hydratation ISSUE-04 investiguée en profondeur : aucune cause applicative retrouvée après recherche exhaustive (zéro `caret-color` dans tout le dépôt), cause externe par extension navigateur hautement probable non prouvée à 100%, `suppressHydrationWarning` ciblé et testé sur exactement 3 éléments justifiés. Gap réel corrigé : `vitest.config.ts` bloquait tout test de composant React dans ce dépôt depuis toujours (`tsconfig.json` en `jsx:"preserve"`) — corrigé côté Vitest uniquement, sans toucher le build Next.js. Nouvelle invitation contextuelle démo (scroll 35%, flag `NEXT_PUBLIC_DEMO_CONTEXTUAL_PROMPT_ENABLED` OFF par défaut) avec arbitrage anti-collision explicite et testé contre le `GuidedTourProvider` préexistant (165 tests verts, dont sa suite complète inchangée). 23 tests nouveaux + 1432 tests de non-régression exécutés en direct, tous verts (un flake transitoire de contamination inter-tests observé puis disparu au second run, non lié à ce bloc). `tsc` propre, ESLint ciblé = 0 erreur. **Découverte critique lors de la revue des commits externes** : `/api/pierre/execute` (P0.1) n'invoque en réalité aucune évaluation de gouvernance dans son code actuel — voir ISSUE-40, statut `P0_1_EXECUTE_ROUTE_GOVERNANCE_GAP_PREEXISTING — BLOCKER CRITIQUE HORS PÉRIMÈTRE DÉCOUVERT PENDANT LE BLOC`, non corrigé dans ce bloc (fichier protégé, hors périmètre). Build de production isolé : **vert après une relance** (`BUILD_ID=k8CJnDblN6dLdp3lKOy4r`, 196/196, `REAL_EXIT_CODE=0`, 12 routes requises confirmées) — ce succès de build ne dit rien de la gouvernance de la route, qui reste rouge côté tests (9/10 P0.1). Voir `DEMO_AND_MOBILE_CONVERSION_CLOSURE_REPORT.md` pour le résultat définitif. Détail complet : `DEMO_AND_MOBILE_CONVERSION_CLOSURE_REPORT.md` et les 13 annexes associées.

## 8sexies. P0.1 Execute Route Governance Re-Closure (2026-07-24, soirée)

Bloc dédié déclenché par la découverte du bloc 8quinquies ci-dessus (ISSUE-40). Forensique Git
(hash de contenu par commit via `isomorphic-git` + `git.status`/mtime par fichier — `git.exe`
reste bloqué au niveau OS) : une version gouvernée réelle de `/api/pierre/execute` avait été
écrite le 2026-07-23 (module `legacy-execute-governance.ts`, 8 tests unitaires, 10 tests
d'intégration, règle additive `cloneguard.ts`), mais n'avait **jamais été commitée en Git** et a
été **écrasée sur disque le 2026-07-24** (mtime du fichier : 16:44:32, exactement dans la
fenêtre des commits externes concurrents `bea7a7dd1`/`0b3d79e61` déjà examinés au bloc
précédent) — classification retenue : `GOVERNED_VERSION_EXISTED_AND_WAS_OVERWRITTEN`. Le
rapport historique `P0_GOVERNANCE_CLOSURE_REPORT.md` n'était donc pas fabriqué : le travail
décrit était réel, seule son intégration dans `route.ts` avait disparu (voir
`P0_1_PREVIOUS_REPORT_RECONCILIATION.md`, classification affirmation par affirmation).
Re-clôture : `evaluateLegacyExecuteGovernance` réimporté tel quel (aucun second évaluateur
créé), `email.send`→DENY, `doc.generate`/`hris.sync`→REQUIRE_APPROVAL (jamais ALLOW, plancher
route dédié pour `hris.sync`), connecteur Make direct (`callMake`, 3 `MAKE_*_WEBHOOK_URL`)
retiré entièrement du fichier plutôt que laissé comme code mort inatteignable, pattern
d'initialisation paresseuse des 4 commits externes intégralement préservé. Deux appelants
internes réels cartographiés : `/api/pierre/tick` (déjà cité par le rapport historique,
reconfirmé) et `/api/pierre/run` (nouveau, boucle `generate→execute`). Preuve : 18/18 tests
P0.1 (comptage identique à celui annoncé par le rapport historique, cette fois réellement vert)
+ 15/15 tests transversaux P0.1/P0.2 + 5611/5613 tests de la zone Pierre complète (1 flake de
parallélisme préexistant sans rapport, vert en isolation) + 9165/9165 `npm test`, `tsc` 0
erreur, ESLint scopé 0. Build de production isolé : voir `P0_1_BUILD_EVIDENCE.md` pour le
résultat définitif. Détail complet : `P0_1_EXECUTE_ROUTE_GOVERNANCE_RECLOSURE_REPORT.md` et les
8 annexes associées (`P0_1_GIT_FORENSIC_TIMELINE.md`, `P0_1_CURRENT_ROUTE_BEFORE_AFTER.md`,
`P0_1_CALLER_AND_SURFACE_MATRIX.md`, `P0_1_GOVERNANCE_DECISION_MATRIX.md`,
`P0_1_TEST_MATRIX.md`, `P0_1_BUILD_EVIDENCE.md`, `P0_1_REMAINING_RISKS.md`,
`P0_1_PREVIOUS_REPORT_RECONCILIATION.md`).

## 8quater. Legal and Commercial Trust Closure (2026-07-24)

Fermeture technique (pas une certification juridique) : checkbox d'acceptation CGV/confidentialité non précochée ajoutée au checkout avec validation serveur (`LEGAL_ACCEPTANCE_REQUIRED` si absente, version+date envoyées) ; footer complété (5 liens légaux au lieu de 1) ; `/legal/confidentialite` alignée sur les 4 autres pages légales (bannière Draft + nav, contenu inchangé) ; mention courte ajoutée à `/signup` (auparavant zéro référence légale) ; une promesse commerciale non bornée corrigée sur `/questions`, une incohérence de métadonnées corrigée sur `/partenaires`. Une découverte architecturale majeure : un moteur légal/commercial complet préexistant (`src/lib/legal-commercial/` "B47", `src/lib/go-live/legal-entity/`, `public-launch-final-review-gate.ts`, `scripts/legal-public-copy-scan.mjs`) a été identifié et réutilisé plutôt que dupliqué. `tsc` propre (0 erreur, après purge d'un `tsconfig.tsbuildinfo` à nouveau gonflé — même schéma récurrent que les blocs précédents). ESLint scopé sur les 9 fichiers touchés = 0 erreur. Scanner canonique `legal-public-copy-scan.mjs` exécuté : 0 violation bloquante sur les 6 pages publiques scannées, 14 placeholders légaux (attendus, identité toujours manquante), 7 champs société toujours en attente. 846 tests de non-régression exécutés en direct (376+470), tous verts, dont 1 nouveau test de refus serveur sans acceptation. Aucune identité juridique n'a été inventée ; une incohérence factuelle a été trouvée dans le DPA (sous-traitant IA nommé "Anthropic" alors que le code confirme OpenAI comme seul fournisseur LLM réel). Build de production isolé : voir `LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md` pour le résultat définitif (deux premières tentatives ont échoué pour des raisons environnementales — un flag CLI invalide, puis une contention mémoire réelle du système à ~3,3 Go libres sur 16 Go — sans rapport avec le code de ce bloc). Détail complet : `LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md` et les 12 annexes associées.

## 8bis. P0 Governance Closure (2026-07-23, après-midi) + P0.2 Sibling Surfaces Closure (soirée)

Le contournement de gouvernance ISSUE-01 (`/api/pierre/execute`) a été fermé dans cette même session (bloc P0.1). `tsc --noEmit` reste propre après le correctif ; ESLint scopé sur les 3 fichiers modifiés/créés = 0 erreur (1 avertissement pré-existant sans rapport). 18 tests réels ajoutés (tous verts) + 6064 tests de non-régression exécutés en direct (tous verts, 0 échec). **Build de production isolé re-testé avec les changements inclus : succès complet** (`BUILD_ID` généré, `/api/pierre/execute` bundlé sans erreur, 196 pages statiques). Détail : `P0_GOVERNANCE_CLOSURE_REPORT.md`, `P0_EXECUTION_PATH_MATRIX.md`, `P0_GOVERNANCE_TEST_MATRIX.md`, `P0_REMAINING_GOVERNANCE_RISKS.md`.

**Bloc P0.2 (même journée)** : les deux surfaces sœurs confirmées par P0.1 (ISSUE-38/39) ont été fermées à leur tour. `/api/pierre/action` gouvernée (réutilise le module de P0.1 sans le modifier) + idempotence ajoutée ; `/api/router` neutralisée (410 Gone, aucun appelant trouvé, URL Make codée en dur retirée du code). 15 tests nouveaux (tous verts) + 5615 tests de non-régression exécutés en direct (tous verts, 0 échec). `tsc` propre, ESLint scopé = 0 erreur. **Build de production isolé re-testé avec succès** (`BUILD_ID` généré, `/api/pierre/action` et `/api/router` tous deux bundlés sans erreur). Voir `P0_2_SIBLING_SURFACES_CLOSURE_REPORT.md` pour le résultat définitif et `P0_2_EXECUTION_SURFACES_MATRIX.md`/`P0_2_CALLER_INVENTORY.md`/`P0_2_TEST_MATRIX.md`/`P0_2_REMAINING_EXECUTION_RISKS.md` pour le détail complet.

## 9bis. Vérification HTTP complémentaire (post-Playwright) sur les routes restantes

**Limite d'outillage survenue en cours d'audit** : le serveur MCP Playwright s'est déconnecté au milieu de cette session — plus aucune automatisation navigateur (navigation, capture d'écran, console JS, réseau, redimensionnement mobile) n'a été disponible pour la suite. Les vérifications ci-dessous ont donc été faites au niveau **HTTP brut (curl)**, pas au niveau navigateur — statut, en-têtes, présence de `<title>`, taille du corps de réponse uniquement. **Rendu visuel réel, erreurs console JS, comportement tactile/interactif : NON TESTÉS** pour ces routes.

| Route | HTTP | `<title>` | Taille corps | Note |
|---|---|---|---|---|
| `/checkout` | 200 | "CloneStore" (générique) | 41,7 KB | Confirme la metadata générique déjà identifiée par l'agent SEO |
| `/reserver/pierre` | 200 | "Réserver Pierre — CloneStore" (propre) | 40,8 KB | Metadata dédiée présente |
| `/login` | 200 | "CloneStore" (générique) | 40,5 KB | — |
| `/signup` | 200 | "CloneStore" (générique) | 46,2 KB | — |
| `/partenaires` | 200 | "Cabinets Fondateurs CloneStore — Proposez à vos clients une équipe RH IA complète" (propre) | 67,5 KB | Metadata dédiée présente |
| `/legal/cgv` | 200 | "CloneStore" (générique) | 141,7 KB | Corps le plus volumineux du lot — cohérent avec un vrai texte juridique long |
| Route 404 aléatoire | **404** | "Page introuvable — CloneStore" | 34 KB | **Positif confirmé** : page 404 personnalisée réelle, pas un crash ni une page blanche |

Toutes les routes testées retournent un corps HTML substantiel (aucune page vide/blanche), confirmant qu'elles rendent un contenu réel au niveau serveur. Le comportement de la 404 personnalisée est un point positif net.

## 9. Ce qui est solide (à ne pas casser)

- `tsc` propre sur l'ensemble du code (0 erreur).
- `next build` réussit intégralement en isolation (196/196 pages statiques, 0 erreur) — le crash OOM initial était un artefact de contention de l'audit, pas un défaut du build.
- Page 404 personnalisée réelle et fonctionnelle ("Page introuvable — CloneStore"), pas de crash sur route inconnue.
- Cœur métier Pierre (`src/lib/pierre/v1/**`, `hr/**`) : idempotence, isolation tenant, floors human-only réellement câblés et non contournables dans le chemin d'exécution principal, cycle de vie documentaire avec intégrité SHA-256.
- Pipeline paiement : hard floor de production, vérification de signature webhook, anti-double-crédit de commission partenaire.
- RLS Supabase et migrations proprement tierées (apply/no-apply enforced par le tooling).
- Dépendances tierces compactes et sans doublon.
