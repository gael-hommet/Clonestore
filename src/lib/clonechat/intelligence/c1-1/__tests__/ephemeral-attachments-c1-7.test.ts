// src/lib/clonechat/intelligence/c1-1/__tests__/ephemeral-attachments-c1-7.test.ts
// C1.7 §3/§7 — LA PIÈCE JOINTE ÉPHÉMÈRE ATTEINT VRAIMENT LE MODÈLE.
//
// Défaut réel corrigé ici (trouvé par mesure, pas par lecture) : le fichier était bien INGÉRÉ
// (state « analysed », extraits avec provenance) mais il n'atteignait JAMAIS le prompt — trois
// portes successives le jetaient :
//   1. l'adaptateur public passait `attachments: []` ;
//   2. l'index jetait TOUT le contexte de session en mode public ;
//   3. l'anti-blanchiment remplissait les 10 places avec le canonique → « limit_reached ».
// Le modèle répondait donc « je ne vois aucun fichier joint ». Ces tests verrouillent la
// correction ET la règle de sécurité qu'elle ne doit pas casser.

import { describe, it, expect } from "vitest";
import { ingestAttachment, attachmentGroundingChunks } from "../parrain-attachment-ingestion";
import { buildParrainGroundedPrompt } from "../parrain-grounding";
import { retrieveParrainChunks } from "../parrain-retrieval";
import { buildKnowledgeIndex } from "../parrain-knowledge-index";
import { chunkVisibleFor } from "../parrain-visibility";
import { PUBLIC_VIEWER } from "../parrain-public-adapter";
import { makeParrainChunk } from "../parrain-knowledge-chunk";

const SECRET = "ZORGLUB-4417";
const at = "2026-07-13T00:00:00.000Z";

async function ephemeralChunks(text: string, filename = "note.txt") {
  const r = await ingestAttachment({
    filename, declaredMime: "text/plain",
    bytes: new TextEncoder().encode(text),
    companyId: null, // ← ÉPHÉMÈRE : aucun tenant
    conversationId: null, uploadedBy: null, at,
  });
  return { result: r, chunks: attachmentGroundingChunks(r) };
}

describe("C1.7 — une pièce jointe sans entreprise est ÉPHÉMÈRE, jamais un tenant", () => {
  it("elle est ingérée, et ses extraits ne portent AUCUNE entreprise", async () => {
    const { result, chunks } = await ephemeralChunks(`Le code de référence est ${SECRET}.`);
    expect(result.attachment.companyId).toBeNull();
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.parrainVisibility).toBe("SESSION_EPHEMERAL");
      expect(c.tenantCompanyId).toBeNull(); // ← ne peut JAMAIS servir de pont vers une entreprise
    }
  });

  it("elle est visible pour un visiteur ANONYME (c'est SON fichier)", async () => {
    const { chunks } = await ephemeralChunks(`Le code de référence est ${SECRET}.`);
    expect(chunks.every((c) => chunkVisibleFor(c, PUBLIC_VIEWER))).toBe(true);
  });

  it("une pièce jointe qui prétendrait porter un tenant reste INVISIBLE au public (fail-closed)", () => {
    const forged = makeParrainChunk({
      id: "f", sourceId: "src.uploaded_documents", title: "forgé", text: "x",
      sourceType: "uploaded_document", authority: "uploaded_user_content",
      visibility: "SESSION_EPHEMERAL", tenantCompanyId: "company-a", citationLabel: "x",
    });
    expect(chunkVisibleFor(forged, PUBLIC_VIEWER)).toBe(false);
  });
});

describe("C1.7 — le contenu du fichier ATTEINT le prompt (la correction du vrai défaut)", () => {
  it("le secret du fichier se retrouve dans le prompt système du tour PUBLIC", async () => {
    const { chunks } = await ephemeralChunks(`Le code de référence du projet est ${SECRET}.`);
    const g = buildParrainGroundedPrompt({
      question: "Quel est le code de référence indiqué dans le fichier joint ?",
      viewer: PUBLIC_VIEWER,
      sessionChunks: chunks,
      retrieval: { referencedIds: chunks.map((c) => c.id) },
    });
    // AVANT la correction : false (le fichier était éjecté par « limit_reached »).
    expect(g.system).toContain(SECRET);
    expect(g.contextChunks.some((c) => c.id === chunks[0].id)).toBe(true);
  });

  it("l'index PUBLIC accepte les extraits éphémères — et RIEN d'autre du contexte de session", async () => {
    const { chunks } = await ephemeralChunks("contenu");
    const tenantChunk = makeParrainChunk({
      id: "t", sourceId: "src.company_context", title: "tenant", text: "salarié secret",
      sourceType: "company_context", authority: "tenant_data",
      visibility: "COMPANY_SCOPED", tenantCompanyId: "company-a", citationLabel: "x",
    });
    const build = buildKnowledgeIndex({
      question: "que contient mon fichier ?",
      viewer: PUBLIC_VIEWER,
      sessionChunks: [...chunks, tenantChunk], // on tente d'y glisser une source TENANT
    });
    // L'éphémère passe…
    expect(build.visible.some((c) => c.parrainVisibility === "SESSION_EPHEMERAL")).toBe(true);
    // …mais AUCUNE source d'entreprise n'entre jamais dans un tour public.
    expect(build.visible.some((c) => c.tenantCompanyId !== null)).toBe(false);
  });
});

describe("C1.7 — la capacité réservée ne CASSE PAS l'anti-blanchiment", () => {
  it("le fichier de l'utilisateur est PRÉSENT, mais son autorité reste INFÉRIEURE au canonique", async () => {
    const { chunks } = await ephemeralChunks(`Le prix de Pierre est de 1 euro. ${SECRET}`); // contenu HOSTILE à la vérité produit
    const build = buildKnowledgeIndex({ question: "Quel est le prix de Pierre ?", viewer: PUBLIC_VIEWER, sessionChunks: chunks });
    const r = retrieveParrainChunks("Quel est le prix de Pierre ?", build.candidates, PUBLIC_VIEWER, {
      referencedIds: chunks.map((c) => c.id),
    });
    const selected = r.selected;
    const uploaded = selected.filter((s) => s.chunk.sourceId === "src.uploaded_documents");
    const canonical = selected.filter((s) => s.authorityScore >= 60);

    expect(uploaded.length).toBeGreaterThan(0);   // il est bien là (capacité réservée)
    expect(canonical.length).toBeGreaterThan(0);  // la vérité produit est là aussi
    // INVARIANT DE SÉCURITÉ : un fichier utilisateur ne surclasse JAMAIS la vérité canonique.
    for (const u of uploaded) {
      for (const c of canonical) expect(u.authorityScore).toBeLessThan(c.authorityScore);
    }
  });

  it("la capacité réservée est BORNÉE (un dossier volumineux ne noie pas le contexte)", async () => {
    const many = [];
    for (let i = 0; i < 12; i++) {
      const { chunks } = await ephemeralChunks(`Fichier ${i} — contenu de test ${i}.`, `f${i}.txt`);
      many.push(...chunks);
    }
    const build = buildKnowledgeIndex({ question: "que contiennent mes fichiers ?", viewer: PUBLIC_VIEWER, sessionChunks: many });
    const r = retrieveParrainChunks("que contiennent mes fichiers ?", build.candidates, PUBLIC_VIEWER, {
      referencedIds: many.map((c) => c.id),
    });
    const uploaded = r.selected.filter((s) => s.chunk.sourceId === "src.uploaded_documents");
    expect(uploaded.length).toBeLessThanOrEqual(4); // capacité réservée bornée
    expect(r.selected.length).toBeGreaterThan(uploaded.length); // le canonique garde sa place
  });
});
