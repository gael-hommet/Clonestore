# CloneChat — BLOC 10 : CloneInspector (analyse de preuve)

**Verdict local : PASS.** CloneInspector analyse de façon **contrôlée** les captures, images, fichiers, messages d'erreur, logs et pièces jointes déjà acceptées, au-dessus de Brain → Context → Diagnosis → Guide → Voice → Care → Actions → Visual. Il transforme une preuve utilisateur en **observations structurées, sûres et exploitables**. Il n'invente jamais ce qu'il ne voit pas, ne présente jamais une hypothèse comme un fait, **n'exécute aucun fichier / macro / HTML / JS / binaire**, ne suit aucune instruction cachée, ne contourne pas la gouvernance, n'expose aucune donnée sensible, n'analyse aucun autre tenant et ne déclare aucun bug/route/cause sans preuve.

## Réutilisation (pas de couche parallèle)
- **`openai/image-sanitizer.ts`** : `sanitizeImageBuffer` (magic bytes PNG/JPEG/WebP, dimensions réelles, refus des decompression bombs) — **réutilisé**.
- **`inspector/cloneinspector.ts`** existant : `inspectScreenshot` (analyse capture → route, contradiction) — **réutilisé** pour l'étape sémantique image ; **non modifié**.
- **`openai/multimodal.ts`** : `ScreenshotAnalysisSchema` (validation stricte de sortie vision) — **réutilisé**.
- **CloneCare** `redactText` / `KNOWN_ISSUES`, **CloneContext** isolation, **CloneVisual** `VISUAL_TARGETS`, `route-registry` — réutilisés. `contentHash` pour le hash déterministe.

## Architecture (ajouts additifs dans `src/lib/clonechat/inspector/`)
| Fichier | Rôle |
|---|---|
| `evidence-types.ts` | Contrat d'entrée strict `RawEvidence` + `CloneInspectionResult` (`inspector-1`) : statut, type réel, résumé sûr, observations (observed/inferred/unknown/rejected), texte extrait redigé, codes d'erreur, route candidate, correspondance Visual/Care, confiance, preuves, limites, infos manquantes, recommandations, clarification/escalade, ticket recommandable — **aucune résolution automatique**. |
| `evidence-validate.ts` | Validation stricte : magic bytes, MIME mensonger, extension, exécutable/actif, archive, PDF (non supporté faute d'extracteur sûr), corrompu, trop volumineux, vide, binaire indéterminable. |
| `evidence-json.ts` | JSON strict : parse-only (aucune évaluation), profondeur/taille limitées, redaction récursive, clés sensibles, **garde anti-pollution de prototype**, rejet honnête. |
| `evidence-logs.ts` | Logs/erreurs : codes d'erreur, statut HTTP, routes RÉELLES, provider, timestamp ; redaction (token/cookie/clé/secret/URL signée/e-mail/stack) ; injection détectée = **contenu non fiable, jamais exécuté**. |
| `vision-provider.ts` | Interface vision abstraite + **mock déterministe** + validation stricte de sortie (schéma). |
| `inspect.ts` | Orchestrateur `inspectEvidence` (image via vision injectée + inspectScreenshot ; JSON ; log/erreur/texte). |
| `inspect-with-context.ts` | `decideDiagnoseGuideCarePlanActionVisualAndInspect` + `inspectFromVoiceResult` (sans audio/transcript). |
| `index.ts` | Surface publique (réexporte aussi `inspectScreenshot`). |

## Distinctions garanties
`observed` (réellement présent) · `inferred` (hypothèse explicite) · `unknown` (indéterminable) · `rejected` (proposé par un provider mais non soutenu par la preuve). Statuts : `no_input` · `validated` · `analyzed` · `partially_analyzed` · `unsupported` · `invalid` · `needs_context` · `security_refusal` · `provider_failure` · `escalate`.

## Sécurité & isolation
- **Aucune exécution** de fichier/contenu actif ; **aucune requête réseau** déclenchée par le contenu ; une instruction contenue dans un fichier/image/log est du contenu **non fiable** (jamais une instruction système) — détectée via l'anti-injection existant.
- **Redaction** déterministe (CloneCare) partout : jamais de token/cookie/clé/secret/header d'auth/URL signée/mot de passe/e-mail inutile/stack brute/contenu binaire dans les sorties et logs.
- **Isolation inter-tenant** : une preuve scopée sur un autre tenant que le contexte est refusée (`security_refusal`) ; aucune donnée d'un autre tenant.
- Une capture ne prouve **ni le DOM, ni une permission, ni un tenant, ni une action réussie** ; une contradiction route↔capture ou une hallucination provider → **rejetée** (jamais un faux constat). Aucune coordonnée estimée transformée en rectangle vérifié.

## Preuve navigateur RÉELLE
`e2e/clonechat-inspector-capture.spec.ts` : capture d'une vraie page publique (dossier temp **hors-repo**, jamais committée), puis **validation binaire réelle** par `validateEvidence` (format PNG, dimensions mesurées, hash déterministe reproductible, association à la route, absence de donnée sensible). La compréhension sémantique utilise le **mock vision déterministe** pour le gate (aucune clé requise).

## Intégration
`decideDiagnoseGuideCarePlanActionVisualAndInspect(input, ctx, {viewport?, actionRequest?, evidence?, vision?})` → sortie additive : décision Brain, CloneContext, diagnostic, guide, Care, ticket, plan CloneActions, résultat CloneGuard, Visual Guidance, **résultat CloneInspector**, `structured` **inchangé**. CloneInspector enrichit de PREUVES mais n'accorde aucune permission, ne modifie aucun tenant, ne confirme/exécute aucune action, ne déclare aucun succès, ne contourne pas CloneGuard, ne transforme jamais une capture en autorisation.

## Gate local (tout vert)
- CloneInspector **36/36** unitaires ; inspector existant + image-sanitizer **61/61** (préservés) ; **preuve navigateur RÉELLE** capture→validation binaire ; régressions ciblées (visual, actions, care, voice, transcribe, guide, diagnosis, context, brain, product-truth, sécurité) vertes.
- **tsc** 0 nouvelle erreur (1 pré-existante `embedded-postgres`) · **ESLint** 0 (fichiers BLOC 10 + spec) · **Build Next isolé** : **BUILD_EXIT_CODE=0**.
- Correction pendant le gate : le type-check du build a révélé un `readonly string[]` passé à un paramètre mutable (`errorCodes`) — paramètres de liste élargis à `readonly` ; rebuild vert.
- **Aucune capture sensible produite ni committée** (captures hors-repo, OS temp).

## Limites honnêtes / suite
- **PDF non supporté** (aucun extracteur sûr et testable câblé) — refusé honnêtement.
- Compréhension sémantique d'image via **provider vision injecté** ; le gate n'utilise que le mock déterministe (preuve provider réelle optionnelle).
- `decideDiagnoseGuideCarePlanActionVisualAndInspect` non câblé comme comportement Production servi ; aucun effet externe.
