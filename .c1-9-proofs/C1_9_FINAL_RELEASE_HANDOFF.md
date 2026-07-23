# CloneChat C1.9 — Passe de clôture produit (relevance/concision + mesure)

**Date** : 2026-07-23 · **Périmètre** : CloneChat uniquement. Aucun fichier P20, Pierre V1 ou T1/T2 modifié.

**Verdict** : **VERROUILLÉ LOCALEMENT SOUS RÉSERVE DE QUOTA** — toutes les portes déterministes
sont vertes ; les portes de campagne modèle sont bloquées par un quota OpenAI épuisé (blocage
externe explicitement autorisé), non par un défaut de code.

---

## 1. Le cerveau — inchangé

OpenAI, via `OPENAI_API_KEY` et `createOpenAIC19Port`. **Aucune IA locale créée.** Le code
fournit contexte, mémoire, connaissances, faits vérifiés, outils, permissions, gouvernance et
vérification. Le **mode `on` reste câblé** sur les deux voies (streamée et non streamée),
stratégie §13 option B (composition + vérification complètes, puis texte validé dans le flux).

## 2. Ce que cette passe a corrigé — le vrai défaut restant

Le grounding ne souffrait plus d'invention pure : les réponses justes étaient **polluées par des
ajouts non demandés** — état du paiement sur une question de prix, réservation sur une question
de pays, panorama produit sur une question étroite, contexte commercial sur un incident. Un
défaut de **concision et de pertinence**, structurel et non rédactionnel.

**Cause de fond** : le `TruthContext` servait au rédacteur la table tarifaire des quatre pays et
le périmètre de lancement à CHAQUE tour. Un rédacteur à qui l'on tend quatre prix en écrit quatre.

**Correctif** : `response-relevance.ts` — contrat de pertinence typé (ce qu'il FAUT dire, ce qu'on
PEUT ajouter, ce qu'on ne DOIT PAS ajouter, la profondeur, le droit de proposer une suite). Les
faits ne sont plus servis au rédacteur qu'à la demande ; les sept sujets périphériques sont
détectés par le MÊME détecteur dans la question et dans la réponse, si bien qu'aucune règle par
question n'y est représentable.

Défauts secondaires trouvés et corrigés à la source (détail dans `C1_9_FINAL_DEFECT_LEDGER.json`) :
politique d'assistance sans vente (support 0/3 → 5/5), capacité jamais énoncée sans source servie,
plancher humain-seul servi comme FAIT, quota de chunks de navigation, règle multi-devises, prénom
/rôle/forme d'adresse tenus, refus qui ne vend plus.

## 3. Deux défauts de MESURE, distincts des défauts produit

- **Le juge ne voyait pas ses propres sources.** Il notait « non étayées » des phrases reprises
  d'un fait fourni, et « inventée » une page pourtant listée. Corrigé : `providedContextForJudge`
  transmet faits servis + pages autorisées ; grounding **3,96 → 4,64 → 4,78** à corpus constant.
- **Le juge tronquait, puis subissait la limitation de débit.** Budget de sortie relevé
  (truncation), puis reprise bornée sur 429 (backoff exponentiel + dispersion, honore
  `Retry-After`). Un verdict invalide ne compte JAMAIS comme réussite.

## 4. Le blocage de compilation — cause trouvée et corrigée

`src/lib/clonechat/durable/pg.ts` ouvrait un pool `pg` **sans borne de connexion**
(`connectionTimeoutMillis` = 0 par défaut = attente infinie). Base débranchée pendant la
compilation ⇒ processus suspendu, 44 Mo, quatre heures, aucun `BUILD_ID`. Corrigé : connexion
8 s, requête 15 s, inactivité 30 s. Une base injoignable ÉCHOUE franchement et l'appelant retombe
sur l'in-memory. Cinq tests déterministes le prouvent (`pg-bounded-wait.test.ts`).

## 5. Ce qui est mesuré VERT cette nuit (sans OpenAI)

- **TypeScript** : 0 erreur sur le dépôt entier.
- **Régression déterministe** : CloneChat + assistant, **1 129 passés / 0 échec**, exit 0,
  sur DEUX exécutions consécutives.
- **Tests C1.9 + durable ciblés** : verts (relevance, policy-matrix, port-retry, pg-bounded-wait,
  anti-hardcoding, runtime, retrieval, memory, neutralization).
- **Compilation isolée** `.next-c19-final` : voir `C1_9_BUILD_RESULTS.json`.

## 6. Ce qui est BLOQUÉ par le quota OpenAI (externe)

`error.type = insufficient_quota` — le compte OpenAI a épuisé son quota de facturation après cinq
campagnes réelles dans la nuit. Un quota épuisé ne se lève pas en attendant ; il faut un
rechargement par le propriétaire du compte. Détail et preuve : `C1_9_OPENAI_QUOTA_BLOCKER.json`.

Bloque : campagne ciblée FINALE, campagne complète (131 formulations), campagne navigateur mode
`on`. **Dernière mesure réelle (run 3, quota encore disponible)** : 47/47 verdicts valides,
39/47 réussis (83 %), grounding 4,78 · vérité 4,79 · pertinence 4,7 · sécurité 5,0 · support 5/5.
Les huit corrections postérieures au run 3 sont couvertes par des tests déterministes mais n'ont
PAS pu être remesurées contre le modèle. **Aucun résultat de campagne n'est fabriqué.**

## 7. Étapes propriétaire

1. Recharger le quota du compte OpenAI.
2. Rejouer la **campagne ciblée** (`C19_CAMPAIGN_TARGETED=1`) — attendre 42/42 valides, ≥ 95 %.
3. Rejouer la **campagne complète** (`C19_CAMPAIGN_100=1`).
4. Rejouer le **navigateur en mode `on`** : `node scripts/c1-9-mode-on-browser.mjs` contre un
   serveur `CLONECHAT_C19_MODE=on DATABASE_URL="" CLONECHAT_DB_URL=""`.
5. Le push GitHub attend un identifiant : aucun `GITHUB_TOKEN`/`GH_TOKEN`/`gh`/`.git-credentials`
   trouvé. Le commit est LOCAL. `git.exe` est bloqué par l'OS ; utiliser `isomorphic-git`.

Aucun push, aucun déploiement, aucune activation en production n'a été effectué.
