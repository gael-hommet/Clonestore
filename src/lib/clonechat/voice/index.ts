// src/lib/clonechat/voice/index.ts — surface publique de CloneVoice (BLOC 6).
export {
  runVoiceJourney, completeVoiceJourney, buildVoiceLog, logVoiceJourney,
  type VoiceJourneyDeps,
} from "./pipeline";
export {
  CLONECHAT_VOICE_VERSION, VOICE_STATES,
  type VoiceState, type VoiceErrorCategory, type VoiceStage, type VoiceError,
  type TranscriptStatus, type VoiceTtsResult, type VoiceJourneyResult,
  type VoiceAudioInput, type VoiceJourneyInput, type VoiceLogEvent,
} from "./types";
export {
  SUPPORTED_AUDIO_FORMATS, canonicalExtension, sniffAudioFormat, detectKnownNonAudio,
  validateAudioContent, MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, MAX_AUDIO_SECONDS,
  type AudioFormat, type AudioContentAcceptance, type AudioContentRejection,
} from "./formats";
export {
  assessTtsSuitability, safeSpeechSummary, TTS_MAX_CHARS,
  type TtsSuitability, type TtsRefusedReason,
} from "./tts-policy";
export {
  mockTranscriber, mockTts, transcriberOf, ttsOf,
  type TranscriptionProvider, type TranscriptionRequest, type TranscriptionOutcome,
  type TtsProvider, type TtsRequest, type TtsOutcome,
} from "./providers";
export { openAiTranscriptionProvider, openAiTtsProvider, type OpenAiTranscriptionConfig, type OpenAiTtsConfig } from "./openai-providers";
export {
  validateAudio, loadTranscriptionModels, shouldFallback, transcriptionVocabularyPrompt,
  LOW_CONFIDENCE_THRESHOLD, TRANSCRIPTION_VOCABULARY_VERSION,
} from "./transcription-policy";
