// src/lib/auth/useAuthGate.ts
// B31.6 — Enhanced auth guard hook.
// Exposes authState for skeleton rendering. Redirects when unauthenticated.
// Use on private pages that benefit from a loading skeleton (profile/agents, etc.).
// For simple redirect-only protection, use useRequireAuth instead.

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildLoginRedirect } from "./redirects";
import { getSessionClient } from "./session-client";
import { isAuthBypassEnabled } from "./dev-bypass";

export type AuthGateState = "checking" | "authenticated" | "unauthenticated";

export function useAuthGate(): { authState: AuthGateState } {
  const router = useRouter();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<AuthGateState>("checking");
  const redirectedRef = useRef(false);

  useEffect(() => {
    // Dev/test uniquement (mort en production) : considérer authentifié.
    if (isAuthBypassEnabled()) {
      setAuthState("authenticated");
      return;
    }

    void getSessionClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) {
          setAuthState("authenticated");
        } else {
          setAuthState("unauthenticated");
          if (!redirectedRef.current) {
            redirectedRef.current = true;
            router.push(buildLoginRedirect(pathname ?? "/"));
          }
        }
      })
      .catch(() => {
        setAuthState("unauthenticated");
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          router.push(buildLoginRedirect(pathname ?? "/"));
        }
      });
    // pathname and router are stable references, safe to include
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { authState };
}
