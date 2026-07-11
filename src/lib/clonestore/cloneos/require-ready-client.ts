// src/lib/clonestore/cloneos/require-ready-client.ts
// P12 §12F — Gate serveur (à appeler EN TÊTE d'une PAGE cockpit). redirect() est fiable dans une
// page server component (307 pour la navigation document) ; il l'est moins dans un layout. N'affaiblit
// pas l'auth : ne fait que router selon l'état de readiness déjà résolu.
import { redirect } from "next/navigation";
import { resolveLandingTarget } from "./client-readiness";

/** Redirige si l'utilisateur courant n'est pas un client prêt (public / achat / setup). */
export async function requireReadyClient(): Promise<void> {
  const target = await resolveLandingTarget();
  if (target.kind !== "cockpit") redirect(target.route);
}
