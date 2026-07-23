# C1.9 — ARCHITECTURE ACTUELLE (constatée, mesurée)

Date : 2026-07-22 · Portée : `POST /api/assistant/chat` et tout ce qu'elle appelle.
Méthode : trace statique du graphe d'appel **+ exécution réelle** des modules
(ports instrumentés, aucun appel réseau, aucun coût). Tous les chiffres ci-dessous
sont mesurés, pas estimés.

---

## 1. Recensement global

| Mesure | Valeur |
|---|---|
| Fichiers runtime (`src/lib/clonechat/**`, hors tests) | 131 |
| Lignes runtime | 21 219 |
| **Littéraux regex** | **1 207** |
| **Blocs de prose française destinés à l'utilisateur** | **724** |
| **Caractères de prose pré-écrite** | **400 850** |
| Bras `case "..."` | 174 |

≈ **19 caractères de réponse écrite à la main par ligne de code**, et un regex toutes
les 17,6 lignes. 400 850 caractères représentent de l'ordre de 100 000 tokens de
réponses rédigées à l'avance plutôt que raisonnées.

---

## 2. Le chemin réel d'un message

```
POST /api/assistant/chat
  ├─ isCloneChatEnabled()            → 503 si off                      [GARDE — légitime]
  ├─ identité (e2e | Supabase | anonyme)
  ├─ detectPromptInjection()         → refus déterministe              [GARDE — légitime]
  ├─ classifyCloneChatRequest()      → 1 classe sur 3                  [CLASSIFIEUR #1]
  ├─ resolveCloneChatPlan()          → lane PUBLIC | COMPANY
  │
  ├─ lane PUBLIC  (anonyme, sans société, sans Pierre, tenant en défaut)
  │    └─ answerPublicQuestion() → runParrainTurn()
  │         ├─ routeCloneChatQuestion()      → 1 catégorie sur 13      [CLASSIFIEUR #2]
  │         ├─ linksFor(category)            → CTA choisi ICI, sans réponse
  │         ├─ resolveNavigationIntent()     → 1 intention sur 27      [CLASSIFIEUR #3]
  │         ├─ ⟶ COURT-CIRCUIT ligne 234 : si intention ∈ {purchase, reserve,
  │         │     login, signup} et confiance ≥ high → PHRASE FIGÉE, modèle jamais appelé
  │         ├─ ⟶ COURT-CIRCUIT ligne 210 : si pas de responder → dictionnaire 37 branches
  │         ├─ retrieveParrainChunks()       → score = comptage de sous-chaînes
  │         ├─ buildParrainSystemPrompt()    → « Base-toi UNIQUEMENT sur ces faits »
  │         ├─ responder.respond()           → OpenAI, JSON libre
  │         ├─ ⟶ ÉCRASEMENT ligne 322 : checkPublicOutput échoue → la réponse du
  │         │     modèle est JETÉE et remplacée par la composition déterministe
  │         └─ finalizeAnswerText()          → 21 regex, tout-ou-rien
  │
  └─ lane COMPANY (identité + entreprise active + droit Pierre)
       ├─ budget.reserve()  → refus = repli déterministe
       ├─ buildParrainGroundedPrompt()
       ├─ responder.respond()  ← modèle CODÉ EN DUR : cfg.model = gpt-4o-mini
       └─ finalizeAnswerText()
```

---

## 3. Cinq classifieurs indépendants, tous mono-intention

Aucun ne connaît l'existence des autres. Leurs verdicts peuvent diverger ; rien ne
les réconcilie.

| # | Fichier | Sorties | Mécanisme | Contrôle |
|---|---|---|---|---|
| 1 | `server/universal-access.ts:101` | 3 classes | 8 regex, chaîne `if` ordonnée | permissions / lane (**correct**) |
| 2 | `intelligence/c1/clonechat-answer-router.ts:46` | 13 catégories | 13 regex, premier match | le champ `category` renvoyé au client sur **tous** les chemins, + la réponse de repli |
| 3 | `navigation/intent-taxonomy.ts:249` | 27 intentions (18 atteignables) | 24 regex ordonnés | le CTA, et sur 4 intentions **toute la réponse** |
| 4 | `care/diagnosis.ts:68` | 24 intentions (21 atteignables) | 21 regex, premier match | diagnostic / blocage |
| 5 | `public-answer/public-situation.ts:409` | 37 situations | ~45 regex, cascade ordonnée | **tout le paragraphe** + l'écrasement post-modèle |

**Volumétrie des tables de mots-clés** (navigation + care seuls) : 1 238 termes,
79 littéraux regex, 290 lignes de tables pures. Le regex `support_request`
(`intent-taxonomy.ts:73`) tient **214 branches d'alternance sur une seule ligne** ;
`purchase_pierre` en compte 116 ; `discover_clonestore` 74.

**Goulot mono-intention** : chaque classifieur renvoie exactement une valeur par
*premier match*. L'ordre des règles **est** la sémantique du produit, et il n'est
documenté que dans des commentaires. « Je n'arrive pas à me connecter, et Pierre
coûte combien ? » ne peut être que `support_request` : la question de prix est
silencieusement jetée.

**Taxonomie morte** : 8 des 27 `NavIntent` et 3 des 24 `SupportIntent` ne peuvent
jamais être renvoyés — aucune règle ne les produit — mais du code aval les teste
encore. Preuve mesurable d'une croissance par accrétion.

---

## 4. Le modèle est-il appelé ? — mesuré

Corpus de **61 formulations inédites** (aucune présente littéralement dans le code
produit), responder toujours fourni, c'est-à-dire **le cas favorable**.

| | |
|---|---|
| Modèle réellement invoqué | **58 / 61** |
| Texte du modèle survivant jusqu'à l'utilisateur | **51 / 61** |
| **Réponses produites par le dictionnaire** | **10 / 61 (16 %)** |

Deux mécanismes distincts de contournement, tous deux confirmés par exécution :

**M1 — court-circuit avant le modèle** (`parrain-turn-runtime.ts:234`)
Le prédicat ne vérifie **pas** `ports.responder`, contrairement à son voisin
ligne 210. Le budget est réservé, un client OpenAI est construit, `respond()` n'est
jamais appelé. Mesuré : 3 formulations d'achat sur 6 n'ont jamais atteint le modèle,
et les trois ont reçu **le même texte** :

> « Pour obtenir Pierre, rendez-vous sur la page Réserver Pierre. Vous y réservez le
> prix fondateur et lancez l'activation. »

Ce chemin n'applique pas `checkPublicOutput` — il expédie donc « prix fondateur »,
une expression que `COMMERCIAL_RX` bloque spécifiquement sur l'autre chemin.
**Deux chemins, deux standards.** En streaming, `respond()` n'étant jamais appelé,
aucun événement `delta` ne peut être émis.

**M2 — écrasement après le modèle** (`parrain-turn-runtime.ts:312-325`)
Le modèle est appelé, les tokens sont dépensés, puis `resolvePublicAnswer(question)`
est invoqué **sur la même question** uniquement pour tenir un remplacement prêt.
Mesuré : 7 réponses du modèle sur 58 jetées ; la famille « support » à 3/3.

**Sans provider** (clé absente, ou réservation refusée), la part du dictionnaire est
de **100 %**, avec une diversité de **33 %** : 12 questions sémantiquement
distinctes ont produit **4 textes**, dont un partagé par 8 questions.

---

## 5. La récupération — la cause racine la plus profonde

`intelligence/c1-1/parrain-retrieval.ts:60`

```ts
const hay = parrainNormalize(`${chunk.title} ${chunk.text} ${(chunk.routes ?? []).join(" ")}`);
let score = 0;
for (const w of words) if (hay.includes(w)) score += 1;
```

Comptage de **sous-chaînes**, pas même de tokens. Pas de frontière de mot, pas de TF,
pas d'IDF, pas de racinisation, pas de normalisation par longueur. `est` matche dans
`question`, `prestataire`, `reste`. Tokenisation : `split(/[^a-z0-9]+/).filter(w => w.length > 2)`
— **aucune liste de mots vides** ; le seul filtre est la longueur. `pour`, `est`,
`les`, `des`, `avec`, `dans`, `vous`, `combien`, `comment` scorent tous.

**Preuve par exécution.** La paraphrase de référence du cahier des charges —
« Ça me permettrait d'éviter de recruter quelqu'un juste pour gérer la paperasse ? » —
**ne récupère pas** `product.roi-productivity`. Sondage du corpus visible :
`paperasse` → 0 chunk, `recruter` → 0 chunk, `gerer` → 0 chunk. Les trois mots qui
portent tout le sens ne contribuent rien. Le corpus dit `embaucher` et `administratif`.
Résultat n°1 : `legacy.tech.clonelearn` (2,8) — matché sur `eviter` + `pour`.

Trois défauts indépendants s'empilent :

- **Sémantique** : aucun stemmer, aucun synonyme, aucun embedding.
- **Éviction par budget de caractères** (`:149`) : `continue` au lieu de `break`. Le
  bon chunk (1 599 car.) est exclu avec `reason: 'char_budget'` après qu'un chunk de
  1 703 car. a gagné une égalité tranchée par l'ordre d'insertion, puis neuf chunks
  plus courts et moins pertinents remplissent le budget.
- **Jamais vide** (`:154-157`) : sur zéro match le classement dégénère vers l'ordre
  des bonus de type de source. « paperasse administrative » → 0 match dans tout le
  corpus → résultat n°1 = `pricing.catalog`. Une question d'automatisation est
  groundée sur la grille tarifaire. **Le pipeline ne peut jamais signaler « je n'ai
  rien trouvé ».**

Remédiations déjà en place, qui traitent le symptôme : un épinglage regex `+50` pour
un chunk unique, et des « ANCRES DE RÉCUPÉRATION » — blocs de mots-clés collés dans
le corps des chunks. Vérifié : l'ancre littérale récupère le chunk au rang 1 ; sa
paraphrase ne le récupère pas du tout. **Chaque nouvelle paraphrase demande une
nouvelle ancre écrite à la main.**

**Aucun embedding n'est câblé.** `text-embedding-3-large/small` n'existent que comme
métadonnées inertes de preset et lignes de table de coûts dans `src/lib/cloneos/ai/`.

Corpus : 201 chunks, 117 candidats par question, 77 visibles pour un visiteur public,
**plafonnés à 10 chunks / 3 400 caractères** avant le modèle.

**Le filtrage par permission est la partie solide** : visibilité appliquée avant tout
scoring, `RESTRICTED_SECRET` refusé à tous y compris fondateur, chunk tenant exigeant
une correspondance exacte de `companyId` résolue serveur, quarantaine des secrets à la
construction. Mesuré 117 → 77. **À conserver tel quel.**

---

## 6. Le prompt système est un sélecteur, pas un raisonneur

`intelligence/c1-1/parrain-system-prompt.ts` — 2 430 car. statiques (mode public) +
faits récupérés, total mesuré ≈ 5 630 car., plus 661 car. de contrat JSON.

> « Base-toi UNIQUEMENT sur ces faits autorisés : … »
> « N'invente JAMAIS un prix, une route, une capacité, une page ou une action. »
> « Si un fait important manque, dis-le honnêtement ("source_missing") plutôt que d'inventer. »

Aucune instruction n'invite à décomposer, calculer, planifier ou raisonner. Aucun
paramètre `reasoning` n'est jamais envoyé à l'API.

**Une estimation ROI est structurellement impossible**, bloquée à trois niveaux
indépendants : (1) le périmètre de grounding — aucun chiffre ROI n'est dans un chunk ;
(2) « n'invente jamais un prix » — un montant dérivé se lit comme un prix inventé ;
(3) `COMMERCIAL_RX` marque tout montant à trois chiffres en €/CHF, ce qui déclenche M2
et remplace toute la réponse. Produire une estimation exigerait de l'ajouter comme
fait récupérable — ce n'est pas un problème de formulation de prompt.

---

## 7. La mémoire conversationnelle n'atteint pas la récupération

Mesuré (`_probe_memory.json`) : avec 4 tours d'historique énonçant « 22 personnes » et
« deux jours par semaine », le prompt système grounded est **identique octet pour
octet** au cas sans historique (5 900 car. dans les deux cas). `systemMentions22 = false`.

L'historique est transmis au responder comme messages bruts, mais la récupération ne
reçoit que le tour courant. Une relance elliptique (« tu l'estimes à combien ? ») est
donc groundée sur des chunks sélectionnés à partir d'une phrase sans contenu
récupérable.

---

## 8. La garde de claims gouverne 100 % des octets — en tout-ou-rien

`intelligence/c1/clonechat-claims-policy.ts:116` — 21 regex (13 C1 + 8 P15.1). **Un
seul match** jette **toute** la réponse et la remplace par `SAFE_REFUSAL_TEXT`
(4 phrases fixes). Ni rédaction, ni excision phrase à phrase, ni réparation.

En streaming, `route.ts:392` applique la garde **phrase par phrase**. Vérifié par
exécution — voici ce que lit réellement l'utilisateur :

> Bonne question. Pierre prépare vos contrats et vos avenants, puis un humain valide.
> **Je préfère ne pas affirmer cela : cette formulation dépasse ce qui est prouvé
> aujourd'hui. Voici la version honnête : … Une revue humaine peut vous répondre
> précisément.**Pour une équipe de vingt personnes, cela représente plusieurs heures
> par semaine. Voulez-vous que nous estimions cela ensemble ?

Un pavé canné est injecté **au milieu** de la réponse, puis la réponse reprend. Le
streaming et le non-streaming produisent des réponses **différentes** pour la même
entrée. L'espace inter-phrase est perdu (`précisément.Pour`).

Le neutraliseur de négation (`affirmativeText`) supprime 12 regex gloutons qui
consomment jusqu'à la ponctuation suivante ; et les deux jeux de règles sont
asymétriques — C1 teste le texte dénégé, P15.1 le texte brut.

---

## 9. Couche provider

- **Inversion de qualité** : la lane PUBLIC passe par `routeModel` → `gpt-5.6-luna`
  (ou `terra` en escalade). La lane COMPANY **n'appelle jamais** `routeModel` et code
  en dur `cfg.model` = **`gpt-4o-mini`**. Les visiteurs anonymes reçoivent un meilleur
  modèle que les clients Pierre payants — alors que le routeur déclare en commentaire
  l'invariant inverse. L'invariant tient dans la fonction pure ; il est violé par
  l'appelant.
- **`reasoning` est mort** : le routeur calcule `none|low|medium` mais aucun champ
  `reasoning` n'existe dans `OpenAIRequest` ni n'est envoyé à l'API. La valeur n'est
  renvoyée que comme preuve auto-déclarée. Idem `imageDetail`.
- **Pas de sortie structurée stricte** : `{ type: "json_object" }` partout ;
  `STRUCTURED_JSON_SCHEMA`, écrit pour `json_schema`, n'est jamais transmis.
- **Streaming sans validation** : `streaming-responder.ts:100-111` fait un
  `JSON.parse` nu et renvoie `structured as never` — le schéma Zod n'est jamais
  appliqué. `sink.providerCalled` est mis à `true` **avant** l'appel réseau, et la
  source `openai_public` en est dérivée : une réponse en réalité déterministe peut
  être étiquetée comme venant du modèle.
- **Cache de prompt mort** : `prompt-cache.ts` (125 lignes) n'a aucun appelant ; aucun
  `prompt_cache_key` n'est envoyé. Le préfixe statique de ~2,4 Ko est refacturé plein
  tarif à chaque tour.
- **Comptabilité de coût fausse** : la table `PRICING` ne connaît pas les modèles
  gpt-5.6 ; tout appel public est chiffré au tarif gpt-4o-mini.
- **Code mort** : tout le pipeline `governed-turn.ts` (236 lignes) n'a aucun appelant
  en production — auditer les prompts ou le budget depuis ce fichier, c'est lire le
  mauvais code.
- **Le budget est réparé** : `resilient-budget.ts` sépare « infrastructure en panne »
  (dégradation vers le compteur mémoire + `console.error` bruyant) de « plafond
  atteint » (refus honoré). La panne de production documentée en mémoire ne peut plus
  se reproduire par ce chemin. Restent : compteur mémoire par processus, dégradation
  collante jusqu'au redémarrage, et le motif `catch { NO_RESERVATION }` toujours
  présent `route.ts:367`.

---

## 10. Cause racine globale

CloneChat **n'est pas** dépourvu de modèle : dans le cas favorable le modèle est
appelé 58 fois sur 61 et reçoit la phrase complète. Le défaut est ailleurs, et il est
triple :

1. **Le modèle n'a pas le droit de comprendre.** Il n'existe aucune étape de
   compréhension. Cinq classifieurs regex mono-intention décident *à sa place* de quoi
   parle le message, et le font **avant** lui.
2. **Le modèle n'a pas de quoi raisonner.** La récupération qui construit son sol de
   vérité est un comptage de sous-chaînes sans mots vides ni sémantique, qui ne peut
   jamais dire « rien trouvé » et qui évince le meilleur chunk pour cause de longueur.
   Le prompt lui interdit ensuite de dériver quoi que ce soit.
3. **Le modèle n'a pas le dernier mot.** Deux mécanismes (M1 avant, M2 après) et une
   garde tout-ou-rien peuvent jeter sa réponse, y compris au milieu d'un flux.

D'où le symptôme observé : deux entreprises différentes reçoivent le même paragraphe,
une question hors sujet reçoit une réponse confiante à une question jamais posée, et
une question triple n'obtient qu'un tiers de réponse.
