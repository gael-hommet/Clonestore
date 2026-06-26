# TECH-10 — CloneVoice Readiness Layer

## 1. Pourquoi CloneVoice existe

**CloneVoice est la couche d'entrée vocale de CloneStore.**

**TECH-10 n'est PAS une activation vocale.** TECH-10 = readiness layer uniquement.

CloneVoice évalue la disponibilité et les prérequis pour l'activation future de la
fonctionnalité vocale. En V1, seul le mode `text_transcript` est disponible pour
tests internes. Aucun audio réel, aucun fournisseur de transcription, aucune capture microphone.

**Invariants absolus CloneVoice (jamais violés) :**
1. CloneVoice n'est PAS actif en production en V1.
2. `production_enabled` est toujours `false`.
3. `live_audio_ready` est toujours `false`.
4. `microphone_ready` est toujours `false`.
5. `audio_storage_enabled` est toujours `false`.
6. Aucun appel à Whisper / OpenAI / Anthropic / API externe.
7. Aucun enregistrement audio. Aucun stockage audio.
8. `privacy_review_required` est toujours `true`.
9. `security_review_required` est toujours `true`.

---

## 2. Différence CloneVoice / CloneOS / CloneChat / Pierre

| Entité | Rôle | Couche |
|--------|------|--------|
| **CloneVoice** | Couche d'entrée vocale — readiness + normalisation | Couche entrée |
| **CloneOS** | Noyau opératoire — classifie, route, planifie, exécute | Couche orchestration |
| **CloneChat** | Interface conversationnelle — canal d'entrée texte/chat | Canal utilisateur |
| **Pierre** | Employé IA RH — exécute les missions HR | Employé IA métier |
| **CloneBrief** | Synthèse exécutive — lisible pour dirigeant | Couche synthèse |

CloneVoice n'est pas CloneOS. CloneVoice n'est pas CloneChat. CloneVoice n'est pas Pierre.

**Important :** `CloneOSCommandSource` n'a pas de valeur `"clonevoice"`.
Les commandes vocales transitant par CloneOS utilisent la source `"clonechat"`
avec `metadata.voice_origin: true`.

---

## 3. Architecture TECH-10

```
Entrée texte (V1 uniquement)
  → CloneVoice Transcript Normalizer
      → Normalisation + Sanitization + Redaction PII
      → Détection langue + intention + niveau de risque
      → CloneVoiceTranscriptDraft

  → CloneVoice Command Adapter
      → Adaptation transcript → commande
      → Mapping intention → employé candidat (pierre pour HR)
      → CloneVoiceCommandDraft
          source: "clonechat" + voice_origin: true

  → [Pierre Bridge optionnel]
      → processPierreVoiceInput()
      → Retourne transcript + command draft

  → CloneOS (si can_proceed_to_cloneos = true)
      → Exécution normale via CloneOS
```

---

## 4. Modes d'entrée

| Mode | Disponible V1 | Description |
|------|---------------|-------------|
| `text_transcript` | ✅ OUI | Transcript texte direct — seul mode V1 |
| `uploaded_audio` | ❌ NON | Upload fichier audio — nécessite provider |
| `microphone` | ❌ NON | Microphone temps réel — nécessite RGPD |
| `phone_call` | ❌ NON | Intégration téléphonie — hors périmètre |
| `meeting_recording` | ❌ NON | Transcription réunion — hors périmètre |

---

## 5. Prérequis pour activation production

| Prérequis | Bloquant | Statut V1 |
|-----------|----------|-----------|
| Provider de transcription configuré | OUI | ❌ Non configuré |
| Revue sécurité complète | OUI | ❌ Non faite |
| Revue vie privée / RGPD | OUI | ❌ Non faite |
| Validation légale | OUI | ❌ Non faite |
| Transcript texte disponible | NON | ✅ Disponible |
| Validation produit | NON | ❌ Non faite |

---

## 6. Niveaux de readiness

| Niveau | Description | Conditions |
|--------|-------------|------------|
| `not_ready` | Pas prêt | text_transcript non disponible |
| `partial_ready` | Partiellement prêt | text_transcript disponible, prérequis bloquants manquants |
| `internal_ready` | Prêt en interne | Tous bloquants validés, text_transcript ok |
| `production_ready` | Prêt production | Tous prérequis validés |

**En V1 : statut `partial_ready` (text_transcript disponible, prérequis bloquants manquants).**

---

## 7. Garde-fous (toujours actifs)

| Garde-fou | Actions bloquées | Revue humaine |
|-----------|------------------|---------------|
| `guard_no_real_audio_capture` | audio_capture, microphone_access, recording | OUI |
| `guard_no_external_api` | whisper_api_call, openai_api_call, anthropic_api_call | OUI |
| `guard_critical_action_review` | critical_action_auto_execute | OUI |
| `guard_no_audio_storage` | audio_storage, audio_persistence | OUI |
| `guard_pii_redaction` | pii_transmission_unredacted | NON |

---

## 8. Règles de validation (CV01–CV20)

| Règle | Champ | Description |
|-------|-------|-------------|
| CV01 | production_enabled | Doit être false — invariant absolu |
| CV02 | live_audio_ready | Doit être false en V1 |
| CV03 | microphone_ready | Doit être false en V1 |
| CV04 | audio_storage_enabled | Doit être false en V1 |
| CV05 | privacy_review_required | Doit être true |
| CV06 | security_review_required | Doit être true |
| CV07 | readiness_score | Dans [0, 100] |
| CV08 | verdict | Non vide |
| CV09 | verdict | Pas d'affirmation de disponibilité production |
| CV10 | generated_at | Non vide |
| CV11 | input_mode | Doit être text_transcript en V1 |
| CV12 | is_sanitized | Doit être true |
| CV13 | draft_id | Non vide |
| CV14 | company_id | Non vide |
| CV15 | requires_human_review | True si risk_level=critical |
| CV16 | can_proceed_to_cloneos | False si blocked_reasons non vide |
| CV17 | command_draft_id | Non vide |
| CV18 | voice_metadata.cloneos_source | Doit être 'clonechat' (avertissement) |
| CV19 | production_enabled (snapshot) | Doit être false |
| CV20 | capabilities_available | ≤ capabilities_total |

---

## 9. Bridge Pierre

```typescript
// Traitement d'une entrée vocale texte de Pierre
const result = processPierreVoiceInput({
  company_id: "company_001",
  text_input: "Préparer un contrat pour la nouvelle recrue.",
  mission_id: "mission_123",
  is_demo: false,
});

// → result.ok = true
// → result.transcript_draft.input_mode = "text_transcript"
// → result.command_draft.voice_metadata.cloneos_source = "clonechat"
// → result.command_draft.voice_metadata.voice_origin = true

// IMPORTANT : source CloneOS = "clonechat" (pas "clonevoice")
// CloneOSCommandSource n'a pas de valeur "clonevoice"
```

---

## 10. Ce qui n'a PAS été fait dans TECH-10

| Ce qui n'a PAS été fait | Pourquoi |
|-------------------------|---------|
| Capture audio réelle | Interdit — pas de revue sécurité/RGPD |
| Appel Whisper / OpenAI / Anthropic | Interdit — aucun fournisseur configuré |
| Stockage audio | Interdit — pas de validation légale |
| Écriture en Supabase | Couche pure — pas de backend branché |
| Migration DB | Hors périmètre |
| Activation production CloneVoice | Prérequis bloquants non validés |
| Modification moteur Pierre | Pierre (B38-B48) est clos |
| Création Emma/Lucas/Sophie | Hors périmètre |
| CloneVoice comme actif en production | INTERDIT en V1 |
| Modification go-live-proofs.local.json | Interdit |

---

## 11. Fichiers créés dans TECH-10

```
Créés :
  src/lib/clonestore/voice/clonevoice-types.ts                — 20 types
  src/lib/clonestore/voice/clonevoice-defaults.ts             — defaults + constantes + démo
  src/lib/clonestore/voice/clonevoice-readiness.ts            — moteur d'évaluation readiness
  src/lib/clonestore/voice/clonevoice-transcript-normalizer.ts — normalisation + détection
  src/lib/clonestore/voice/clonevoice-command-adapter.ts      — adaptation transcript → commande
  src/lib/clonestore/voice/clonevoice-guardrails.ts           — garde-fous de sécurité
  src/lib/clonestore/voice/clonevoice-validation.ts           — 20 règles CV01-CV20
  src/lib/clonestore/voice/clonevoice-snapshot.ts             — snapshot + diff
  src/lib/clonestore/voice/clonevoice-storage.ts              — storage in-memory
  src/lib/clonestore/voice/pierre-voice-bridge.ts             — bridge Pierre → CloneVoice
  src/lib/clonestore/voice/index.ts                           — exports publics
  src/lib/clonestore/voice/__tests__/clonevoice-readiness-tech10.test.ts — 50 tests
  docs/TECH_10_CLONEVOICE_READINESS_LAYER.md                  — cette documentation

Non modifiés :
  src/lib/clonestore/brief/**               — TECH-09 intact
  src/lib/clonestore/trace/**               — TECH-07 intact
  src/lib/clonestore/cloneos/**             — TECH-08 intact
  src/lib/clonestore/guard/**               — TECH-06 intact
  src/lib/clonestore/adn/**                 — TECH-05 intact
  src/lib/pierre/**                         — moteur Pierre intact
  go-live-proofs.local.json                 — interdit
```

---

## 12. Prochain bloc recommandé : TECH-11

**TECH-11 — Technology Readiness Final Gate**

Objectif : Évaluation finale de readiness de toutes les technologies CloneStore
(TECH-05 → TECH-10). Rapport de consolidation final avant go-live.

```
TECH-05 — CloneADN Global Enterprise Memory ✅
TECH-06 — CloneGuard + ClonePolicy Global Rules ✅
TECH-07 — CloneTrace Global Audit Timeline ✅
TECH-08 — CloneOS Command Center Alignment ✅
TECH-09 — CloneBrief Executive Summaries ✅
TECH-10 — CloneVoice Readiness Layer ✅
TECH-11 — Technology Readiness Final Gate
```
