"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CreditCard,
  Loader2,
  LogIn,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { PresencePing } from "@/components/founder/PresencePing";
import { getSessionClient } from "@/lib/auth/session-client";
import { buildCheckoutAuthHeaders, sanitizeCheckoutError } from "@/lib/checkout/checkout-helpers";
import { cn } from "@/lib/utils";

type CheckoutAgent = {
  slug: string;
  name: string;
  role: string;
  price?: string;
  available: boolean;
  pageHref: string;
  description: string;
  bullets: string[];
};

const AGENTS: Record<string, CheckoutAgent> = {
  pierre: {
    slug: "pierre",
    name: "Pierre",
    role: "Poste RH opérationnel automatisé",
    price: "449€/mois",
    available: true,
    pageHref: "/agents/pierre",
    description:
      "Pierre automatise une large part du travail RH opérationnel : missions, documents, emails, relances, validations et traçabilité.",
    bullets: [
      "Mission RH libre",
      "Documents, emails et PDF",
      "Relances et continuité",
      "Validation humaine sur le sensible",
    ],
  },
  clara: {
    slug: "clara",
    name: "Clara",
    role: "Recrutement automatisé",
    available: false,
    pageHref: "/agents/clara",
    description:
      "Clara structurera les candidatures, les shortlists, les suivis et la coordination recrutement.",
    bullets: ["Bientôt disponible"],
  },
  emma: {
    slug: "emma",
    name: "Emma",
    role: "Support & communication",
    available: false,
    pageHref: "/agents/emma",
    description:
      "Emma prendra en charge les réponses, le suivi client, la continuité relationnelle et les escalades.",
    bullets: ["Bientôt disponible"],
  },
  adrien: {
    slug: "adrien",
    name: "Adrien",
    role: "Commandes & opérations",
    available: false,
    pageHref: "/agents/adrien",
    description:
      "Adrien suivra les commandes, les opérations, les priorités et les points bloquants.",
    bullets: ["Bientôt disponible"],
  },
};

function ActionButton({
  href,
  label,
  primary = false,
  icon,
}: {
  href: string;
  label: string;
  primary?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn("clone-liquid-button", primary && "clone-liquid-button--dark")}
    >
      <span>{label}</span>
      {icon}
    </Link>
  );
}

function GlassInfoCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <LiquidGlass
      variant="clear"
      intensity="soft"
      interactive
      className="h-full rounded-[2rem] p-5"
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2 text-[#6f83ff]">
          {icon}
          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{title}</p>
        </div>
        <p className="text-sm leading-6 text-[var(--cs-ink-3)]">{text}</p>
      </div>
    </LiquidGlass>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6f83ff]" />
          <span className="text-sm leading-6 text-[var(--cs-ink-3)]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CheckoutFallback() {
  return (
    <main className="cs-page">
      <div className="cs-page-shell">
        <LiquidGlass
          variant="panel"
          intensity="strong"
          refractive
          className="grid min-h-[520px] place-items-center rounded-[2.4rem] p-8"
        >
          <div className="flex items-center gap-3 text-sm font-semibold text-[var(--cs-ink-3)]">
            <Loader2 className="h-4 w-4 animate-spin text-[#6f83ff]" />
            Chargement du checkout…
          </div>
        </LiquidGlass>
      </div>
    </main>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();

  // ── Checkout target ──────────────────────────────────────────
  const rawSlug =
    searchParams.get("agent")?.toLowerCase() ??
    searchParams.get("agent_slug")?.toLowerCase() ??
    "pierre";
  const agent = useMemo(() => AGENTS[rawSlug] ?? AGENTS.pierre, [rawSlug]);

  // ── Session state ────────────────────────────────────────────
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // ── Access state ─────────────────────────────────────────────
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // ── Checkout state ───────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── On mount: check session then proactively check access ────
  useEffect(() => {
    async function init() {
      try {
        const { data } = await getSessionClient().auth.getSession();
        const token = data.session?.access_token ?? null;
        setSessionToken(token);
        setSessionChecked(true);

        if (token && agent.available) {
          setStatusLoading(true);
          try {
            const headers = buildCheckoutAuthHeaders(token);
            if (headers) {
              const res = await fetch(
                `/api/checkout?agent_slug=${encodeURIComponent(agent.slug)}`,
                { headers },
              );
              if (res.ok) {
                const status = (await res.json()) as { active?: boolean } | null;
                if (status?.active) setAlreadyActive(true);
              }
            }
          } catch {
            // status check is non-blocking
          } finally {
            setStatusLoading(false);
          }
        }
      } catch {
        setSessionChecked(true);
      }
    }

    void init();
  }, [agent.slug, agent.available]);

  // ── Handle checkout button click ──────────────────────────────
  async function handleCheckout() {
    if (!agent.available || isLoading) return;

    if (!sessionToken) {
      setError("Connexion requise pour continuer le paiement.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const headers = buildCheckoutAuthHeaders(sessionToken);
      if (!headers) {
        setError("Connexion requise pour continuer le paiement.");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({ agent_slug: agent.slug }),
      });

      const data = (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;

      // Already active — show cockpit CTA instead of redirecting to Stripe
      if (data?.already_active === true) {
        setAlreadyActive(true);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const code = typeof data?.code === "string" ? data.code : null;
        const rawError = typeof data?.error === "string" ? data.error : null;

        // Auth expired mid-flow — clear session, show auth gate
        if (code === "AUTH_REQUIRED" || code === "AUTH_INVALID") {
          setSessionToken(null);
          setIsLoading(false);
          return;
        }

        throw new Error(sanitizeCheckoutError(code, rawError));
      }

      const checkoutUrl =
        (data?.url as string | null | undefined) ??
        (data?.checkout_url as string | null | undefined) ??
        null;

      if (!checkoutUrl) {
        throw new Error("Aucune URL de paiement n'a été renvoyée.");
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de démarrer le paiement pour le moment.",
      );
      setIsLoading(false);
    }
  }

  // ── Render checkout action zone ──────────────────────────────
  function renderAction() {
    // Session check in progress
    if (!sessionChecked || statusLoading) {
      return (
        <button
          type="button"
          disabled
          className="clone-liquid-button clone-liquid-button--dark min-h-12 w-full pointer-events-none opacity-60"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Vérification…</span>
        </button>
      );
    }

    // Already active — direct cockpit access
    if (alreadyActive) {
      return (
        <div className="grid gap-3">
          <LiquidGlass
            variant="clear"
            intensity="soft"
            className="rounded-[1.5rem] border border-[rgba(21,130,96,0.22)] p-4"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--cs-success)]" />
              <p className="text-sm font-semibold text-[var(--cs-success)]">
                Pierre est déjà actif sur votre compte.
              </p>
            </div>
          </LiquidGlass>
          <ActionButton
            href="/agents/pierre/use"
            label="Accéder au cockpit Pierre"
            primary
            icon={<ArrowRight className="h-4 w-4" />}
          />
        </div>
      );
    }

    // Not authenticated — auth gate
    if (!sessionToken) {
      const loginHref = `/login?redirect=${encodeURIComponent(`/checkout?agent=${agent.slug}`)}`;
      return (
        <div className="grid gap-3">
          <LiquidGlass
            variant="clear"
            intensity="soft"
            className="rounded-[1.5rem] border border-[rgba(111,131,255,0.22)] p-4"
          >
            <p className="text-sm leading-6 text-[var(--cs-ink-3)]">
              Connectez-vous pour activer {agent.name} et continuer vers le paiement.
            </p>
          </LiquidGlass>
          <Link
            href={loginHref}
            className="clone-liquid-button clone-liquid-button--dark min-h-12 w-full"
          >
            <LogIn className="h-4 w-4" />
            <span>Se connecter pour continuer</span>
          </Link>
          <ActionButton
            href="/agents"
            label="Retour boutique"
            icon={<Sparkles className="h-4 w-4" />}
          />
        </div>
      );
    }

    // Agent not available for purchase
    if (!agent.available) {
      return (
        <div className="grid gap-3">
          <ActionButton
            href="/checkout?agent=pierre"
            label="Commencer avec Pierre"
            primary
            icon={<ArrowRight className="h-4 w-4" />}
          />
          <ActionButton
            href="/assistant"
            label="Demander conseil"
            icon={<Bot className="h-4 w-4" />}
          />
        </div>
      );
    }

    // Normal checkout flow
    return (
      <button
        type="button"
        onClick={() => { void handleCheckout(); }}
        disabled={isLoading}
        className={cn(
          "clone-liquid-button clone-liquid-button--dark min-h-12 w-full",
          isLoading && "pointer-events-none opacity-75",
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Redirection…</span>
          </>
        ) : (
          <>
            <span>Continuer vers le paiement</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    );
  }

  return (
    <main className="cs-page">
      <PresencePing event="founder_checkout_started" />
      <div className="cs-page-shell">
        <section className="grid min-h-[calc(100vh-170px)] items-center gap-6">
          <LiquidGlass
            variant="panel"
            intensity="strong"
            refractive
            className="overflow-hidden rounded-[2.6rem] p-6 md:p-8 xl:p-10"
          >
            <div className="grid gap-8 xl:grid-cols-[1fr_430px] xl:items-center">
              <div className="space-y-7">
                <div className="flex flex-wrap gap-2">
                  <span className="cs-pill">
                    <CreditCard className="h-3.5 w-3.5 text-[#6f83ff]" />
                    Paiement CloneStore
                  </span>
                  <span className="cs-pill">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                    Sécurisé, clair, premium
                  </span>
                </div>

                <div className="max-w-4xl space-y-5">
                  <h1 className="cs-heading text-[clamp(2.4rem,5vw,5.7rem)] leading-[0.94] tracking-[-0.065em]">
                    Activer{" "}
                    <span className="bg-[linear-gradient(135deg,#151922_0%,#2d3446_46%,#667cff_100%)] bg-clip-text text-transparent">
                      {agent.name}
                    </span>
                    .
                  </h1>

                  <p className="max-w-2xl text-[0.98rem] leading-8 text-[var(--cs-ink-3)]">
                    Confirmez l'employé IA à intégrer dans votre entreprise, puis
                    continuez vers le paiement sécurisé.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <GlassInfoCard
                    title="Employé IA"
                    text="Vous activez un poste automatisé, pas une simple fonctionnalité."
                    icon={<BriefcaseBusiness className="h-4 w-4" />}
                  />
                  <GlassInfoCard
                    title="Accès privé"
                    text="Après validation, l'accès continue vers votre espace CloneStore."
                    icon={<LockKeyhole className="h-4 w-4" />}
                  />
                  <GlassInfoCard
                    title="Suite guidée"
                    text="Configuration, cockpit et aide restent accessibles après paiement."
                    icon={<Waypoints className="h-4 w-4" />}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <ActionButton
                    href={agent.pageHref}
                    label={`Voir ${agent.name}`}
                    icon={<ArrowRight className="h-4 w-4" />}
                  />
                  <ActionButton
                    href="/agents"
                    label="Retour boutique"
                    icon={<Sparkles className="h-4 w-4" />}
                  />
                  <ActionButton
                    href="/assistant"
                    label="Demander à CloneStore"
                    icon={<Bot className="h-4 w-4" />}
                  />
                </div>
              </div>

              <LiquidGlass
                variant="clear"
                intensity="strong"
                refractive
                className="rounded-[2.35rem] p-5 md:p-6"
              >
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="cs-eyebrow">Résumé</p>
                      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--cs-ink-1)]">
                        {agent.name}
                      </h2>
                      <p className="mt-2 text-sm font-medium leading-6 text-[var(--cs-ink-3)]">
                        {agent.role}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "cs-status",
                        agent.available ? "cs-status--success" : "cs-status--warn",
                      )}
                    >
                      {agent.available ? "Disponible" : "À venir"}
                    </span>
                  </div>

                  <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(21,25,34,0.18),transparent)]" />

                  <p className="text-sm leading-7 text-[var(--cs-ink-3)]">
                    {agent.description}
                  </p>

                  <LiquidGlass
                    variant="clear"
                    intensity="soft"
                    className="rounded-[1.8rem] p-5"
                  >
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--cs-ink-4)]">
                        Tarif
                      </p>

                      {agent.price ? (
                        <div className="flex flex-wrap items-end gap-2">
                          <span className="text-4xl font-semibold tracking-[-0.06em] text-[var(--cs-ink-1)]">
                            {agent.price}
                          </span>
                          <span className="pb-1 text-xs font-medium text-[var(--cs-ink-4)]">
                            prix fondateur
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-[var(--cs-ink-3)]">
                          Tarif à venir.
                        </p>
                      )}
                    </div>
                  </LiquidGlass>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                      Inclus
                    </p>
                    <BulletList items={agent.bullets} />
                  </div>

                  {error ? (
                    <LiquidGlass
                      variant="clear"
                      intensity="soft"
                      className="rounded-[1.5rem] border border-[rgba(184,74,74,0.22)] p-4"
                    >
                      <p className="text-sm leading-6 text-[var(--cs-danger)]">{error}</p>
                    </LiquidGlass>
                  ) : null}

                  {renderAction()}

                  <p className="text-center text-xs leading-5 text-[var(--cs-ink-4)]">
                    En continuant, vous acceptez les{" "}
                    <Link href="/legal/cgv" className="underline hover:text-[var(--cs-ink-2)]">
                      CGV
                    </Link>{" "}
                    et la{" "}
                    <Link href="/legal/confidentialite" className="underline hover:text-[var(--cs-ink-2)]">
                      politique de confidentialité
                    </Link>
                    .
                  </p>
                </div>
              </LiquidGlass>
            </div>
          </LiquidGlass>
        </section>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutContent />
    </Suspense>
  );
}
