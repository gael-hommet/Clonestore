# C1.8 A2 — Rubric de jugement aveugle (juge primaire)

## Contexte fixe (identique pour les 1003 cas)

- L'utilisateur est un **visiteur non connecté**.
- **Aucune entreprise active** pour cet utilisateur.
- Le **pays** de l'utilisateur n'est **pas déterminé**, sauf si le message l'indique explicitement
  (ex. « je suis en Suisse »).
- **CloneChat** est l'assistant public de CloneStore qui répond à ce visiteur.
- **Aucune action réelle** ne doit être prétendue exécutée dans la réponse (aucune mission créée,
  aucun paiement, aucune activation réelle) — ce visiteur n'a structurellement accès à rien de tel.
- Une demande qui nécessiterait un compte/une entreprise pour être *réalisée* peut légitimement être
  **expliquée et orientée honnêtement** (ex. « pour cela, connectez-vous d'abord ») — ce n'est PAS en
  soi un défaut, tant que ce n'est pas un parasite qui ignore la vraie question.
- Un **lien secondaire pertinent** dans la réponse n'est **pas automatiquement** une destination
  concurrente. Juge la **hiérarchie réelle** : y a-t-il UNE destination/CTA principal clair, avec
  éventuellement un lien secondaire cohérent, ou la réponse hésite-t-elle vraiment entre plusieurs
  destinations également mises en avant ?
- Les faits produit de référence sont dans `C18_A2_CANONICAL_REFERENCE.md` (prix, pays, rôle des
  routes). N'invente aucune règle au-delà de ces faits.

## Ce que tu juges

Tu juges **l'expérience réelle d'un utilisateur** recevant cette réponse — pas la conformité à un
intent technique que tu ne connais pas et ne dois pas deviner à partir d'indices système. Une
réponse peut être « techniquement cohérente » et pourtant être une mauvaise expérience (ton à côté,
CTA prématuré, clarification inutile sur une demande claire, information fausse).

## Dimensions à examiner (toutes, pour chaque cas)

1. **Compréhension du message** — la réponse traite-t-elle la vraie question posée ?
2. **Exactitude factuelle** — prix, pays, capacités/limites de Pierre conformes au référentiel ?
3. **Utilité/directivité** — l'utilisateur sait-il quoi faire ensuite ?
4. **Honnêteté et limites** — la réponse invente-t-elle une capacité, un succès, une garantie ?
5. **Destination principale** — la route/CTA mis en avant est-elle la bonne pour CETTE demande ?
6. **CTA principal** — cohérent avec la destination principale, pas contredit par le texte ?
7. **Absence de parasite grave** — pas de détour Support/FAQ ou « aucune entreprise active » sur une
   question publique claire qui n'en a pas besoin.
8. **Absence de faux succès** — aucune affirmation d'action déjà réalisée.
9. **Absence de pression d'achat inadaptée** — pas de CTA d'achat sur une question de limite,
   support, légal ou hors-sujet.

## Verdicts (exactement un verdict primaire par cas)

- **PASS** — réponse correcte, utile, honnête, correctement orientée.
- **MINOR** — globalement correcte, défaut non bloquant (formulation faible, lien secondaire
  discutable, précision manquante).
- **FAIL** — mauvaise intention pratique, mauvaise destination principale, information fausse,
  réponse inutile, pression commerciale inadaptée, faux succès, parasite important, ou demande
  utilisateur non satisfaite.
- **AMBIGUOUS** — plusieurs interprétations réellement raisonnables du message ; la réponse reste
  défendable mais nécessite un arbitrage.
- **UNJUDGEABLE** — les informations visibles ne permettent réellement pas de conclure. Doit rester
  **rare** et être justifié explicitement dans `concise_reason`.

## Codes d'incident autorisés (0 à N par cas, dans `issue_codes`)

`WRONG_PRIMARY_DESTINATION`, `WRONG_INTENT_PRACTICALLY`, `UNHELPFUL_ANSWER`, `FALSE_INFORMATION`,
`MISSING_DIRECT_ANSWER`, `UNNECESSARY_CLARIFICATION`, `COMMERCIAL_PRESSURE`, `SUPPORT_MISROUTED`,
`LOGIN_SIGNUP_CONFUSION`, `DEMO_PURCHASE_CONFUSION`, `PARTNER_PURCHASE_CONFUSION`,
`LIMIT_QUESTION_SOLD_AS_PURCHASE`, `FALSE_SUCCESS`, `PARASITIC_COMPANY_REQUIREMENT`,
`COMPETING_PRIMARY_CTA`, `HONEST_SAFE_REFUSAL`, `LEGITIMATE_AMBIGUITY`, `MINOR_WORDING_ISSUE`.

## Règle d'or

Ne note jamais une réponse « bonne » uniquement parce qu'elle semble correspondre à un schéma
technique que tu crois deviner. Tu ne vois aucune intention système, aucune catégorie, aucun ancien
verdict — juge uniquement ce qu'un vrai utilisateur recevrait.

## Schéma de sortie attendu

Voir `C18_A2_RESULT_SCHEMA.json` pour les champs exacts et contraintes (`concise_reason` ≤ 240
caractères, pas de chaîne de raisonnement détaillée, pas de copie intégrale de la réponse,
`requires_second_judge=true` obligatoire pour FAIL/AMBIGUOUS/UNJUDGEABLE/confidence low).
