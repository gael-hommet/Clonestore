// CloneStory — pont SUPABASE AUTH réel pour l'onboarding seamless (SERVER-ONLY, PROD).
//
// Isolé du coeur testable (auth-onboarding.ts). Crée/restaure une session Supabase SANS
// envoyer de second email : `admin.generateLink({type:'magiclink'})` génère un token SANS
// l'envoyer ; `verifyOtp({token_hash})` l'échange contre une session. Les cookies d'auth
// sont posés sur la RÉPONSE fournie (motif route-handler SSR : cookies requête → réponse).

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SeamlessDeps } from "./auth-onboarding";

function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  return (header ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const i = c.indexOf("=");
      return i < 0 ? { name: c, value: "" } : { name: c.slice(0, i), value: decodeURIComponent(c.slice(i + 1)) };
    });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase admin env");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Dépendances RÉELLES (prod) liées à la requête entrante + à la réponse sortante `res` :
 * le client SSR lit les cookies de la requête et ÉCRIT les cookies d'auth sur `res`.
 * Jamais utilisées en test (les tests injectent un mock de SeamlessDeps).
 */
export function realSeamlessDeps(cookieHeader: string | null, res: NextResponse): SeamlessDeps {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env");
  const reqCookies = parseCookieHeader(cookieHeader);
  const server = createServerClient(url, anon, {
    cookies: {
      getAll() { return reqCookies; },
      setAll(toSet) {
        for (const { name, value, options } of toSet) res.cookies.set(name, value, options as Record<string, unknown>);
      },
    },
  });

  return {
    currentUser: async () => {
      try {
        const { data } = await server.auth.getUser();
        return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
      } catch {
        return null;
      }
    },
    mintSession: async (email: string) => {
      try {
        const admin = adminClient();
        // 1) Compte existant + email confirmé (CloneStory l'a vérifié). Ignore si déjà présent.
        await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => undefined);
        // 2) Magiclink — AUCUN email envoyé par Supabase → récupère hashed_token.
        const gen = await admin.auth.admin.generateLink({ type: "magiclink", email });
        const tokenHash = (gen.data?.properties as { hashed_token?: string } | undefined)?.hashed_token;
        if (gen.error || !tokenHash) return { ok: false, error: gen.error?.message ?? "no_token" };
        // 3) Échange token → session ; les cookies d'auth sont posés sur `res`.
        const otp = await server.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
        if (otp.error || !otp.data?.user) return { ok: false, error: otp.error?.message ?? "verify_failed" };
        return { ok: true, userId: otp.data.user.id };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "mint_error" };
      }
    },
  };
}
