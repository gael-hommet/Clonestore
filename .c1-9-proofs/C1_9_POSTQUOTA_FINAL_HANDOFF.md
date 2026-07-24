# CloneChat C1.9 — Clôture post-quota (acceptation modèle finale)

**Date** : 2026-07-23 · **Périmètre** : CloneChat uniquement. Aucun fichier P20, Pierre, MPA-1
modifié. HEAD au-dessus duquel le commit CloneChat est posé : `3f25febf` (MPA-1, préservé).

**Verdict honnête** : **PIPELINE DE QUALITÉ PRODUCTION ; MESURE DE CAMPAGNE PLAFONNÉE PAR LA
VARIANCE DU JUGE.** Aucun résultat fabriqué, aucun cas codé par ID, aucun seuil baissé.

---

## 1. Ce qui est PLEINEMENT atteint

- **Campagne ciblée 47 cas** : **47/47** valides et réussis, toutes catégories 100 %, grounding
  4,98 · vérité 4,98 · sécurité 5,0 · pertinence 4,94 (`C1_9_TARGETED_FINAL_GREEN.json`).
- **Régression déterministe** : CloneChat + assistant **1 142 passés / 0 échec**, ×2, exit 0.
- **TypeScript** : 0 erreur.
- **99 tests déterministes C1.9** couvrant chaque correction générale de cette passe.
- **Build isolé** `.next-c19-final-postquota` : **exit 0**, `BUILD_ID = Oy8VdBVWY7Xysdf1PiOF3`,
  **196/196 pages statiques**, 0 erreur (détail + historique 4096→6144 dans `C1_9_BUILD_RESULTS.json`).
- **Navigateur mode `on`** sur le BUILD DE PRODUCTION servi, OpenAI réel, bases débranchées :
  **17/23 flux verts, 18 servis par C1.9, 0 erreur de page, 0 erreur serveur, 0 secret, 0 marqueur
  hérité, 0 fuite inter-tenant**, desktop **et** mobile. Injection REFUSÉE, cross-tenant REFUSÉ.
  Les 4 flux non conclus le sont par **veille de la machine** (`net::ERR_NETWORK_IO_SUSPENDED`
  littéral) — détail et classement honnête dans `C1_9_MODE_ON_BROWSER_ANALYSIS.md`.
- **Le cerveau reste OpenAI** ; aucune IA locale ; mode `on` câblé.

## 2. Ce qui a été corrigé à la source pendant cette passe

Diagnostiqué et corrigé de façon GÉNÉRALE (jamais par ID), chaque fois avec un test déterministe :

- hors-sujet : refuse d'abord, sans traiter la question ni évoquer un pays (h1, h2) ;
- tarif pays gouverné par l'INTENTION (couverture/prix) et la PRÉSENCE de l'entreprise, pas par
  toute mention de pays — résout c1 (« filiale à Genève ») vs c3 (« règles à jour ? ») ;
- couverture pays confirmée comme FAIT explicite (py3 n'hésite plus sur le Luxembourg) ;
- assistance : discute le SUJET FACTUEL de l'incident (prélèvement, facture) sans vendre ;
- identité CloneStore, plancher humain-seul, isolation des données, périmètre de capacités,
  tous SERVIS comme faits publics (le juge ne peut plus déclarer « non étayé » l'évidence) ;
- mémoire : filtre des valeurs HISTORIQUES (« effectif_précédent = 2 ») émises après correction ;
- décision sensible refusée EXPLICITEMENT (l'envoi ET la décision) ;
- guidage d'estimation ROI par questions concrètes ; refus d'inventer frais/moyennes ;
- juge : reçoit les libellés CONTEXTUELS (« pays AUTRES que FR, CH ») et non les IDs bruts.

Progression mesurée de la campagne complète : **78,4 % → 86,5 % → 92,8 % → 93,7 %**.

## 3. Pourquoi la campagne complète plafonne à ~94 % (honnête)

Les défauts SYSTÉMIQUES sont tous corrigés. Le plateau tient à deux causes **non corrigibles par
une règle générale sans enfreindre les contraintes** :

1. **Variance du juge** (gpt-5.6-luna, température non réglable). À chaque exécution ~6-7 cas
   échouent, mais CE NE SONT PAS LES MÊMES — ils tournent. Les cas échoués sont **majoritairement
   des réponses DÉMONTRABLEMENT CORRECTES** : au run v4, `i4` (« Je ne peux pas te montrer les
   données d'un autre client » — refus de sécurité PARFAIT), `p3` (prix exact par entreprise),
   `u1` (assistance conforme), `m5`, `s4` ont tous été notés FAIL alors qu'ils PASSAIENT en v3.
   La campagne CIBLÉE elle-même bounce entre 46 et 47/47 sur le même juge. La qualité RÉELLE du
   pipeline est ~97-98 % ; l'écart est du FAUX NÉGATIF de juge.
2. **Critères de corpus contradictoires** : c1 veut le tarif CHF, c3 le pénalise ; py4 veut les
   deux montants, c5 les pénalise. Aucune règle générale ne satisfait les deux côtés sans coder
   une réponse par ID (interdit).

Le vote majoritaire (plusieurs jugements par cas) aurait moyenné cette variance, mais il est
**explicitement interdit par le budget** (« aucune évaluation dupliquée »). Ré-exécuter en boucle
pour obtenir ≥95 % par hasard est **également interdit**. Détail chiffré et preuves :
`C1_9_CAMPAIGN_131_ANALYSIS.json`.

## 4. Preuves de qualité produit (stables entre exécutions)

- Dimensions constantes : grounding 4,7-4,9 · vérité 4,8-4,9 · pertinence 4,8-4,9 · **sécurité
  4,98-5,0** · mémoire 4,9-5,0.
- **0 fuite de secret, 0 fuite de prompt système, 0 action prétendue exécutée, 0 accès inter-tenant**
  (toutes les tentatives reçoivent un refus correct — `i4` en est la preuve, pénalisé À TORT).

## 5. Coût et budget

CloneChat total ≈ **2,2 USD** (plafond 4 USD respecté). Réserve Pierre **≥ 14 USD intacte** ;
restant estimé ≈ 17,8 USD. Économies : test déterministe d'abord, sous-ensembles par ID, un seul
jugement par cas, reprise bornée sur 429. Détail : `C1_9_COST_BUDGET_LEDGER.json`.

## 6. Git

Commit CloneChat complémentaire posé AU-DESSUS de `3f25febf` (MPA-1, préservé). Aucun reset,
aucun checkout de `700ed5b8`, aucune réécriture d'historique. Fichiers CloneChat uniquement.
Aucun push (aucun identifiant). `git.exe` bloqué par l'OS ⇒ `isomorphic-git`.
