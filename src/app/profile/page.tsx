"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setReady(true); return; } // pas d'env → pas de crash
    sb.auth.getUser()
      .then(({ data: { user } }) => setEmail(user?.email ?? null))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <section className="mx-auto max-w-3xl py-12 px-4">
        <h1 className="text-2xl font-semibold">Mon profil</h1>
        <p className="text-muted-foreground mt-2">Chargement…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-2xl font-semibold">Mon profil</h1>
      <p className="text-sm text-muted-foreground mt-2">
        {email ? `Connecté : ${email}` : "Non connecté"}
      </p>
      {email ? (
        <button
          onClick={async () => { const sb = getSupabase(); if (sb) await sb.auth.signOut(); location.href = "/login"; }}
          className="mt-4 border rounded px-3 py-2"
        >
          Se déconnecter
        </button>
      ) : (
        <a href="/login" className="inline-block mt-4 border rounded px-3 py-2">Se connecter</a>
      )}
    </section>
  );
}





