import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export interface LockAction {
  label: string;
  href: string;
  primary?: boolean;
}

export interface AccessLockScreenProps {
  /** Petit label au-dessus du titre. */
  eyebrow?: string;
  /** Titre principal (promesse claire). */
  title: string;
  /** Explication courte. */
  description: string;
  /** Points expliquant ce qui débloque l'accès (optionnel). */
  bullets?: string[];
  /** Actions / CTA (la première primary mène vers la bonne suite). */
  actions: LockAction[];
  icon?: ReactNode;
}

/**
 * Écran verrouillé / « bientôt disponible » PREMIUM et COMMERCIAL.
 * Composant serveur pur (aucun hook) : utilisable dans un layout serveur
 * (blocage CloneChat) comme dans une page connectée (cockpit / messagerie sans
 * employé actif). Ce n'est jamais une erreur, une page vide ou un toast :
 * c'est une expérience propre qui explique pourquoi et où aller ensuite.
 */
export default function AccessLockScreen({
  eyebrow,
  title,
  description,
  bullets,
  actions,
  icon,
}: AccessLockScreenProps) {
  return (
    <main className="cs-page">
      <div className="cs-page-shell py-10 md:py-16">
        <section className="cs-command-surface overflow-hidden">
          <div className="cs-system-halo" />

          <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--cs-line)] bg-white/55 text-[var(--cs-violet)] shadow-[var(--cs-shadow-soft)] backdrop-blur-xl">
              {icon ?? <Lock className="h-6 w-6" />}
            </span>

            {eyebrow ? (
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--cs-ink-4)]">
                {eyebrow}
              </p>
            ) : null}

            <h1 className="cs-heading mt-3 text-[clamp(1.9rem,4.4vw,3.2rem)] leading-[1.04]">
              {title}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
              {description}
            </p>

            {bullets && bullets.length > 0 ? (
              <ul className="mt-6 grid w-full gap-2.5 text-left sm:grid-cols-2">
                {bullets.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 rounded-2xl border border-[var(--cs-line-soft)] bg-white/40 px-4 py-3 text-sm text-[var(--cs-ink-3)] backdrop-blur-xl"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-violet)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-8 flex w-full flex-wrap items-center justify-center gap-3">
              {actions.map((action) => (
                <Link
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  className={[
                    "clone-liquid-button min-h-11 px-5 text-sm",
                    action.primary ? "clone-liquid-button--dark" : "",
                  ].join(" ")}
                >
                  <span>{action.label}</span>
                  {action.primary ? <ArrowRight className="h-4 w-4" /> : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
