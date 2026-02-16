"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  // ================= LOGIN =================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setNeedsConfirm(false);
    setLoading(true);

    if (!supabase) {
      setError("Supabase non configuré. Vérifie tes variables NEXT_PUBLIC_*.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("email not confirmed")) {
        setNeedsConfirm(true);
        setError("Email non confirmé. Vérifie ta boîte mail (et les spams).");
      } else {
        setError("Email ou mot de passe incorrect.");
      }
      setLoading(false);
      return;
    }

    router.refresh();
    router.push("/profile");
  }

  // ================= RESEND CONFIRM =================
  async function resendConfirmEmail() {
    setError(null);
    setInfo(null);
    setResendLoading(true);

    if (!supabase) {
      setError("Supabase non configuré.");
      setResendLoading(false);
      return;
    }

    const emailRedirectTo =
      (process.env.NEXT_PUBLIC_SITE_URL || "https://www.clonestore.pro").replace(/\/$/, "") +
      "/login";

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      setError("Impossible de renvoyer l’email. Réessaie.");
      setResendLoading(false);
      return;
    }

    setInfo("Email de confirmation renvoyé. Vérifie aussi tes spams.");
    setResendLoading(false);
  }

  // ================= RESET PASSWORD =================
  async function handleForgotPassword() {
    setError(null);
    setInfo(null);

    if (!email) {
      setError("Entre ton email pour réinitialiser le mot de passe.");
      return;
    }

    if (!supabase) {
      setError("Supabase non configuré.");
      return;
    }

    const redirectTo =
      (process.env.NEXT_PUBLIC_SITE_URL || "https://www.clonestore.pro").replace(/\/$/, "") +
      "/login";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setError("Impossible d’envoyer l’email de réinitialisation.");
      return;
    }

    setInfo("Email de réinitialisation envoyé. Vérifie ta boîte mail.");
  }

  return (
    <section className="mx-auto max-w-md py-12 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Se connecter</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Accède à ton espace CloneStore pour gérer ton compte et tes clones.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* EMAIL */}
        <div className="space-y-1 text-sm">
          <label htmlFor="email" className="font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* PASSWORD */}
        <div className="space-y-1 text-sm">
          <label htmlFor="password" className="font-medium">
            Mot de passe
          </label>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="w-full rounded-md border px-3 py-2 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:opacity-70"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs text-muted-foreground hover:underline"
          >
            Mot de passe oublié ?
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}

        {needsConfirm && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={resendConfirmEmail}
            disabled={resendLoading || !email}
          >
            {resendLoading ? "Envoi..." : "Renvoyer l’email de confirmation"}
          </Button>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="underline">
          Créer un compte
        </Link>
      </p>
    </section>
  );
}






