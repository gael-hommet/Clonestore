# CloneChat — BLOC 6 : CloneVoice (interface vocale complète)

**Verdict local : PASS.** CloneVoice est la véritable **interface vocale** de CloneChat, au-dessus du chemin **Brain → CloneContext → Diagnosis → Guide**. La voix est une **entrée/sortie**, jamais une autorité : toute transcription repasse par **exactement le même pipeline sécurisé** que le texte (anti-injection, gouvernance, confirmation). L'entrée vocale existante est **conservée et durcie**.

## Parcours complet couvert
capture/réception audio → **validation stricte (MIME + taille + contenu)** → transcription → transformation en demande CloneChat normale → **décision Brain** → **contexte** → **diagnostic** → **guide** → **réponse texte** → **TTS facultatif** → **fallback texte honnête** si transcription ou TTS échoue.

## Architecture (`src/lib/clonechat/voice/`)

| Fichier | Rôle |
|---|---|
| `types.ts` | État typé & versionné (`voice-1`) : `VoiceState` (idle/recording/processing/transcribed/responded/speaking/completed/cancelled/error), catégories d'erreur, `VoiceJourneyResult` additif (transcript exact + confiance + statut, décision, contexte, diagnostic, guide, `structured` historique, réponse texte, TTS, `securityRefusal`, `autoSend:false`). |
| `formats.ts` | **Registre canonique** des formats (MP3/WebM/Ogg/MP4-M4A/WAV/FLAC) + **sniffing de contenu** (magic bytes) : détection positive audio + **deny-known-bad** (ZIP/PDF/exe/HTML…) → refus des fichiers non-audio **déguisés** et des **MIME mensongers**. |
| `providers.ts` | Interfaces PROVIDER abstraites (transcription + TTS) + **mocks déterministes** (gate sans clé). |
| `openai-providers.ts` | **Adaptateurs RÉELS** OpenAI (transcription + `/audio/speech`) — clé serveur, non exercés par le gate. |
| `tts-policy.ts` | Politique TTS pure : longueur max (résumé sûr déterministe), **refus de lire un contenu privé sans autorisation réelle**, refus du vide. |
| `pipeline.ts` | **Orchestrateur** `runVoiceJourney()` + `completeVoiceJourney()` + **journalisation sûre** (`buildVoiceLog` : jamais l'audio, jamais le transcript, jamais un secret). |
| `transcription-policy.ts` | Politique existante (validation MIME/taille, vocabulaire, décision de repli) — **conservée**. |

## Entrée vocale — durcie
- **Registre canonique** des formats supportés ; **validation cohérente client/serveur** ; erreurs **structurées** ; **timeout** contrôlé ; **annulation** ; **limite de taille** (20 Mo) ; **protection anti-fichier déguisé** (magic bytes).
- **Route existante `/api/assistant/transcribe` durcie** de façon ADDITIVE : rejet deny-known-bad d'un contenu non-audio déguisé (ZIP/PDF/exe…) **avant tout appel réseau**, sans casser un audio légitime au conteneur inhabituel (les tests existants restent verts).
- Capacités MP3 / WebM-Opus / MP4-AAC **préservées** et transformées en contrat propre, testé, documenté ; nom de fichier provider suivant le MIME réel.

## Sortie vocale / TTS — contrôlée
- **Interface provider abstraite** ; audio **uniquement si explicitement demandé et autorisé** ; texte source = **réponse finale sécurisée** de CloneChat ; **longueur max** (résumé sûr) ; **refus** pour contenu privé sans autorisation ; **timeout + panne** provider ; **fallback texte systématique** ; état `speaking` **seulement** quand l'audio est réellement disponible ; **jamais de faux succès** (`ok:true` sans audio réel ⇒ traité comme échec + fallback).

## Autorité & sécurité (la voix ne contourne rien)
- La transcription devient une demande CloneChat **normale** → anti-injection (BLOC 0), gouvernance, confirmation humaine s'appliquent.
- **Injection** dans la transcription / **impératif dangereux terminé par `?`** → `securityRefusal`, jamais exécuté, réponse **sûre** de refus.
- Transcription **incertaine** → `low_confidence` (jamais présentée comme exacte) ; **aucun auto-envoi** (`autoSend:false` sur tous les chemins) ; aucune action exécutée.
- Distinction claire : **erreur utilisateur / format non supporté / panne provider / timeout / refus de sécurité**.
- **Aucune fuite inter-tenant** ; **logs sûrs** (longueur de transcript, jamais le texte ; jamais l'audio ; jamais un secret).

## Intégration
Adaptateur réel `runVoiceJourney(input, {transcriber, tts?})` : `audio → transcript → decideDiagnoseAndGuide() → texte → TTS facultatif`. Sortie additive et **compatible** : transcript, confiance/statut, décision, contexte, diagnostic, guide, `structured` historique **inchangé**, résultat TTS ou fallback, état vocal final.

## Gate local (tout vert)
- CloneVoice **32/32** + transcribe route **6/6** ; régressions **233/233** (guide 25, diagnosis 25, context 25, brain 27, product-truth 15, context-boundary 51, corpus 6, injection-114 114/114, universal-clonechat 20).
- **tsc** 0 nouvelle erreur (1 pré-existante `embedded-postgres`) · **ESLint** 0 sur `voice/` + route · **Build Next isolé** (`.next-hotfix`) : **BUILD_EXIT_CODE=0**.
- Gate **sans clé externe** : providers mockés déterministes ; adaptateurs OpenAI réels fournis mais non requis.

## Limites honnêtes / suite
- L'adaptateur `runVoiceJourney` **n'est pas encore câblé** comme comportement Production servi dans `/api/assistant/chat` (aucun gate Production supplémentaire activé) ; le module complet + adaptateur sont réellement implémentés et testés.
- Accessibilité clavier / lecteurs d'écran : la réponse **texte** est toujours disponible (exploitable par un lecteur d'écran) ; l'UI vocale visuelle fine relève des surfaces UI (BLOC 9).
- Aucune conservation durable d'audio : le pipeline ne persiste aucun audio ; politique explicite « pas de stockage sans nécessité ».
