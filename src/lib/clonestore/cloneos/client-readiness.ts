// src/lib/clonestore/cloneos/client-readiness.ts
// P12 §12F — Résolution SERVEUR de la readiness client (pour le routage post-login). Réutilise les
// signaux d'auth EXISTANTS (Supabase getUser + hasPierreAccess) — n'affaiblit NI ne falsifie l'auth.
// FAIL-SAFE : en cas d'ambiguïté, on ne PIÈGE jamais un client hors de son espace (on ne prétend pas
// non plus qu'un visiteur est client). La complétude d'onboarding est un placeholder sûr documenté
// (le gating fin d'onboarding vit déjà dans Mon CloneStore / /agents/pierre/setup).

import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";
import { hasPierreAccess } from "@/lib/pierre/access";
import { resolveLandingRoute, type ClientReadiness, type LandingTarget } from "./cloneos-app-shell-contract";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Résout l'état de readiness du client courant à partir des signaux serveur réels. Ne throw jamais :
 * toute erreur → état conservateur (connecté sans plus, ou déconnecté). connected/isClient sont RÉELS ;
 * onboardingComplete est un placeholder sûr (= isClient) tant que le signal fin n'est pas câblé —
 * un client n'est donc jamais bloqué hors du cockpit, et un non-client n'est jamais traité comme prêt.
 */
export async function resolveClientReadiness(): Promise<ClientReadiness> {
  let userId: string | null = null;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return { connected: false, isClient: false, onboardingComplete: false };

  let isClient = false;
  try {
    const admin = adminClient();
    if (admin) {
      const access = await hasPierreAccess(admin, userId);
      isClient = !!access?.ok;
    }
  } catch {
    isClient = false; // fail-closed sur le statut client : on ne fabrique JAMAIS un client
  }

  // Placeholder sûr : un client payant est routé comme onboardé (le gating fin d'onboarding reste
  // dans Mon CloneStore / setup). On ne piège pas le client hors du cockpit.
  const onboardingComplete = isClient;
  return { connected: true, isClient, onboardingComplete };
}

/** Cible d'atterrissage pour l'utilisateur courant (pure resolveLandingRoute sur l'état résolu). */
export async function resolveLandingTarget(): Promise<LandingTarget> {
  return resolveLandingRoute(await resolveClientReadiness());
}
