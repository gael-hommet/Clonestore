"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  Waypoints,
} from "lucide-react";

import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function GlassLink({
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
      className={cn(
        "clone-liquid-button",
        primary && "clone-liquid-button--dark"
      )}
    >
      <span>{label}</span>
      {icon}
    </Link>
  );
}

function GlassBadge({
  icon,
  label,
  tone = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "blue" | "green";
}) {
  return (
    <span className="cs-pill">
      <span
        className={cn(
          "inline-flex",
          tone === "blue" ? "text-[#6f83ff]" : "text-[var(--cs-success)]"
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}

function Field({
  label,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-[var(--cs-ink-2)]">{label}</span>

      <div className="liquid-glass liquid-glass--clear liquid-glass--soft flex min-h-[52px] items-center gap-3 rounded-[1.35rem] px-4">
        <span className="text-[#6f83ff]">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full border-0 bg-transparent text-sm font-medium text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)]"
        />
      </div>
    </label>
  );
}

function CheckItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]",
          ok ? "bg-[var(--cs-success)] text-[var(--cs-success)]" : "bg-black/15 text-black/15"
        )}
      />
      <span className={ok ? "text-[var(--cs-ink-2)]" : "text-[var(--cs-ink-4)]"}>
        {text}
      </span>
    </div>
  );
}

function AlertBox({
  type,
  children,
}: {
  type: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.25rem] border px-4 py-3 text-sm font-medium leading-6",
        type === "success"
          ? "border-[rgba(21,130,96,0.18)] bg-[rgba(21,130,96,0.08)] text-[var(--cs-success)]"
          : "border-[rgba(184,74,74,0.18)] bg-[rgba(184,74,74,0.08)] text-[var(--cs-danger)]"
      )}
    >
      {children}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      upper: /\p{Lu}/u.test(password),
      lower: /[a-zÃƒ -ÃƒÂ¶ÃƒÂ¸-ÃƒÂ¿]/.test(password),
      number: /\d/.test(password),
      match: password.length > 0 && password === confirmPassword,
    }),
    [password, confirmPassword]
  );

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length > 0 &&
      email.trim().length > 0 &&
      passwordChecks.length &&
      passwordChecks.upper &&
      passwordChecks.lower &&
      passwordChecks.number &&
      passwordChecks.match &&
      !isLoading
    );
  }, [fullName, email, passwordChecks, isLoading]);

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    if (!supabase) {
      setError(
        "Configuration Supabase manquante. VÃƒÂ©rifie les variables dÃ¢â‚¬â„¢environnement puis redÃƒÂ©marre le projet."
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/profile` : undefined;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName.trim(),
            company_name: companyName.trim() || null,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        router.push("/profile");
        router.refresh();
        return;
      }

      setSuccess("Compte crÃƒÂ©ÃƒÂ©. VÃƒÂ©rifie ton email pour confirmer ton accÃƒÂ¨s.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de crÃƒÂ©er le compte pour le moment."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="cs-page">
      <div className="cs-page-shell py-8 md:py-12">
        <section className="liquid-glass liquid-glass--panel liquid-glass--strong liquid-glass--refractive overflow-hidden rounded-[2.4rem] p-5 md:p-7 xl:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(255,255,255,0.72),transparent_30%),radial-gradient(circle_at_86%_14%,rgba(111,131,255,0.10),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(216,193,152,0.15),transparent_36%)]" />

          <div className="relative grid gap-7 xl:grid-cols-[0.92fr_0.72fr] xl:items-center">
            <div className="min-w-0 space-y-7">
              <div className="flex flex-wrap gap-2">
                <GlassBadge
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label="CrÃƒÂ©ation de compte"
                />
                <GlassBadge
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label="EntrÃƒÂ©e sÃƒÂ©curisÃƒÂ©e"
                  tone="green"
                />
              </div>

              <div className="max-w-3xl">
                <h1 className="cs-heading text-[clamp(2.6rem,5.2vw,5.8rem)] leading-[0.94] tracking-[-0.07em]">
                  CrÃƒÂ©ez votre
                  <br />
                  <span className="cs-gradient-text">espace CloneStore.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-[0.98rem] leading-8 text-[var(--cs-ink-3)]">
                  Un compte vous donne accÃƒÂ¨s au cockpit, aux employÃƒÂ©s IA activÃƒÂ©s,
                  aux configurations et au pilotage de votre systÃƒÂ¨me.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <GlassLink
                  href="/login"
                  label="DÃƒÂ©jÃƒ  un compte ?"
                  primary
                  icon={<ArrowRight className="h-4 w-4" />}
                />
                <GlassLink
                  href="/assistant"
                  label="Ouvrir CloneChat"
                  icon={<Bot className="h-4 w-4" />}
                />
                <GlassLink
                  href="/agents"
                  label="Voir la boutique"
                  icon={<BriefcaseBusiness className="h-4 w-4" />}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  "Compte entreprise",
                  "Cockpit privÃƒÂ©",
                  "EmployÃƒÂ©s IA activables",
                ].map((item) => (
                  <div
                    key={item}
                    className="liquid-glass liquid-glass--clear liquid-glass--soft rounded-[1.45rem] px-4 py-4"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#6f83ff]" />
                      <span className="text-sm font-semibold text-[var(--cs-ink-1)]">
                        {item}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="liquid-glass liquid-glass--panel liquid-glass--strong rounded-[2rem] p-5 md:p-6">
              <div className="space-y-6">
                <div>
                  <p className="cs-eyebrow">Nouveau compte</p>
                  <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.06em] text-[var(--cs-ink-1)]">
                    Inscription
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                    Quelques informations suffisent pour crÃƒÂ©er lÃ¢â‚¬â„¢accÃƒÂ¨s.
                  </p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                  <Field
                    label="Nom complet"
                    icon={<UserRound className="h-4 w-4" />}
                    value={fullName}
                    onChange={setFullName}
                    placeholder="PrÃƒÂ©nom Nom"
                    autoComplete="name"
                  />

                  <Field
                    label="Entreprise"
                    icon={<Building2 className="h-4 w-4" />}
                    value={companyName}
                    onChange={setCompanyName}
                    placeholder="Nom de votre entreprise"
                    autoComplete="organization"
                  />

                  <Field
                    label="Adresse email"
                    icon={<Mail className="h-4 w-4" />}
                    value={email}
                    onChange={setEmail}
                    placeholder="vous@entreprise.com"
                    autoComplete="email"
                    type="email"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Mot de passe"
                      icon={<Lock className="h-4 w-4" />}
                      value={password}
                      onChange={setPassword}
                      placeholder="Mot de passe"
                      autoComplete="new-password"
                      type="password"
                    />

                    <Field
                      label="Confirmation"
                      icon={<Lock className="h-4 w-4" />}
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Confirmer"
                      autoComplete="new-password"
                      type="password"
                    />
                  </div>

                  <div className="liquid-glass liquid-glass--clear liquid-glass--soft rounded-[1.45rem] p-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <CheckItem ok={passwordChecks.length} text="8 caractÃƒÂ¨res minimum" />
                      <CheckItem ok={passwordChecks.upper} text="Une majuscule" />
                      <CheckItem ok={passwordChecks.lower} text="Une minuscule" />
                      <CheckItem ok={passwordChecks.number} text="Un chiffre" />
                      <CheckItem ok={passwordChecks.match} text="Confirmation identique" />
                    </div>
                  </div>

                  {error ? <AlertBox type="error">{error}</AlertBox> : null}
                  {success ? <AlertBox type="success">{success}</AlertBox> : null}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={cn(
                      "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-all duration-[var(--cs-speed-fast)] ease-[var(--cs-ease)]",
                      canSubmit
                        ? "border-[rgba(30,34,44,0.10)] bg-[linear-gradient(135deg,#20242d,#303645_62%,#667cff)] text-white shadow-[0_18px_52px_rgba(45,56,128,0.22)] hover:-translate-y-0.5"
                        : "border-white/44 bg-white/32 text-[var(--cs-ink-4)] opacity-70"
                    )}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>CrÃƒÂ©ationÃ¢â‚¬Â¦</span>
                      </>
                    ) : (
                      <>
                        <span>CrÃƒÂ©er mon compte</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/42 pt-4">
                  <p className="text-sm text-[var(--cs-ink-4)]">Vous avez dÃƒÂ©jÃƒ  un compte ?</p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cs-ink-1)] transition hover:opacity-70"
                  >
                    Se connecter
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Cockpit",
              text: "LÃ¢â‚¬â„¢espace principal aprÃƒÂ¨s connexion.",
              icon: <Waypoints className="h-4 w-4" />,
            },
            {
              title: "EmployÃƒÂ©s IA",
              text: "Activation et accÃƒÂ¨s aux postes automatisÃƒÂ©s.",
              icon: <BriefcaseBusiness className="h-4 w-4" />,
            },
            {
              title: "Aide",
              text: "CloneStore reste disponible en cas de question.",
              icon: <Bot className="h-4 w-4" />,
            },
          ].map((item) => (
            <div
              key={item.title}
              className="liquid-glass liquid-glass--clear liquid-glass--soft rounded-[1.7rem] p-5"
            >
              <div className="flex items-center gap-2 text-[#6f83ff]">
                {item.icon}
                <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                  {item.title}
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--cs-ink-3)]">
                {item.text}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
