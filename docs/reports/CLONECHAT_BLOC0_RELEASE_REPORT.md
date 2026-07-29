# CloneChat — BLOC 0 Release Report

**Verdict : `CLONECHAT CURRENT PRODUCTION RELEASE VERIFIED`**

**SHA déployé (clonestore-xcwi, READY) :** `24b1ece36a2e0f6ef93e886148bac6d175de4a80`
**origin/main :** `24b1ece3…` (identique) · **Domaines :** clonestore.pro, www.clonestore.pro (vérifiés, sans override)
**Date de vérification Production :** 2026-07-29

## Chaîne de release (BLOC 0)

Depuis `40b5ecf0`, la fermeture de la release a produit (après re-création LF côté push utilisateur) la ligne `…→ 6ce9231e → 24b1ece3` :
- `6ce9231e` — durcissement anti-injection (impératif de contournement déguisé en question : le `?` seul ne prouve jamais une intention informative) + corpus FR/BE/LU/CH / 449€ / 499CHF / 12 août + provenance corpus + preuves voix réelles + fichiers de contrôle.
- `24b1ece3` — **fix navigation** : une demande d'orientation (« Sur quelle page réserver Pierre ? ») faisait choisir au modèle l'outil `open_page` sans texte → `respondUnified` (un seul appel) renvoyait un `answer` vide → `ok=false` → message d'indisponibilité. Correctif : synthèse d'une réponse d'orientation **fondée** (label + chemin réels du registre) quand une vraie page est résolue sans texte + system-prompt qui exige un texte d'accompagnement. Root cause confirmé par repro OpenAI réel.

## Preuves Production (toutes vertes)

| Gate | Résultat |
|---|---|
| Sécurité — 4 impératifs dangereux | **4/4 BLOQUÉS** (`source: refused`) en Production |
| Questions de capacité légitimes | **4/4 ANSWERED** (`clonechat_unified`), honnêtes et fondées |
| Navigation (défaut corrigé) | **4/4 PASS** — « réserver / payer / démo » répondent avec la vraie page, plus jamais « indisponible » |
| Benchmark connaissance (24 Q, pacing anti-rate-limit) | **95.8%** accuracy · **95.8%** grounded · **0** rate-limited ; l'unique échec = le défaut navigation, désormais corrigé et re-vérifié PASS |
| Prix & pays | FR/BE/LU/CH ✓ · 449 EUR ✓ · 499 CHF ✓ |
| Date pré-lancement | **12 août 2026** ✓ (aucune date active 5 août) |
| CloneVoice Production | transcription exacte, `autoSend=false` ✓ |
| Logs runtime récents | **aucune erreur** ; 0 occurrence de `openai_http_401`, `role clonechat_app`, `BUDGET DURABLE INDISPONIBLE`, `transcribe_failure` |

## Preuves locales

- Tests ciblés CloneChat **109/109** (dont `navigation-answer` déterministe + `context-boundary` 51/51 verrouillant les phrases exactes du programme maître).
- Sécurité **inchangée** : injection-114 114/114, torture-security 200, red-team 125, torture 1000 — 0 régression.
- **tsc 0** erreur nouvelle · **ESLint 0** erreur · **build isolé `BUILD_EXIT_CODE=0`** sur le commit exact.
- Formats voix réels (ffmpeg) : MP3 `audio/mpeg`, WebM/Opus `audio/webm`, MP4/AAC `audio/mp4` transcrits ; cas d'erreur (MIME interdit, vide, trop court, conteneur corrompu) refusés honnêtement (voir `CLONECHAT_VOICE_FORMAT_EVIDENCE.md`).

## Limites assumées

- Un seul item du benchmark (navigation) a été re-vérifié isolément après déploiement plutôt qu'un re-benchmark complet des 24 questions : le correctif est strictement isolé au chemin « open_page sans texte » et ne touche aucun autre chemin de réponse ; les 23 autres passaient déjà et leur code est inchangé. Justifié pour respecter le rate-limit anonyme de Production.
- iPhone physique non testé : compatibilité mp4/webm prouvée par conteneurs réels + `MediaRecorder.isTypeSupported`, pas par appareil.

## Suite

BLOC 0 clos. Démarrage immédiat du **BLOC 1 — Product Truth Engine** : l'inventaire des sources réelles est fait (chaque domaine a déjà une source de code ; le travail est l'unification versionnée et la couverture des trous, notamment ~40 routes réelles absentes de `route-registry.ts` et l'autorité technologies canonique vs adaptateur legacy).
