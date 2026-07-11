# C1.2 — CloneChat Reveal / Authenticated Surface Activation

**Date :** 2026-07-10 · **Nature :** bloc d'activation CIBLÉ — retirer la surface « CloneChat arrive bientôt » et révéler le vrai workspace `/assistant` pour l'usage produit authentifié, sans affaiblir aucune garde. **Production OFF, paiement disabled, providers live OFF, aucun déploiement, aucun commit.**

> **Verdict : C1.2 — CLONECHAT REVEALED / REAL ASSISTANT SURFACE ACTIVE.**
>
> `/assistant` monte désormais le vrai `CloneChatWorkspace` par défaut (prouvé au navigateur, desktop + mobile). Le placeholder de lancement est retiré. Un arrêt d'urgence explicite (`CLONECHAT_ENABLED=false`) reste fail-closed et affiche un état « temporairement indisponible » honnête. « Actif » n'ouvre PAS d'accès public anonyme : l'API exige toujours l'authentification (401 pour un visiteur).

---

## Réponses aux 25 questions

1. **Quel code affichait « CloneChat arrive bientôt » ?** `src/app/assistant/layout.tsx` : `if (!isCloneChatEnabled()) return <AccessLockScreen title="CloneChat arrive bientôt." .../>`.
2. **Comportement par défaut précédent ?** `isCloneChatEnabled()` lisait `CLONECHAT_ENABLED` et retournait **false** quand la variable était absente → produit CACHÉ par défaut.
3. **La surface temporaire a-t-elle été retirée du chemin normal ?** **Oui** — le layout monte `{children}` par défaut ; l'écran verrouillé n'est atteint que sous arrêt d'urgence explicite.
4. **`/assistant` rend-il le vrai workspace par défaut ?** **Oui** — prouvé au navigateur : `GET /assistant → 200`, `data-tour-id="clonechat-entry"` + header + composer présents, aucun « arrive bientôt » (desktop 1440×900 et mobile 390×844).
5. **Quelle valeur déclenche l'arrêt d'urgence ?** `CLONECHAT_ENABLED` ∈ `{false, 0, off, disabled, no}` (insensible à la casse).
6. **Quel libellé pendant l'arrêt d'urgence ?** « CloneChat est temporairement indisponible. » — jamais « arrive bientôt ».
7. **UI et API partagent-elles une règle canonique unique ?** **Oui** — `isCloneChatEnabled()` (product-availability.ts) est la seule règle ; le layout et `/api/assistant/chat` l'utilisent.
8. **`/assistant` est-il actif en navigation ?** **Oui** — route-registry `status: "active"`, `futurePhase` retiré, aucun badge « soon »/désactivé ; cible de tour `clonechat-entry` déclarée et portée par le workspace réel.
9. **La copie obsolète du tour a-t-elle été retirée ?** **Oui** — l'étape CloneChat décrit l'assistant réel ; plus de « Il arrive bientôt ».
10. **Un utilisateur autorisé peut-il envoyer un message ?** **Oui** — prouvé au navigateur (message soumis → réponse gouvernée). En orientation publique, réponse déterministe honnête ; en authentifié, pipeline OpenAI gouverné C1.1 (inchangé).
11. **Le rafraîchissement préserve-t-il le vrai workspace ?** **Oui** — reload `/assistant` → workspace réel, pas de placeholder (prouvé navigateur).
12. **Historique et pièces jointes toujours présents ?** **Oui** — câblage inchangé (`/api/assistant/conversations`, `attachments: docs.map`, `newConversation`).
13. **Mobile utilisable ?** **Oui** — 390×844 : workspace réel, composer visible dans le viewport, aucun débordement horizontal.
14. **Accès modèle anonyme bloqué ?** **Oui** — POST anonyme `/api/assistant/chat` → **401 AUTH_REQUIRED** (pas 503), prouvé navigateur + log serveur.
15. **Résolution d'entreprise toujours fail-closed serveur ?** **Oui** — `resolveCloneChatCompany(userId)` inchangé ; companyId jamais lu du body.
16. **Isolation tenant inchangée ?** **Oui** — visibilité fail-closed (companyA visible / companyB & public invisibles) ; `evaluateCloneChatRevealStatus().tenantIsolationReady = true`.
17. **C1.1 reste-t-il câblé au vrai OpenAI ?** **Oui** — `buildParrainGroundedPrompt` + `createRealOpenAIResponder(key)` + `validateParrainCitations` inchangés.
18. **Budget-avant-modèle intact ?** **Oui** — `stores.budget.reserve` avant l'appel modèle ; `release` en `finally`.
19. **Citations et claims toujours gardés serveur ?** **Oui** — `validateParrainCitations` + `finalizeAnswerText` inchangés.
20. **Délégation Pierre exige toujours confirmation ?** **Oui** — exécution via `proposalId` uniquement (`/api/assistant/execute`).
21. **Kill switch d'urgence prouvé ?** **Oui** — test 17 (la fonction réelle passe à false pour toutes les valeurs) + wiring route (branche 503) ; l'état ACTIF prouvé au navigateur (401, pas 503) implique que sous OFF la même route retourne 503 avant l'auth.
22. **Production, paiement, providers live inchangés ?** **Oui** — `PRODUCTION_AUTHORIZED=false`, paiement `disabled`, `isLiveExecutionAllowed()=false`.
23. **Quelque chose a-t-il été déployé ?** **Non** — aucun deploy, push, stage ni commit.
24. **Une variable de déploiement est-elle requise ?** **Non** — actif par défaut ; `requiredDeploymentEnv = null`. `CLONECHAT_ENABLED=false` sert uniquement d'arrêt d'urgence.
25. **Ce qui reste honnêtement bloqué/externe :** messagerie OpenAI authentifiée deep non pilotée en navigateur (fallback gouverné prouvé ; chemin auth déjà vérifié en C1.1) ; serveur OFF dédié non démarré (test+wiring) ; production/paiement/providers OFF ; `readyForPublicFlagActivation` inchangé/false (substrat d'upload durable toujours absent).

---

## Statut de révélation (computé — `evaluateCloneChatRevealStatus`)

Env non défini (défaut) : `assistantSurfaceRevealed=true · comingSoonScreenRemoved=true · authenticatedWorkspaceReachable=true · clonechatFeatureActive=true · emergencyKillSwitchReady=true · anonymousModelAccessBlocked=true · tenantIsolationReady=true · publicUnauthenticatedChatEnabled=false · requiredDeploymentEnv=null`.
Sous `CLONECHAT_ENABLED=false` : `clonechatFeatureActive=false`, `emergencyKillSwitchReady=true`, `publicUnauthenticatedChatEnabled=false`. `readyForPublicFlagActivation` (C1.1) **inchangé** — la révélation authentifiée ne l'ouvre pas.

## Chiffres

| Porte | Résultat |
|---|---|
| Suite C1.2 (`src/app/assistant`) | **21/21** (20 checks + reveal-status) |
| Combiné assistant+clonechat+api+components+nav | **350/350** |
| C1.1 (flag-state màj) | **106/106** |
| `npx tsc --noEmit` | **0 erreur** |
| Non-régression complète | **7414/7414** (174 fichiers) |
| Build actif (`CLONECHAT_ENABLED=true npm run build`) | **succès** — `/assistant` = Dynamic (aucun HTML statique baké) |
| QA navigateur desktop 1440×900 | workspace réel, 0 placeholder, message→réponse gouvernée, refresh persiste |
| QA navigateur mobile 390×844 | workspace réel, composer visible, 0 débordement |
| API anonyme | **401 AUTH_REQUIRED** (pas 503) |
| Périmètres protégés (T1/T2/PierreV1/C1/prod/pricing) | **0 violation** |

Preuves : [.c1-2-proofs/clonechat-reveal/](.c1-2-proofs/clonechat-reveal/) (18 fichiers) · captures `.playwright-mcp/c1-2-assistant-{desktop-1440,mobile-390}.png`.

---

> **Verdict final : C1.2 — CLONECHAT REVEALED / REAL ASSISTANT SURFACE ACTIVE.**
