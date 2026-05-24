// src/lib/auth/useRequireAuth.ts
// B31.5 — Private route guard. Redirects to /login?redirect=<path> if no session.
// Use on pages that require authentication (cockpit, profile).
// The AuthGate in PierreCockpitShell handles mid-session token expiry separately.

"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildLoginRedirect } from "./redirects";
import { getSessionClient } from "./session-client";

export function useRequireAuth(): void {
  const router = useRouter();
  const pathname = usePathname();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    void getSessionClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!data.session) {
          router.push(buildLoginRedirect(pathname ?? "/"));
        }
      })
      .catch(() => {
        router.push(buildLoginRedirect(pathname ?? "/"));
      });
  }, [router, pathname]);
}
