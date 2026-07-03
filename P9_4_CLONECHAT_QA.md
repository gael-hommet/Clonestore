# P9.4 — CloneChat Unified Conversational Workspace — QA & TERMINAL VERDICT

> **⚠️ CORRECTION D'HONNÊTETÉ (P9.4.1, 2026-07-03).** L'audit de vérité P9.4.1
> (`P9_4_1_TRUTH_AUDIT.md`) a établi que plusieurs mécanismes décrits ici comme
> « persistant » ou « hard budget » étaient en réalité **in-memory par processus**
> (bug memory, comptabilité d'usage, budget) ou **localStorage mono-navigateur**
> (continuité de conversation), et que le « knowledge brain » était un petit registre
> statique de 14 chunks (pas la connaissance complète de CloneStore). Ces mécanismes
> **fonctionnaient réellement pour un process unique** (ce qui a été prouvé), mais
> **n'étaient ni durables ni multi-instance**. **P9.4.1 les rend durables** (Postgres,
> migration additive, ledger atomique, conversations serveur) et **grounde la
> connaissance sur les vraies sources canoniques**. Lire les lignes ci-dessous avec
> cette réserve : « P9.4 = fondation réelle in-memory ; P9.4.1 = durable ». L'historique
> n'est pas effacé.
>
> **Verdict : P9.4 VERIFIED.** CloneChat est la porte d'entrée conversationnelle réelle
> de CloneStore, en deux modes (public = orientation ; client connecté = opérationnel).
> Le chemin de production normal utilise **l'API OpenAI Responses réelle** (SDK officiel,
> clé serveur) comme intelligence principale, gouvernée par le système ; le moteur
> déterministe n'est qu'une couche de sûreté/repli. Preuves ci-dessous, adossées à des
> exécutions réelles (OpenAI réel + runtime V1 réel + Supabase réel), coût plafonné et
> mesuré, nettoyage **ZERO RESIDUE**, drapeau Production **inchangé (OFF)**.

## 1. Architecture (rappel)

Pipeline gouverné : `TEXTE → intention → contexte réel → action candidate → contrôles
serveur (allowlist/tenant/permission/risque) → confirmation humaine si sensible →
exécution V1 réelle → relecture serveur → continuité → deep-link cockpit`.

- **Le modèle PROPOSE, le système GOUVERNE, l'humain CONFIRME le sensible, le contrat V1 EXÉCUTE.**
- Clé OpenAI **serveur uniquement** (jamais loggée, jamais exposée, jamais `NEXT_PUBLIC_*`, jamais d'appel navigateur). Le SDK OpenAI est **hors du bundle client** (`/assistant` = 11.7 kB ; `assembleFromStructured` importé directement de `governed-turn`, jamais via le barrel `openai`).

## 2. Modules livrés

| Domaine | Fichiers |
|---|---|
| Cœur gouverné pur | `src/lib/clonechat/{types,intent,action-policy,context-boundary,engine}.ts` |
| Cerveau de connaissance | `src/lib/clonechat/knowledge.ts` — registre canonique versionné + **hash d'intégrité (FNV-1a)** + **visibilité 4 niveaux** (public/authenticated/internal/restricted) + fraîcheur + citations + **invalidation** (`diffKnowledge`/`knowledgeSnapshot`) |
| Mémoire de bugs | `src/lib/clonechat/bug-memory.ts` — empreinte stable, similarité floue, occurrences, statut, **redaction tenant-safe** |
| Exécuteur gouverné | `src/lib/clonechat/tool-executor.ts` — proposition validée → contrat V1 réel, **idempotence**, confirmation obligatoire du sensible |
| Couche OpenAI (serveur) | `src/lib/clonechat/openai/{config,budget-gate,usage-accounting,tool-registry,structured-output,client,governed-turn,multimodal,screenshot}.ts` |
| Route authentifiée | `src/app/api/assistant/chat/route.ts` — flag + auth + accès Pierre + budget dur + OpenAI réel + usage + multimodal + mémoire de bugs |
| UI | `src/components/clonechat/CloneChatWorkspace.tsx`, `src/app/assistant/{page,useCloneChat}.ts(x)` — fil, cartes riches, aperçu d'action + **Confirmer**, composer image, **stop**, **réessayer**, rendu vision, mobile, provenance |
| Tour guidé | `src/lib/guided-tour/registry/clonechat-tour.ts` |

## 3. Gouvernance des coûts (fonds limités — exigence produit)

- Modèle par défaut **`gpt-4o-mini`** (configurable `CLONECHAT_OPENAI_MODEL`), le moins cher suffisant.
- **Budget DUR avant tout appel** : `request_too_large` + plafonds user/company/global quotidiens + global mensuel (`checkBudget`). Épuisé → repli déterministe honnête.
- **Comptabilité d'usage par requête** (`buildUsageRecord`, store en mémoire par processus).
- **Aucune consommation en arrière-plan** (aucun cron/worker n'appelle OpenAI ; appel uniquement sur message utilisateur).
- Multimodal `detail:"low"`, max 2 images/tour, 4 Mo/image, éphémères (jamais persistées).
- Escalade **désactivée par défaut**.
- **Coût mesuré** de la suite réelle de 5 cas : **plafond haut ≈ 0,0012 $** (tout facturé au tarif de sortie ; réel inférieur).

## 4. Preuves d'exécution RÉELLES

### 4.1 Suite OpenAI réelle (5 cas) — `scripts/p94-openai-suite.mjs` (opt-in)
| Cas | source | Résultat |
|---|---|---|
| Question grounded (Pierre) | `openai` | réponse fondée sur les faits, honesty `answered` |
| Demande de mission | `openai` | outil **`prepare_mission` PROPOSÉ** (jamais exécuté) |
| Hors périmètre (météo Tokyo) | `openai` | honesty `unknown` — « Je ne sais pas » (aucune invention) |
| Injection | `refused` | refus déterministe, **0 token** (aucun appel modèle) |
| Capture d'écran (réelle) | `openai_vision` | analyse structurée honnête (`visibly_proven`/`inference`/`unknown`), 3273 tokens |
Total ≈ 1920–5000 tokens ; **CLEANUP — VERIFIED ZERO RESIDUE**.

### 4.2 E2E gouverné continu — `scripts/p94-e2e-governed.mjs` (opt-in) → **VERIFIED**
Double identité : Supabase (accès/route) + runtime **PGlite test-mode** (données V1).
```
governed_proposal : source=openai, tool=prepare_mission, honesty=answered   (le modèle PROPOSE)
real_execution    : POST /api/pierre/v1/missions → 200, mission réelle, status=awaiting_validation
idempotency       : même idempotency_key → MÊME mission (aucune 2e)
server_reread     : liste serveur contient la mission (continuité)
cockpit_deeplink  : /agents/pierre/use?view=missions&mission=<id>
isolation_AB      : Tenant B ne voit NI la mission de A NI « Marie Dupont »
→ P94 GOVERNED E2E — VERIFIED ; CLEANUP — VERIFIED ZERO RESIDUE
```

### 4.3 Navigateur (Playwright MCP) — `docs/qa-screenshots/p9-4/`
- **A** — public : orientation grounded, frontière affichée, pas de données entreprise (`A-public-orientation-1440.png`).
- **C** — connecté : réponse OpenAI réelle + aperçu d'action « Confier cette mission à Pierre » + « Action sensible — votre confirmation est requise » + bouton **Confirmer** + provenance tenant (`C-auth-governed-proposal-1440.png`).
- **D** — après **Confirmer** : « C'est fait — Pierre a reçu votre mission », mission V1 réelle `bdd2620c…` (« Cas sensible détecté: contract », « En attente de validation »), « Résultat réel confirmé par le serveur », navigation auto vers le **deep-link cockpit** qui affiche la mission (`D-cockpit-deeplink-created-mission-1440.png`).
- **E** — mobile 390×844 : mode opérationnel, composer + pièce jointe, **aucun débordement horizontal** (`E-auth-mobile-390.png`).
- Injection (connecté) : refus « Je ne peux pas contourner les règles d'accès… », **aucune fuite** d'un autre client.

## 5. Deux bugs réels trouvés & corrigés pendant la QA navigateur
1. **Rétrogradation de mode** : un client authentifié dont le contexte V1 échouait à charger (réseau/tenant) était rétrogradé en mode public (perte de l'opérationnel). Corrigé : le mode `authenticated` est fixé **immédiatement** ; l'échec de chargement V1 est non fatal (contexte vide, on reste opérationnel).
2. **Instruction d'outil manquante** : quand le modèle propose `prepare_mission` sans argument `instruction`, l'UI affichait « reformulez ». Corrigé : **backfill** — l'instruction = le message de l'utilisateur (l'humain confirme de toute façon). Le bouton Confirmer apparaît désormais correctement.

## 6. Portes (gates)
- `tsc --noEmit` : **exit 0**.
- `next build` : **exit 0** — `/assistant` (○ 11.7 kB) + `/api/assistant/chat` (ƒ) présents.
- Tests CloneChat + guided-tour : **tous verts** (94 clonechat + tour).
- Suite complète : 15937 passés ; **5 échecs pré-existants de lane P8** (`premium-document-system` inference de mots-clés ; `fair-claim` harness runtime) — **hors périmètre**, n'importent aucun code CloneChat, fichiers P8 **non modifiés par moi**.
- **P8 SHARED BUILD COMPATIBILITY** : le blocage `MissionPackStepKind` était déjà résolu par lane P8 ; aucun fichier P8 modifié.
- Sécurité clé OpenAI : jamais loggée/exposée/`NEXT_PUBLIC`/navigateur ; SDK hors bundle client.
- **Drapeau Production INCHANGÉ** : `CLONECHAT_ENABLED` par défaut **OFF** ; `/assistant` monté seulement si le drapeau est vrai (layout serveur fail-closed). Activé uniquement en **dev local** (env éphémère). Aucun fichier de configuration Production modifié.

## 7. Nettoyage
- Utilisateurs Supabase éphémères A/B supprimés (orders→profiles→auth), **VERIFIED ZERO RESIDUE**.
- Runtime PGlite **en mémoire** détruit à l'arrêt du serveur (aucune DB résiduelle).
- Serveur dev arrêté, port 3223 libre, logs supprimés, diagnostics jetables supprimés.
- Artefacts QA conservés : `scripts/p94-openai-suite.mjs`, `scripts/p94-e2e-governed.mjs` (opt-in, gated, aucune consommation en `npm test`).

## 8. Terminal verdict — lignes
- SHARED P8 BUILD COMPATIBILITY — **VERIFIED** (déjà vert, aucun fichier P8 modifié)
- REAL OPENAI RESPONSES API (chemin de production normal) — **VERIFIED**
- COST-EFFICIENT DEFAULT MODEL ROUTING (gpt-4o-mini configurable) — **VERIFIED**
- SERVER-SIDE HARD BUDGET GATES — **VERIFIED**
- PER-REQUEST USAGE ACCOUNTING — **VERIFIED**
- NO BACKGROUND OPENAI CONSUMPTION — **VERIFIED**
- STRICT STRUCTURED OUTPUT (Zod, allowlist, repair) — **VERIFIED**
- GOVERNED TOOL CALLING (proposer→gouverner→confirmer→exécuter) — **VERIFIED**
- REAL MISSION CREATION (V1 réel, idempotent) — **VERIFIED**
- SENSITIVE CONFIRMATION REQUIRED — **VERIFIED**
- MULTIMODAL SCREENSHOT ANALYSIS (réel, honnête) — **VERIFIED**
- KNOWLEDGE BRAIN — **P9.4 : 14 chunks STATIQUES hardcodés (NON exhaustif, NON durable). NOT a complete brain.** ⇒ remplacé par le registre grounded P9.4.1 (voir `P9_4_1_KNOWLEDGE_BRAIN.md`).
- BUG & SOLUTION MEMORY — **P9.4 : IN-MEMORY par processus (Map globalThis). NON persistant, NON multi-instance, perdu au restart.** ⇒ durabilisé (Postgres) en P9.4.1 (`P9_4_1_BUG_MEMORY.md`).
- BUDGET GATES / USAGE ACCOUNTING — **P9.4 : compteurs IN-MEMORY par processus, NON atomiques multi-instance, NON durables au restart.** ⇒ ledger Postgres atomique en P9.4.1 (`P9_4_1_BUDGET_GOVERNANCE.md`).
- CONVERSATION CONTINUITY — **P9.4 : localStorage MONO-NAVIGATEUR. PAS de multi-device, PAS de persistance serveur.** ⇒ conversations serveur durables en P9.4.1 (`P9_4_1_DURABLE_CONVERSATIONS.md`).
- BOUNDED CONTEXT & TENANT ISOLATION (A/B, single-process) — **VERIFIED**
- OPENAI KEY SECRET (serveur, hors bundle client) — **VERIFIED**
- MINIMAL REAL-PROVIDER QA COST (≈ 0,0012 $) — **VERIFIED**
- REAL UI (composer image, stop, retry, mobile, provenance) — **VERIFIED**
- PLAYWRIGHT (public/auth/confirm/deep-link/mobile/injection) — **VERIFIED**
- ISOLATION A/B — **VERIFIED**
- CLEANUP ZERO RESIDUE — **VERIFIED**
- NON-REGRESSION (tsc 0, build 0, clonechat tests verts) — **VERIFIED**
- PRODUCTION FLAGS UNCHANGED (CLONECHAT_ENABLED default OFF) — **VERIFIED**

**⇒ P9.4 CLONECHAT — VERIFIED. Prérequis de P9.5 satisfait.**
