# P9.4 — CloneChat Unified Conversational Workspace — Architecture

> Interface conversationnelle de CloneStore. Ce document fixe l'architecture réelle
> constatée (audit Section 1), les deux modes (public / client), la couche cliente
> canonique, les gardes serveur, le moteur d'intention gouverné, la frontière P8, et
> les critères de sortie. Produit **avant** toute construction.

Règle cardinale : **consommer les contrats réels (runtime V1 via clients client-safe
existants), ne jamais inventer de backend, ne jamais simuler une réussite, ne jamais
exposer de données d'un autre tenant, l'humain confirme le sensible, le serveur reste
l'autorité.**

---

## 1. Audit réel constaté (état actuel — HONNÊTE)

| Élément | Chemin | État réel |
|---|---|---|
| Page CloneChat | `src/app/assistant/page.tsx` (+ `layout.tsx`) | Page de présentation ; **verrouillée serveur** par `isCloneChatEnabled()` → `AccessLockScreen` « CloneChat arrive bientôt » quand flag off. Page intacte. |
| API assistant | `src/app/api/assistant/route.ts` | POST/GET ; **503 `CLONECHAT_DISABLED`** quand flag off. Quand on : moteur **déterministe** `classifyIntent` + `buildFallbackAnswer` (`@/lib/assistant/knowledge`) + `quickAsks`/`statusCards`/`links`. **Public, sans auth, sans tenant.** |
| Moteur public | `src/lib/assistant/{knowledge,types}.ts` | **Réel et déterministe** : classification par règles, réponses produit, orientation. Intents produit (pricing/onboarding/navigation/support…). Aucune hallucination, aucune donnée cliente. |
| Flag | `src/lib/features/product-availability.ts` | `isCloneChatEnabled()` = env `CLONECHAT_ENABLED` (défaut **off**). Blocage RÉEL (page + API). |
| Lien nav | AppShell (`/assistant` « CloneChat ») + route-registry (`/assistant`, gated) | présent. |
| LLM | — | **Aucune intégration LLM** aujourd'hui. Le moteur est déterministe. |
| Mode client authentifié opérationnel | — | **INEXISTANT** — c'est le cœur de la construction P9.4. |

**Conclusion d'audit** : le **mode PUBLIC — ORIENTATION** existe déjà (déterministe,
honnête). Le **mode CLIENT AUTHENTIFIÉ — OPÉRATIONNEL** (contexte entreprise, missions,
validations, salariés, documents, actions gouvernées, création de mission réelle) est
à construire, **en réutilisant la couche P9.3** `src/lib/client-cockpit/**` +
`src/lib/pierre/cockpit/**` (clients V1 client-safe).

## 2. `/assistant` vs `/profile/messages` (responsabilités distinctes, reliées)

- **`/assistant` (CloneChat)** : espace **conversationnel interactif** — demande libre, orientation, compréhension du contexte, recherche, proposition d'action gouvernée, confirmation, résultat réel, continuité, passages vers le cockpit.
- **`/profile/messages` (Messagerie)** : centre de **consultation** — communications, notifications, historique, feed de contexte (lecture seule). Reste distinct ; relié par des liens (« Poser une question à CloneChat »). **Pas de fusion.**

## 3. Modèle client canonique `src/lib/clonechat/**` (pur, testable)

Aucun import serveur. Réutilise les modèles P9.3 (statuts mission/validation/document,
permissions, overview) — **jamais de duplication de logique métier P8**.

```
types.ts              # CloneChatMessage, ContentBlock (Text/Mission/Validation/Employee/Document/ActionPreview/Error/SourceBoundary), ProposedAction
intent-contract.ts    # classification déterministe (règles) → intent + entités
action-contract.ts    # actions candidates (create_mission/open_*/cancel_mission/navigate)
action-policy.ts      # risque + confirmation + permission (réutilise CockpitPermissions)
context-boundary.ts   # frontière public/company/pierre/user ; jamais de fuite tenant
response-normalizer.ts# assemble des blocs riches à partir des modèles client-cockpit
conversation-machine.ts # état du fil (idle/classifying/resolving/awaiting_confirmation/executing/complete/error)
thread-storage.ts     # persistance locale versionnée (thread courant, reprise, cleanup, pas de secret)
continuity.ts         # reprise, résumé, lien messagerie
public-mode.ts        # capacités publiques (orientation seule)
authenticated-mode.ts # capacités client selon permissions
errors.ts             # taxonomie (auth/access/subscription/runtime/network/stale/validation_conflict/missing_data/feature_disabled/unknown)
index.ts
```

Invariants de la couche cliente : jamais d'effet sensible sans confirmation ; jamais
d'invention de donnée ; provenance toujours affichée ; jamais d'exécution sans
permission serveur ; jamais d'ID technique en clair ; jamais de contenu cross-tenant.

## 4. Gardes serveur `src/app/api/assistant/**`

- **Mode public** (existant) : orientation seule, aucune route protégée atteinte.
- **Mode client** (nouveau, ex. `/api/assistant/context`, `/api/assistant/act`) :
  garde d'auth + `resolveOperationalAccess("pierre")` (même autorité que le cockpit) +
  tenant résolu **serveur** (jamais de `company_id` client) + permissions + refus
  cross-tenant + `no-store` + aucune fuite d'erreur brute/secret. Les **données** sont
  lues via les clients V1 existants (`fetchPierreHistory`, `fetchPierreMission`,
  `fetchPierreMissionValidations`, `fetchPierreEmployeesV1`) ; les **actions** via
  `submitPierreMission` + décisions de validation (mêmes chemins réels que P9.3).

## 5. Moteur d'intention GOUVERNÉ (déterministe honnête)

Aucune intégration LLM réelle disponible → **moteur déterministe par règles** (aucune
hallucination, documenté honnêtement). Pipeline : message → classification d'intention
→ résolution du contexte **réel** (V1) → action candidate → **permission serveur** →
politique de risque → **confirmation si sensible** → exécution via **contrat réel** →
lecture du résultat réel → réponse structurée → continuité. Intention ambiguë →
**clarification** (jamais d'invention). Action interdite → explication honnête.

## 6. Intégration LLM — honnêteté

**Mode réellement utilisé = déterministe** (règles + données réelles). Le produit
n'affirme jamais qu'un LLM répond. Si une intégration LLM autorisée est ajoutée plus
tard : elle **proposera**, le système **gouverne**, l'humain **confirme** le sensible,
le contrat réel **exécute** — jamais d'exécution autonome sensible par le LLM.

## 7. Frontière P8 (lecture seule)

Interdit de modifier : `src/lib/pierre/v1/**`, `src/app/api/pierre/v1/**`,
`api/webhooks/**`, `supabase/migrations/**`, providers, queues, workers, RLS, contrats
V1, scripts P8, flags Production. CloneChat consomme les **réponses HTTP** V1 via les
clients client-safe existants. Manque backend réel → `P9_4_RUNTIME_CONTRACT_GAPS.md`.

## 8. Harness QA (Section 13/15)

Réutilise le modèle P9.3 : 2 users Supabase éphémères + orders (flag
`P94_E2E_..._WRITES=yes`) pour l'accès ; runtime **PGlite local** (`PIERRE_E2E_TEST_MODE=1`)
+ plan de contrôle E2E P8 pour semer des données réelles ; `CLONECHAT_ENABLED=true`
**uniquement en local test**. Playwright A–H (1440×900 + 390×844). Cleanup total.

## 9. Critères de sortie

Mode public orientation (sans donnée cliente) ; mode client opérationnel gouverné ;
moteur d'intention honnête ; contexte + cartes réelles ; création mission réelle via
chat (double-clic safe) ; validations mutables via chat (confirmation, version) ;
salariés + documents via chat (isolation, liens sécurisés) ; isolation A/B + sécurité
prompt-injection ; continuité ; responsive + a11y ; tour ; Playwright A–H ; cleanup
zéro résidu ; tsc + tests P9.4 + build verts ; P9.1/P9.2/P9.3 non régressés ; P8
intouché ; flag Production inchangé.
