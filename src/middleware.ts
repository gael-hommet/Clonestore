// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // Founder Command Center — route RÉELLEMENT dynamique : /internal/[slug]/command-center.
  // §G — Garde du slug AU BORD : en rendu dynamique streamé, un notFound() dans la page
  // arrive après l'envoi des en-têtes (200). On rejette donc un mauvais slug ici pour
  // émettre un VRAI statut HTTP 404, avant tout rendu. On ne 404 QUE si le slug est
  // configuré et différent (le bon slug passe ; porte/session/allowlist restent gérées
  // par la page, fail-closed). Aucun secret n'est révélé.
  const cockpit = request.nextUrl.pathname.match(/^\/internal\/([^/]+)\/command-center(?:\/[a-z-]+)?\/?$/);
  if (cockpit) {
    const expectedSlug = process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
    if (expectedSlug && cockpit[1] !== expectedSlug) {
      return new NextResponse(null, { status: 404 });
    }
  }

  // La validation porte propriétaire + session + allowlist est faite par la page serveur
  // (fail-closed). L'ancien chemin statique a été supprimé : il renvoie 404.
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: any[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session cookie if needed. getSession() reads from cookie (~0ms when fresh,
  // ~200ms only when JWT is expired and refresh token is used). getUser() would make
  // a network call on every request — not needed here since API routes validate tokens.
  const { data: { session } } = await supabase.auth.getSession();

  // P12 — Gate CONNECTÉ fiable au bord (redirect() serveur n'est pas fiable en RSC streamé) :
  // l'espace CloneOS (/cockpit, /mon-clonestore) exige une session. Le routage fin
  // client/onboarding (achat/setup) est fait ensuite (page server + garde client). N'affaiblit
  // pas l'auth : redirige seulement les requêtes SANS session vers /login (avec ?next=).
  const path = request.nextUrl.pathname;
  const isCloneOsSpace = path === "/cockpit" || path.startsWith("/cockpit/") || path === "/mon-clonestore" || path.startsWith("/mon-clonestore/");
  if (isCloneOsSpace && !session) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};