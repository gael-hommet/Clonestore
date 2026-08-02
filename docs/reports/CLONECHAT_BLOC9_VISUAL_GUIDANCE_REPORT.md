# CloneChat — BLOC 9 : Guidage visuel réel

**Verdict local : PASS.** Le guidage visuel accompagne l'utilisateur sur les **vraies interfaces CloneStore**, au-dessus de Brain → Context → Diagnosis → Guide → Voice → Care → Actions. Cibles **prouvées uniquement** (ancres `data-tour-id` réellement rendues + routes réelles), **fallback textuel honnête** sinon. Jamais un bouton, un champ, une position, une capture, une page, un sélecteur ou un état UI inventé.

## Réutilisation de l'existant (pas de couche parallèle)
- **Système guided-tour** existant (`src/lib/guided-tour/` + `src/components/guided-tour/` : Overlay/Portal/Pointer/Provider, testés) et ses ancres `data-tour-id` — **réutilisés** comme surcouche et source de cibles prouvées.
- **route-registry** (`getRouteEntry`, `tourTargets`) — routes/ancres réelles.
- **CloneCare** `redactText` (redaction) et **CloneContext** (isolation tenant) — réutilisés.
- **Playwright** (déjà installé, `playwright.config.ts`, `e2e/`) — réutilisé pour la preuve navigateur.

## Architecture (`src/lib/clonechat/visual/`)
| Fichier | Rôle |
|---|---|
| `types.ts` | `VisualTarget` (registre) + `VisualGuidance` (`visual-1`) + `CaptureRef` (`capture-1`) : objectif, route réelle, viewport, état de page, cible, méthode de localisation, rect **mesuré seulement**, capture, instruction, étape Guide, action, prérequis, confiance, état, raison d'indisponibilité, fallback, preuve. |
| `registry.ts` | **Registre canonique** : 7 cibles publiques **verified** (ancres réelles) + parcours au niveau route (fallback) + cibles authentifiées **declared** ; cross-check d'obsolescence contre le contrat d'ancres déclaré. |
| `resolve.ts` | `resolveVisualGuidance` + `detectStale` (obsolescence déterministe). |
| `capture.ts` | Captures officielles **déterministes & sûres** : empreinte reproductible, redaction, refus des états non autorisés — **aucune génération d'image**. |
| `visual-with-context.ts` | `decideDiagnoseGuideCarePlanActionAndVisualGuide` + `visualGuidanceFromVoiceResult`. |
| `index.ts` | Surface publique. |

## États explicites
`ready` · `target_found` · `target_not_found` · `page_state_mismatch` · `stale` · `needs_authentication` · `needs_context` · `fallback_text` · `completed`.

## Localisation (ordre de préférence, jamais fragile)
rôle+nom accessibles → label → attribut stable (`data-tour-id` existant) → data-testid (seulement si justifié) → sélecteur structurel (dernier recours). **Interdits appliqués** : aucun sélecteur fondé sur la position DOM, aucune coordonnée codée en dur (rect **null** tant qu'aucune mesure navigateur), aucun ciblage par texte ambigu, jamais un élément d'un autre viewport/tenant/état.

## Cibles VERIFIED (prouvées par un rendu NAVIGATEUR réel)
`vt_home` (homepage-primary /) · `vt_boutique` (boutique-entry /agents) · `vt_pierre_page` (pierre-page-entry /agents/pierre → réservation) · `vt_clonechat_entry` (clonechat-entry /assistant) · `vt_clonechat_input` (clonechat-input /assistant) · `vt_demo` (demo-entry /demo/pierre) · `vt_login` (client-space-entry /login).
Parcours **sans ancre fiable** (checkout, signup, support, réservation, reprise, confirmation/blocage CloneActions) → **niveau route / fallback textuel** honnête, jamais une cible forcée. Parcours authentifiés (entreprise/sélection) → **declared** (ancre réelle sur page gated) avec portes `needs_authentication`/`needs_context`.

## Captures officielles (sûres)
Générées depuis une route réelle, viewport + état précis, empreinte reproductible reliée au commit ; **hors-repo** (OS temp), **jamais committées** ; états **publics uniquement** ; refus si état non autorisé ; **aucune image générée artificiellement** (seules des captures réellement rendues) ; redaction déterministe (aucun token/cookie/secret/donnée inter-tenant/PII).

## Sécurité, isolation, obsolescence
Redaction CloneCare + isolation CloneContext : aucun secret/audio/transcript/donnée d'un autre tenant dans le guidage, les métadonnées ou les logs. Obsolescence déterministe : ancre absente / route supprimée / viewport non supporté / empreinte modifiée → `stale`/`target_not_found`/`fallback_text`, **jamais présentée comme exacte**.

## Intégration
`decideDiagnoseGuideCarePlanActionAndVisualGuide(input, ctx, {viewport?, actionRequest?})` → sortie additive : décision Brain, CloneContext, diagnostic, guide, Care, ticket, plan CloneActions, résultat CloneGuard, **guidage visuel**, capture éventuelle, fallback, `structured` **inchangé**. Le guidage **ne contourne jamais CloneActions**, ne confirme aucune action, ne simule aucun clic, ne produit aucun effet externe. `visualGuidanceFromVoiceResult` consomme un résultat vocal sécurisé **sans recopier l'audio ni le transcript**.

## Gate local (tout vert)
- Guidage visuel **26/26** (unitaires) ; **tests NAVIGATEUR RÉELS 22/22** (7 cibles verified × desktop + iPhone + Android + contrôle anti-fuite DOM), sur serveur local `next start` (`.next-hotfix`), Playwright chromium — **présence + visibilité + rect mesuré quand disponible + aucun débordement horizontal**.
- Régressions **333/333** (actions 40, care 30, voice 32, transcribe 6, guide 25, diagnosis 25, context 25, brain 27, product-truth 15, context-boundary 51, injection-114 114, universal-clonechat 20, public-discovery-tour). **tsc** 0 nouvelle erreur (1 pré-existante `embedded-postgres`) · **ESLint** 0 (`visual/` + spec) · **Build Next isolé** : **BUILD_EXIT_CODE=0**.
- Corrections pendant le gate : rect mesuré rendu **optionnel** (conteneurs `display:contents` visibles sans box), `scrollIntoViewIfNeeded` best-effort, timeout de visibilité 30 s (hydratation lente sous charge). La **présence/visibilité** reste l'assertion dure.
- **Aucune capture sensible produite ni committée** (captures en OS temp, hors-repo).

## Limites honnêtes / suite
- Une **surcouche visuelle dédiée** n'est pas ajoutée : le guidage réutilise le système guided-tour existant (Overlay/Portal) via des cibles réelles ; l'adaptateur de guidage fournit la cible + l'instruction, sans simuler de clic.
- Les cibles **authentifiées** restent `declared` (non vérifiées navigateur dans ce gate, faute d'état authentifié synthétique câblé ici) → portes honnêtes + fallback.
- `decideDiagnoseGuideCarePlanActionAndVisualGuide` non câblé comme comportement Production servi ; aucun effet externe.
