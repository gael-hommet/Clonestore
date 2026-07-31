// src/lib/clonechat/voice/formats.ts
//
// Registre CANONIQUE des formats audio réellement supportés + validation de CONTENU (octets de
// signature) pour détecter un fichier non-audio DÉGUISÉ (un ZIP renommé .mp4, un MIME mensonger).
// Le MIME déclaré par le client n'est qu'un indice ; la vérité vient de la signature réelle des
// octets quand le contenu est disponible. Pur, sans réseau, déterministe.

import { validateAudio, MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, MAX_AUDIO_SECONDS } from "./transcription-policy";

export { MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, MAX_AUDIO_SECONDS };

export interface AudioFormat {
  readonly mime: string;
  readonly extensions: readonly string[];
  readonly label: string;
}

/** Formats audio réellement acceptés (produits par les navigateurs ET acceptés par le provider). */
export const SUPPORTED_AUDIO_FORMATS: readonly AudioFormat[] = [
  { mime: "audio/webm", extensions: ["webm"], label: "WebM/Opus" },
  { mime: "audio/ogg", extensions: ["ogg", "oga"], label: "Ogg/Opus" },
  { mime: "audio/mp4", extensions: ["mp4", "m4a"], label: "MP4/AAC" },
  { mime: "audio/m4a", extensions: ["m4a"], label: "M4A/AAC" },
  { mime: "audio/x-m4a", extensions: ["m4a"], label: "M4A/AAC" },
  { mime: "audio/mpeg", extensions: ["mp3"], label: "MP3" },
  { mime: "audio/mpga", extensions: ["mp3"], label: "MP3" },
  { mime: "audio/wav", extensions: ["wav"], label: "WAV/PCM" },
  { mime: "audio/x-wav", extensions: ["wav"], label: "WAV/PCM" },
  { mime: "audio/flac", extensions: ["flac"], label: "FLAC" },
] as const;

/** Extension canonique par MIME (le nom de fichier envoyé au provider suit le MIME réel). */
export function canonicalExtension(mime: string): string {
  const m = (mime ?? "").split(";")[0].trim().toLowerCase();
  const f = SUPPORTED_AUDIO_FORMATS.find((x) => x.mime === m);
  return f?.extensions[0] ?? "webm";
}

// ── Signatures d'octets (magic bytes) ─────────────────────────────────────────

function matchAt(content: Uint8Array, offset: number, sig: readonly number[]): boolean {
  if (offset + sig.length > content.length) return false;
  for (let i = 0; i < sig.length; i++) if (content[offset + i] !== sig[i]) return false;
  return true;
}

const ASCII = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));

/**
 * Détecte POSITIVEMENT un format audio depuis les premiers octets. Renvoie le MIME normalisé ou
 * null si aucune signature audio connue n'est reconnue.
 */
export function sniffAudioFormat(content: Uint8Array): string | null {
  if (content.length < 4) return null;
  if (matchAt(content, 0, [0x1a, 0x45, 0xdf, 0xa3])) return "audio/webm"; // EBML (WebM/Matroska)
  if (matchAt(content, 0, ASCII("OggS"))) return "audio/ogg";
  if (matchAt(content, 0, ASCII("fLaC"))) return "audio/flac";
  if (matchAt(content, 0, ASCII("RIFF")) && matchAt(content, 8, ASCII("WAVE"))) return "audio/wav";
  if (matchAt(content, 4, ASCII("ftyp"))) return "audio/mp4"; // MP4/M4A (ISO-BMFF)
  if (matchAt(content, 0, ASCII("ID3"))) return "audio/mpeg"; // MP3 avec tag ID3
  // Trame MP3 brute : 0xFF suivi de 0xE?/0xF? (11 bits de synchronisation).
  if (content[0] === 0xff && (content[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return null;
}

/** Signatures de formats NON-audio courants (deny-known-bad) : un tel contenu déguisé est refusé. */
const KNOWN_NON_AUDIO: ReadonlyArray<{ readonly offset: number; readonly sig: readonly number[]; readonly kind: string }> = [
  { offset: 0, sig: [0x50, 0x4b, 0x03, 0x04], kind: "zip" }, // PK.. (ZIP/OOXML)
  { offset: 0, sig: [0x50, 0x4b, 0x05, 0x06], kind: "zip_empty" },
  { offset: 0, sig: ASCII("%PDF"), kind: "pdf" },
  { offset: 0, sig: [0x89, 0x50, 0x4e, 0x47], kind: "png" },
  { offset: 0, sig: ASCII("GIF8"), kind: "gif" },
  { offset: 0, sig: [0xff, 0xd8, 0xff], kind: "jpeg" },
  { offset: 0, sig: [0x7f, 0x45, 0x4c, 0x46], kind: "elf" }, // exécutable ELF
  { offset: 0, sig: [0x4d, 0x5a], kind: "pe" }, // exécutable Windows (MZ)
  { offset: 0, sig: ASCII("<!DO"), kind: "html" },
  { offset: 0, sig: ASCII("<htm"), kind: "html" },
  { offset: 0, sig: ASCII("<?xm"), kind: "xml" },
  { offset: 0, sig: [0x1f, 0x8b], kind: "gzip" },
];

/** Le contenu correspond-il à une signature NON-audio connue ? (renvoie le type détecté, ou null) */
export function detectKnownNonAudio(content: Uint8Array): string | null {
  for (const { offset, sig, kind } of KNOWN_NON_AUDIO) {
    if (matchAt(content, offset, sig)) return kind;
  }
  return null;
}

// ── Validation stricte (MIME + taille + contenu) ─────────────────────────────

export type AudioContentRejection = {
  readonly ok: false;
  readonly code: "EMPTY_AUDIO" | "AUDIO_TOO_SHORT" | "AUDIO_TOO_LARGE" | "AUDIO_TYPE_UNSUPPORTED" | "AUDIO_CONTENT_NOT_AUDIO";
  readonly message: string;
};
export type AudioContentAcceptance = {
  readonly ok: true;
  readonly mime: string; // MIME normalisé
  readonly detectedMime: string | null; // format réellement sniffé (si contenu fourni)
  readonly bytes: number;
};

/**
 * Validation COMPLÈTE : MIME + taille (via la politique existante), puis — si le contenu est
 * fourni — vérification de signature. Un contenu non-audio (déguisé) OU sans aucune signature
 * audio connue est refusé, quel que soit le MIME déclaré (protection « MIME mensonger »).
 */
export function validateAudioContent(input: { mime: string; bytes: number; content?: Uint8Array }): AudioContentAcceptance | AudioContentRejection {
  const base = validateAudio({ mime: input.mime, bytes: input.bytes });
  if (!base.ok) return base;

  let detectedMime: string | null = null;
  if (input.content && input.content.length > 0) {
    if (detectKnownNonAudio(input.content) !== null) {
      return { ok: false, code: "AUDIO_CONTENT_NOT_AUDIO", message: "Ce fichier n'est pas un enregistrement audio." };
    }
    detectedMime = sniffAudioFormat(input.content);
    if (detectedMime === null) {
      return { ok: false, code: "AUDIO_CONTENT_NOT_AUDIO", message: "Ce fichier n'est pas un enregistrement audio valide." };
    }
  }
  return { ok: true, mime: base.mime, detectedMime, bytes: base.bytes };
}
