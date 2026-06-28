// PHASE 8.3-B3-R3.6 — phone normalization is strictly safe. National numbers are converted ONLY
// for explicitly-supported, tested countries (FR, CH). An unsupported/ambiguous country (e.g. IT)
// is NOT silently transformed; an unknown country and an invalid E.164 fail closed.
import { describe, it, expect } from "vitest";
import { normalizePhoneNumber, SignerSecurityError } from "../signature-security";

describe("B3-R3.6 strictly-safe phone normalization", () => {
  it("France national → +33 (supported + tested)", () => {
    expect(normalizePhoneNumber("0612345678", "FR")).toBe("+33612345678");
    expect(normalizePhoneNumber("01 23 45 67 89", "FR")).toBe("+33123456789");
  });
  it("Switzerland national → +41 (supported + tested)", () => {
    expect(normalizePhoneNumber("0791234567", "CH")).toBe("+41791234567");
  });
  it("already-E.164 is accepted as-is", () => {
    expect(normalizePhoneNumber("+33612345678")).toBe("+33612345678");
    expect(normalizePhoneNumber("+41791234567")).toBe("+41791234567");
  });
  it("00 international prefix → + after validation", () => {
    expect(normalizePhoneNumber("0033612345678")).toBe("+33612345678");
  });
  it("Italy national is NOT silently transformed (ambiguous / unsupported)", () => {
    // IT mobile like 3331234567 with country IT is not a supported national rule here → refused
    expect(() => normalizePhoneNumber("3331234567", "IT")).toThrow(/country is not supported/i);
    expect(() => normalizePhoneNumber("03311234567", "IT")).toThrow(SignerSecurityError);
  });
  it("an unknown country is refused", () => {
    expect(() => normalizePhoneNumber("0612345678", "ZZ")).toThrow(/country is not supported/i);
    expect(() => normalizePhoneNumber("0612345678")).toThrow(/country is not supported/i);
  });
  it("an invalid E.164 is refused", () => {
    expect(() => normalizePhoneNumber("+0")).toThrow(/valid E\.164/i);
    expect(() => normalizePhoneNumber("+33abc")).toThrow(SignerSecurityError);
  });
  it("a national number that does not match the country's format is refused", () => {
    expect(() => normalizePhoneNumber("0012", "FR")).toThrow(/national format|valid E\.164/i);
  });
  it("a missing phone is refused", () => {
    expect(() => normalizePhoneNumber(null)).toThrow(/required but missing/i);
    expect(() => normalizePhoneNumber("")).toThrow(SignerSecurityError);
  });
});
