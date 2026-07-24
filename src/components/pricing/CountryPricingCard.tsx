"use client";

// P10 §8 — Carte de tarification par pays (surface publique). Le prix EXACT est résolu CÔTÉ
// SERVEUR (/api/pricing/public) : FR/BE/LU → 449 € / mois ; CH → 499 CHF / mois ; pays inconnu →
// sélection requise (aucun prix par défaut). Copie honnête : pas de « disponible dans le monde
// entier », aucune promesse fiscale/TVA. Mobile-safe (pas de débordement horizontal).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface PublicPricing {
  enabled: boolean;
  resolvedCountry: string | null;
  confidence: string;
  supported: boolean;
  requiresCountrySelection: boolean;
  price: { amount: number; currency: string; display: string } | null;
  countries: { code: string; label: string }[];
  catalog: { group: string; countries: string[]; display: string; amount: number; currency: string }[];
  message: string;
}

export function CountryPricingCard({ className }: { className?: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<PublicPricing | null>(null);
  const [loading, setLoading] = useState(true);
  // PAYMENT PATH CLOSURE (2026-07-24) — CTA_SUISSE_MORT (audit ISSUE-02) : ce bouton n'avait
  // aucun gestionnaire de clic. Un visiteur suisse sélectionnant CH voyait un CTA actif « 499
  // CHF/mois » sans aucun effet au clic. `navigating` protège contre le double-clic pendant la
  // navigation vers /checkout (le pays exact reste porté dans l'URL — jamais de bascule EUR
  // silencieuse : le serveur revalide toujours ce pays dans /api/checkout).
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (country: string | null) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pricing/public${country ? `?country=${encodeURIComponent(country)}` : ""}`, { headers: { accept: "application/json" } });
      const json = (await res.json()) as PublicPricing;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(selected); }, [selected, load]);

  const countries = data?.countries ?? [{ code: "FR", label: "France" }, { code: "BE", label: "Belgique" }, { code: "LU", label: "Luxembourg" }, { code: "CH", label: "Suisse" }];
  const needsSelection = data?.requiresCountrySelection ?? true;
  const price = data?.price ?? null;
  const canCheckout = !!price && !needsSelection && (data?.supported ?? false);

  const handleChoosePierre = useCallback(() => {
    if (navigating) return; // anti double-clic
    if (!canCheckout || !data?.resolvedCountry) {
      setError("Sélectionnez votre pays de facturation avant de continuer.");
      return;
    }
    setError(null);
    setNavigating(true);
    try {
      // Le pays choisi voyage dans l'URL vers /checkout, qui le transmet à /api/checkout — le
      // serveur reste seul autoritatif (re-résolution + garde pays/devise, jamais de confiance
      // au client). CH ne peut jamais atterrir silencieusement sur l'offre EUR : si la
      // re-résolution serveur diverge, /checkout affiche l'erreur retournée, il ne bascule jamais.
      router.push(`/checkout?agent=pierre&country=${encodeURIComponent(data.resolvedCountry)}`);
    } catch {
      setNavigating(false);
      setError("Impossible de continuer vers le paiement pour le moment. Réessayez.");
    }
  }, [canCheckout, navigating, data?.resolvedCountry, router]);

  return (
    <section
      data-testid="country-pricing-card"
      data-pricing-enabled={data?.enabled ? "true" : "false"}
      data-pricing-country={data?.resolvedCountry ?? ""}
      data-pricing-requires-selection={needsSelection ? "true" : "false"}
      className={cn("cs-card w-full max-w-full overflow-hidden p-5 md:p-6", className)}
    >
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <p className="cs-eyebrow">Pierre — employé IA RH</p>
          <h3 className="text-[1.1rem] font-semibold tracking-[-0.02em] text-[var(--cs-ink-1)]">Tarif de lancement</h3>
        </div>

        {/* Grille des offres de lancement (toujours honnête sur les deux devises). */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-[1rem] border border-[var(--cs-line-soft)] bg-white/40 px-4 py-3">
            <p className="text-[0.78rem] text-[var(--cs-ink-3)]">France, Belgique, Luxembourg</p>
            <p className="text-[1.05rem] font-semibold text-[var(--cs-ink-1)]" data-testid="offer-eur">449 € / mois</p>
          </div>
          <div className="rounded-[1rem] border border-[var(--cs-line-soft)] bg-white/40 px-4 py-3">
            <p className="text-[0.78rem] text-[var(--cs-ink-3)]">Suisse</p>
            <p className="text-[1.05rem] font-semibold text-[var(--cs-ink-1)]" data-testid="offer-chf">499 CHF / mois</p>
          </div>
        </div>

        {/* Sélecteur de pays de facturation. */}
        <div>
          <p className="mb-2 text-[0.82rem] font-medium text-[var(--cs-ink-2)]">Votre pays de facturation</p>
          <div role="radiogroup" aria-label="Pays de facturation" className="flex flex-wrap gap-2" data-testid="country-selector">
            {countries.map((c) => (
              <button
                key={c.code}
                type="button"
                role="radio"
                aria-checked={data?.resolvedCountry === c.code}
                data-pricing-country-option={c.code}
                onClick={() => setSelected(c.code)}
                className={cn(
                  "rounded-full border px-4 py-2 text-[0.84rem] font-medium transition",
                  data?.resolvedCountry === c.code
                    ? "border-[var(--cs-violet)] bg-white text-[var(--cs-violet)] shadow-[var(--cs-shadow-soft)]"
                    : "border-[var(--cs-line-soft)] bg-white/50 text-[var(--cs-ink-3)] hover:text-[var(--cs-ink-1)]",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* État de prix résolu / message honnête. */}
        <div aria-live="polite" data-testid="pricing-state">
          {loading ? (
            <p className="text-[0.86rem] text-[var(--cs-ink-3)]">Chargement du tarif…</p>
          ) : price && !needsSelection ? (
            <p className="text-[1.35rem] font-semibold tracking-[-0.02em] text-[var(--cs-ink-1)]" data-testid="pricing-price">{price.display}</p>
          ) : data && !data.supported && data.resolvedCountry ? (
            <p className="text-[0.9rem] leading-6 text-[var(--cs-warn)]" data-testid="pricing-unsupported">
              Ce pays n'est pas encore ouvert au lancement. Contactez-nous pour être recontacté.
            </p>
          ) : (
            <p className="text-[0.9rem] leading-6 text-[var(--cs-ink-2)]" data-testid="pricing-select-prompt">
              Choisissez votre pays de facturation pour afficher le prix exact.
            </p>
          )}
          {price && needsSelection ? (
            <p className="mt-1 text-[0.78rem] text-[var(--cs-ink-4)]">Prix suggéré — confirmez votre pays pour continuer.</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleChoosePierre}
            disabled={!canCheckout || navigating}
            aria-busy={navigating}
            data-testid="pricing-cta"
            className={cn(
              "cs-liquid-button cs-liquid-button--primary w-full justify-center",
              (!canCheckout || navigating) && "pointer-events-none opacity-50",
            )}
          >
            {navigating ? "Redirection…" : canCheckout ? `Choisir Pierre — ${price?.display}` : "Sélectionnez votre pays"}
          </button>
          {error ? (
            <p className="text-[0.78rem] text-[var(--cs-danger)]" data-testid="pricing-cta-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="text-[0.72rem] leading-5 text-[var(--cs-ink-4)]">
            Prix HT, hors taxes applicables. Le pays de facturation est revérifié au paiement.
          </p>
        </div>
      </div>
    </section>
  );
}
