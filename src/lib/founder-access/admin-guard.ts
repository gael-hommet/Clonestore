// Phase E.2 — Founder Access : garde administrateur (serveur uniquement).
// Sécurité réelle : session Supabase + allowlist d'emails par variable d'env.
// Aucune confiance dans un booléen client. Aucune donnée avant autorisation.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isOwnerGateConfigured } from "./owner-gate";
import { ownerGateUnlocked } from "./signed-cookie";

/**
 * Normalise un email pour comparaison : retire les caractères invisibles (BOM /
 * zero-width), les espaces et les guillemets englobants (valeurs .env citées), puis
 * minuscule. Robuste aux formats .env réels qui faisaient échouer la comparaison
 * (faux « forbidden » alors que l'email figure bien dans la variable).
 */
function normalizeEmail(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[​-‍﻿]/g, "") // zero-width / BOM
    .trim()
    .replace(/^['"]+|['"]+$/g, "") // guillemets englobants
    .trim()
    .toLowerCase();
}

/** Allowlist administrateur : fusionne les deux variables, tolère virgule/point-virgule/
 *  espaces/sauts de ligne et guillemets, et ne garde que des entrées contenant « @ ». */
function allowlist(): string[] {
  const raw = `${process.env.CLONESTORE_OWNER_ADMIN_EMAILS ?? ""},${process.env.CLONESTORE_FOUNDER_ACCESS_ADMIN_EMAILS ?? ""}`;
  return raw
    .split(/[,;\s]+/) // un email ne contient jamais d'espace → séparateurs sûrs
    .map((e) => normalizeEmail(e))
    .filter((e) => e.includes("@"));
}

export type AdminAuth =
  | { ok: true; email: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/** Résout l'administrateur fondateur courant via la session Supabase + allowlist. */
export async function resolveFounderAdmin(): Promise<AdminAuth> {
  let email = "";
  try {
    const supa = supabaseServer();
    const { data } = await supa.auth.getUser();
    email = normalizeEmail(data.user?.email);
  } catch {
    email = "";
  }
  const list = allowlist();
  const allowlisted = email.length > 0 && list.includes(email);

  // Diagnostic serveur opt-in (CLONESTORE_OWNER_GATE_DIAG=1) : inerte par défaut, ne révèle
  // aucun secret (slug/hash/clé). Permet de confirmer la cause sur une vraie session.
  if (process.env.CLONESTORE_OWNER_GATE_DIAG === "1") {
    console.warn("[owner-gate-diag]", JSON.stringify({
      auth_reason: email.length === 0 ? "unauthenticated" : allowlisted ? "authenticated" : "forbidden",
      email_normalized: email || null,
      allowlisted,
      allowlist_size: list.length,
    }));
  }

  if (email.length === 0) return { ok: false, reason: "unauthenticated" };
  if (!allowlisted) return { ok: false, reason: "forbidden" };
  return { ok: true, email };
}

/** Réponse de refus : 401 si non connecté, 404 sinon (ne pas révéler l'existence). */
export function founderAdminDeniedResponse(reason: "unauthenticated" | "forbidden"): NextResponse {
  return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 404, headers: { "cache-control": "private, no-store" } });
}

/**
 * État UNIQUE de la porte propriétaire, partagé par la page cockpit et toutes les
 * API internes (§1/§2). FAIL-CLOSED : une configuration incomplète n'autorise jamais.
 *   - "misconfigured" : hash/secret cookie/slug manquant → 404, jamais d'accès ;
 *   - "locked"        : configurée mais pas de cookie valide → écran/refus ;
 *   - "unlocked"      : configurée + cookie signé valide.
 */
export type OwnerGateState = "misconfigured" | "locked" | "unlocked";

export function resolveOwnerGateState(cookieHeader: string | null): OwnerGateState {
  if (!isOwnerGateConfigured()) return "misconfigured";
  return ownerGateUnlocked(cookieHeader) ? "unlocked" : "locked";
}

/**
 * Garde complète d'une API interne : porte (configurée + déverrouillée) → session →
 * allowlist. Une porte non configurée n'est JAMAIS une autorisation (fail-closed).
 * Renvoie un refus générique (404) sinon, sans révéler le contrôle ayant échoué.
 */
export async function guardInternalRequest(req: Request): Promise<AdminAuth> {
  if (resolveOwnerGateState(req.headers.get("cookie")) !== "unlocked") {
    return { ok: false, reason: "forbidden" };
  }
  return resolveFounderAdmin();
}

/** true si un email donné est administrateur fondateur (tests / vérifications pures). */
export function isFounderAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && allowlist().includes(normalized);
}
