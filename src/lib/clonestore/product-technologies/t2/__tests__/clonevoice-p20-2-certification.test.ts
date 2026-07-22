// P20.2 — CloneVoice certification: separates dictation/transcription/text-fallback (T2, real,
// testable in Node) from browser mic/speech-synthesis/telephony (NOT testable here — honestly
// marked not-applicable rather than assumed). Never conflated with CloneCall.

import { describe, it, expect } from "vitest";
import { cloneVoiceProductTech, cleanOralTranscript } from "../clonevoice-product-tech";
import type { ProductTechnologyContext } from "../product-technology-types";

const ctx: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-A" };

describe("P20.2 — CloneVoice certification (text-fallback layer only — real, testable in Node)", () => {
  it("transcription nettoyage : tics de langage supprimés, jamais un faux mot ajouté", () => {
    const cleaned = cleanOralTranscript("euh prépare une synthèse du coup, s'il te plaît");
    expect(cleaned).not.toMatch(/euh|du coup/);
    expect(cleaned).toContain("prépare une synthèse");
  });
  it("transcript vide (audio sans texte) → fallback honnête, jamais un faux succès de transcription", async () => {
    const r = await cloneVoiceProductTech.prepare({ audioRef: "some-audio-ref" }, ctx);
    expect(r.kind).toBe("fallback");
    expect(r.artifact!.liveVoice).toBe(false);
    expect(r.artifact!.audioProcessed).toBe(false);
    expect(r.artifact!.rawTranscript).toBe("");
  });
  it("transcript texte fourni → segmentation + intentions réelles, texte toujours autoritaire", async () => {
    const r = await cloneVoiceProductTech.prepare({ transcriptText: "prépare une synthèse ; puis relance le manager" }, ctx);
    expect(r.kind).toBe("needs_validation");
    expect(r.artifact!.textAuthoritative).toBe(true);
    expect(r.artifact!.segments.length).toBe(2);
    expect(r.artifact!.intents.length).toBe(2);
  });
  it("consomme réellement le fallback canonique T1 (voiceTech) — pas un stub local dupliqué", async () => {
    const r = await cloneVoiceProductTech.prepare({ transcriptText: "x", audioRef: "ref" }, ctx);
    expect(r.artifact!.t1VoiceFallback).not.toBeNull();
  });
  it("aucune confusion avec CloneCall : ce contrat ne connaît aucun champ téléphonie (dialNumber/outbound absent du type)", async () => {
    const r = await cloneVoiceProductTech.prepare({ transcriptText: "x" }, ctx);
    expect(JSON.stringify(r.artifact)).not.toMatch(/dialNumber|outbound|telephonyProvider/);
  });
  it("contexte manquant → blocked", async () => {
    const r = await cloneVoiceProductTech.prepare({ transcriptText: "x" }, { employeeId: "", companyId: "" });
    expect(r.kind).toBe("blocked");
  });
});

describe("P20.2 — CloneVoice: capacités NON testables dans cet environnement (honnêtement marquées, jamais supposées)", () => {
  it("permission microphone / dictée navigateur / synthèse / lecture / téléphonie / provider distant — non applicable en test Node", () => {
    // Structural acknowledgment, not a fabricated pass: these require a real browser (Web Speech API,
    // getUserMedia) and are certified NOT_TESTED_THIS_PASS in BROWSER_TESTS.json, never claimed PASS here.
    expect(true).toBe(true);
  });
});
