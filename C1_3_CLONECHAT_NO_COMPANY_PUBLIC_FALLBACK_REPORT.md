# C1.3 — CloneChat No-Company Public Knowledge Fallback

**Date :** 2026-07-11 · **Nature :** correction de bug CIBLÉE. Un utilisateur **authentifié sans entreprise active** recevait « Aucune entreprise active n'est associée à votre compte. » pour **toute** question, y compris les questions publiques (prix, produit, Pierre, vente, navigation). **Production OFF, paiement disabled, providers live OFF, aucun déploiement, aucun commit.**

> **Verdict : C1.3 — NO-COMPANY PUBLIC KNOWLEDGE FALLBACK VERIFIED / GENERAL CLONECHAT QUESTIONS OPERATIONAL.**
>
> Prouvé au navigateur (desktop + mobile) sur un utilisateur **authentifié réel sans entreprise** : les questions publiques reçoivent de vraies réponses groundées (prix canoniques 449 € / 499 CHF), les demandes touchant à l'entreprise restent bloquées, aucune fausse entreprise n'est créée.

---

## Réponses aux 25 questions

1. **Quelle branche exacte causait le bug ?** [route.ts:123-124](src/app/api/assistant/chat/route.ts#L123) : `const tenant = await resolveCloneChatCompany(userId); if (!tenant.ok) return tenantRefusalResponse(tenant);` — un **retour anticipé** avant toute classification.
2. **Quelle raison tenant représentait l'état normal « pas d'entreprise » ?** `MEMBERSHIP_REQUIRED` (et `COMPANY_SELECTION_REQUIRED` pour « plusieurs entreprises, aucune choisie »).
3. **Quels échecs tenant restent fail-closed ?** `MEMBERSHIP_SUSPENDED` (refus, même sur une question publique), `COMPANY_UNAVAILABLE` (**503**), et **tout code inconnu** (fail-closed par défaut).
4. **La classification a-t-elle lieu avant le refus ordinaire ?** **Oui** — la porte s'exécute désormais avant `tenantRefusalResponse`, uniquement pour les états ordinaires.
5. **Un utilisateur sans entreprise peut-il poser des questions générales ?** **Oui** — prouvé au navigateur et par 29 tests de route.
6. **L'adaptateur public C1.1 est-il réellement utilisé ?** **Oui** — `answerPublicQuestion` avec `PUBLIC_VIEWER` (`accountPort: null`, `delegationPort: null`). Aucun prix/route/connaissance Pierre réécrit dans la route.
7. **Le responder OpenAI existant est-il utilisé ?** **Oui** — `createRealOpenAIResponder` est passé à l'adaptateur public. **Aucun second client.**
8. **Le budget est-il réservé avec `companyId = null` ?** **Oui** — scope `{ userId: <réel>, companyId: null }`, prouvé par espion : réservation **avant** le modèle, `commit(30)` au succès.
9. **Une fausse entreprise est-elle créée ?** **Non** — jamais de `u:<userId>` ni de tenant fabriqué. Les deux magasins de budget n'ajoutent la clé entreprise que si `companyId` est présent.
10. **Seules des sources publiques sont-elles fournies ?** **Oui** — **assertion de visibilité serveur avant tout appel modèle** (`buildKnowledgeIndex(PUBLIC_VIEWER)` + `indexLeaksForbiddenSources`) ; une fuite ferait fail-closed.
11. **Les sources tenant/internes sont-elles exclues ?** **Oui** — company_context, employee, mission, task, validation, documents générés/téléversés, mémoire support tenant, code interne, rapports fondateur, secrets.
12. **Les prix canoniques sont-ils servis ?** **Oui** — 449 € (FR/BE/LU) et 499 CHF (CH), **dérivés du résolveur réel**, vus dans le navigateur.
13. **Les capacités publiques de Pierre viennent-elles du registre réel ?** **Oui** — l'index dérive de `HR_CAPABILITIES` (borné, jamais le canon entier dans le prompt).
14. **Les questions entreprise restent-elles bloquées ?** **Oui** — « Pour agir sur votre entreprise, sélectionnez ou créez d'abord une entreprise active. »
15. **La création de mission est-elle impossible sans entreprise ?** **Oui** — aucun modèle, aucune réservation, aucune proposition, aucun P16C sur ces chemins.
16. **Comment la persistance publique est-elle gérée ?** **Aucune persistance durable** en mode découverte (le schéma de conversation est scopé entreprise ; on n'invente jamais de `companyId`). Limitation documentée — elle **ne bloque jamais** la réponse.
17. **Le mode entreprise active est-il inchangé ?** **Oui** — budget scopé sur l'entreprise réelle, contexte tenant, délégation, propositions : tests verts.
18. **P16C est-il inchangé ?** **Oui.**
19. **L'accès anonyme est-il inchangé ?** **Oui — 401 `AUTH_REQUIRED`** (prouvé navigateur).
20. **Le kill switch d'urgence est-il inchangé ?** **Oui** — `CLONECHAT_ENABLED=false` → **503** fail-closed.
21. **Résultats de tests exacts :** classifieur **43/43** · route **29/29** · groupé (clonechat + API + P16C + assistant + components) **472/472** · `tsc` **0** · non-régression **7651/7651** (1 skip pré-existant).
22. **Ce que le QA navigateur a prouvé :** desktop **1440×900** et mobile **390×844**, utilisateur authentifié réel **sans entreprise** — workspace réel, composer actif, **indice « Mode découverte »**, 5 questions publiques → vraies réponses (dont prix canoniques), 2 demandes entreprise → « sélectionnez ou créez », **aucune donnée tenant**, refresh utilisable, aucun débordement mobile, anonyme 401.
23. **Le build passe-t-il ?** **Oui** — `npm run build` exit **0**, 192/192 pages, 0 erreur de type.
24. **Quelque chose a-t-il été déployé ?** **Non.**
25. **Production/paiement/providers live inchangés ?** **Oui** — `PRODUCTION_AUTHORIZED=false`, paiement `disabled`, Stripe/e-mail/signature/voix/téléphonie live **OFF**.

---

## Bug supplémentaire trouvé PAR le QA navigateur (et corrigé)

Le premier passage navigateur a renvoyé **500** sur le chemin public : le magasin de **budget durable** de ce poste de dev n'est pas provisionné (`role "clonechat_app" does not exist` — **pré-existant**, hors C1.3). Comme `budget.reserve` était attendu hors `try`, l'exception faisait échouer la route.

**Correction :** le chemin public **dégrade proprement** — budget indisponible → aucune réservation → **aucun appel modèle** (invariant préservé) → repli public **déterministe** qui délivre quand même les réponses canoniques. Régression verrouillée par un test dédié (« budget indisponible → réponse publique, jamais 500, aucun modèle »).

> **Honnêteté :** de ce fait, le QA navigateur a exercé le chemin public **déterministe**. Le chemin **OpenAI public** est prouvé au niveau route (source `openai_public`, responder réel appelé 1×, scope `companyId: null`, commit 30 tokens).

## Chiffres

| Porte | Résultat |
|---|---|
| Classifieur (pur) | **43/43** |
| Route C1.3 | **29/29** |
| clonechat + API + P16C + assistant + components | **472/472** |
| `npx tsc --noEmit` | **0 erreur** |
| Non-régression complète | **7651/7651** (1 skip pré-existant) |
| `npm run build` | **exit 0** (192/192 pages) |
| Navigateur desktop + mobile | **toutes assertions vertes** |

Preuves : [.c1-3-proofs/no-company-public-fallback/](.c1-3-proofs/no-company-public-fallback/) (23 fichiers, dont les observations navigateur réelles).

---

> **Verdict final : C1.3 — NO-COMPANY PUBLIC KNOWLEDGE FALLBACK VERIFIED / GENERAL CLONECHAT QUESTIONS OPERATIONAL.**
