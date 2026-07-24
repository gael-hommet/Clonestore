# CloneStore — Audit Pierre (produit vendu 449€/mois, 499 CHF Suisse)

Audit du 2026-07-23. Périmètre : `src/lib/pierre/**` (moteur v1 + bloc `hr/`), routes `src/app/api/pierre/**`, pages `/agents/pierre`, `/demo`, `/test-pierre`. Méthode : lecture de code (fait de code ≠ preuve d'exécution, distingué partout) + vérification navigateur réelle sur `/agents/pierre` et `/demo`.

## Verdict par capacité

| Capacité | Statut | Preuve |
|---|---|---|
| Missions/tâches (`mission-service.ts`) | **Totalement fonctionnelle (code)** | Idempotence de replay, plafond d'autonomie serveur-authoritatif (le client ne peut pas escalader en forgeant `autonomy_mode`), isolation anti-cross-tenant AVANT tout insert, machine à états, empreinte figée sur les approbations (`content_fingerprint`) |
| Employee 360 (`buildEmployeeFile360`) | **Fonctionnelle (code)** | Agrégateur défensif : gère proprement les cas vides/malformés, isole les échecs individuels par try/catch, réellement appelé par une route API |
| Documents (cycle de vie `v1/documents.ts` + `v1/templates.ts`) | **Fonctionnelle et robuste (code)** | Statuts immuables une fois `final`/`signed`, re-vérification antivirus au moment de la finalisation (bug historique documenté et corrigé dans le code), intégrité SHA-256 recalculée, **ne invente jamais** une donnée manquante (reportée dans `missing_fields`) |
| Onboarding (`v1/onboarding-service.ts`) | **Fonctionnelle (code)** | Complétude calculée serveur, le client ne peut jamais forcer un pourcentage ou une étape |
| CloneTrace (`v1/trace/canonical-event.ts`) | **Fonctionnelle, partielle en bout-en-bout** | Enveloppe canonique réelle, mais l'ancien `ObservableEvent` reste documenté "(unwired)" dans le code lui-même — non confirmé comme réellement consommé en production au-delà de l'adaptateur |
| **Floors human-only** (licenciement, sanction, disciplinaire, harcèlement, discrimination) | **Réels et non contournables — MAIS PAS UNIVERSELS** | Voir section "Défaut majeur" ci-dessous |
| CloneGuard / Gouvernance | **Fragmentée** | Voir section "Défaut majeur" |
| CloneContinuum | **N'existe pas sous ce nom** dans `src/lib/pierre/**` | Voir section "Défaut majeur" |
| Génération de documents via IA (`/api/pierre/generate`) | **Fonctionnelle mais non gouvernée** | Appelle réellement `openai.responses.create({model:"gpt-5"})` et écrit en base, mais **sans aucune évaluation CloneGuard**, contrairement au reste du moteur documentaire |

## Mise à jour 2026-07-23 (après-midi) — P0 fermé sur `/api/pierre/execute`

Le défaut ci-dessous a été corrigé le jour même : `/api/pierre/execute` passe désormais par les mêmes évaluateurs canoniques (`evaluatePierreCloneGuard`+`evaluateGovernance`) que le moteur v1/hr, et tout appel externe direct (Make.com) a été retiré du fichier. Preuve : 18 tests réels + 6064 tests de non-régression, tous verts — voir `P0_GOVERNANCE_CLOSURE_REPORT.md`. **Mise à jour 2026-07-23 (bloc P0.2)** : les deux surfaces analogues (`/api/pierre/action`, `/api/router`) sont **désormais fermées également** — voir `P0_2_SIBLING_SURFACES_CLOSURE_REPORT.md`. `/api/pierre/action` passe maintenant par la même gouvernance canonique (email.send refusé, doc.generate mis en attente d'approbation) ; `/api/router` a été neutralisée (410 Gone, aucun appelant trouvé). Le constat "les floors ne sont pas universels" ne s'applique plus à AUCUNE des 3 surfaces d'exécution HTTP historiquement identifiées. Ce qui reste non résolu (hors périmètre des deux blocs P0) : la fragmentation de la gouvernance en 4 implémentations à l'intérieur même du moteur v1/hr (ISSUE-07).

## Défaut majeur confirmé (CORRIGÉ pour `/api/pierre/execute`, PARTIEL ailleurs) : les floors "human-only" ne sont pas universels

Le code prouve que les règles de sécurité RH (ex. *"un email n'est jamais auto-exécuté par Pierre"*, *"licenciement/sanction toujours requiert une validation humaine"*) sont **réelles et non contournables — mais seulement dans le chemin d'exécution principal (`v1`/`hr`, via `execute-task.ts` et `mission-service.ts`)**.

Une **route legacy parallèle**, `/api/pierre/execute` (architecture "V0", authentification HMAC + `client_id` externe, 551 lignes), exécute `email.send` / `doc.generate` / `hris.sync` directement vers des webhooks Make.com **sans aucune évaluation CloneGuard ni gouvernance** — grep exhaustif sur ce fichier : 0 résultat pour `cloneguard|governance|requires_human|approval`. C'est une contradiction directe et prouvée par lecture avec la règle imposée ailleurs.

De plus :
- `/api/pierre/run` attend de `/api/pierre/generate` un format de réponse (`{agent, actions[], safety}`) que `/api/pierre/generate` **ne produit plus** (il renvoie `{ok, document}` depuis une réécriture pour servir le studio de debug `/test-pierre`). Le parsing Zod échouera systématiquement — **pipeline cassé, prouvé par lecture**.
- La gouvernance/CloneGuard/Autonomy existe en **au moins 4 implémentations parallèles non unifiées** : (a) `hr/cloneguard.ts`+`hr/governance.ts`, (b) `v1/autonomy.ts`+`v1/cloneguard.ts`, (c) `v1/governance/canonical-decision.ts` (la version "canonique" P19, mais **branchée uniquement dans l'orchestrateur CloneOS multi-canal, jamais dans le pipeline mission/tâche principal**), (d) `hr/autonomy.ts`. Le fichier `canonical-decision.ts` reconnaît lui-même cette fragmentation dans ses commentaires.
- **CloneContinuum**, l'une des 6 technologies Pierre mises en scène dans `/demo`, n'a **aucune implémentation réelle sous ce nom** dans `src/lib/pierre/**` — seulement des répliques de démo scénarisées et une dépendance déclarée-jamais-câblée. Le module réel de continuité (`hr/continuity.ts`, 1159 lignes) ne mentionne jamais ce nom.

**Conséquence pour le verdict commercial** : la promesse "Pierre ne fait jamais X sans validation humaine" est **vraie pour le produit tel qu'utilisé par un client normal via le cockpit/mission** (chemin v1/hr), mais **fausse pour la route `/api/pierre/execute`** si elle est encore appelée par un intégrateur externe ou un webhook Make.com existant — à vérifier côté configuration réelle (hors périmètre de cet audit code).

## `/test-pierre` — risque confirmé, à traiter avant amplification

Page de debug (studio de génération de document libre), bloquée en production **au niveau page** (`notFound()` si `NODE_ENV==='production'`) mais **pas au niveau API** : `/api/pierre/generate` reste appelable par tout utilisateur Supabase authentifié (pas nécessairement un client Pierre payant), déclenchant un vrai appel GPT-5 facturable et une écriture réelle en base, hors du parcours produit normal. Un tag de log copié-collé (`"[pierre/doc/generate][POST]"` dans le fichier `generate/route.ts`) confirme un copier-coller entre deux routes distinctes sans nettoyage.

## Vérification navigateur réelle

- **`/agents/pierre`** (desktop 1440) : page solide — titre clair ("Pierre absorbe une part massive du travail RH opérationnel"), tarif transparent par pays (449€ FR/BE/LU, 499 CHF Suisse) avec sélecteur, mention "Tarif fondateur" honnête. **Mais** le bouton d'achat de la carte tarif-pays est **mort** (aucun `onClick` câblé, voir CLONESTORE_ISSUE_REGISTER.md ISSUE-01) — un visiteur suisse qui sélectionne son pays et clique sur "Choisir Pierre — 499 CHF/mois" ne déclenche rien.
- **`/demo`** (desktop 1440) : value-shock immédiat dès le premier écran (11h35 de travail humain → 12 min d'attention humaine ; jusqu'à 1,6M€/an de capacité libérée), avec disclaimer honnête ("estimation, jamais une garantie"). **Bug réel observé** : hydratation React cassée sur le calculateur de coût interactif (tous les curseurs/champs numériques) — React logge explicitement "this won't be patched up".
- Perception de remplacement d'un salarié : le discours produit est cohérent et mesuré ("Pierre absorbe une part massive du travail RH opérationnel" — pas "remplace un salarié"), avec une section confiance dédiée ("Puissant, mais jamais incontrôlé").

## Ce qui est fait_observe seulement (pas vérifié en exécution)

Tous les points ci-dessus marqués "code" sont des faits de lecture — aucune mission réelle n'a été créée, aucune tâche exécutée en base, aucune validation humaine déclenchée dans cette session (cohérent avec la contrainte "ne pas modifier le produit" et le risque `DATABASE_URL` = prod partagée, voir CLONESTORE_TECHNICAL_AUDIT.md §7).

## Ce qui est absent / non testé

- Timeline/historique cockpit, CloneGuard en action réelle sur une mission, refus sensibles en conditions réelles, expérience mobile de `/cockpit/pierre` : **NON TESTÉS** (nécessitent une authentification + création de données réelles dans une base partagée avec la production — jugé trop risqué pour ce tour d'audit sans accord explicite supplémentaire).
