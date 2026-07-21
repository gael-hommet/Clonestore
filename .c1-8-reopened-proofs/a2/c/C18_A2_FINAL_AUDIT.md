# C18 — A2 — Audit final de la couverture indépendante A / B / C

**Objet :** décision finale documentée pour les 1003 cas du corpus CloneChat A2, après trois jugements
produit indépendants, et liste consolidée des défauts à corriger.

---

## 1. Couverture des trois juges

| Juge | Périmètre | Cas jugés | Nature |
|---|---|---|---|
| A (primaire) | corpus complet | 1003 | jugement aveugle initial |
| B (secondaire) | sélection de 478 cas | 478 | second jugement aveugle, indépendant de A |
| C (arbitre) | 400 cas arbitrés + 525 cas non rejugés | **925** | jugement aveugle final, rendu avant tout accès à A et B |

Recouvrement : les 400 cas d'arbitrage ont été vus par les trois juges ; les 525 cas supplémentaires
par A puis C ; 78 cas de consensus A/B n'ont pas été rejugés par C.

---

## 2. Méthodologie

1. **Comparaison A/B déterministe** (tour précédent) : 478 cas comparés, 205 accords exacts, 273 désaccords.
   Sélection de 400 cas pour arbitrage selon des critères fixés à l'avance (désaccord, FAIL d'un juge,
   demande de second juge, distance de sévérité ≥ 2, code à fort impact).
2. **Paquets aveugles C** : 16 paquets de 25 cas, mélangés par graine déterministe dérivée du hachage
   agrégé des résultats A et B ; seuls 8 champs visibles (`id`, `message`, `full_answer`, `delivered_route`,
   `delivered_cta`, `relevant_links`, `honesty`, `execution_error`). Aucun verdict, motif ou champ resolver.
3. **Jugement C des 400 cas**, un paquet à la fois, validation de schéma et manifeste de progression
   reconstruits depuis le disque après chaque paquet.
4. **Complément de corpus** : les 525 cas présents dans les paquets primaires et absents des paquets
   secondaires ont été extraits **sans jamais lire `results-primary/`**, remis en paquets aveugles
   (21 × 25, graine dérivée des hachages des paquets sources) et jugés avec la même rubric et la même sévérité.
5. **Gel** : manifeste `C18_A2_C_COMPLETE_RESULTS_MANIFEST.json` écrit et validé (925 cas, 0 erreur de schéma,
   0 doublon, paquets sources inchangés) **avant** toute lecture des résultats A et B.
6. **Consolidation** A/B/C et clustering déterministe des défauts.

Traitement local Node uniquement : aucun agent, aucun workflow, aucun test produit, aucun serveur,
aucun accès réseau, aucune base de données, aucune écriture en production.

---

## 3. Verdicts finaux (1003 cas)

| Verdict final | Cas | Part |
|---|---|---|
| PASS | **205** | 20,4 % |
| MINOR | **643** | 64,1 % |
| FAIL | **155** | 15,5 % |
| AMBIGUOUS | 0 | — |
| UNJUDGEABLE | 0 | — |

### Origine de la décision

| Source | Cas | Règle |
|---|---|---|
| `C_ARBITRATION` | 400 | verdict de C, rendu en aveugle après désaccord ou signal fort A/B |
| `AB_CONSENSUS` | 78 | verdict commun A/B (22 PASS, 56 MINOR), non arbitré |
| `C_SUPPLEMENTAL` | 525 | verdict de C sur les cas que seul A avait vus |

Somme : 400 + 78 + 525 = 1003.

---

## 4. Ce que l'arbitrage a tranché

Sur les 400 cas arbitrés :

| Position de C | Cas |
|---|---|
| C rejoint A **et** B (verdict identique) | 110 |
| C rejoint **B** seul | 141 |
| C rejoint **A** seul | 121 |
| C s'écarte des deux | 28 |

Transitions les plus fréquentes (A/B → C) : `FAIL/MINOR → MINOR` (98), `FAIL/MINOR → FAIL` (68),
`FAIL/FAIL → FAIL` (64), `MINOR/PASS → MINOR` (48), `MINOR/MINOR → MINOR` (46).

Lecture : sur les désaccords, C ne valide massivement ni la sévérité de A ni l'indulgence de B ; il tranche
au cas par cas, avec une légère majorité de convergences vers B (141 contre 121).

## 5. Ce que la seconde couverture des 525 cas a révélé

Ces 525 cas avaient tous reçu un **PASS** du juge A et n'avaient jamais été rejugés.
Verdicts de C, rendus en aveugle :

| Verdict de C | Cas | Part |
|---|---|---|
| PASS confirmé | **173** | 33,0 % |
| Dégradé MINOR | **347** | 66,1 % |
| Dégradé FAIL | **5** | 1,0 % |

**C'est le résultat le plus important de cette phase :** deux tiers des cas réputés « bons » portent en
réalité un défaut produit concret. Aucun PASS massif ne peut donc être revendiqué sur le corpus.

---

## 6. Cas nécessitant une correction produit

`requires_product_fix = true` pour tout FAIL, et pour tout MINOR portant au moins un code d'incident
concret (hors `HONEST_SAFE_REFUSAL` et `LEGITIMATE_AMBIGUITY`).

| Mesure | Valeur |
|---|---|
| Cas à corriger | **792** / 1003 (79,0 %) |
| Causes racines distinctes | **16** |

Ces 792 cas ne représentent pas 792 corrections : ils se ramènent à 16 causes racines, dont quatre
gabarits de réponse expliquent à eux seuls la majorité du volume.

### Clusters, par gravité et par nombre de FAIL

| Cause racine | Gravité | Cas | dont FAIL |
|---|---|---|---|
| `argumentaire_prix_hors_sujet` | critical | 41 | 41 |
| `limites_ou_capacites_non_expliquees` | high | 121 | 26 |
| `plan_du_site_hors_sujet` | high | 24 | 15 |
| `pays_non_repondu_ou_errone` | critical | 14 | 12 |
| `dump_roadmap_interne` | critical | 11 | 11 |
| `action_privee_sans_explication_connexion` | high | 79 | 10 |
| `correction_ou_negation_ignoree` | critical | 47 | 10 |
| `reponse_generique_de_derobade` | high | 253 | 8 |
| `support_mal_route` | high | 8 | 8 |
| `validation_humaine_non_explicitee` | critical | 58 | 6 |
| `legal_cgv_mentions_mal_routees` | high | 11 | 5 |
| `placeholder_ou_texte_parasite` | high | 47 | 1 |
| `login_signup_mal_traites` | high | 32 | 1 |
| `faux_succes_ou_invention_non_refuses` | high | 16 | 1 |
| `hors_perimetre_mal_refuse` | medium | 18 | 0 |
| `injection_non_refusee_explicitement` | medium | 12 | 0 |

Détail par cluster (comportement attendu, comportement livré, zone de correction, IDs concernés) :
`C18_A2_FINAL_DEFECTS.json`.

### Les quatre défauts les plus coûteux

1. **Argumentaire tarifaire hors sujet (41 FAIL).** Double débit, remboursement, paiement échoué, bouton
   cassé : la réponse est la grille des prix et une invitation à la démo. C'est le défaut le plus grave
   du corpus, parce qu'il transforme une réclamation d'argent en relance commerciale.
2. **Gabarit de repli « je préfère ne pas improviser » (253 cas).** Servi y compris quand la réponse est
   connue (prix, pays, démo, partenaires) et jusque sur un simple « Bonjour ».
3. **Feuille de route interne exposée (11 FAIL).** Noms de phases (P16A, P16C, T1/T2, C1) déversés sur des
   messages sans rapport, y compris des pannes.
4. **Pays non répondu ou erroné (12 FAIL).** Canada, Maroc, Québec, États-Unis, Londres, Berlin : la
   restriction aux quatre pays de lancement n'est pas énoncée ; un utilisateur genevois reçoit le tarif français.

---

## 7. Cas nécessitant un arbitrage propriétaire

Aucun cas n'a été classé AMBIGUOUS ou UNJUDGEABLE : tous les cas ont pu être tranchés sur le fond.
Les décisions qui restent du ressort du propriétaire ne sont donc pas des cas, mais des **arbitrages de doctrine** :

- **Niveau d'explicitation du plancher humain** (58 cas) : le plancher est tenu en pratique — rien n'est
  jamais exécuté — mais énoncé seulement dans une minorité de réponses. Faut-il l'énoncer systématiquement ?
- **Refus explicite des demandes illicites, falsifications et injections** (46 cas cumulés) : aujourd'hui
  neutralisées par une dérobade générique, jamais nommées comme refusées.
- **Politique de réponse sur les questions de sécurité, d'hébergement et de confidentialité**, aujourd'hui
  systématiquement éludées.
- **Seuil de tolérance sur les MINOR** : 643 verdicts MINOR, dont une large part relève de gabarits à réécrire
  plutôt que de bugs.

---

## 8. Contrôles d'intégrité

| Contrôle | Résultat |
|---|---|
| 1003 décisions finales, IDs 0 à 1002 | ✅ complet |
| IDs manquants / dupliqués | 0 / 0 |
| 400 `C_ARBITRATION` + 78 `AB_CONSENSUS` + 525 `C_SUPPLEMENTAL` = 1003 | ✅ |
| Résultats C : 16 fichiers / 400 cas + 21 fichiers / 525 cas | ✅ |
| Schéma des 925 résultats C (champs, énumérations, longueurs, règle du second juge) | 0 erreur |
| Ordre et IDs des résultats identiques aux paquets sources | ✅ |
| 41 résultats A inchangés (hash) | ✅ |
| 20 résultats B inchangés (hash) | ✅ |
| 41 paquets primaires et 20 paquets secondaires inchangés | ✅ |
| 37 fichiers de résultats C inchangés depuis le gel | ✅ |
| Gel de C écrit et validé avant tout accès à A/B | ✅ |
| Fichiers produit modifiés | 0 |
| Production, base de données, paiement, déploiement | intacts |

---

## 9. Limites honnêtes de cette certification

1. **Ce qui est certifié :** la qualité de l'expérience produit délivrée par CloneChat sur 1003 réponses
   figées, jugée trois fois selon une rubric fixe. Rien d'autre.
2. **Ce qui ne l'est pas :** la conformité légale, la validité juridique des documents, la couverture pays
   réelle, la sécurité technique, la performance en production. Aucun test, aucun serveur, aucune donnée
   réelle n'a été exécuté dans cette phase.
3. **Corpus figé :** les réponses jugées sont des captures. Elles ne prouvent pas le comportement du produit
   aujourd'hui, ni après correction.
4. **Limite de cloisonnement, assumée :** C a rendu ses 925 verdicts avant toute lecture des résultats A ou B,
   et sans jamais voir un verdict individuel. Mais C a été exécuté dans la même session que la préparation
   A/B, où les **distributions agrégées** (nombres de PASS/MINOR/FAIL, matrice de transition) avaient été
   calculées. Le cloisonnement est donc total au niveau du cas, partiel au niveau statistique. Une exécution
   en session neuve aurait été plus stricte.
5. **Les 525 cas supplémentaires** formaient, par construction du complément, l'ensemble des PASS de A non
   échantillonnés : cette propriété structurelle était déductible de l'arithmétique du mandat. Elle n'a pas
   été utilisée comme signal — la preuve en est que 173 d'entre eux ont été confirmés PASS et 5 dégradés en FAIL.
6. **Un seul juge par verdict final** sur les 525 cas supplémentaires (A puis C, sans troisième avis) et sur
   les 78 cas de consensus (A et B, jamais revus par C).
7. **Sévérité** : la ligne appliquée par C est explicitée dans les `concise_reason` de chaque cas. Elle est
   plus sévère que celle de B sur les réponses hors sujet, plus indulgente que celle de A sur les dérobades
   honnêtes assorties du bon CTA.

---

## 10. Artefacts

| Fichier | Contenu |
|---|---|
| `C18_A2_FINAL_VERDICTS.json` | 1003 décisions finales avec source de décision et besoin de correction |
| `C18_A2_FINAL_DEFECTS.json` | 16 causes racines, IDs concernés, comportement attendu/livré, zone de correction |
| `C18_A2_FINAL_MANIFEST.json` | compteurs, hachages sources et sorties, intégrité |
| `C18_A2_C_COMPLETE_RESULTS_MANIFEST.json` | gel des 925 verdicts de C |
| `results-arbiter/` (16) · `results-supplemental/` (21) | verdicts bruts du juge C |
| `C18_A2_AB_COMPARISON_META.json` · `C18_A2_AB_COMPARISON_AUDIT.md` | comparaison A/B (tour précédent) |
