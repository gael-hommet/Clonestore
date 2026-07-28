# CloneChat — Preuve de compatibilité vocale (formats réels)

**Objet.** Preuve reproductible que `/api/assistant/transcribe` traite correctement de vrais
conteneurs audio (pas des fichiers mal étiquetés) pour les trois formats que le client peut
envoyer selon le navigateur, plus les cas d'erreur attendus. Exécuté en local contre le build
isolé (`NEXT_DIST_DIR=.next-hotfix`), aucun fichier audio committé (synthèse TTS jetable,
supprimée après test).

## 1. Génération des fixtures réelles

Phrase source (TTS OpenAI, `tts-1`, voix `alloy`) : *« Explique-moi ce que Pierre peut gérer
dans une PME. »* → `dictation-sample.mp3` (audio réel, 24 kHz mono, ~64 Ko).

Transcodage vers de VRAIS conteneurs avec les bons codecs (ffmpeg 4.1.3, `libopus`/`aac`) :

```bash
ffmpeg -y -i dictation-sample.mp3 -c:a libopus dictation-sample.webm
ffmpeg -y -i dictation-sample.mp3 -c:a aac -b:a 64k dictation-sample.m4a
```

Résultat vérifié par `ffmpeg` lui-même (extrait des logs) :
- `dictation-sample.webm` → `Stream #0:0: Audio: opus (libopus), 24000 Hz, mono, 64 kb/s` — conteneur WebM réel, codec Opus réel.
- `dictation-sample.m4a` → `Stream #0:0: Audio: aac (LC) (mp4a / 0x6134706D), 24000 Hz, mono, 64 kb/s` — conteneur MP4/M4A réel, codec AAC réel.

Ce ne sont PAS des fichiers MP3 réétiquetés (contrairement au premier test de cette campagne,
qui avait envoyé du contenu MP3 sous MIME `audio/webm` — cela ne prouvait que le rejet honnête
d'un fichier corrompu, pas la compatibilité WebM réelle).

## 2. Résultats — formats valides

Testés contre le build isolé local (`http://localhost:3590/api/assistant/transcribe`,
`NEXT_DIST_DIR=.next-hotfix`, clé OpenAI réelle) :

| Format | Conteneur/codec réel | MIME envoyé | Taille | HTTP | Transcript | autoSend | Modèle | Latence |
|---|---|---|---|---|---|---|---|---|
| MP3 | mp3 (mpeg audio) | `audio/mpeg` | 64 320 o | 200 | *« Explique-moi ce que Pierre peut gérer dans une PME. »* (exact) | `false` | `gpt-4o-mini-transcribe` | 1919 ms |
| WebM | WebM / Opus (libopus) | `audio/webm` | 31 983 o | 200 | *« Explique-moi ce que Pierre peut gérer dans une PME. »* (exact) | `false` | `gpt-4o-mini-transcribe` | 1857 ms |
| MP4/M4A | MP4 / AAC (LC) | `audio/mp4` | 31 854 o | 200 | *« Explique-moi ce que Pierre peut gérer dans une PME. »* (exact) | `false` | `gpt-4o-mini-transcribe` | 1382 ms |

Les trois formats produisent une transcription EXACTE, `autoSend:false` dans les trois cas
(jamais d'envoi automatique — le texte revient dans le composer pour relecture).

## 3. Résultats — cas d'erreur

| Cas | Détail | HTTP | Code |
|---|---|---|---|
| MIME interdit | contenu audio réel envoyé sous `application/zip` | 400 | `AUDIO_TYPE_UNSUPPORTED` — refusé avant tout appel réseau |
| Fichier vide | 0 octet, `audio/mp4` | 400 | `EMPTY_AUDIO` |
| Fichier trop court | 500 octets de silence, `audio/mp4` | 400 | `AUDIO_TOO_SHORT` |
| Conteneur WebM corrompu | vrai fichier WebM tronqué à 200 octets | 400 | `AUDIO_TOO_SHORT` (rejeté par la borne de taille minimale avant même d'atteindre le provider — comportement honnête, aucun appel OpenAI gaspillé) |

Les cas timeout (20 s, `AbortController`) et échec provider 401 sont couverts par
`src/app/api/assistant/transcribe/__tests__/transcribe-hotfix.test.ts` (déterministe, `fetch`
simulé — reproductible en CI, contrairement à un vrai timeout de 20 s contre la production qui
immobiliserait des ressources serveur sans valeur ajoutée).

## 4. Reproductibilité

Toute personne avec `ffmpeg` installé et une clé OpenAI peut reproduire ces résultats avec les
deux commandes de la section 1 puis un `POST multipart/form-data` vers `/api/assistant/transcribe`
avec le champ `audio`. Aucun fichier audio n'est committé dans ce dépôt (synthèse TTS jetable,
non sensible mais inutile à conserver en binaire versionné).
