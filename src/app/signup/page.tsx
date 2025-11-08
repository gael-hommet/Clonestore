"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);

    // Récupération du client Supabase
    const sb = getSupabase();
    if (!sb) {
      setMsg("Erreur : configuration Supabase manquante (URL/clé).");
      setBusy(false);
      return;
    }

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    // 🔥 Ligne corrigée : on utilise sb et non supabase
    const { error } = await sb.auth.signUp({ email, password });

    if (error) setMsg(error.message);
    else {
      setMsg("✅ Compte créé avec succès. Vérifie tes emails si nécessaire.");
      setTimeout(() => router.push("/login"), 1000);
    }

    setBusy(false);
  }

  return (
    <section className="mx-auto max-w-sm py-12 px-4">
      <h1 className="text-2xl font-semibold">Créer un compte</h1>

      <form onSubmit={onSubmit} className="mt-6 grid gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="border rounded p-2"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Mot de passe (min. 6 caractères)"
          className="border rounded p-2"
          minLength={6}
          required
        />
        <button
          disabled={busy}
          className="border rounded p-2 disabled:opacity-60"
        >
          {busy ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}

      <p className="mt-6 text-sm">
        Déjà un compte ?{" "}
        <a href="/login" className="underline">
          Se connecter
        </a>
      </p>
    </section>
  );
}



