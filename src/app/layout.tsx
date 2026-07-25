import "./globals.css";
import "@/styles/liquid-glass.css";

import type { Metadata, Viewport } from "next";
import SiteHeader from "../components/site/site-header";
import SiteFooter from "../components/site/site-footer";
import { LiquidGlassFilters } from "@/components/ui/LiquidGlassFilters";
import { GuidedTourProvider } from "@/components/guided-tour/GuidedTourProvider";
// Bloc PWA isolé (aucune dépendance P19). `app/manifest.ts` injecte automatiquement le
// <link rel="manifest">. PwaProvider enregistre le service worker et rend les surfaces
// d'installation / mise à jour (fixed, ne modifie pas le flux de la page).
import { PwaProvider } from "@/components/pwa";
// Analytics, Funnel and Launch Measurement Closure — tracker de navigation canonique, additif.
// Ne remplace aucun tracker existant (PresencePing, BLOC3, etc.), ne rend rien (return null).
import { AnalyticsPageViewTracker } from "@/components/analytics/AnalyticsPageViewTracker";

export const metadata: Metadata = {
  applicationName: "CloneStore",
  title: "CloneStore",
  description:
    "CloneStore — gagnez du temps et de l’argent avec des employés IA premium pour entreprises.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CloneStore",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f4ec",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CloneStore",
  url: "https://clonestore.pro",
  logo: "https://clonestore.pro/icon-512.png",
  description:
    "CloneStore aide les entreprises à gagner du temps et de l’argent avec des employés IA premium.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
      </head>

      <body>
        <LiquidGlassFilters />

        <div className="cs-backdrop" aria-hidden="true">
          <div className="cs-backdrop__halo cs-backdrop__halo--a" />
          <div className="cs-backdrop__halo cs-backdrop__halo--b" />
          <div className="cs-backdrop__halo cs-backdrop__halo--c" />
          <div className="cs-backdrop__arc" />
          <div className="cs-backdrop__film" />
        </div>

        <div className="cs-vignette" aria-hidden="true" />

        <SiteHeader />
        <AnalyticsPageViewTracker />

        <div className="cs-main">
          <PwaProvider>
            <GuidedTourProvider>{children}</GuidedTourProvider>
          </PwaProvider>
        </div>

        <SiteFooter />
      </body>
    </html>
  );
}