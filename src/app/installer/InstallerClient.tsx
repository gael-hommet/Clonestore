"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Download,
  Share,
  Plus,
  Check,
  Smartphone,
  Monitor,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Maximize2,
  Home,
  Zap,
  WifiOff,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { usePwaContext, IosInstallSheet } from "@/components/pwa";
import { PWA_COPY } from "@/lib/pwa/constants";

/**
 * Surface « Installer CloneStore » — état d'installation, appareil détecté, instructions,
 * avantages RÉELS, confidentialité, hors connexion honnête, mises à jour, désinstallation.
 * Ne promet que ce qui existe : pas d'offline complet, pas de push, pas de background sync.
 */
export function InstallerClient() {
  const pwa = usePwaContext();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  // Réouverture volontaire du mini-onboarding (« réouvrable depuis les paramètres »).
  const [guideOpen, setGuideOpen] = useState(false);

  const onInstall = useCallback(async () => {
    if (!pwa) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await pwa.promptInstall();
      setResult(
        r === "accepted"
          ? "Installation lancée — retrouvez CloneStore sur votre écran d'accueil."
          : r === "dismissed"
            ? "Installation reportée. Vous pourrez réessayer à tout moment."
            : "L'installation directe n'est pas disponible dans ce navigateur.",
      );
    } finally {
      setBusy(false);
    }
  }, [pwa]);

  const platform = pwa?.info.platform ?? "other";
  const isStandalone = pwa?.isStandalone ?? false;
  const isInstalled = pwa?.isInstalled ?? false;
  const canPromptNative = pwa?.canPromptNative ?? false;
  const deviceLabel = pwa?.deviceLabel ?? "Détection en cours…";
  const isIosSafari = pwa?.info.isIosSafari ?? false;

  const stateLabel = isStandalone
    ? "Lancée en application"
    : isInstalled
      ? "Installée"
      : "Non installée";

  return (
    <main className="mx-auto w-full max-w-[46rem] px-4 pb-16 pt-8 sm:pt-12">
      {/* Hero */}
      <header className="text-center">
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-[22px] border border-[color:rgba(21,25,34,0.10)] bg-white shadow-[0_18px_44px_rgba(21,25,34,0.10)]">
          <span className="block h-9 w-4 rounded-full border-[3.5px] border-[color:var(--cs-ink-1,#151922)]" aria-hidden="true" />
        </span>
        <h1 className="text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] text-[color:var(--cs-ink-1,#151922)] sm:text-[2rem]">
          Installer CloneStore
        </h1>
        <p className="mx-auto mt-2 max-w-[32rem] text-[0.98rem] leading-relaxed text-[color:var(--cs-ink-3,#5c6675)]">
          {PWA_COPY.installSubtext} Une application propre, plein écran, cohérente avec votre cockpit.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Chip icon={platform === "desktop" ? <Monitor className="size-3.5" /> : <Smartphone className="size-3.5" />}>
            {deviceLabel}
          </Chip>
          <Chip tone={isInstalled ? "ok" : "muted"} icon={isInstalled ? <Check className="size-3.5" /> : undefined}>
            {stateLabel}
          </Chip>
          <Chip muted icon={<span className="opacity-60">v</span>}>
            {pwa?.version ?? "…"}
          </Chip>
        </div>
      </header>

      {/* Action principale selon l'état */}
      <section className="mt-8">
        {isStandalone ? (
          <StatusCard tone="ok" title="CloneStore est lancée en application">
            Vous utilisez déjà CloneStore en plein écran. Retrouvez votre cockpit depuis l&apos;icône
            de votre écran d&apos;accueil.
            <CockpitLink />
          </StatusCard>
        ) : isInstalled ? (
          <StatusCard tone="ok" title="CloneStore est installée">
            Ouvrez CloneStore depuis l&apos;icône de votre écran d&apos;accueil pour la lancer en
            plein écran.
            <CockpitLink />
          </StatusCard>
        ) : platform === "ios" ? (
          <IosSteps isSafari={isIosSafari} />
        ) : canPromptNative ? (
          <div className="rounded-[24px] border border-[color:var(--cs-line-soft,rgba(21,25,34,0.12))] bg-[color:var(--cs-surface-strong,rgba(255,255,255,0.82))] p-5 text-center shadow-[var(--cs-shadow-soft,0_18px_44px_rgba(21,25,34,0.10))] backdrop-blur-xl">
            <p className="mb-4 text-[0.92rem] text-[color:var(--cs-ink-2,#29313d)]">
              Votre appareil peut installer CloneStore en un geste.
            </p>
            <button
              type="button"
              onClick={onInstall}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[0.95rem] font-semibold text-white shadow-[0_18px_38px_rgba(21,25,34,0.22)] transition hover:-translate-y-px disabled:pointer-events-none disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #151922 0%, #52647c 48%, #6f83a6 100%)" }}
            >
              <Download className="size-4" />
              {busy ? "Installation…" : PWA_COPY.installCta}
            </button>
            {result && (
              <p className="mt-3 text-[0.84rem] text-[color:var(--cs-ink-3,#5c6675)]">{result}</p>
            )}
          </div>
        ) : platform === "desktop" ? (
          <StatusCard tone="muted" title="Installer depuis votre navigateur">
            Sur ordinateur (Chrome, Edge), cliquez sur l&apos;icône d&apos;installation dans la barre
            d&apos;adresse, ou ouvrez le menu du navigateur puis « Installer CloneStore ». Le bouton
            direct apparaîtra ici dès que le navigateur le proposera.
          </StatusCard>
        ) : (
          <StatusCard tone="muted" title="Installation non disponible ici">
            Ce navigateur ne propose pas l&apos;installation. Ouvrez CloneStore dans Chrome, Edge ou
            Safari sur votre téléphone pour l&apos;ajouter à votre écran d&apos;accueil.
          </StatusCard>
        )}
      </section>

      {/* Avantages réels */}
      <Section title="Ce que l'installation apporte">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Benefit icon={<Home className="size-4" />} title="Sur votre écran d'accueil">
            Une icône dédiée, un lancement immédiat.
          </Benefit>
          <Benefit icon={<Maximize2 className="size-4" />} title="Plein écran">
            Sans barre de navigateur, comme une vraie app.
          </Benefit>
          <Benefit icon={<Zap className="size-4" />} title="Accès direct">
            Retrouvez Pierre et votre cockpit en un geste.
          </Benefit>
          <Benefit icon={<Smartphone className="size-4" />} title="Adaptée au mobile">
            Une expérience pensée pour le téléphone.
          </Benefit>
        </div>
      </Section>

      {/* Confidentialité & hors connexion — honnête */}
      <Section title="Confidentialité & hors connexion">
        <div className="rounded-[20px] border border-[color:rgba(21,25,34,0.10)] bg-white/55 p-4">
          <Row icon={<ShieldCheck className="size-4" />} title="Vos données restent sur nos serveurs">
            Missions, employés, documents et échanges ne sont jamais stockés hors connexion sur
            l&apos;appareil. L&apos;installation ne change rien à la sécurité de votre espace.
          </Row>
          <Row icon={<WifiOff className="size-4" />} title="Hors connexion">
            {PWA_COPY.offline} L&apos;application ne montre aucun faux contenu « synchronisé ».
          </Row>
        </div>
      </Section>

      {/* Mises à jour */}
      <Section title="Mises à jour">
        <Row icon={<RefreshCw className="size-4" />} title="Automatiques, sans interruption">
          Quand une nouvelle version est prête, un bandeau discret propose « {PWA_COPY.updateCta} ».
          Rien n&apos;est rechargé brutalement pendant une saisie : la mise à jour attend votre accord.
        </Row>
      </Section>

      {/* Désinstallation */}
      <Section title="Désinstaller">
        <Row icon={<Trash2 className="size-4" />} title="À tout moment">
          {platform === "ios"
            ? "Appui long sur l'icône CloneStore → Supprimer l'app."
            : platform === "android"
              ? "Appui long sur l'icône CloneStore → Désinstaller."
              : "Ouvrez le menu de l'application installée → Désinstaller, ou via les applications de votre système."}
        </Row>
      </Section>

      {/* Mini-onboarding : réouvrable volontairement, même s'il a déjà été vu */}
      {pwa?.onboardingReopen.show && (
        <Section title="Guide d'installation">
          <div className="flex flex-col items-start gap-3 rounded-[20px] border border-[color:rgba(21,25,34,0.10)] bg-white/55 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-[color:rgba(21,25,34,0.10)] bg-white/70 text-[color:var(--cs-ink-1,#151922)]">
                <RotateCcw className="size-4" />
              </span>
              <div>
                <p className="text-[0.9rem] font-semibold text-[color:var(--cs-ink-1,#151922)]">
                  Revoir le guide
                </p>
                <p className="mt-0.5 text-[0.85rem] leading-relaxed text-[color:var(--cs-ink-3,#5c6675)]">
                  {pwa.onboardingSeen
                    ? "Vous l'avez déjà vu — vous pouvez le rouvrir à tout moment."
                    : "Les étapes adaptées à votre appareil, en quelques secondes."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                pwa.onboardingReopen.kind === "ios-instructions" ? setGuideOpen(true) : onInstall()
              }
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[color:rgba(21,25,34,0.12)] bg-white/70 px-4 text-[0.85rem] font-semibold text-[color:var(--cs-ink-1,#151922)] transition hover:-translate-y-px hover:bg-white"
            >
              Revoir le guide d&apos;installation
            </button>
          </div>
        </Section>
      )}

      <p className="mt-10 text-center text-[0.76rem] text-[color:var(--cs-ink-3,#5c6675)]">
        CloneStore · version PWA {pwa?.version}
      </p>

      <IosInstallSheet
        open={guideOpen}
        onClose={() => {
          setGuideOpen(false);
          pwa?.markOnboardingSeen();
        }}
        isSafari={isIosSafari}
      />
    </main>
  );
}

/* ---------- sous-composants ---------- */

function CockpitLink() {
  return (
    <Link
      href="/mon-clonestore?utm_source=installer"
      className="mt-4 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-[color:var(--cs-ink-1,#151922)] underline-offset-4 hover:underline"
    >
      Ouvrir mon cockpit <ArrowRight className="size-4" />
    </Link>
  );
}

function IosSteps({ isSafari }: { isSafari: boolean }) {
  return (
    <div className="rounded-[24px] border border-[color:var(--cs-line-soft,rgba(21,25,34,0.12))] bg-[color:var(--cs-surface-strong,rgba(255,255,255,0.82))] p-5 shadow-[var(--cs-shadow-soft,0_18px_44px_rgba(21,25,34,0.10))] backdrop-blur-xl">
      <h2 className="mb-1 text-[1.02rem] font-semibold tracking-[-0.02em] text-[color:var(--cs-ink-1,#151922)]">
        Ajouter à l&apos;écran d&apos;accueil
      </h2>
      {!isSafari && (
        <p className="mb-3 rounded-2xl border border-[color:rgba(21,25,34,0.10)] bg-white/60 px-3 py-2 text-[0.82rem] leading-relaxed text-[color:var(--cs-ink-3,#5c6675)]">
          {PWA_COPY.iosOpenInSafari}
        </p>
      )}
      <ol className="mt-2 flex flex-col gap-2.5">
        <IosStep index={1} icon={<Share className="size-4" />}>{PWA_COPY.iosSteps[0]}</IosStep>
        <IosStep index={2} icon={<Plus className="size-4" />}>{PWA_COPY.iosSteps[1]}</IosStep>
        <IosStep index={3}>{PWA_COPY.iosSteps[2]}</IosStep>
      </ol>
    </div>
  );
}

function IosStep({ index, icon, children }: { index: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[color:rgba(21,25,34,0.08)] bg-white/55 px-3 py-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--cs-ink-1,#151922)] text-[0.78rem] font-semibold text-white">
        {index}
      </span>
      <span className="flex items-center gap-2 text-[0.9rem] text-[color:var(--cs-ink-1,#151922)]">
        {icon}
        {children}
      </span>
    </li>
  );
}

function Chip({
  children,
  icon,
  tone,
  muted,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "ok" | "muted";
  muted?: boolean;
}) {
  const ok = tone === "ok";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.78rem] font-medium ${
        ok
          ? "border-[rgba(46,125,86,0.28)] bg-[rgba(46,125,86,0.10)] text-[#2e7d56]"
          : "border-[rgba(21,25,34,0.12)] bg-white/60 text-[color:var(--cs-ink-2,#29313d)]"
      } ${muted ? "opacity-80" : ""}`}
    >
      {icon}
      {children}
    </span>
  );
}

function StatusCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "ok" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[24px] border p-5 shadow-[var(--cs-shadow-soft,0_18px_44px_rgba(21,25,34,0.10))] backdrop-blur-xl ${
        tone === "ok"
          ? "border-[rgba(46,125,86,0.22)] bg-[rgba(46,125,86,0.06)]"
          : "border-[color:var(--cs-line-soft,rgba(21,25,34,0.12))] bg-[color:var(--cs-surface-strong,rgba(255,255,255,0.82))]"
      }`}
    >
      <div className="flex items-center gap-2">
        {tone === "ok" && (
          <span className="grid size-7 place-items-center rounded-full bg-[#2e7d56] text-white">
            <Check className="size-4" />
          </span>
        )}
        <h2 className="text-[1.02rem] font-semibold tracking-[-0.02em] text-[color:var(--cs-ink-1,#151922)]">
          {title}
        </h2>
      </div>
      <div className="mt-2 flex flex-col text-[0.9rem] leading-relaxed text-[color:var(--cs-ink-2,#29313d)]">
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-ink-3,#5c6675)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Benefit({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-[color:rgba(21,25,34,0.09)] bg-white/55 p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color:var(--cs-ink-1,#151922)] text-white">
        {icon}
      </span>
      <div>
        <p className="text-[0.9rem] font-semibold text-[color:var(--cs-ink-1,#151922)]">{title}</p>
        <p className="mt-0.5 text-[0.82rem] leading-snug text-[color:var(--cs-ink-3,#5c6675)]">{children}</p>
      </div>
    </div>
  );
}

function Row({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-[color:rgba(21,25,34,0.10)] bg-white/70 text-[color:var(--cs-ink-1,#151922)]">
        {icon}
      </span>
      <div>
        <p className="text-[0.9rem] font-semibold text-[color:var(--cs-ink-1,#151922)]">{title}</p>
        <p className="mt-0.5 text-[0.85rem] leading-relaxed text-[color:var(--cs-ink-3,#5c6675)]">{children}</p>
      </div>
    </div>
  );
}
