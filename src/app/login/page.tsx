"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import { getSessionClient } from "@/lib/auth/session-client";
import { resolvePostLoginRedirect } from "@/lib/auth/login-helpers";
import { cn } from "@/lib/utils";

type LoginMode = "password" | "magic";

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

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition",
        active
          ? "border-white/70 bg-white/58 text-[var(--cs-ink-1)] shadow-[0_14px_36px_rgba(38,32,22,0.08)]"
          : "border-white/40 bg-white/24 text-[var(--cs-ink-3)] hover:bg-white/42 hover:text-[var(--cs-ink-1)]"
      )}
    >
      {label}
    </button>
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

function getPostLoginPath(): string {
  if (typeof window === "undefined") return resolvePostLoginRedirect(null);
  const params = new URLSearchParams(window.location.search);
  return resolvePostLoginRedirect(params.get("redirect"));
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSessionClient() as SupabaseClient | null, []);

  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!email.trim()) return false;
    if (mode === "password" && !password.trim()) return false;
    return !isLoading;
  }, [email, password, mode, isLoading]);

  async function handlePasswordLogin() {
    if (!supabase) {
      setError(
        "Configuration Supabase manquante. Vérifie les variables d’environnement puis redémarre le projet."
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      router.push(getPostLoginPath());
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de se connecter pour le moment."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!supabase) {
      setError(
        "Configuration Supabase manquante. Vérifie les variables d’environnement puis redémarre le projet."
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const postLoginPath = getPostLoginPath();
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}${postLoginPath}` : undefined;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (otpError) throw otpError;

      setSuccess("Lien envoyé. Ouvre ton email pour entrer dans CloneStore.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’envoyer le lien magique pour le moment."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    if (mode === "password") {
      await handlePasswordLogin();
      return;
    }

    await handleMagicLink();
  }

  return (
    <main className="cs-page">
      <div className="cs-page-shell py-8 md:py-12">
        <section className="liquid-glass liquid-glass--panel liquid-glass--strong liquid-glass--refractive overflow-hidden rounded-[2.4rem] p-5 md:p-7 xl:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.72),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(111,131,255,0.10),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(216,193,152,0.15),transparent_36%)]" />

          <div className="relative grid gap-7 xl:grid-cols-[0.92fr_0.72fr] xl:items-center">
            <div className="min-w-0 space-y-7">
              <div className="flex flex-wrap gap-2">
                <GlassBadge
                  icon={<UserRound className="h-3.5 w-3.5" />}
                  label="Connexion CloneStore"
                />
                <GlassBadge
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label="Accès sécurisé"
                  tone="green"
                />
              </div>

              <div data-tour-id="client-space-entry" className="max-w-3xl">
                <h1 className="cs-heading text-[clamp(2.6rem,5.2vw,5.8rem)] leading-[0.94] tracking-[-0.07em]">
                  Entrez dans
                  <br />
                  <span className="cs-gradient-text">votre cockpit.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-[0.98rem] leading-8 text-[var(--cs-ink-3)]">
                  Connectez-vous pour retrouver vos employés IA, vos missions, vos
                  validations et votre espace de pilotage CloneStore.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <GlassLink
                  href="/signup"
                  label="Créer un compte"
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
                  icon={<Sparkles className="h-4 w-4" />}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  "Cockpit privé",
                  "Employés IA",
                  "Missions & validations",
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
                  <p className="cs-eyebrow">Accès client</p>
                  <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.06em] text-[var(--cs-ink-1)]">
                    Connexion
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                    Choisissez votre méthode d’accès.
                  </p>
                </div>

                <div className="liquid-glass liquid-glass--clear liquid-glass--soft flex flex-wrap gap-2 rounded-full p-1.5">
                  <ModeButton
                    active={mode === "password"}
                    label="Mot de passe"
                    onClick={() => {
                      setMode("password");
                      setError(null);
                      setSuccess(null);
                    }}
                  />
                  <ModeButton
                    active={mode === "magic"}
                    label="Lien magique"
                    onClick={() => {
                      setMode("magic");
                      setError(null);
                      setSuccess(null);
                    }}
                  />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Field
                    label="Adresse email"
                    icon={<Mail className="h-4 w-4" />}
                    value={email}
                    onChange={setEmail}
                    placeholder="vous@entreprise.com"
                    autoComplete="email"
                    type="email"
                  />

                  {mode === "password" ? (
                    <Field
                      label="Mot de passe"
                      icon={<KeyRound className="h-4 w-4" />}
                      value={password}
                      onChange={setPassword}
                      placeholder="Votre mot de passe"
                      autoComplete="current-password"
                      type="password"
                    />
                  ) : (
                    <div className="liquid-glass liquid-glass--clear liquid-glass--soft rounded-[1.45rem] p-4">
                      <div className="flex gap-3">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#6f83ff]" />
                        <p className="text-sm leading-6 text-[var(--cs-ink-3)]">
                          Un lien de connexion sera envoyé directement à cette adresse.
                        </p>
                      </div>
                    </div>
                  )}

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
                        <span>Connexion…</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {mode === "password"
                            ? "Entrer dans CloneStore"
                            : "Envoyer le lien"}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/42 pt-4">
                  <p className="text-sm text-[var(--cs-ink-4)]">Pas encore de compte ?</p>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cs-ink-1)] transition hover:opacity-70"
                  >
                    Créer un compte
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}