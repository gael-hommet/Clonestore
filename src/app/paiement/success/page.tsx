import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { cn } from "@/lib/utils";

function ActionButton({
  href,
  label,
  primary = false,
  icon,
}: {
  href: string;
  label: string;
  primary?: boolean;
  icon?: React.ReactNode;
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
  icon: React.ReactNode;
}) {
  return (
    <LiquidGlass
      variant="clear"
      intensity="soft"
      interactive
      className="rounded-[2rem] p-5"
    >
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

export default function PaiementSuccessPage() {
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
                    Paiement confirmÃ©
                  </span>
                  <span className="cs-pill">
                    <Sparkles className="h-3.5 w-3.5 text-[#6f83ff]" />
                    Bienvenue dans CloneStore
                  </span>
                </div>

                <div className="max-w-4xl space-y-5">
                  <h1 className="cs-heading text-[clamp(2.4rem,5vw,5.5rem)] leading-[0.94] tracking-[-0.065em]">
                    Activation confirmÃ©e.
                    <br />
                    <span className="bg-[linear-gradient(135deg,#151922_0%,#2d3446_46%,#667cff_100%)] bg-clip-text text-transparent">
                      Votre espace peut Ãªtre configurÃ©.
                    </span>
                  </h1>

                  <p className="max-w-2xl text-[0.98rem] leading-8 text-[var(--cs-ink-3)]">
                    Lâ€™accÃ¨s est validÃ©. La suite logique : configurer votre espace,
                    retrouver vos employÃ©s IA, puis entrer dans le cockpit.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <ActionButton
                    href="/cockpit"
                    label="Entrer dans le cockpit"
                    primary
                    icon={<ArrowRight className="h-4 w-4" />}
                  />
                  <ActionButton
                    href="/agents/pierre/setup"
                    label="Configurer Pierre"
                    icon={<Waypoints className="h-4 w-4" />}
                  />
                  <ActionButton
                    href="/assistant"
                    label="Demander Ã  CloneStore"
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
                <div className="space-y-4">
                  <StepCard
                    title="Paiement acceptÃ©"
                    text="Votre activation CloneStore est confirmÃ©e."
                    icon={<CheckCircle2 className="h-4 w-4" />}
                  />
                  <StepCard
                    title="Configuration"
                    text="Pierre peut maintenant Ãªtre prÃ©parÃ© avec vos rÃ¨gles, votre entreprise et vos usages."
                    icon={<FileCheck2 className="h-4 w-4" />}
                  />
                  <StepCard
                    title="Cockpit"
                    text="Votre espace central vous permettra de piloter vos employÃ©s IA."
                    icon={<Waypoints className="h-4 w-4" />}
                  />
                  <StepCard
                    title="ContrÃ´le"
                    text="Les actions sensibles restent encadrÃ©es, visibles et validables."
                    icon={<ShieldCheck className="h-4 w-4" />}
                  />

                  <div className="pt-2">
                    <ActionButton
                      href="/cockpit"
                      label="Continuer"
                      primary
                      icon={<ArrowRight className="h-4 w-4" />}
                    />
                  </div>
                </div>
              </LiquidGlass>
            </div>
          </LiquidGlass>
        </section>
      </div>
    </main>
  );
}