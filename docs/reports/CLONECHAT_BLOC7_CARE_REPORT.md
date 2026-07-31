# CloneChat — BLOC 7 : CloneCare (support & résolution)

**Verdict local : PASS.** CloneCare est la couche de **support & résolution** au-dessus de
**Brain → CloneContext → Diagnosis → CloneGuide → CloneVoice**. Elle détermine **honnêtement** la nature d'une situation et prépare un **brouillon de ticket sûr** — sans jamais inventer un bug, une résolution, un délai, un statut, une équipe ou une réussite, et **sans jamais envoyer automatiquement**.

## Architecture (`src/lib/clonechat/care/`)
> Un ancien module C1.8 (actions/contracts/diagnosis/envelope/…) coexiste dans ce dossier ; le BLOC 7 est **additif** et n'y touche pas. Fichiers BLOC 7 ci-dessous.

| Fichier | Rôle |
|---|---|
| `types.ts` | `CloneCareResult` (`care-1`) + `SupportTicketDraft` (`ticket-1`) : statut, problème observé, correspondance connue, confiance, preuves, résolution/contournement, étapes sûres, condition observable de résolution, infos manquantes, priorité, escalade, route support réelle, ticket nécessaire + brouillon. |
| `known-issues.ts` | **Registre canonique** (`known-issues-1`), typé, versionné, déterministe : 10 entrées **réellement prouvées** par le repo (routes, erreurs structurées, comportements), chacune avec **provenance**. Matching par signal réel / kind de diagnostic / catégorie de blocage / code de refus tenant. |
| `redaction.ts` | Redaction **déterministe** : tokens, cookies, clés API, secrets, en-têtes d'auth, JWT, e-mails, traces de pile brutes. |
| `ticket.ts` | Modèle de ticket + **clé d'idempotence déterministe**, **déduplication**, deduper à état, **interface provider abstraite** + mock + provider indisponible, **envoi contrôlé** (`submitTicket` refuse sans confirmation). |
| `care.ts` | Moteur `assessCare()` + `careFromVoiceResult()` (consomme un résultat vocal déjà sécurisé, **sans audio ni transcript**). |
| `care-with-context.ts` | `decideDiagnoseGuideAndCare()` — sortie additive, `structured` **inchangé**. |
| `index.ts` | Surface publique BLOC 7. |

## Statuts CloneCare (explicites)
`no_support_needed` · `known_issue` · `resolution_available` · `workaround_available` · `needs_information` · `provider_outage` · `product_limitation` · `security_refusal` · `human_escalation`.

## Registre des problèmes connus (10, tous prouvés)
checkout paiement refusé · membership suspendu · entreprise indisponible · panne lecture entitlement · panne modèle · route inexistante · réservation avant lancement · **Pierre prépare / humain valide (limite produit)** · transcription indisponible · TTS indisponible. Chaque entrée porte : id, titre, description sûre, catégorie, sévérité, statut réel, surfaces, signaux, préconditions, cause connue/inconnue, résolution officielle (si elle existe), contournement (si il existe), condition de vérification, escalade, **provenance**, validité éventuelle.

## Autorité & honnêteté
- Le **diagnostic** (BLOC 4) fait autorité sur la **cause** ; le registre (plus spécifique) peut reclasser une escalade « opaque » en problème connu quand un **signal réel** correspond.
- **CloneGuide** fournit les étapes sûres ; seules des **routes réelles** sont utilisées.
- Une **résolution** n'est jamais déclarée « faite » : au mieux `resolution_available`, toujours avec une **condition observable** de vérification.
- **Refus de sécurité conservé comme refus** (`security_refusal`), jamais un bug ni un contournement (aucun workaround, aucune résolution offerte, aucun ticket).
- **Escalade** pour suspensions / erreurs opaques persistantes / sécurité / absence de résolution sûre ; **pas d'escalade inutile** quand un réessai ou une résolution officielle suffit (pannes provider → `provider_outage`, pas de ticket).

## Tickets — sûrs par construction
Brouillon = résumé, catégorie, priorité, route/surface affectée, **codes d'erreur sûrs (redigés)**, étapes déjà essayées (jamais inventées), résultat attendu/observé, preuves non sensibles, **tenant uniquement si autorisé + scopé + nécessaire**. Interdits appliqués : **aucun envoi automatique**, aucune création externe sans confirmation, **aucun audio/transcript/token/cookie/secret/clé/header d'auth**, aucune donnée d'un autre tenant, aucune stack trace brute, aucune PII inutile. Fournis : **redaction déterministe**, **déduplication**, **clé d'idempotence**, anti-répétition, **provider abstrait + mock**, **réponse honnête si provider indisponible**.

## Intégration
`decideDiagnoseGuideAndCare(input, ctx)` → `{ decision, context, diagnosis, guide, care, ticketDraft, structured }` (`structured` **inchangé**). `careFromVoiceResult(voiceResult)` transforme un résultat vocal sécurisé en résultat Care **sans recopier l'audio ni le transcript** (ne consomme que contexte/diagnostic/guide). Aucun envoi externe ni comportement Production risqué câblé.

## Gate local (tout vert)
- CloneCare **30/30** ; régressions **263/263** (voice 32, transcribe 6, guide 25, diagnosis 25, context 25, brain 27, product-truth 15, context-boundary 51, corpus 6, injection-114 114/114, universal-clonechat 20).
- **tsc** 0 nouvelle erreur (1 pré-existante `embedded-postgres`) · **ESLint** 0 erreur sur les fichiers BLOC 7 (un *warning* pré-existant, non lié, sur `care/__tests__/support-99-benchmark.test.ts` du module C1.8 — laissé intact) · **Build Next isolé** (`.next-hotfix`) : **BUILD_EXIT_CODE=0**.

## Limites honnêtes / suite
- `decideDiagnoseGuideAndCare` **pas câblé** comme comportement Production servi ; **aucun envoi de ticket externe réel** n'est branché (provider abstrait + mock uniquement).
- Le registre est volontairement restreint aux problèmes **réellement prouvés** ; il s'enrichira au fil des incidents réels (jamais sur suggestion d'un modèle).
