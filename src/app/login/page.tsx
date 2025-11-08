"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);

    const sb = getSupabase();
    if (!sb) {
      setMsg("Erreur : configuration Supabase manquante (URL/clé).");
      setBusy(false);
      return;
    }

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else router.push("/profile/agents");
    setBusy(false);
  }

  return (
    <section className="mx-auto max-w-sm py-12 px-4">
      <h1 className="text-2xl font-semibold">Se connecter</h1>

      <form onSubmit={onSubmit} className="mt-6 grid gap-3">
        <input name="email" type="email" placeholder="Email" className="border rounded p-2" required />
        <input name="password" type="password" placeholder="Mot de passe" className="border rounded p-2" required />
        <button disabled={busy} className="border rounded p-2 disabled:opacity-60">
          {busy ? "Connexion..." : "Connexion"}
        </button>
      </form>

      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}

      <p className="mt-6 text-sm">
        Pas encore de compte ? <a href="/signup" className="underline">Créer un compte</a>
      </p>
    </section>
  );
}

