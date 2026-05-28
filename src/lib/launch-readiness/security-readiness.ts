// B48 — Security Readiness
// Checks security posture for public launch.
// Pure: no Supabase, no Next, no async. No throw.

import type { LaunchReadinessCheck } from "./types";

export function getSecurityReadinessChecks(): LaunchReadinessCheck[] {
  return [
    {
      id: "SEC_RLS_PRODUCTION",
      surface: "security",
      label: "RLS Supabase activé en production",
      description: "Row Level Security doit être activé et testé sur toutes les tables utilisateur.",
      status: "blocked",
      severity: "critical",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: true,
      notes: "Non vérifié — requis avant lancement public.",
      remediation: "Activer RLS sur chaque table. Tester avec un utilisateur non-admin. Documenter les politiques.",
    },
    {
      id: "SEC_SERVICE_ROLE_KEY_SERVER_ONLY",
      surface: "security",
      label: "SUPABASE_SERVICE_ROLE_KEY côté serveur uniquement",
      description: "La clé service role ne doit jamais être exposée côté client ou dans les bundles Next.js.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Clé définie en variable serveur sans préfixe NEXT_PUBLIC_.",
      remediation: "S'assurer que SUPABASE_SERVICE_ROLE_KEY n'est jamais importé dans du code client.",
    },
    {
      id: "SEC_STRIPE_KEYS_ENV",
      surface: "security",
      label: "Clés Stripe dans variables d'environnement",
      description: "STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET ne doivent jamais être hardcodées.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Clés lues depuis process.env.",
      remediation: "Vérifier qu'aucune clé Stripe n'est committée dans le code.",
    },
    {
      id: "SEC_NO_USER_DATA_LOGS",
      surface: "security",
      label: "Pas de données utilisateur dans les logs",
      description: "Les logs de production ne doivent pas contenir de données personnelles (noms, emails, salaires).",
      status: "ready_with_warnings",
      severity: "warning",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "À vérifier manuellement lors de l'audit sécurité.",
      remediation: "Passer en revue les logs Supabase et les console.log en production.",
    },
    {
      id: "SEC_HEADERS",
      surface: "security",
      label: "Headers de sécurité HTTP configurés",
      description: "CSP, X-Frame-Options, HSTS, X-Content-Type-Options doivent être configurés.",
      status: "ready_with_warnings",
      severity: "warning",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "À configurer dans next.config.js headers.",
      remediation: "Ajouter les headers de sécurité dans la configuration Next.js.",
    },
    {
      id: "SEC_INPUT_VALIDATION",
      surface: "security",
      label: "Validation des inputs côté serveur",
      description: "Tous les endpoints API valident les inputs avant traitement.",
      status: "ready",
      severity: "blocking",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Routes B47/B48 implémentent validation systématique.",
      remediation: null,
    },
    {
      id: "SEC_NO_COMMAND_INJECTION",
      surface: "security",
      label: "Pas d'injection de commande / SQL injection",
      description: "Les requêtes Supabase utilisent des paramètres typés, pas de string interpolation.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Supabase SDK utilisé avec paramètres typés.",
      remediation: null,
    },
  ];
}

export function getSecurityBlockers(): LaunchReadinessCheck[] {
  return getSecurityReadinessChecks().filter(
    (c) => c.blocking_public_launch && c.status !== "ready"
  );
}

export function isSecurityLaunchBlocked(): boolean {
  return getSecurityBlockers().length > 0;
}
