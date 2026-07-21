// src/lib/clonechat/conversations/__tests__/isolation.test.ts
// C1.8 — SÉCURITÉ RESTANTE : l'historique d'autrui n'existe pas pour vous.
//
// On attaque le store CANONIQUE (celui que la route utilise réellement), pas un mock affaibli.
// L'identifiant de conversation est DEVINABLE — c'est justement pourquoi il ne doit JAMAIS
// suffire : seul le contexte (userId + companyId), résolu SERVEUR, fait autorité.

import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryConversationStore } from "../memory-store";
import type { ConversationStore, ConversationCtx } from "../types";

const A: ConversationCtx = { userId: "user-A", companyId: "company-A" };
const B: ConversationCtx = { userId: "user-B", companyId: "company-B" };
/** Même entreprise, AUTRE utilisateur — le cas le plus sournois. */
const A2: ConversationCtx = { userId: "user-A2", companyId: "company-A" };

let store: ConversationStore;
let convA: string;

beforeEach(async () => {
  store = createInMemoryConversationStore();
  const c = await store.createConversation(A, { title: "Salaire confidentiel de Paul", at: "2026-07-14T10:00:00Z" });
  convA = c.id;
  await store.appendMessage(convA, A, {
    role: "user",
    content: [{ type: "text", text: "SECRET-A : le salaire de Paul est 45000" }],
    at: "2026-07-14T10:00:01Z",
  });
});

describe("C1.8 sécurité — accès transversal : refusé, et fail-closed", () => {
  it("B ne peut pas LIRE la conversation de A, même en connaissant son identifiant exact", async () => {
    expect(await store.getConversation(convA, B)).toBeNull();
    expect(await store.getMessages(convA, B)).toEqual([]);
  });

  it("le SECRET de A ne fuit nulle part chez B", async () => {
    const blob = JSON.stringify({
      conv: await store.getConversation(convA, B),
      msgs: await store.getMessages(convA, B),
      list: await store.listConversations(B),
    });
    expect(blob).not.toContain("SECRET-A");
    expect(blob).not.toContain("45000");
    expect(blob).not.toContain("Paul");
  });

  it("le TITRE d'autrui ne fuit pas par la liste (une fuite par titre reste une fuite)", async () => {
    const list = await store.listConversations(B);
    expect(list).toEqual([]);
    expect(JSON.stringify(list)).not.toContain("Salaire confidentiel");
  });

  it("B ne peut pas SUPPRIMER la conversation de A (et A la retrouve intacte)", async () => {
    await store.deleteConversation(convA, B); // doit être un non-événement
    const still = await store.getConversation(convA, A);
    expect(still).not.toBeNull();
    expect((await store.getMessages(convA, A)).length).toBe(1);
  });

  it("B ne peut ni RENOMMER ni ARCHIVER la conversation de A", async () => {
    await store.renameConversation(convA, B, "Détourné par B", "2026-07-14T11:00:00Z");
    await store.archiveConversation(convA, B, "2026-07-14T11:00:00Z");
    const c = await store.getConversation(convA, A);
    expect(c!.title).toBe("Salaire confidentiel de Paul"); // inchangé
  });

  it("B ne peut pas ÉCRIRE dans la conversation de A", async () => {
    await store.appendMessage(convA, B, {
      role: "user", content: [{ type: "text", text: "injecté par B" }], at: "2026-07-14T11:00:00Z",
    }).catch(() => undefined); // qu'il refuse ou qu'il ignore, le résultat doit être le même
    const msgs = await store.getMessages(convA, A);
    expect(JSON.stringify(msgs)).not.toContain("injecté par B");
  });

  // ═══ LE CAS LE PLUS SOURNOIS : même entreprise, autre personne ═══
  it("un COLLÈGUE de la même entreprise ne lit pas la conversation privée d'un autre", async () => {
    expect(await store.getConversation(convA, A2)).toBeNull();
    expect(await store.listConversations(A2)).toEqual([]);
    expect(JSON.stringify(await store.getMessages(convA, A2))).not.toContain("SECRET-A");
  });

  it("A, lui, accède normalement à SA conversation (l'isolation n'est pas une panne)", async () => {
    const c = await store.getConversation(convA, A);
    expect(c!.id).toBe(convA);
    expect(await store.listConversations(A)).toHaveLength(1);
    expect(JSON.stringify(await store.getMessages(convA, A))).toContain("SECRET-A");
  });

  it("un identifiant INEXISTANT ne révèle rien et ne casse rien (fail-closed)", async () => {
    expect(await store.getConversation("conv-devine-au-hasard", A)).toBeNull();
    expect(await store.getMessages("conv-devine-au-hasard", A)).toEqual([]);
    await expect(store.deleteConversation("conv-devine-au-hasard", A)).resolves.toBeUndefined();
  });
});
