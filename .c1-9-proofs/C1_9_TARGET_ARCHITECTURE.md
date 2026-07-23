# C1.9 — ARCHITECTURE CIBLE

Une pipeline unique, `CloneChatIntelligenceRuntime`, empruntée par **tous** les
lecteurs (anonyme, connecté, sans société, avec société). Ce qui change selon le
lecteur, ce sont les **permissions** et les **connaissances visibles** — jamais le fait
que CloneChat raisonne.

Emplacement : `src/lib/clonechat/intelligence/c1-9/`
Drapeau : `CLONECHAT_C19_MODE` = `off` (défaut) | `shadow` | `on` — fail-closed.

---

## 1. Répartition des responsabilités

| Le modèle décide | Le déterministe décide |
|---|---|
| ce que veut l'utilisateur | qui il est (auth) |
| les intentions multiples | ce qu'il a le droit de voir (visibilité, tenant) |
| les sous-entendus, les pronoms | les prix officiels, les pays, les statuts |
| ce qu'il faut chercher | quelles routes existent |
| le raisonnement et le calcul demandé | quels outils sont exécutables |
| la formulation | ce qui exige une validation humaine |
| s'il faut demander une précision | les plafonds de coût |

Une règle déterministe peut **bloquer, contraindre, vérifier, corriger un fait, exiger
une validation**. Elle n'écrit pas la réponse à la place du modèle — sauf : panne
complète du provider, message de sécurité obligatoire, erreur technique structurée.

---

## 2. Les huit étapes

```
understand → retrieve → reason → decideTools → executeGovernedTools
           → compose → verify → respond
```

Chaque étape est observable et enregistrée dans une trace (`observability.ts`).

### 2.1 `understand` — compréhension par le modèle

Remplace les cinq classifieurs regex. Un appel modèle **économique** produit une
structure **ouverte** (aucune taxonomie fermée) : `summary`, `primary_goal`,
`secondary_goals[]`, `questions_detected[]`, `entities[]`, `requested_metrics[]`,
`requested_actions[]`, `constraints[]`, `assumptions[]`, `missing_information[]`,
`ambiguities[]`, `user_emotion`, `requires_clarification`, `clarification_question`,
`knowledge_needs[]`, `tool_needs[]`, `risk_signals[]`, `confidence`.

Entrée : message complet + historique pertinent + **faits déjà établis dans la
conversation** + identité du lecteur + capacités accessibles.

`knowledge_needs[]` est la clé : c'est le modèle qui dit **quoi chercher**, en
vocabulaire du corpus, ce qui règle le problème de la paraphrase à la source.

### 2.2 `retrieve` — récupération hybride

Remplace `relevance()` (comptage de sous-chaînes). Signaux combinés :

1. **besoins de connaissance** issus de `understand` (et non les mots bruts de
   l'utilisateur) ;
2. **correspondance d'entités** (noms de produits, pays, capacités) ;
3. **lexical pondéré** : tokens à frontière de mot, **mots vides français filtrés**,
   pondération inverse-fréquence sur le corpus, normalisation par longueur de chunk ;
4. **autorité** et **fraîcheur** en départage ;
5. **contexte conversationnel** — les faits des tours précédents entrent dans la
   requête ;
6. **filtre de permission inchangé** — `filterVisibleChunks` avant tout scoring.

Corrections obligatoires :
- le budget de caractères **emballe** (garde le meilleur ensemble) au lieu d'évincer
  le meilleur chunk puis de remplir avec du bruit ;
- la récupération **peut renvoyer vide** et le signale (`sufficiency: "none"`), ce qui
  autorise le pipeline à demander une précision plutôt qu'à inventer.

Le lexical reste un **signal secondaire**, jamais l'autorité principale.

### 2.3 `TruthContext` — le sol de vérité

Chaque fait porte : `value`, `source`, `authority`, `verifiedAt`, `confidence`,
`allowedForViewer`. Construit à partir des autorités **déjà canoniques** du dépôt
(P10 pricing, registre de routes, registres T1/T2, canon RH P8.10/8.12, contexte
société borné) — on ne réécrit aucune vérité, on la **typé** et on l'**attribue**.

Le modèle raisonne librement **à l'intérieur** de ce sol. Il peut construire une
estimation, expliquer une formule, proposer un scénario, afficher une fourchette —
à condition de distinguer explicitement **fait officiel / hypothèse / estimation /
exemple / limite**.

### 2.4 `reason` — plan de réponse multi-intentions

Sortie : `response_plan[]` (un élément par objectif réellement présent), `answer_order`,
`global_caveats`, `suggested_follow_up`. Chaque élément porte `goal`, `answer_type`,
`required_facts`, `required_tools`, `must_clarify`.

Une demande contenant trois questions produit trois éléments. **La réponse finale doit
couvrir toutes les questions réellement posées** — c'est le vérificateur qui l'impose.

### 2.5 `decideTools` / `executeGovernedTools`

Le modèle **propose** un appel via le registre canonique. Le runtime déterministe
valide, autorise, applique la gouvernance, exécute, et **rend le résultat au
raisonnement avant la réponse**. Le modèle n'exécute jamais directement une action
sensible. Plancher inchangé : `authoritativeCompletion: false`, aucune action à effet
externe réel.

Un **outil de calcul interne sûr** (`estimateWorkload`) fait l'arithmétique des
estimations, au lieu de la confier au modèle seul : heures actuelles → part
automatisable → heures libérées → valeur → comparaison à l'abonnement. Il retourne les
**hypothèses** avec le résultat, pour que la réponse puisse les expliciter.

### 2.6 `compose` — génération naturelle

Un seul appel de composition, nourri par : le plan, le TruthContext, les résultats
d'outils, la mémoire de conversation. Pas de gabarit, pas de sélection de bloc.

### 2.7 `verify` — vérificateur final

Contrôle : couverture de toutes les questions · aucun fait non sourcé · aucun chiffre
inventé · estimations identifiées comme telles · statuts produit exacts · aucune action
prétendue exécutée · aucune fuite · aucune contradiction · aucun CTA prématuré · aucun
langage de garantie juridique.

**Différence essentielle avec l'existant** : en cas d'échec, le vérificateur
**corrige, redemande une clarification, ou bloque honnêtement**. Il ne substitue pas
un paragraphe pré-écrit. La garde de claims reste un plancher de sécurité, mais
devient **réparatrice** (excision de la phrase fautive) plutôt que tout-ou-rien, et
n'est plus appliquée phrase par phrase au milieu d'un flux.

### 2.8 CTA — après la réponse, jamais avant

Ordre imposé : comprendre → répondre → vérifier que la demande est satisfaite →
**seulement ensuite** évaluer si une suite est utile. Un CTA n'est émis que s'il
correspond à la demande, apporte une vraie suite, pointe vers une route existante du
registre, et ne remplace pas la réponse.

---

## 3. Mémoire (`conversation-memory.ts`)

Distinguer : mémoire de session · mémoire durable autorisée · données sensibles ·
contexte entreprise · éléments à ne jamais mémoriser.

Contenu : résumé conversationnel, **faits utilisateur** (« 22 salariés », « deux jours
par semaine »), hypothèses en cours, questions encore ouvertes, décisions déjà prises,
corrections. Ces faits **entrent dans la requête de récupération** — c'est ce qui
corrige le défaut D3.

---

## 4. Anonyme

Même pipeline. Contraintes : modèle économique, limitation de débit, budget maximum
par conversation, historique borné, **aucune donnée privée**, aucun outil exigeant un
compte, grounding public uniquement.

Le repli anonyme dit **honnêtement** qu'il ne peut pas traiter la demande
intelligemment à cet instant. Il ne se fait pas passer pour l'IA (corrige D4).

---

## 5. Modes dégradés

| Situation | Comportement exigé |
|---|---|
| Provider indisponible | le dire ; conserver les réponses atomiques sûres (prix, statut, route, pays) ; ne jamais sélectionner une FAQ hors sujet |
| Récupération insuffisante | dire ce qui manque ; poser une clarification ; ne pas inventer |
| Confiance basse | demander une précision ; ne pas choisir au hasard entre prix, ROI, support et achat |

---

## 6. Migration

1. audit ✔ 2. pipeline derrière drapeau local ✔ 3. **shadow mode** 4. comparaison
ancienne/nouvelle 5. campagne modèle réelle 6. correction 7. bascule anonyme
contrôlée 8. bascule connecté 9. suppression des early returns obsolètes
10. suppression des dictionnaires 11. fermeture.

En shadow : l'utilisateur reçoit **encore la voie stable** ; la nouvelle pipeline
produit une réponse **non affichée** ; les deux sont comparées ; aucun effet n'est
exécuté deux fois (les outils sont désactivés en shadow).

---

## 7. Ce qui est conservé tel quel

- le filtrage de visibilité / isolation tenant (`parrain-visibility.ts`) — solide ;
- `detectPromptInjection`, le kill switch, la limitation de débit anonyme ;
- `resilient-budget.ts` ;
- `safe-links.ts` (fail-closed, aucun HTML produit) ;
- l'enveloppe CloneCare (purement additive, ne touche jamais `structured.answer`) ;
- le registre de routes canonique, P10 pricing, registres T1/T2, canon RH.

## 8. Ce qui est déprécié

Les cinq classifieurs mono-intention comme autorité de réponse · le switch 37 branches
de `public-composer` · `directNavigationAnswer` · les ancres de récupération écrites à
la main · l'épinglage regex `+50` · l'écrasement M2 · la substitution tout-ou-rien.

Rien n'est supprimé avant la bascule : les anciennes voies délèguent, deviennent de
simples gardes, ou sont marquées dépréciées.
