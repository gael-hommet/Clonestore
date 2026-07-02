"use client";

// My CloneStore — Home officielle (P9.2, Étape 1).
//
// Accueil de l'espace client authentifié. Affiche UNIQUEMENT des données réelles
// (chemin V0 session : Supabase auth + tables `profiles`/`orders`) + l'onboarding
// local (GlobalOnboardingDraft). Aucune donnée fictive, aucun JSON brut, aucun
// bouton mort. Les états verrouillés (paiement/activation/suspendu/sans employé)
// sont rendus par la garde de layout existante (AccessLockScreen) ; cette page
// couvre l'expérience du client authentifié (démarrage, employés, entreprise,
// compte). Le shell « Mon CloneStore » est fourni par le layout.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CreditCard,
  Fingerprint,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { getSessionClient } from "@/lib/auth/session-client";
import { useRequireAuth } from "@/lib/auth/useRequireAuth";
import { PIERRE_PUBLIC } from "@/lib/catalog/public-catalog";
import {
  ProfileActionLink,
  ProfileEmptyState,
  ProfileErrorBanner,
  ProfileQuickLink,
  ProfileSection,
  ProfileStatCard,
} from "./_ui/profile-primitives";
// CloneStory (univers séparé) — carte « Mon espace partenaire » auto-portée
// (self-fetch, sans prop). Préservée depuis CS-FINAL 1 : rendue dans la home
// « Mon espace », jamais une page parallèle. Aucune logique CloneStory modifiée.
import CloneStoryCockpitCard from "./_ui/CloneStoryCockpitCard";
import {
  resolveCockpitAccess,
  resolveNextAction,
  summarizeOwnedEmployee,
  type CockpitAccessResult,
  type NextAction,
} from "@/lib/my-clonestore";
import {
  buildFootprintSections,
  footprintOverall,
  isFootprintSufficient,
  isQuickStartComplete,
  loadFootprintInputs,
  loadQuickStart,
  quickStartProgress,
} from "@/lib/client-onboarding";

type OrderRow = { id: string; agent_slug: string; status: string };
type ProfileRow = { id: string; email: string | null; full_name: string | null };
type LoadState = "loading" | "ready" | "error" | "unauthenticated";

function statusChipTone(state: CockpitAccessResult["decision"]): string {
  if (state === "ready") return "cs-status cs-status--success";
  if (state === "entitlement_pending" || state === "onboarding_required" || state === "account_incomplete")
    return "cs-status cs-status--info";
  if (state === "entitlement_inactive") return "cs-status cs-status--warn";
  return "cs-status";
}

export default function MyCloneStorePage() {
  useRequireAuth();

  const supabase = useMemo<SupabaseClient | null>(() => getSessionClient(), []);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Onboarding local (client-authoritative ; reprise même navigateur).
  const [companyName, setCompanyName] = useState<string>("");
  const [quickStartDone, setQuickStartDone] = useState(false);
  const [quickProgress, setQuickProgress] = useState(0);
  const [footprintPct, setFootprintPct] = useState(0);
  const [footprintSufficient, setFootprintSufficient] = useState(false);

  const readLocalOnboarding = useCallback(() => {
    const qs = loadQuickStart();
    const sections = buildFootprintSections(loadFootprintInputs());
    setCompanyName(qs.companyName.trim());
    setQuickStartDone(isQuickStartComplete(qs));
    setQuickProgress(quickStartProgress(qs));
    setFootprintPct(footprintOverall(sections));
    setFootprintSufficient(isFootprintSufficient(sections));
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoadState("loading");
      setErrorMessage(null);

      readLocalOnboarding();

      if (!supabase) {
        setErrorMessage(
          "Configuration Supabase manquante. Vérifiez les variables publiques puis relancez le projet.",
        );
        setLoadState("error");
        setRefreshing(false);
        return;
      }
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          setLoadState("unauthenticated");
          setRefreshing(false);
          return;
        }
        const uid = authData.user.id;
        setEmail(authData.user.email ?? null);
        const [profileResult, ordersResult] = await Promise.all([
          supabase.from("profiles").select("id, email, full_name").eq("id", uid).maybeSingle(),
          supabase.from("orders").select("id, agent_slug, status").eq("user_id", uid),
        ]);
        if (!profileResult.error && profileResult.data) setProfile(profileResult.data as ProfileRow);
        if (ordersResult.error) throw ordersResult.error;
        setOrders((ordersResult.data ?? []) as OrderRow[]);
        setLoadState("ready");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Impossible de charger Mon CloneStore pour le moment.",
        );
        setLoadState("error");
      } finally {
        setRefreshing(false);
      }
    },
    [supabase, readLocalOnboarding],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Employé possédé (réel) + accès cockpit (machine pure).
  const owned = useMemo(() => summarizeOwnedEmployee(orders, PIERRE_PUBLIC.slug), [orders]);
  const cockpit: CockpitAccessResult = useMemo(
    () =>
      resolveCockpitAccess(
        {
          authenticated: loadState === "ready",
          operationalState: owned.operationalState,
          ownsEmployee: owned.ownsEmployee,
          companyIdentityComplete: quickStartDone || companyName.length > 0,
          onboardingSufficient: footprintSufficient,
          routeAvailable: true,
        },
        { employeeLabel: PIERRE_PUBLIC.name },
      ),
    [loadState, owned, quickStartDone, companyName, footprintSufficient],
  );
  const nextAction: NextAction = useMemo(
    () =>
      resolveNextAction({
        quickStartComplete: quickStartDone,
        quickStartProgress: quickProgress,
        footprintCompletion: footprintPct,
      }),
    [quickStartDone, quickProgress, footprintPct],
  );

  const displayName = profile?.full_name?.trim() || email?.split("@")[0] || "votre entreprise";
  const companyLabel = companyName || "Votre entreprise";
  const footprintPercent = Math.round(footprintPct * 100);
  const progressPercent = Math.round(nextAction.progress * 100);

  // ── États non-nominaux ─────────────────────────────────────────────────────
  if (loadState === "loading") {
    return (
      <main className="cs-page">
        <div className="cs-page-shell">
          <div className="flex min-h-[40vh] items-center justify-center gap-3 text-[var(--cs-ink-3)]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Chargement de Mon CloneStore…</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="cs-page">
      <div className="cs-page-shell space-y-6">
        {/* ── En-tête ── */}
        <section
          data-tour-id="mycs-header"
          className="cs-panel relative overflow-hidden p-6 md:p-7"
        >
          <div className="cs-system-halo" aria-hidden="true" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="cs-eyebrow">Mon CloneStore</p>
              <h1 className="cs-heading text-[clamp(1.9rem,3.4vw,3rem)] leading-[1.02]">
                Bonjour, {displayName}.
              </h1>
              <p className="max-w-2xl text-[0.95rem] leading-7 text-[var(--cs-ink-3)]">
                Votre espace pour piloter vos employés IA, l'empreinte de votre entreprise et votre compte.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className={statusChipTone(cockpit.decision)}>{cockpit.title}</span>
                {email ? <span className="cs-status">{email}</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ProfileActionLink href={nextAction.cta.href} label={nextAction.cta.label} primary />
              <button
                type="button"
                onClick={() => void load(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--cs-line-soft)] bg-white/60 px-4 text-[0.86rem] font-medium text-[var(--cs-ink-2)] transition hover:bg-white/88"
                aria-label="Rafraîchir"
              >
                <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                <span className="hidden sm:inline">Rafraîchir</span>
              </button>
            </div>
          </div>
        </section>

        {loadState === "error" && errorMessage ? <ProfileErrorBanner message={errorMessage} /> : null}
        {loadState === "unauthenticated" ? (
          <ProfileErrorBanner message="Votre session a expiré. Reconnectez-vous pour retrouver votre espace." />
        ) : null}

        {/* ── Démarrage ── */}
        <ProfileSection
          title="Démarrage"
          description="Votre prochaine action pour avancer avec CloneStore."
          className="scroll-mt-24"
        >
          <div data-tour-id="mycs-startup" className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="cs-card cs-card-tight">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.96rem] font-semibold text-[var(--cs-ink-1)]">{nextAction.title}</p>
                  {nextAction.estimatedTime ? (
                    <span className="cs-status">{nextAction.estimatedTime}</span>
                  ) : null}
                </div>
                <p className="text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">{nextAction.description}</p>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-[rgba(24,29,39,0.08)]"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progression du démarrage"
                >
                  <div
                    className="h-full rounded-full bg-[var(--cs-violet)] transition-[width] duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[0.8rem] text-[var(--cs-ink-4)]">{progressPercent}% du démarrage</span>
                  <ProfileActionLink href={nextAction.cta.href} label={nextAction.cta.label} primary />
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <ProfileStatCard
                title="Quick Start"
                value={quickStartDone ? "Terminé" : `${Math.round(quickProgress * 100)}%`}
                helper="Identité minimale de l'entreprise."
                icon={<Sparkles className="h-4 w-4" />}
                tone={quickStartDone ? "success" : "violet"}
              />
              <ProfileStatCard
                title="Empreinte"
                value={`${footprintPercent}%`}
                helper="Contexte confié à Pierre."
                icon={<Fingerprint className="h-4 w-4" />}
                tone={footprintSufficient ? "success" : "blue"}
              />
            </div>
          </div>
        </ProfileSection>

        {/* ── Mes employés IA ── */}
        <ProfileSection
          title="Mes employés IA"
          description="Les employés IA réellement rattachés à votre compte."
        >
          <div data-tour-id="mycs-employees" className="space-y-3">
            {owned.ownsEmployee ? (
              <div className="cs-card cs-card-tight">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">{PIERRE_PUBLIC.name}</p>
                      <span className={statusChipTone(cockpit.decision)}>{cockpit.title}</span>
                    </div>
                    <p className="text-[0.85rem] leading-6 text-[var(--cs-ink-3)]">{PIERRE_PUBLIC.role}</p>
                    <p className="text-[0.82rem] leading-6 text-[var(--cs-ink-4)]">{cockpit.message}</p>
                  </div>
                  <div data-tour-id="mycs-cockpit" className="shrink-0">
                    {cockpit.canOpen ? (
                      <ProfileActionLink
                        href={cockpit.cta.href}
                        label={cockpit.cta.label}
                        primary
                        icon={<Waypoints className="h-4 w-4" />}
                      />
                    ) : (
                      <ProfileActionLink
                        href={cockpit.cta.href}
                        label={cockpit.cta.label}
                        icon={<LockKeyhole className="h-4 w-4" />}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <ProfileEmptyState
                title="Aucun employé IA actif pour le moment"
                text={cockpit.message}
                actions={
                  <ProfileActionLink href={cockpit.cta.href} label={cockpit.cta.label} primary />
                }
              />
            )}

            <ProfileQuickLink
              href="/agents"
              title="Découvrir d'autres employés IA"
              text="D'autres métiers arriveront progressivement. Aujourd'hui, Pierre est l'employé opérationnel ouvert."
              badge={<span className="cs-status">Boutique</span>}
            />
          </div>
        </ProfileSection>

        {/* ── Mon entreprise ── */}
        <ProfileSection
          title="Mon entreprise"
          description="L'empreinte que CloneStore connaît de votre entreprise."
          right={<ProfileActionLink href="/profile/onboarding" label="Compléter l'empreinte" />}
        >
          <div data-tour-id="mycs-company" className="grid gap-4 md:grid-cols-3">
            <ProfileStatCard
              title="Entreprise"
              value={companyLabel}
              helper={companyName ? "Identité renseignée." : "À renseigner au démarrage."}
              icon={<Building2 className="h-4 w-4" />}
              tone={companyName ? "success" : "default"}
            />
            <ProfileStatCard
              title="Complétude"
              value={`${footprintPercent}%`}
              helper={footprintSufficient ? "Suffisant pour Pierre." : "Enrichissez pour plus de justesse."}
              icon={<ShieldCheck className="h-4 w-4" />}
              tone={footprintSufficient ? "success" : "violet"}
            />
            <ProfileStatCard
              title="À confirmer"
              value={"—"}
              helper="Les propositions à valider apparaîtront dans l'empreinte."
              icon={<Fingerprint className="h-4 w-4" />}
              tone="default"
            />
          </div>
        </ProfileSection>

        {/* ── Le Cercle des partenaires fondateurs (CloneStory, univers séparé) ── */}
        {/* Carte auto-portée : gère elle-même non-membre (honnête) / partenaire vérifié. */}
        <CloneStoryCockpitCard />

        {/* ── Compte ── */}
        <ProfileSection title="Compte" description="Raccourcis réellement disponibles.">
          <div data-tour-id="mycs-account" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileQuickLink href="/profile/agents" title="Mes employés" text="Vue détaillée de vos employés IA." />
            <ProfileQuickLink href="/profile/onboarding" title="Empreinte entreprise" text="Quick Start, empreinte guidée et continue." />
            <ProfileQuickLink href="/agents" title="Facturation & offres" text="Gérer votre accès et découvrir la boutique." badge={<CreditCard className="h-4 w-4 text-[var(--cs-ink-4)]" />} />
            <ProfileQuickLink href="/questions" title="Support" text="Une question ? L'équipe CloneStore répond." badge={<BriefcaseBusiness className="h-4 w-4 text-[var(--cs-ink-4)]" />} />
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[0.84rem] font-medium text-[var(--cs-ink-4)] transition hover:text-[var(--cs-ink-1)]"
            >
              Retour au site
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </ProfileSection>
      </div>
    </main>
  );
}
