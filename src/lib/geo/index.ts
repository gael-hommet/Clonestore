// src/lib/geo/index.ts
// P18 — GEO PACKS public API. The central country contract for FR/BE/LU/CH: server-authoritative
// resolution of legal country → profile → pricing region / currency / price / formats / capabilities,
// fail-closed and never falling back to France. Composes the P10 pricing canon and the P8.10/8.12 HR
// canon without duplicating them.

export * from "./types";
export * from "./country-profiles";
export * from "./pricing-region";
export * from "./geo-resolver";
export * from "./capabilities";
export * from "./geo-invariants";
export * from "./document-availability";
export * from "./document-jurisdiction";
export * from "./formatting";
