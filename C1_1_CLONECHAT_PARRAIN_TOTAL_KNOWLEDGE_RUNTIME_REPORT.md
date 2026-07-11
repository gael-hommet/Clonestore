# C1.1 — CloneChat Parrain / Total CloneStore Knowledge Runtime

**Date :** 2026-07-10 · **Nature :** transformer le substrat de connaissance C1 en RUNTIME « parrain » réellement câblé — connaissance totale (site vivant · capacités RH canoniques · registres T1/T2 · pricing canonique · vérité produit · contexte entreprise borné · documents · code interne fondateur), grounding OpenAI réel, compréhension de pièces jointes, délégation gouvernée à Pierre. **Production OFF, paiement disabled, providers live bloqués, flag public fail-closed, rien de déployé, rien de commité.**

> **Verdict : C1.1 — CLONECHAT PARRAIN TOTAL KNOWLEDGE RUNTIME VERIFIED / WIRED TO REAL CLONECHAT.**
>
> Câblé au vrai `/api/assistant/chat` + au responder OpenAI existant + à l'UI `/assistant`. Isolation tenant, filtrage de permission, citations validées, délégation Pierre gouvernée : tous prouvés. Le flag `CLONECHAT_ENABLED` reste **OFF par défaut** (posture fail-closed voulue — l'activation publique est une décision produit séparée).

**Emplacement :** `src/lib/clonechat/intelligence/c1-1/` (37 modules + 2 tests), additif pur ; câblage additif dans `src/app/api/assistant/chat/route.ts`, `src/app/assistant/useCloneChat.ts`, `src/components/clonechat/CloneChatWorkspace.tsx` ; 3 scripts d'index.

---

## Réponses aux 35 questions

1. **C1.1 est-il câblé à la vraie route authentifiée ?** **Oui** — `/api/assistant/chat` importe `intelligence/c1-1`, appelle `buildParrainGroundedPrompt` et `validateParrainCitations`, et applique la garde de claims `finalizeAnswerText` (test 89, `command-center.c1WiredToAuthenticatedRoute=true`).
2. **C1.1 est-il utilisé par le vrai responder OpenAI ?** **Oui** — le prompt système Parrain (chunks C1.1) alimente `createRealOpenAIResponder(key).respond(...)` existant, dans l'ordre budget→modèle (`c1WiredToOpenAI=true`, tests 58/63/104).
3. **CloneChat dérive-t-il la connaissance Pierre du vrai registre de capacités ?** **Oui** — `buildPierreCapabilityIndex()` mappe `HR_CAPABILITIES` (P8.10), aucune copie manuelle (tests 13-16).
4. **Compte de capacités dérivé (live) ?** **215** — lu de `HR_CAPABILITIES.length` ; sonde anti-hardcode : aucun littéral `215` en code C1.1 (`capabilityCountDerivedNotHardcoded=true`, test 14).
5. **Peut-il expliquer chaque capacité avec statut et limites réels ?** **Oui** — chaque entrée porte autonomie, risque, human-only, dépendances légal/provider, statut d'implémentation canon, et `forbiddenClaims` honnêtes (tests 15-19).
6. **Connaît-il le site exact et les liens ?** **Oui** — index vivant fusionnant `ROUTE_REGISTRY` + descriptions C1 ; routes absentes déclarées absentes avec la page réelle la plus proche, jamais d'URL fabriquée (tests 7-10).
7. **Comment la connaissance site détecte-t-elle la péremption ?** Empreinte live du registre de routes + des pages ; les scripts `clonechat-build-site-index.mjs` / `clonechat-verify-knowledge-freshness.mjs` marquent un index généré STALE dès que le hash d'arbre source change (test 11, `site-freshness.json`).
8. **Dérive-t-il les prix du résolveur canonique ?** **Oui** — `pricingForCountry` (P10), jamais de montant dupliqué : FR/BE/LU 449 EUR, CH 499 CHF, pays inconnu fail-closed (`pricingDerivedFromCanonicalResolver=true`, tests 26-29).
9. **Connaît-il T1 et T2 par leurs vrais registres ?** **Oui** — statuts vivants lus des registres T1 (15) / T2 (14) ; CloneVoice non-live, CloneCall non-téléphonie (tests 22-25).
10. **Peut-il comprendre les images sanitisées ?** **Oui** — RÉUTILISE le pipeline P9.4.2 (`sanitizeImages` → `prepareImagesForModel`/sharp → `analyzeScreenshotReal`) ; aucune seconde pile OpenAI ; jamais de texte invisible prétendu lu (`imageUnderstandingReady=true`).
11. **Formats réellement pris en charge ?** **PDF** (texte natif, réf. pages), **DOCX** (mammoth, paragraphes/sections), **XLSX** (xlsx, valeurs affichées uniquement), **CSV**, **TXT**, **Markdown**, **PNG/JPEG/WEBP** (pipeline visuel). Parseurs installés et testés (tests 43-57).
12. **Formats partiels/non pris en charge ?** **XLSX = structured_partial** (aucune formule exécutée) ; **PDF sans texte = image_only** (jamais OCRisé automatiquement) ; **PPTX = unsupported** (aucun parseur approuvé — refus honnête) ; format inconnu = unsupported.
13. **Peut-il répondre sur des documents téléversés avec citations ?** **Oui** — ingestion tenant-scopée → chunks avec provenance (page/feuille/section) → grounding borné + citations validées (tests 46-57).
14. **Peut-il expliquer un document généré par Pierre via un lineage réel ?** **Oui** — `buildDocumentLineage` récupère mission/tâche/instruction/gabarit/validations/trace ; ID d'artefact étranger → null (tenant) (tests 37-42).
15. **Explication au niveau de la phrase là où la preuve existe ?** **Oui** — `explainSentence` rapproche des passages sources réels avec un score de confiance (test 39).
16. **Admet-il quand la preuve de lineage manque ?** **Oui** — `missingEvidence` toujours calculé ; sans passage source, confiance `none` et « l'origine exacte ne peut pas être confirmée » (tests 38/40).
17. **Peut-il récupérer missions/documents/validations du client authentifié ?** **Oui** — port loopback V1 lecture seule (identité transmise, entreprise épinglée re-vérifiée par V1), instantané borné spécifique à la question (tests 31-33).
18. **Tout le contexte client est-il tenant- et permission-scopé ?** **Oui** — `companyId` résolu serveur ; `keepOwn` rejette les ID étrangers ; entreprise B aveugle à l'entreprise A ; aucun contexte en mode public (`tenantIsolationReady` + `permissionFilteringReady`, tests 31-36).
19. **Peut-il diagnostiquer les bugs depuis captures/fichiers ?** **Oui** — runtime support multi-tours combinant findings visuels + connaissance de page + bugs validés + ≤2 questions précises (tests 78-82).
20. **Les résolutions de bugs validées sont-elles réutilisables en sécurité ?** **Oui** — uniquement `status==='validated'`, portées global/account/route/feature/browser/device/release (test 78).
21. **Les correctifs candidats/de compte sont-ils isolés ?** **Oui** — candidat jamais servi ; compte A invisible pour compte B et anonyme ; promotion globale = rédaction obligatoire (tests 79-80).
22. **L'apprentissage reste-t-il proposal-only ?** **Oui** — `requiresValidation` littéral, validateur vide refusé, candidat contradictoire jamais approuvé (tests 84-88).
23. **Peut-il vendre fort sans claims non supportés ?** **Oui** — runtime de vente grounded (persona→douleur→capacité réelle→contrôle→CTA), séparation disponible/préparé/bloqué, sortie passée à la garde claims (tests 74-77).
24. **Donne-t-il des liens réels exacts ?** **Oui** — chaque CTA pointe une page existante du site vivant (tests 74-77/92).
25. **Délègue-t-il le travail RH à Pierre au lieu de devenir un 2e cerveau RH ?** **Oui** — `delegateToPierre` ne planifie rien, propose via `buildAndPersistProposal` existant, `executed:false` littéral ; décisions sensibles finales human-only (`clonechatDoesNotBecomeHrBrain=true`, tests 67-73).
26. **L'usage OpenAI est-il budgété et fail-safe ?** **Oui** — réservation atomique AVANT le modèle, `finally` libère toute réservation non réglée (tests 63-64).
27. **Les citations sont-elles validées serveur ?** **Oui** — seuls les IDs réellement fournis survivent ; les IDs forgés sont supprimés ; labels discrets sans chemin interne (tests 59/104).
28. **La connaissance de code interne est-elle fondateur seulement ?** **Oui** — chunks FOUNDER_INTERNAL invisibles client/public ; adaptateur interne owner-gated fail-closed ; route `/assistant` en mode client uniquement (tests 94/102).
29. **Production, paiement et providers live restent-ils bloqués ?** **Oui** — `PRODUCTION_AUTHORIZED=false`, `paymentMode=disabled` (jamais live même clés forgées), `isLiveExecutionAllowed()=false` (tests 30/99-101).
30. **`/assistant` est-il réellement câblé ?** **Oui** — l'UI transporte les documents, affiche le statut/limites honnêtes et les labels de citation ; confirmation par `proposalId` inchangée (`c1WiredToAssistantUI=true`, test 103).
31. **Le flag reste-t-il fail-closed ?** **Oui** — `isCloneChatEnabled()` 503 par défaut ; `publicFeatureFlagState=off_default_fail_closed` (test 93).
32. **Que reste-t-il externe/non pris en charge ?** Substrat d'upload durable absent (pièces jointes en transport borné, non persistées) ; PPTX ; PDF scannés (image_only) ; providers signature/e-mail/voix/téléphonie ; paiement en ligne ; revue légale externe.
33. **Prêt pour usage fondateur ?** **Oui** — `readyForFounderUse=true`.
34. **Prêt pour usage client authentifié ?** **Oui** — `readyForAuthenticatedClientUse=true`, `exactBlockers=[]`.
35. **Prêt pour activation du flag public ?** **Non (voulu)** — `readyForPublicFlagActivation=false` : le flag reste fail-closed, les index générés doivent être vérifiés frais par script, et un substrat d'upload durable est requis avant de revendiquer des pièces jointes persistantes.

---

## Revue adversariale (16 lentilles) — 0 réfutation réelle

Chaque lentille est **computée** par le command center contre les modules réels (voir `adversarial-review.json`) : Pierre profond (non statique) · compte non hardcodé (scan de tous les fichiers) · pas de 2e cerveau RH (`executed:false` littéral) · isolation inter-tenant · code interne invisible client/public · injection sans fuite (visibilité indépendante de la question) · claims interdits neutralisés après citations · péremption détectée · pièces jointes sans exécutable/macro/fetch · support PDF/DOCX/XLSX non surdéclaré · lineage jamais fabriqué · candidat jamais réutilisé · vente sans sur-promesse · délégation via confirmation/idempotence existantes · budget avant modèle · flag/production/paiement jamais activés.

## Chiffres (gates réels)

| Porte | Résultat |
|---|---|
| Suite C1.1 | **105/105** (+ générateur de preuves) |
| CloneChat + API assistant | **314/314** |
| T1 + T2 + ultimate + production | **210/210** |
| Pierre V1 | **295/295** |
| `npx tsc --noEmit` | **0 erreur** |
| Non-régression complète | **7392/7392** |
| Périmètres protégés (T1/T2/P16/PierreV1/C1/prod/pricing) | **0 violation** |

Preuves : [.c1-1-proofs/clonechat-parrain/](.c1-1-proofs/clonechat-parrain/) (40 fichiers, générés depuis les modules et résultats réels).

---

> **Verdict final : C1.1 — CLONECHAT PARRAIN TOTAL KNOWLEDGE RUNTIME VERIFIED / WIRED TO REAL CLONECHAT.**
