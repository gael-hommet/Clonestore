import "./globals.css";
import "@/styles/liquid-glass.css";

import type { Metadata } from "next";
import SiteHeader from "../components/site/site-header";
import SiteFooter from "../components/site/site-footer";
import { LiquidGlassFilters } from "@/components/ui/LiquidGlassFilters";
import { GuidedTourProvider } from "@/components/guided-tour/GuidedTourProvider";

export const metadata: Metadata = {
  title: "CloneStore",
  description:
    "CloneStore — gagnez du temps et de l’argent avec des employés IA premium pour entreprises.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
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

        <div className="cs-main">
          <GuidedTourProvider>{children}</GuidedTourProvider>
        </div>

        <SiteFooter />
      </body>
    </html>
  );
}