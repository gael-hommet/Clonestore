import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CreditCard,
  Eye,
  ShieldCheck,
  Sparkles,
  Undo2,
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

function MiniCard({
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

export default function PaiementCancelPage() {
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
                    <Undo2 className="h-3.5 w-3.5 text-[var(--cs-danger)]" />
                    Paiement annulé
                  </span>
                  <span className="cs-pill">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                    Aucune action facturée
                  </span>
                </div>

                <div className="max-w-4xl space-y-5">
                  <h1 className="cs-heading text-[clamp(2.4rem,5vw,5.5rem)] leading-[0.94] tracking-[-0.065em]">
                    Paiement annulé.
                    <br />
                    <span className="bg-[linear-gradient(135deg,#151922_0%,#2d3446_46%,#667cff_100%)] bg-clip-text text-transparent">
                      Vous pouvez reprendre quand vous voulez.
                    </span>
                  </h1>

                  <p className="max-w-2xl text-[0.98rem] leading-8 text-[var(--cs-ink-3)]">
                    Votre activation n’a pas été finalisée. Vous pouvez revenir à la
                    boutique, reprendre le checkout ou demander de l’aide à CloneStore.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <ActionButton
                    href="/checkout?agent=pierre"
                    label="Reprendre le paiement"
                    primary
                    icon={<ArrowRight className="h-4 w-4" />}
                  />
                  <ActionButton
                    href="/demo/pierre"
                    label="Voir la démo Pierre"
                    icon={<Eye className="h-4 w-4" />}
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
                <div className="space-y-4">
                  <MiniCard
                    title="Rien n’est perdu"
                    text="Votre compte et votre navigation restent inchangés."
                    icon={<ShieldCheck className="h-4 w-4" />}
                  />
                  <MiniCard
                    title="Paiement non finalisé"
                    text="Aucune activation n’est confirmée tant que le paiement n’est pas validé."
                    icon={<CreditCard className="h-4 w-4" />}
                  />
                  <MiniCard
                    title="Aide disponible"
                    text="CloneStore peut vous orienter avant de reprendre le checkout."
                    icon={<Bot className="h-4 w-4" />}
                  />

                  <div className="pt-2">
                    <ActionButton
                      href="/checkout?agent=pierre"
                      label="Reprendre maintenant"
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