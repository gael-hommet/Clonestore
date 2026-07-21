# C1.8 A2 — Audit de la recapture intégrale (code corrigé)

**Objet :** rejeu des 1003 messages du corpus A2 sur le pipeline public CORRIGÉ, mêmes identifiants,
même ordre, réponses complètes.

## 1. Conditions d'exécution

| Élément | Valeur |
|---|---|
| Surface mesurée | `answerPublicQuestion` (visiteur non connecté, chemin déterministe) |
| Harnais | `src/lib/clonechat/navigation/__tests__/c18-a2-remediated-recapture.test.ts` |
| Fixture source | `src/lib/clonechat/navigation/__tests__/fixtures/torture-1000.json` (inchangée) |
| Horodatage injecté | `2026-07-18T10:00:00Z` (identique à la capture d'origine) |
| Réseau, base, provider externe | aucun |
| Variable sensible lue | aucune |

## 2. Contrôles d'intégrité

| Contrôle | Résultat |
|---|---|
| Cas capturés | **1003** |
| Identifiants 0..1002 complets | ✅ |
| Identifiants dupliqués | 0 |
| Ordre identique au corpus source | ✅ |
| Messages identiques au corpus figé | ✅ |
| Réponses vides | 0 |
| Erreurs d'exécution | 0 |
| Réponses tronquées à 90 caractères | 0 |
| Longueur moyenne des réponses | 345 caractères |

## 3. Ce que la recapture a changé

| Mesure | Valeur |
|---|---|
| Réponses dont le texte a changé | **1003** / 1003 |
| Cas dont la destination a changé | **547** / 1003 |

### Situations résolues (nouvelle couche publique)

| Situation | Cas |
|---|---|
| `incident` | 165 |
| `unclear` | 79 |
| `governance_limit` | 75 |
| `pricing_question` | 69 |
| `capability_question` | 48 |
| `country_availability` | 44 |
| `illicit_request` | 40 |
| `abandon` | 40 |
| `demo_request` | 38 |
| `discover_pierre` | 35 |
| `purchase_intent` | 30 |
| `hr_document_request` | 27 |
| `out_of_scope` | 27 |
| `mission_request` | 26 |
| `private_data_request` | 25 |
| `denied_intent` | 25 |
| `prompt_injection` | 23 |
| `discover_clonestore` | 21 |
| `validation_request` | 19 |
| `technology_explanation` | 18 |
| `login_help` | 18 |
| `partner_program` | 17 |
| `legal_document` | 16 |
| `signup_help` | 15 |
| `privacy_security` | 13 |
| `human_contact` | 13 |
| `next_step` | 9 |
| `value_question` | 7 |
| `payment_method` | 6 |
| `cancellation` | 5 |
| `false_price_premise` | 4 |
| `help_request` | 2 |
| `company_identity` | 1 |
| `navigate_home` | 1 |
| `greeting` | 1 |
| `catalog_question` | 1 |

### Destinations délivrées

| Destination | Cas |
|---|---|
| /agents/pierre | 216 |
| /questions | 193 |
| /reserver/pierre | 141 |
| null | 141 |
| /comprendre-clonestore | 131 |
| /demo/pierre | 54 |
| /login | 43 |
| /legal/confidentialite | 23 |
| /founding-partners | 19 |
| /signup | 15 |
| /agents | 7 |
| /profile | 7 |
| /legal/mentions | 5 |
| /legal/cgv | 5 |
| /legal/cgu | 2 |
| / | 1 |

## 4. Artefacts

| Fichier | Contenu |
|---|---|
| `C18_A2_REMEDIATED_BLIND_CORPUS.json` | corpus aveugle (id, message, réponse complète, destination, liens, honnêteté) |
| `C18_A2_REMEDIATED_FULL_RESPONSE_META.json` | capture complète avec métadonnées (situation, intention, confiance, source) |
