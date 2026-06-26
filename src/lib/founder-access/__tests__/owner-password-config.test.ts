// Non-régression — le hash de mot de passe propriétaire est chargé/normalisé de façon
// IDENTIQUE quelle que soit la forme dans .env (guillemets, CRLF, BOM), et un hash mal
// formé échoue fail-closed. Élimine la divergence « hash script ↔ hash Next » → 401.
import { describe, it, expect, afterEach } from "vitest";
import { loadOwnerPasswordHash } from "../owner-password-config";
import { hashOwnerPassword, verifyOwnerPassword } from "../owner-gate";

const KEY = "CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH";
const B64 = "CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH_B64";
const saved = process.env[KEY];
const savedB64 = process.env[B64];
afterEach(() => {
  if (saved === undefined) delete process.env[KEY]; else process.env[KEY] = saved;
  if (savedB64 === undefined) delete process.env[B64]; else process.env[B64] = savedB64;
});

const PASSWORD = "Gael-choix-mot-de-passe-2026";
const VALID = hashOwnerPassword(PASSWORD); // scrypt$16384$8$1$saltHex$hashHex

describe("owner-password-config — normalisation + format + vérification", () => {
  it("hash propre → présent, format valide, 6 segments", () => {
    process.env[KEY] = VALID;
    const i = loadOwnerPasswordHash();
    expect(i.present).toBe(true);
    expect(i.formatValid).toBe(true);
    expect(i.parts).toBe(6);
    expect(verifyOwnerPassword(PASSWORD)).toBe(true);
  });
  it("hash entre guillemets → normalisé + accepté", () => {
    process.env[KEY] = `"${VALID}"`;
    expect(loadOwnerPasswordHash().formatValid).toBe(true);
    expect(verifyOwnerPassword(PASSWORD)).toBe(true);
  });
  it("hash avec CRLF final → accepté", () => {
    process.env[KEY] = VALID + "\r";
    expect(loadOwnerPasswordHash().formatValid).toBe(true);
    expect(verifyOwnerPassword(PASSWORD)).toBe(true);
  });
  it("hash avec BOM initial → accepté", () => {
    process.env[KEY] = "﻿" + VALID;
    expect(loadOwnerPasswordHash().formatValid).toBe(true);
    expect(verifyOwnerPassword(PASSWORD)).toBe(true);
  });
  it("hash avec espaces extérieurs → accepté", () => {
    process.env[KEY] = `   ${VALID}   `;
    expect(verifyOwnerPassword(PASSWORD)).toBe(true);
  });
  it("hash mal formé → format invalide + vérification false (fail-closed)", () => {
    process.env[KEY] = "pas-un-hash-scrypt";
    expect(loadOwnerPasswordHash().formatValid).toBe(false);
    expect(verifyOwnerPassword(PASSWORD)).toBe(false);
  });
  it("hash vide → absent", () => {
    process.env[KEY] = "";
    expect(loadOwnerPasswordHash().present).toBe(false);
    expect(verifyOwnerPassword(PASSWORD)).toBe(false);
  });
  it("mot de passe incorrect → false", () => {
    process.env[KEY] = VALID;
    expect(verifyOwnerPassword("mauvais")).toBe(false);
  });
  it("forme base64 (_B64) → décodée, prioritaire, et vérifie le mot de passe", () => {
    delete process.env[KEY];
    process.env[B64] = Buffer.from(VALID, "utf8").toString("base64");
    const i = loadOwnerPasswordHash();
    expect(i.formatValid).toBe(true);
    expect(i.parts).toBe(6);
    expect(verifyOwnerPassword(PASSWORD)).toBe(true);
  });
  it("_B64 valide PRIORITAIRE sur une variable directe corrompue (cas @next/env)", () => {
    process.env[KEY] = "scrypt"; // simulate corruption par expansion $
    process.env[B64] = Buffer.from(VALID, "utf8").toString("base64");
    expect(loadOwnerPasswordHash().formatValid).toBe(true);
    expect(verifyOwnerPassword(PASSWORD)).toBe(true);
  });
  it("empreinte IDENTIQUE que le hash soit propre ou cité+CRLF (script ↔ Next)", () => {
    process.env[KEY] = VALID;
    const a = loadOwnerPasswordHash().fingerprint;
    process.env[KEY] = `"${VALID}"\r`;
    const b = loadOwnerPasswordHash().fingerprint;
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });
});
