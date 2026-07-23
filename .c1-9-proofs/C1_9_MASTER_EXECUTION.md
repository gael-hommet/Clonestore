# C1.9 — EXÉCUTION MAÎTRE

**État : FONDATION EXÉCUTABLE. La voie héritée est INCHANGÉE.**
Date : 2026-07-22

---

## Ce qui a été fait

1. **Audit** — trace statique complète de `POST /api/assistant/chat` **et exécution
   réelle** des modules avec des ports instrumentés (aucun réseau, aucun coût).
2. **Architecture cible** — une pipeline unique, huit étapes observables.
3. **Construction** — 11 modules sous `src/lib/clonechat/intelligence/c1-9/`.
4. **Preuve** — 20 tests hors ligne + 3 campagnes provider réelles successives.

## Ce qui n'a pas été fait

- **La route n'est pas modifiée.** Le drapeau `CLONECHAT_C19_MODE` vaut `off` par
  défaut et n'est lu nulle part dans `route.ts`. Le branchement shadow est le prochain
  jalon, et il attend un GO explicite.
- **Aucun défaut de la voie héritée n'est corrigé.** C'est délibéré : on ne réécrit pas
  un chemin de production avant d'avoir prouvé le remplaçant. Les 19 défauts sont
  documentés dans `C1_9_DEFECT_LEDGER.json`, pas colmatés.
- Navigateur, mobile, sécurité, anonyme/connecté en conditions réelles : **non exécutés**,
  car ils exigent la route branchée.

---

## Le constat en trois chiffres

| | |
|---|---|
| Lignes du runtime CloneChat hérité | 21 219 |
| Littéraux regex | **1 207** |
| Caractères de prose française pré-écrite | **400 850** |

Soit ≈ 19 caractères de réponse écrite à la main par ligne de code.

**Le modèle EST appelé** — 58 fois sur 61 dans le cas favorable. Le défaut n'est pas son
absence, c'est qu'il n'a ni le droit de comprendre, ni de quoi raisonner, ni le dernier mot.

---

## Les trois causes racines, et ce qui les remplace

### 1. Le modèle n'a pas le droit de comprendre

Cinq classifieurs regex mono-intention décident **avant lui** de quoi parle le message.
1 238 termes de mots-clés pour la seule navigation ; une alternance de 214 branches sur
une ligne.

→ **Une étape `understand`** : un appel modèle produit une structure ouverte de 27 champs.
Aucun enum fermé de sujets. Les objectifs sont multiples par construction.

*Mesuré* : compréhension jugée **4,67/5**, couverture **5,00/5** sur corpus inédit.

### 2. Le modèle n'a pas de quoi raisonner

La récupération était un comptage de **sous-chaînes**, sans mots vides, sans frontière de
mot, sans IDF. La paraphrase de référence du cahier des charges ne récupérait **pas** la
source qui y répond : `paperasse` → 0 chunk, `recruter` → 0 chunk, `gerer` → 0 chunk.

→ **`retrieveSemantic`** : la requête est faite des **besoins de connaissance écrits par
le modèle**, pas des mots de l'utilisateur ; mots vides filtrés, racinisation prudente,
pondération IDF, normalisation par longueur, emballage sous budget, et surtout la
capacité de dire **« je n'ai rien trouvé »**.

*Mesuré, même corpus, mêmes bornes* : **1/3 → 3/3** au rang 0, `sufficiency: strong`.

### 3. Le modèle n'a pas le dernier mot

Deux mécanismes jetaient sa réponse (un avant, un après), et une garde tout-ou-nothing
la remplaçait par quatre phrases fixes — **y compris au milieu d'un flux**.

→ **Un vérificateur qui répare** : excision de la phrase fautive, pas substitution
globale ; puis correction, clarification, ou blocage honnête.

---

## Les campagnes réelles

Trois passes successives sur le même corpus inédit, juge indépendant, budget plafonné.

| | pass | compréhension | couverture | fidélité | invention | naturel |
|---|---|---|---|---|---|---|
| nº1 | 2/11 | 1,09 | 0,91 | 4,55 | 4,91 | 1,55 |
| nº2 | 8/10 | 4,00 | 3,90 | 4,80 | 4,90 | 3,40 |
| **nº3** | **11/12** | **4,67** | **5,00** | **5,00** | **4,83** | **4,42** |

Chaque passe a révélé un défaut réel **dans la nouvelle couche**, corrigé à la source :
troncature de la compréhension, puis de la composition, puis une invention de grandeurs
non monétaires que le vérificateur ne contrôlait pas.

C'est le point du §19 : une campagne où `OPENAI_API_KEY=""` n'aurait rien trouvé de tout
cela.

Coût total des trois campagnes : ~70 800 tokens par passe, base de production jamais
touchée, aucun outil à effet externe.

---

## Garde anti-durcissement

| | hérité | C1.9 |
|---|---|---|
| Littéraux regex | 1 207 | **32** |
| Regex le plus long | ~5 000 car. | **163 car.** |
| Blocs de prose utilisateur | 724 | **2** |
| Bras `case "…"` | 174 | **0** |

La contrainte qui compte est la **longueur** : un routeur de sujet déguisé se trahit par
la taille de ses alternances. Le test échoue au-delà de 200 caractères.

---

## Où en est la migration

```
1. audit                          ✔
2. pipeline derrière un drapeau   ✔  (off par défaut, fail-closed)
3. shadow mode                    ◐  construit, NON branché sur la route
4. comparaison ancienne/nouvelle  ✗
5. campagne modèle réelle         ✔  3 passes, 11/12
6. correction                     ✔  7 défauts C1.9 corrigés, 2 ouverts (P2)
7-11. bascule et nettoyage        ✗  attend un GO
```
