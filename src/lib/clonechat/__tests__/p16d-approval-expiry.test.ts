// src/lib/clonechat/__tests__/p16d-approval-expiry.test.ts
// P16D §4 / §5 / §7 — EXPIRATION DE L'APPROBATION.
//
// DÉFAUT CORRIGÉ (confirmé sur le schéma réel) — `clonechat_proposals` porte bien un `created_at`,
// mais `ProposalStore.load()` ne le lisait pas et la route d'exécution ne le regardait jamais.
// Une proposition — qui EST l'approbation humaine, puisque le client ne renvoie qu'un
// `proposalId` — restait donc exécutable INDÉFINIMENT. Un onglet laissé ouvert des semaines,
// ou un `proposalId` rejoué plus tard, ré-autorisait l'action alors que rôle / effectif /
// entitlement avaient pu changer entre-temps.
//
// §4 exige que « approbation EXPIRÉE → AUTORISÉ » ÉCHOUE FERMÉ. §5 exige que l'expiration
// entre dans l'identité canonique de la commande.
//
// Aucune migration : la borne dérive du `created_at` existant.

import { describe, it, expect } from "vitest";
import {
  PROPOSAL_TTL_MS, proposalFreshness, proposalExpiresAt, isProposalExecutable,
} from "@/lib/clonechat/durable/proposal-expiry";
import { commandFingerprint, type CanonicalCommand } from "@/lib/clonechat/durable/command-ledger";

const T0 = "2026-07-12T10:00:00.000Z";
const at = (ms: number) => new Date(Date.parse(T0) + ms);

describe("P16D §4 — une approbation expirée n'autorise plus rien (fail-closed)", () => {
  it("fraîche à l'intérieur du TTL", () => {
    expect(proposalFreshness(T0, at(PROPOSAL_TTL_MS - 1)).state).toBe("fresh");
    expect(isProposalExecutable(T0, at(0))).toBe(true);
  });

  it("EXPIRÉE une fois le TTL atteint — la borne est stricte", () => {
    expect(proposalFreshness(T0, at(PROPOSAL_TTL_MS)).state).toBe("expired");
    expect(proposalFreshness(T0, at(PROPOSAL_TTL_MS + 1)).state).toBe("expired");
    expect(isProposalExecutable(T0, at(PROPOSAL_TTL_MS + 1))).toBe(false);
  });

  it("des semaines plus tard (l'onglet oublié) ⇒ jamais exécutable", () => {
    expect(isProposalExecutable(T0, at(21 * 24 * 3600_000))).toBe(false);
  });

  // FAIL-CLOSED : une preuve de fraîcheur ABSENTE n'est jamais une preuve positive.
  it.each([
    ["created_at null", null],
    ["created_at undefined", undefined],
    ["created_at illisible", "pas-une-date"],
    ["created_at vide", ""],
  ])("%s ⇒ `unknown` ⇒ NON exécutable (absence de preuve ≠ preuve)", (_l, bad) => {
    expect(proposalFreshness(bad as string | null | undefined, at(0)).state).toBe("unknown");
    expect(isProposalExecutable(bad as string | null | undefined, at(0))).toBe(false);
  });

  it("une date illisible ne produit AUCUNE borne d'expiration", () => {
    expect(proposalExpiresAt("pas-une-date")).toBeNull();
    expect(proposalExpiresAt(null)).toBeNull();
  });
});

describe("P16D §5 — l'expiration entre dans l'identité canonique, sans casser l'idempotence", () => {
  const base: CanonicalCommand = {
    companyId: "c-1", actorId: "u-1", conversationId: null,
    proposalId: "p-1", actionKind: "create_mission", payload: { instruction: "Préparer un CDI" },
  };

  it("l'expiration est LIÉE : deux bornes différentes ⇒ deux identités différentes", () => {
    const a = commandFingerprint({ ...base, expiresAt: "2026-07-12T10:15:00.000Z" });
    const b = commandFingerprint({ ...base, expiresAt: "2026-07-12T11:15:00.000Z" });
    expect(a).not.toBe(b);
  });

  it("l'identité reste STABLE en reprise : `expiresAt` dérive d'un `created_at` IMMUABLE", () => {
    // Le serveur recalcule la borne à chaque tentative à partir de la MÊME proposition.
    const e = proposalExpiresAt(T0)!;
    expect(commandFingerprint({ ...base, expiresAt: e })).toBe(commandFingerprint({ ...base, expiresAt: proposalExpiresAt(T0)! }));
  });

  it("l'ordre des clés du payload ne change PAS l'identité (canonicalisation triée)", () => {
    const e = proposalExpiresAt(T0)!;
    const one = commandFingerprint({ ...base, payload: { a: 1, b: { x: 1, y: 2 } }, expiresAt: e });
    const two = commandFingerprint({ ...base, payload: { b: { y: 2, x: 1 }, a: 1 }, expiresAt: e });
    expect(one).toBe(two);
  });

  it("le tenant reste lié : la même proposition sous une AUTRE entreprise ⇒ autre identité", () => {
    const e = proposalExpiresAt(T0)!;
    expect(commandFingerprint({ ...base, expiresAt: e })).not.toBe(commandFingerprint({ ...base, companyId: "c-2", expiresAt: e }));
  });
});
