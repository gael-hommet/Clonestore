// BLOC 4 — reservation step-1 CLIENT validation (UX). Server (validateStep1) stays authoritative.
import { describe, it, expect } from "vitest";
import { validateReservationStep1Client, isReservationStep1Valid } from "../client-validation";
import type { CompanySize } from "../types";

const valid = { email: "founder@acme.com", company_name: "Acme", company_size: "50-249" as CompanySize };

describe("BLOC4 — reservation step1 client validation", () => {
  it("accepts a valid step 1", () => {
    expect(validateReservationStep1Client(valid)).toEqual({});
    expect(isReservationStep1Valid(valid)).toBe(true);
  });

  it("flags empty email / company / size", () => {
    const e = validateReservationStep1Client({ email: "", company_name: "", company_size: "" });
    expect(e.email).toBeTruthy();
    expect(e.company_name).toBeTruthy();
    expect(e.company_size).toBeTruthy();
    expect(isReservationStep1Valid({ email: "", company_name: "", company_size: "" })).toBe(false);
  });

  it("flags malformed / oversized email", () => {
    expect(validateReservationStep1Client({ ...valid, email: "not-an-email" }).email).toBeTruthy();
    expect(validateReservationStep1Client({ ...valid, email: "a@b" }).email).toBeTruthy();
    expect(validateReservationStep1Client({ ...valid, email: "a".repeat(250) + "@b.com" }).email).toBeTruthy();
  });

  it("accepts trimmed email/company; rejects an unknown size", () => {
    expect(isReservationStep1Valid({ email: "  f@acme.com  ", company_name: "  Acme  ", company_size: "1-49" })).toBe(true);
    expect(validateReservationStep1Client({ ...valid, company_size: "999" as unknown as CompanySize }).company_size).toBeTruthy();
  });
});
