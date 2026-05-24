"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSessionClient } from "@/lib/auth/session-client";
import type { Session } from "@supabase/supabase-js";

type AuthState = "loading" | "guest" | "authenticated";

type TopbarAuthSlotProps = {
  variant?: "desktop" | "mobile";
};

export default function TopbarAuthSlot({
  variant = "desktop",
}: TopbarAuthSlotProps) {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    let mounted = true;
    const client = getSessionClient();

    // getSession() reads from cookie — no network round-trip, resolves in <1ms.
    void client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthState(data.session?.user ? "authenticated" : "guest");
    }).catch(() => {
      if (mounted) setAuthState("guest");
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (!mounted) return;
      setAuthState(session?.user ? "authenticated" : "guest");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
