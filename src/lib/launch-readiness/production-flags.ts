// B48 — Production Flags
// Manual verification flags required before public launch.
// Pure: no Supabase, no Next, no async. No throw.

import type { ManualVerificationFlags } from "./types";

export type ProductionFlag = {
  key: keyof ManualVerificationFlags;
  label: string;
  description: string;
  blocking_public_launch: boolean;
  surface: string;
  remediation: string;
};

const PRODUCTION_FLAGS: ProductionFlag[] = [
  {
    key: "cgu_cgu_validated",
    label: "CGU/CGV rédigées et validées",
    description: "Conditions générales d'utilisation et de vente rédigées, vérifiées par conseil juridique, et publiées.",
    blocking_public_launch: true,
    surface: "legal",
    remediation: "Rédiger CGU/CGV avec conseil juridique. Publier sur /legal/cgu et /legal/cgv.",
  },
  {
    key: "privacy_policy_validated",
    label: "Politique de confidentialité RGPD validée",
    description: "Politique de confidentialité complète conforme RGPD, validée et publiée.",
    blocking_public_launch: true,
    surface: "rgpd",
    remediation: "Compléter /legal/confidentialite. Mentionner DPO, sous-traitants, durées de rétention.",
  },
  {
    key: "legal_review_done",
    label: "Revue juridique humaine effectuée",
    description: "Un juriste ou avocat a relu les guardrails B47, les claims commerciales, et les limitations de responsabilité.",
    blocking_public_launch: true,
    surface: "legal",
    remediation: "Faire relire B47_FINAL_LEGAL_REVIEW_CHECKLIST.md par un conseil juridique.",
  },
  {
    key: "rls_production_verified",
    label: "RLS Supabase vérifié en production",
    description: "Row Level Security activé et testé sur toutes les tables contenant des données utilisateur en environnement de production.",
    blocking_public_launch: true,
    surface: "security",
    remediation: "Appliquer les politiques RLS. Tester avec utilisateur non-admin. Vérifier chaque table.",
  },
  {
    key: "stripe_production_configured",
    label: "Stripe production configuré",
    description: "Clés Stripe live (sk_live_*) configurées. Webhook production enregistré. Prix live créé.",
    blocking_public_launch: true,
    surface: "billing",
    remediation: "Remplacer clés test par clés live. Enregistrer webhook sur dashboard.stripe.com. Créer price ID live.",
  },
  {
    key: "domain_dns_configured",
    label: "Domaine et DNS configurés",
    description: "Domaine de production pointant vers le déploiement. SSL actif. NEXT_PUBLIC_APP_URL défini.",
    blocking_public_launch: false,
    surface: "operations",
    remediation: "Configurer DNS. Vérifier SSL. Définir NEXT_PUBLIC_APP_URL en production.",
  },
  {
    key: "smtp_production_configured",
    label: "SMTP/Resend production configuré",
    description: "Clé Resend production configurée. Domaine d'envoi vérifié. Adresse 'from' professionnelle.",
    blocking_public_launch: false,
    surface: "email",
    remediation: "Configurer RESEND_API_KEY en production. Vérifier le domaine d'envoi sur resend.com.",
  },
  {
    key: "rgpd_dpa_prepared",
    label: "DPA / accord sous-traitance préparé",
    description: "Data Processing Agreement préparé pour les clients B2B qui traitent des données de salariés via Pierre.",
    blocking_public_launch: false,
    surface: "rgpd",
    remediation: "Rédiger DPA template. Le proposer aux clients B2B avant collecte de données.",
  },
  {
    key: "security_audit_done",
    label: "Audit sécurité initial effectué",
    description: "Revue des endpoints publics, des règles RLS, et des permissions Supabase par un profil sécurité.",
    blocking_public_launch: false,
    surface: "security",
    remediation: "Passer en revue tous les endpoints API. Tester l'accès non-authentifié. Vérifier les headers sécurité.",
  },
];

export function getAllProductionFlags(): ProductionFlag[] {
  return [...PRODUCTION_FLAGS];
}

export function getBlockingProductionFlags(): ProductionFlag[] {
  return PRODUCTION_FLAGS.filter((f) => f.blocking_public_launch);
}

export function getNonBlockingProductionFlags(): ProductionFlag[] {
  return PRODUCTION_FLAGS.filter((f) => !f.blocking_public_launch);
}

export function getDefaultManualFlags(): ManualVerificationFlags {
  return {
    cgu_cgu_validated: false,
    privacy_policy_validated: false,
    legal_review_done: false,
    rls_production_verified: false,
    stripe_production_configured: false,
    domain_dns_configured: false,
    smtp_production_configured: false,
    rgpd_dpa_prepared: false,
    security_audit_done: false,
  };
}

export function evaluateManualFlags(flags: ManualVerificationFlags): {
  blocking_unverified: string[];
  non_blocking_unverified: string[];
  all_blocking_done: boolean;
  all_done: boolean;
} {
  const blocking_unverified: string[] = [];
  const non_blocking_unverified: string[] = [];

  for (const flag of PRODUCTION_FLAGS) {
    const verified = flags[flag.key] === true;
    if (!verified) {
      if (flag.blocking_public_launch) {
        blocking_unverified.push(flag.label);
      } else {
        non_blocking_unverified.push(flag.label);
      }
    }
  }

  return {
    blocking_unverified,
    non_blocking_unverified,
    all_blocking_done: blocking_unverified.length === 0,
    all_done: blocking_unverified.length === 0 && non_blocking_unverified.length === 0,
  };
}
