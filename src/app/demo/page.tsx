import "./demo.css";
import "./demo-stage.css";

import type { Metadata } from "next";
import { DemoStage } from "@/components/demo/stage/DemoStage";
import { PresencePing } from "@/components/founder/PresencePing";

export const metadata: Metadata = {
  title: "CloneStore — Employés IA pour entreprises",
  description:
    "Découvrez CloneStore : vous formulez l'objectif, CloneStore organise la mission, mobilise l'employé compétent et suit chaque action jusqu'au résultat, selon les règles de votre entreprise.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "CloneStore — Employés IA pour entreprises",
    description:
      "Vous formulez l'objectif. CloneStore organise la mission, mobilise l'employé compétent et suit chaque action jusqu'au résultat.",
    url: "https://clonestore.pro/demo",
    type: "website",
  },
};

// Filet de sécurité sans JavaScript : Framer Motion rend l'état initial
// (opacity:0) côté serveur. Si JS est désactivé, on force tout le contenu de
// /demo à rester visible et statique — aucun texte ne dépend de JS pour être lu.
const NO_JS_FALLBACK = `.demo-stage-root *{opacity:1!important;transform:none!important;filter:none!important;}`;

export default function DemoPage() {
  return (
    <>
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: NO_JS_FALLBACK }} />
      </noscript>
      <PresencePing event="demo_viewed" />
      <DemoStage />
    </>
  );
}
