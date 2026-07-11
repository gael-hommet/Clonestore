// src/lib/clonestore/product-technologies/t2/product-technology-result.ts
// T2 — Résultat d'une technologie produit. INVARIANT DUR : `live: false` au niveau du TYPE.
// Les messages sont assainis via l'assainisseur T1 (réutilisé, jamais dupliqué).

import { sanitizeTechnologyMessage } from "@/lib/clonestore/technologies/t1";
import type { ProductTechnologyContext, ProductTechnologyId } from "./product-technology-types";

export type ProductTechnologyResultKind = "ok" | "needs_validation" | "fallback" | "blocked" | "error";

export const ALL_PRODUCT_RESULT_KINDS: readonly ProductTechnologyResultKind[] = [
  "ok", "needs_validation", "fallback", "blocked", "error",
];

export interface ProductTechnologyResult<T = unknown> {
  readonly kind: ProductTechnologyResultKind;
  readonly productTechnologyId: ProductTechnologyId;
  readonly employeeId: string;
  readonly companyId: string;
  /** Artefact préparé localement — JAMAIS un effet exécuté. */
  readonly artifact: T | null;
  readonly requiresHumanValidation: boolean;
  /** INVARIANT T2 : aucun résultat n'est live. Jamais. */
  readonly live: false;
  readonly fallbackNote?: string;
  readonly blockedReason?: string;
  readonly errorMessage?: string;
}

function scope(ctx: Partial<ProductTechnologyContext> | null | undefined): { employeeId: string; companyId: string } {
  return { employeeId: (ctx?.employeeId ?? "").trim(), companyId: (ctx?.companyId ?? "").trim() };
}

export function productOk<T>(id: ProductTechnologyId, ctx: ProductTechnologyContext, artifact: T): ProductTechnologyResult<T> {
  return { kind: "ok", productTechnologyId: id, ...scope(ctx), artifact, requiresHumanValidation: false, live: false };
}

export function productNeedsValidation<T>(id: ProductTechnologyId, ctx: ProductTechnologyContext, artifact: T): ProductTechnologyResult<T> {
  return { kind: "needs_validation", productTechnologyId: id, ...scope(ctx), artifact, requiresHumanValidation: true, live: false };
}

export function productFallback<T>(id: ProductTechnologyId, ctx: ProductTechnologyContext, artifact: T | null, fallbackNote: string): ProductTechnologyResult<T> {
  return {
    kind: "fallback", productTechnologyId: id, ...scope(ctx), artifact,
    requiresHumanValidation: true, live: false, fallbackNote: sanitizeTechnologyMessage(fallbackNote),
  };
}

export function productBlocked<T = never>(
  id: ProductTechnologyId,
  ctx: Partial<ProductTechnologyContext> | null | undefined,
  blockedReason: string,
  fallbackNote?: string,
): ProductTechnologyResult<T> {
  const base = {
    kind: "blocked" as const, productTechnologyId: id, ...scope(ctx), artifact: null,
    requiresHumanValidation: true, live: false as const,
    blockedReason: sanitizeTechnologyMessage(blockedReason),
  };
  return fallbackNote === undefined ? base : { ...base, fallbackNote: sanitizeTechnologyMessage(fallbackNote) };
}

export function productError<T = never>(
  id: ProductTechnologyId,
  ctx: Partial<ProductTechnologyContext> | null | undefined,
  message: string,
): ProductTechnologyResult<T> {
  return {
    kind: "error", productTechnologyId: id, ...scope(ctx), artifact: null,
    requiresHumanValidation: true, live: false, errorMessage: sanitizeTechnologyMessage(message),
  };
}
