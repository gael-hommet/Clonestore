"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type AuthState = "loading" | "guest" | "authenticated";

type TopbarAuthSlotProps = {
  variant?: "desktop" | "mobile";
};

export default function TopbarAuthSlot({
  variant = "desktop",
}: TopbarAuthSlotProps) {
  const [authState, setAuthState] = useState<AuthState>("loading");

  const supabase = useMemo(() => {
    try {
      return getSupabase();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        if (mounted) setAuthState("guest");
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      setAuthState(data.user ? "authenticated" : "guest");
    }

    void load();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthState(session?.user ? "authenticated" : "guest");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const isMobile = variant === "mobile";
  const wrapperClass = isMobile ? "grid gap-2" : "flex items-center gap-2";

  if (authState === "loading") {
    return (
      <div className={wrapperClass}>
        <div className="h-11 w-28 rounded-full cs-glass" />
        <div className="h-11 w-36 rounded-full cs-glass" />
      </div>
    );
  }

  if (authState === "authenticated") {
    return (
      <div className={wrapperClass}>
        <Link
          href="/profile/agents"
          className={[
            "clone-liquid-button min-h-11 px-5",
            isMobile ? "w-full" : "",
          ].join(" ")}
        >
          Cockpit
        </Link>

        <Link
          href="/profile"
          className={[
            "clone-liquid-button clone-liquid-button--dark min-h-11 px-5",
            isMobile ? "w-full" : "",
          ].join(" ")}
        >
          Mon CloneStore
        </Link>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <Link
        href="/signup"
        className={[
          "clone-liquid-button clone-liquid-button--dark min-h-11 px-5",
          isMobile ? "w-full" : "",
        ].join(" ")}
      >
        Créer un compte
      </Link>

      <Link
        href="/login"
        className={[
          "clone-liquid-button min-h-11 px-5",
          isMobile ? "w-full" : "",
        ].join(" ")}
      >
        Connexion
      </Link>
    </div>
  );
}