"use client";

import Link from "next/link";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  FileCheck2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { getSessionClient } from "@/lib/auth/session-client";
import { buildCheckoutAuthHeaders } from "@/lib/checkout/checkout-helpers";
import { cn } from "@/lib/utils";

type ActivationState = "checking" | "active" | "pending" | "unauthenticated";

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

function StepCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <LiquidGlass variant="clear" intensity="soft" interactive className="rounded-[2rem] p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/60 bg-white/35 text-[#6f83ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--cs-ink-3)]">{text}</p>
        </div>
      </div>
    </LiquidGlass>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const agent = searchParams.get("agent") ?? "pierre";
  const sessionId = searchParams.get("session_id") ?? null;

  const [activationState, setActivationState] = useState<ActivationState>("checking");
  const [retryCount, setRetryCount] = useState(0);
  // Prevent concurrent calls
  const checkingRef = useRef(false);

  async function runConfirmThenCheck(headers: Record<string, string>) {
    // Step 1 — if we have a session_id, call confirm to activate via Stripe server-side
    if (sessionId) {
      try {
        const confirmRes = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers,
          body: JSON.stringify({ session_id: sessionId, agent_slug: agent }),
        });
        // confirm returns { ok, activated, status } — we proceed regardless to status check
        const confirmBody = (await confirmRes.json().catch(() => null)) as {
          ok?: boolean;
          activated?: boolean;
          status?: string;
        } | null;

        // If confirm already says active/trialing, we can short-circuit
        if (
          confirmBody?.ok === true &&
          confirmBody.activated === true &&
          (confirmBody.status === "active" || confirmBody.status === "trialing")
        ) {
          setActivationState("active");
          return;
        }
      } catch {
        // confirm failure is non-blocking — fall through to status check
      }
    }

    // Step 2 — check orders status directly
    try {
      const res = await fetch(
        `/api/checkout?agent_slug=${encodeURIComponent(agent)}`,
        { headers }
      );
      if (!res.ok) {
        setActivationState("pending");
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        active?: boolean;
      } | null;
      setActivationState(body?.active === true ? "active" : "pending");
    } catch {
      setActivationState("pending");
    }
  }

  async function checkActivation() {
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const { data } = await getSessionClient().auth.getSession();
      const token = data.session?.access_token ?? null;

      if (!token) {
        setActivationState("unauthenticated");
        return;
      }

      const headers = buildCheckoutAuthHeaders(token);
      if (!headers) {
        setActivationState("unauthenticated");
        return;
      }

      await runConfirmThenCheck(headers);
    } catch {
      setActivationState("pending");
    } finally {
      checkingRef.current = false;
    }
  }

  // Initial check on mount
  useEffect(() => {
    void checkActivation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-retry up to 2× after 3s if still pending
  useEffect(() => {
    if (activationState !== "pending" || retryCount >= 2) return;
    const timer = setTimeout(() => {
      setRetryCount((c) => c + 1);
      void checkActivation();
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activationState, retryCount]);

  const isActive = activationState === "active";

  return (
    <main className="cs-page">
      <div className="cs-page-shell">
        <section className="grid min-h-[calc(100vh-170px)] items-center">
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
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                    Paiement confirmé
                  </span>
                  <span className="cs-pill">
                    <Sparkles className="h-3.5 w-3.5 text-[#6f83ff]" />
                    Bienvenue dans CloneStore
                  </span>
                </div>

                <div className="max-w-4xl space-y-5">
                  <h1 className="cs-heading text-[clamp(2.4rem,5vw,5.5rem)] leading-[0.94] tracking-[-0.065em]">
                    {isActive ? (
                      <>
                        Activation confirmée.
                        <br />
                        <span className="bg-[linear-gradient(135deg,#151922_0%,#2d3446_46%,#667cff_100%)] bg-clip-text text-transparent">
                          Pierre est prêt.
                        </span>
                      </>
                    ) : (
                      <>
                        Paiement reçu.
                        <br />
                        <span className="bg-[linear-gradient(135deg,#151922_0%,#2d3446_46%,#667cff_100%)] bg-clip-text text-transparent">
                          Activation en cours.
                        </span>
                      </>
                    )}
                  </h1>

                  <p className="max-w-2xl text-[0.98rem] leading-8 text-[var(--cs-ink-3)]">
                    {isActive
                      ? "L'accès est validé. Configurez votre espace, retrouvez vos employés IA, puis entrez dans le cockpit."
                      : "Le paiement a bien été reçu. L'activation peut prendre quelques secondes après la confirmation Stripe."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {isActive ? (
                    <>
                      <ActionButton
                        href="/agents/pierre/use"
                        label="Accéder à Pierre"
                        primary
                        icon={<ArrowRight className="h-4 w-4" />}
                      />
                      <ActionButton
                        href="/agents/pierre/setup"
                        label="Configurer Pierre"
                        icon={<Waypoints className="h-4 w-4" />}
                      />
                      <ActionButton
                        href="/profile"
                        label="Mon CloneStore"
                        icon={<Bot className="h-4 w-4" />}
                      />
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRetryCount(0);
                          setActivationState("checking");
                          void checkActivation();
                        }}
                        className="clone-liquid-button clone-liquid-button--dark"
                      >
                        <span>Vérifier l'activation</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <ActionButton
                        href="/profile"
                        label="Mon CloneStore"
                        icon={<Bot className="h-4 w-4" />}
                      />
                    </>
                  )}
                </div>
              </div>

              <LiquidGlass
                variant="clear"
                intensity="strong"
                refractive
                className="rounded-[2.35rem] p-5 md:p-6"
              >
                <div className="space-y-4">
                  {activationState === "checking" ? (
                    <div className="flex min-h-[280px] items-center justify-center">
                      <div className="flex items-center gap-3 text-[var(--cs-ink-3)]">
                        <Loader2 className="h-5 w-5 animate-spin text-[#667cff]" />
                        <span className="text-sm font-medium">Vérification de l'activation…</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <StepCard
                        title={isActive ? "Accès confirmé" : "Paiement accepté"}
                        text={
                          isActive
                            ? "Votre accès Pierre est actif."
                            : "Votre paiement est validé. L'activation peut prendre quelques secondes."
                        }
                        icon={
                          isActive ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )
                        }
                      />
                      <StepCard
                        title="Empreinte Entreprise"
                        text="Configurez Pierre avec votre identité, vos règles RH, vos valideurs et votre ton — en quelques minutes."
                        icon={<FileCheck2 className="h-4 w-4" />}
                      />
                      <StepCard
                        title="Cockpit"
                        text="Votre espace central vous permettra de piloter vos employés IA."
                        icon={<Waypoints className="h-4 w-4" />}
                      />
                      <StepCard
                        title="Contrôle"
                        text="Les actions sensibles restent encadrées, visibles et validables."
                        icon={<ShieldCheck className="h-4 w-4" />}
                      />

                      {activationState === "pending" && retryCount >= 2 ? (
                        <LiquidGlass
                          variant="clear"
                          intensity="soft"
                          className="rounded-[1.5rem] border border-[rgba(111,131,255,0.22)] p-4"
                        >
                          <p className="text-sm leading-6 text-[var(--cs-ink-3)]">
                            L'activation est en cours de traitement. Si elle n'apparaît pas dans quelques minutes,
                            contactez le support CloneStore depuis Mon CloneStore.
                          </p>
                        </LiquidGlass>
                      ) : null}

                      <div className="pt-2">
                        {isActive ? (
                          <ActionButton
                            href="/agents/pierre/use"
                            label="Accéder à Pierre"
                            primary
                            icon={<ArrowRight className="h-4 w-4" />}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setRetryCount(0);
                              setActivationState("checking");
                              void checkActivation();
                            }}
                            className="clone-liquid-button clone-liquid-button--dark w-full"
                          >
                            <span>Vérifier l'activation</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </LiquidGlass>
            </div>
          </LiquidGlass>
        </section>
      </div>
    </main>
  );
}

export default function PaiementSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="cs-page">
          <div className="cs-page-shell flex min-h-[60vh] items-center justify-center">
            <div className="flex items-center gap-3 text-[var(--cs-ink-3)]">
              <Loader2 className="h-5 w-5 animate-spin text-[#667cff]" />
              <span className="text-sm font-medium">Chargement…</span>
            </div>
          </div>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
