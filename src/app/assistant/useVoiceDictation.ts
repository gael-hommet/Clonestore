"use client";

// src/app/assistant/useVoiceDictation.ts
// C1.7 §8A/§8B — DICTÉE dans le composer.
//
// Contrat produit, non négociable :
//   · la dictée n'ENVOIE JAMAIS toute seule — elle INSÈRE du texte éditable ;
//   · le texte déjà présent dans le composer est PRÉSERVÉ ;
//   · l'insertion est ANNULABLE (undo) ;
//   · le micro est TOUJOURS relâché : stop, annulation, erreur, démontage — sans exception.
//
// Le micro qui reste allumé est le défaut classique de ce genre de fonctionnalité : ici la
// libération passe par un point unique (`releaseMic`), appelé depuis chaque sortie.

import { useCallback, useEffect, useRef, useState } from "react";

export type DictationState =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "transcribing"
  | "error";

export interface DictationError {
  readonly code: "PERMISSION_DENIED" | "NO_MICROPHONE" | "UNSUPPORTED" | "EMPTY_AUDIO" | "TRANSCRIPTION_FAILED" | "TRANSCRIPTION_TIMEOUT" | "RATE_LIMITED";
  readonly message: string;
}

const MAX_SECONDS = 240;

const MESSAGES: Record<DictationError["code"], string> = {
  PERMISSION_DENIED: "Microphone refusé. Autorisez le microphone pour dicter.",
  NO_MICROPHONE: "Aucun microphone détecté.",
  UNSUPPORTED: "La dictée n'est pas prise en charge par ce navigateur.",
  EMPTY_AUDIO: "Je n'ai rien entendu. Réessayez la dictée.",
  TRANSCRIPTION_FAILED: "La transcription n'a pas abouti. Réessayez la dictée.",
  TRANSCRIPTION_TIMEOUT: "La dictée a pris trop de temps. Réessayez.",
  RATE_LIMITED: "Vous allez un peu vite. Reprenez la dictée dans un instant.",
};

/** Le navigateur sait-il capter le micro ? (jamais une promesse creuse) */
export function isDictationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(navigator?.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== "undefined";
}

/** Choisit un conteneur réellement supporté (Safari ≠ Chrome). */
function pickMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function useVoiceDictation(opts: { onTranscript: (text: string) => void }) {
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState<DictationError | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0); // 0..1 — indicateur de niveau sonore

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const mounted = useRef(true);
  const onTranscriptRef = useRef(opts.onTranscript);
  onTranscriptRef.current = opts.onTranscript;

  /**
   * POINT UNIQUE DE LIBÉRATION. Coupe les pistes, l'analyseur, les minuteurs.
   * Appelé par stop, cancel, erreur ET démontage — le micro ne peut pas rester ouvert.
   */
  const releaseMic = useCallback(() => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    try { void audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (tickRef.current !== null) { clearInterval(tickRef.current); tickRef.current = null; }
    recorderRef.current = null;
    if (mounted.current) setLevel(0);
  }, []);

  // Démontage : le micro est relâché, quoi qu'il arrive.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; releaseMic(); };
  }, [releaseMic]);

  const fail = useCallback((code: DictationError["code"]) => {
    releaseMic();
    if (!mounted.current) return;
    setError({ code, message: MESSAGES[code] });
    setState("error");
  }, [releaseMic]);

  const start = useCallback(async () => {
    if (state === "recording" || state === "transcribing") return;
    setError(null);
    if (!isDictationSupported()) { fail("UNSUPPORTED"); return; }

    setState("requesting_permission");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      fail(name === "NotFoundError" || name === "DevicesNotFoundError" ? "NO_MICROPHONE" : "PERMISSION_DENIED");
      return;
    }
    if (!mounted.current) { stream.getTracks().forEach((t) => t.stop()); return; } // démonté pendant la demande

    streamRef.current = stream;
    cancelledRef.current = false;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      fail("UNSUPPORTED");
      return;
    }
    recorderRef.current = rec;

    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const type = rec.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      releaseMic(); // ← le micro est coupé AVANT le réseau : jamais d'écoute pendant l'envoi
      if (cancelledRef.current) { if (mounted.current) { setState("idle"); setSeconds(0); } return; }
      void sendForTranscription(blob);
    };

    // Indicateur de niveau (visuel honnête : il suit le vrai signal).
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (!audioCtxRef.current) return;
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
        if (mounted.current) setLevel(Math.min(1, peak * 1.6));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch { /* l'indicateur est un confort : son absence n'empêche pas de dicter */ }

    setSeconds(0);
    tickRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_SECONDS) { try { rec.stop(); } catch { /* ignore */ } } // borne dure
        return next;
      });
    }, 1000);

    rec.start();
    setState("recording");
  }, [state, fail, releaseMic]);

  const sendForTranscription = useCallback(async (blob: Blob) => {
    if (!mounted.current) return;
    if (blob.size < 1_200) { fail("EMPTY_AUDIO"); return; }
    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "dictation.webm");
      const res = await fetch("/api/assistant/transcribe", { method: "POST", body: form, credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (!mounted.current) return;

      if (res.status === 429) { fail("RATE_LIMITED"); return; }
      if (!res.ok || !data?.ok) {
        if (data?.code === "EMPTY_TRANSCRIPT" || data?.code === "EMPTY_AUDIO") { fail("EMPTY_AUDIO"); return; }
        if (data?.code === "TRANSCRIPTION_TIMEOUT") { fail("TRANSCRIPTION_TIMEOUT"); return; }
        fail("TRANSCRIPTION_FAILED");
        return;
      }
      const text = String(data.transcript ?? "").trim();
      if (!text) { fail("EMPTY_AUDIO"); return; }

      // INSERTION — jamais un envoi. Le serveur le dit aussi : `autoSend: false`.
      onTranscriptRef.current(text);
      setState("idle");
      setSeconds(0);
    } catch {
      if (mounted.current) fail("TRANSCRIPTION_FAILED");
    }
  }, [fail]);

  const stop = useCallback(() => {
    cancelledRef.current = false;
    try { recorderRef.current?.stop(); } catch { releaseMic(); setState("idle"); }
  }, [releaseMic]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    releaseMic(); // ceinture ET bretelles
    if (mounted.current) { setState("idle"); setSeconds(0); setError(null); }
  }, [releaseMic]);

  const reset = useCallback(() => { setError(null); setState("idle"); }, []);

  return { state, error, seconds, level, supported: isDictationSupported(), start, stop, cancel, reset };
}
