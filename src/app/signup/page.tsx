"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!accepted) {
      setError("Tu dois accepter la politique de confidentialité.");
      return;
    }

    setLoading(true);

    if (!supabase) {
      setError("Supabase non configuré. Vérifie tes variables NEXT_PUBLIC_*.");
      setLoading(false);
      return;
    }

    const emailRedirectTo =
      (process.env.NEXT_PUBLIC_SITE_URL || "https://www.clonestore.pro").replace(/\/$/, "") +
      "/login";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      setError(error.message || "Impossible de créer le compte.");
      setLoading(false);
      return;
    }

    // confirmation email activée => session null => normal
    if (!data.session) {
      setInfo(
        "Compte créé ✅ Vérifie ton email pour confirmer ton compte (pense aux spams), puis reviens te connecter."
      );
      setLoading(false);
      return;
    }

    router.refresh();
    router.push("/profile");
  }

  return (
    <section className="mx-auto max-w-md py-12 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Créer un compte</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Crée ton espace CloneStore pour activer et gérer tes clones IA.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

        <div className="space-y-1 text-sm">
          <label htmlFor="password" className="font-medium">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            J’ai lu et j’accepte la{" "}
            <a
              href="https://www.clonestore.pro/legal/confidentialite"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:opacity-80"
            >
              politique de confidentialité
            </a>
            .
          </span>
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}

        <Button type="submit" className="w-full" disabled={loading || !accepted}>
          {loading ? "Création du compte..." : "Créer mon compte"}
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        Tu as déjà un compte ?{" "}
        <Link href="/login" className="underline">
          Se connecter
        </Link>
      </p>
    </section>
  );
}







