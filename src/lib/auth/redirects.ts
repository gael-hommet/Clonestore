// src/lib/auth/redirects.ts
// B31.5 — Auth redirect helpers. Pure functions, no side effects.

export function getDefaultPostLoginPath(): string {
  return "/profile/agents";
}

export function buildLoginRedirect(path: string): string {
  if (!path || path === "/") return "/login";
  return `/login?redirect=${encodeURIComponent(path)}`;
}

export function isPrivatePath(path: string): boolean {
  const privatePaths = [
    "/agents/pierre/use",
    "/profile",
    "/profile/agents",
    "/profile/messages",
  ];
  return privatePaths.some((p) => path === p || path.startsWith(`${p}/`));
}
