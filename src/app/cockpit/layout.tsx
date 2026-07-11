// src/app/cockpit/layout.tsx
// P12 — Layout de la zone COCKPIT (console CloneOS). Gate de routage post-login SANS affaiblir
// l'auth : on résout la readiness réelle et on redirige les non-clients vers la bonne surface.
// Ne rend PAS l'AppShell classique — chaque page cockpit rend sa propre console CloneOsAppShell
// (fixed 100dvh, pas de scroll de page).

export const dynamic = "force-dynamic";

// Le gate de readiness est appliqué dans chaque PAGE cockpit (requireReadyClient) — redirect() y est
// fiable. Ce layout reste minimal (le shell est rendu par chaque page via CloneOsAppShell).
export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
