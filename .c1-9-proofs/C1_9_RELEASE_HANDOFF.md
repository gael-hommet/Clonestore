# C1.9 — PASSATION

**Verdict : FONDATION EXÉCUTABLE ET PROUVÉE. PAS DE BASCULE.**
Le chantier n'est **pas** fermé au sens du §24 : la route n'est pas branchée, donc
navigateur, mobile, sécurité et anonyme/connecté en conditions réelles restent à faire.

---

## 1. Ce qui est livré

`src/lib/clonechat/intelligence/c1-9/` — 11 modules de production, 5 fichiers de test.

| Module | Rôle |
|---|---|
| `intelligence-runtime.ts` | la pipeline : understand → retrieve → reason → decideTools → executeGovernedTools → compose → verify → respond |
| `understanding.ts` / `understanding-schema.ts` | compréhension par le modèle, structure ouverte de 27 champs |
| `semantic-retrieval.ts` | récupération hybride ; remplace le comptage de sous-chaînes |
| `truth-context.ts` | faits typés avec source, autorité et niveau de preuve |
| `response-composer.ts` | plan multi-intentions + composition |
| `response-verifier.ts` | vérificateur **réparateur** |
| `governed-tools.ts` | registre + `estimate_workload` |
| `conversation-memory.ts` | faits de session, injectés dans la récupération |
| `observability.ts` | trace par étape, sans donnée sensible |
| `openai-port.ts` | seul point de contact provider, budget de tokens dur |
| `flags.ts` | `CLONECHAT_C19_MODE` — `off` par défaut, fail-closed |

**Aucun fichier hérité n'a été modifié.** Vérifié : aucun `.ts` de `src/lib/clonechat/`
hors `c1-9/` ne porte la date du jour.

---

## 2. État des portes

| Porte | Résultat |
|---|---|
| TypeScript | **0 erreur** |
| Tests C1.9 hors ligne | **20 passés**, 1 ignoré (campagne réelle, sur drapeau) |
| Anti-durcissement | **vert** — 32 regex (plus long : 163 car.), 2 blocs de prose, 0 `case` |
| Récupération, corpus et bornes identiques | **1/3 → 3/3** au rang 0 |
| Campagne provider réelle | **11/12**, juge indépendant |
| Suite CloneChat complète | 936 passés, **3 échecs PRÉEXISTANTS** (voir §5) |

---

## 3. Comment rejouer les preuves

```bash
# Hors ligne, gratuit
CLONECHAT_DB_URL="" DATABASE_URL="" \
  node node_modules/vitest/vitest.mjs run src/lib/clonechat/intelligence/c1-9/__tests__/

# Campagne provider réelle (coût réel ~70 000 tokens, budget plafonné dans le test)
C19_REAL_CAMPAIGN=1 CLONECHAT_DB_URL="" DATABASE_URL="" \
  node node_modules/vitest/vitest.mjs run \
  src/lib/clonechat/intelligence/c1-9/__tests__/c1-9-real-model.test.ts
```

> `DATABASE_URL=""` est **obligatoire** : le `.env.local` de ce dépôt pointe sur la base
> de PRODUCTION. Toute QA locale qui l'oublie s'y connecte.

`npx tsc` est cassé ici ; utiliser `node node_modules/typescript/bin/tsc --noEmit`.

---

## 4. Prochain jalon — branchement shadow

Ce qui reste à faire, dans l'ordre :

1. Lire `readC19Mode()` dans `route.ts`, **après** que la voie stable a produit sa réponse.
2. En `shadow` : exécuter la pipeline, **ne rien renvoyer à l'utilisateur**, journaliser la
   trace et la comparaison. Les outils sont déjà désactivés en shadow — aucun effet ne
   peut être joué deux fois.
3. Prévoir le coût : **deux appels modèle supplémentaires par tour**. À plafonner par une
   réservation dédiée, sans quoi le shadow double la facture.
4. Comparer sur trafic réel, puis basculer l'anonyme, puis le connecté.
5. Seulement ensuite : retirer les early returns et les dictionnaires.

**Rien de tout cela ne doit être fait sans GO explicite.**

---

## 5. Trois échecs préexistants, non causés par ce chantier

`navigation/__tests__/{frozen-capture, torture-1000, c18-a2-remediated-recapture}.test.ts`

Ce sont des **dépassements de délai**, pas des assertions fausses : ces tests traitent
1003 cas en ~6,4 s contre un délai par défaut de 5 s, sans `timeout` explicite.

Preuves qu'ils ne viennent pas d'ici : ils échouent aussi **exécutés seuls** ; ils
n'importent aucun module `c1-9/` ; leurs fixtures datent du 18–19/07 ; aucun fichier
hérité n'a été modifié.

Correctif suggéré (hors périmètre) : donner un `timeout` explicite à ces trois tests. Un
test qui dépend de la vitesse de la machine finira par masquer un vrai échec.

---

## 6. Défauts ouverts hérités les plus urgents

Détail complet dans `C1_9_DEFECT_LEDGER.json`. Les trois qui méritent une décision
indépendamment de C1.9 :

- **D13 (P0)** — les clients Pierre payants reçoivent `gpt-4o-mini` pendant que les
  visiteurs anonymes reçoivent `gpt-5.6-luna`. La lane COMPANY n'appelle jamais le routeur.
- **D7 (P0)** — la garde de claims injecte un refus canné **au milieu** d'une réponse
  diffusée, qui reprend ensuite ; streaming et non-streaming divergent.
- **D15 (P1)** — le chemin streaming n'applique pas le validateur et peut étiqueter
  `openai_public` une réponse en réalité déterministe.

---

## 7. Deux défauts C1.9 ouverts (P2, aucun P0/P1)

- **C19-D8** — une question de culture générale hors périmètre reçoit une réponse au lieu
  d'un refus. Atténué : statut `source_missing`, aucune offre poussée, aucune question
  fabriquée. À traiter en faisant de `out_of_scope` une contrainte de composition.
- **C19-D9** — le contrôle de couverture est lexical (recouvrement de tokens ≥ 34 %) et
  produit des faux positifs : 3 cas rétrogradés en `clarification_required` alors que le
  juge notait la couverture 5/5. **C'est exactement le piège corrigé dans la récupération**,
  reproduit dans le vérificateur. À rendre sémantique.

---

## 8. Fichiers de sonde à conserver jusqu'à la bascule

`src/lib/clonechat/__tests__/c1-9-{probe,surface,memory,streamguard}.test.ts` documentent
le comportement **hérité** par exécution (part du dictionnaire, cécité à l'historique,
injection en flux). Ils sont verts et servent de référence de comparaison. À supprimer une
fois les dictionnaires retirés.
