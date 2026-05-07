import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  LockKeyhole,
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

function PaymentCard() {
  return (
    <LiquidGlass
      variant="clear"
      intensity="strong"
      refractive
      className="rounded-[2.35rem] p-5 md:p-6"
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="cs-eyebrow">EmployÃ© IA</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--cs-ink-1)]">
              Pierre
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[var(--cs-ink-3)]">
              Poste RH opÃ©rationnel automatisÃ©
            </p>
          </div>

          <span className="cs-status cs-status--success">Disponible</span>
        </div>

        <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(21,25,34,0.18),transparent)]" />

        <LiquidGlass
          variant="clear"
          intensity="soft"
          className="rounded-[1.8rem] p-5"
        >
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--cs-ink-4)]">
              Tarif
            </p>

            <div className="flex flex-wrap items-end gap-2">
              <span className="text-4xl font-semibold tracking-[-0.06em] text-[var(--cs-ink-1)]">
                449â‚¬/mois
              </span>
              <span className="pb-1 text-xs font-medium text-[var(--cs-ink-4)]">
                prix fondateur
              </span>
            </div>
          </div>
        </LiquidGlass>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
            Inclus
          </p>
          <BulletList
            items={[
              "Mission RH libre",
              "Documents, emails et PDF",
              "Relances, suivi et continuitÃ©",
              "Historique et traÃ§abilitÃ©",
              "Validation humaine sur le sensible",
            ]}
          />
        </div>

        <ActionButton
          href="/checkout?agent=pierre"
          label="Continuer vers le paiement"
          primary
          icon={<ArrowRight className="h-4 w-4" />}
        />
      </div>
    </LiquidGlass>
  );
}

export default function PaiementPage() {
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
                    <CreditCard className="h-3.5 w-3.5 text-[#6f83ff]" />
                    Paiement CloneStore
                  </span>
                  <span className="cs-pill">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                    Activation sÃ©curisÃ©e
                  </span>
                </div>

                <div className="max-w-4xl space-y-5">
                  <h1 className="cs-heading text-[clamp(2.4rem,5vw,5.7rem)] leading-[0.94] tracking-[-0.065em]">
                    Activez votre premier
                    <br />
                    <span className="bg-[linear-gradient(135deg,#151922_0%,#2d3446_46%,#667cff_100%)] bg-clip-text text-transparent">
                      employÃ© IA.
                    </span>
                  </h1>

                  <p className="max-w-2xl text-[0.98rem] leading-8 text-[var(--cs-ink-3)]">
                    CloneStore commence avec Pierre : un poste RH automatisÃ©,
                    pilotable depuis le site, avec rÃ¨gles, continuitÃ© et traÃ§abilitÃ©.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <ActionButton
                    href="/checkout?agent=pierre"
                    label="Commencer avec Pierre"
                    primary
                    icon={<ArrowRight className="h-4 w-4" />}
                  />
                  <ActionButton
                    href="/agents/pierre"
                    label="Voir Pierre"
                    icon={<BriefcaseBusiness className="h-4 w-4" />}
                  />
                  <ActionButton
                    href="/assistant"
                    label="Demander Ã  CloneStore"
                    icon={<Bot className="h-4 w-4" />}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniCard
                    title="Prix clair"
                    text="Une offre lisible, sans parcours compliquÃ©."
                    icon={<CreditCard className="h-4 w-4" />}
                  />
                  <MiniCard
                    title="Poste activÃ©"
                    text="Vous activez un employÃ© IA opÃ©rationnel."
                    icon={<BriefcaseBusiness className="h-4 w-4" />}
                  />
                  <MiniCard
                    title="AccÃ¨s privÃ©"
                    text="Le paiement ouvre la suite vers lâ€™espace client."
                    icon={<LockKeyhole className="h-4 w-4" />}
                  />
                  <MiniCard
                    title="SystÃ¨me"
                    text="CloneOS, Trace et Guard encadrent lâ€™expÃ©rience."
                    icon={<FileCheck2 className="h-4 w-4" />}
                  />
                </div>
              </div>

              <PaymentCard />
            </div>
          </LiquidGlass>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <LiquidGlass
              variant="clear"
              intensity="soft"
              className="rounded-[2rem] p-5 md:p-6"
            >
              <div className="flex items-start gap-4">
                <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[#6f83ff]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                    AprÃ¨s paiement
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--cs-ink-3)]">
                    Vous Ãªtes redirigÃ© vers la confirmation, puis vers la
                    configuration et le cockpit CloneStore.
                  </p>
                </div>
              </div>
            </LiquidGlass>

            <LiquidGlass
              variant="clear"
              intensity="soft"
              className="rounded-[2rem] p-5 md:p-6"
            >
              <div className="flex items-start gap-4">
                <Waypoints className="mt-1 h-5 w-5 shrink-0 text-[#6f83ff]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                    Besoin dâ€™aide ?
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--cs-ink-3)]">
                    CloneStore peut vous orienter avant lâ€™activation si vous
                    hÃ©sitez sur le bon employÃ© IA.
                  </p>
                </div>
              </div>
            </LiquidGlass>
          </div>
        </section>
      </div>
    </main>
  );
}