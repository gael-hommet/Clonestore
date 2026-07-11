"use client";

// Cabinets Fondateurs CloneStore — landing publique interactive.
//
// SSR-safe : <MotionConfig reducedMotion="user"> au sommet ; on ne branche
// JAMAIS le rendu initial sur prefers-reduced-motion (pas d'écart d'hydratation).
// Effets « liquid metal » réalisés en CSS pur (halos radiaux + reflets chrome via
// dégradés) — aucun three.js / R3F / shadergradient. Fort dégradé mobile via CSS.
//
// POSITIONNEMENT (source canonique : /comprendre-clonestore).
// Pierre n'est ni un assistant, ni un outil RH de plus : c'est un employé IA
// RH complet qui prend en charge un périmètre opérationnel dans la durée — il
// organise, exécute les actions autorisées, suit, relance, reprend, fait valider
// le sensible et conserve la trace. Selon l'organisation, il peut constituer
// l'équipe RH IA principale, le cœur d'une équipe hybride, ou démultiplier un
// service RH humain existant.
//
// La gouvernance est présentée comme une architecture de contrôle (une force),
// jamais comme un affaiblissement : l'humain conserve les décisions légales, les
// sanctions, les arbitrages sensibles, les signatures officielles et la
// responsabilité finale. Aucun chiffre inventé, aucun témoignage, aucun logo.

import * as React from "react";
import Link from "next/link";
import { MotionConfig } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "@/components/demo/primitives/motion";
import { EMPLOYEE_PRICE } from "@/lib/catalog/public-catalog";
import { estimateCommission } from "@/lib/partner-program/calculator";
import { formatMinorAmount } from "@/lib/partner-program/money";

// Prix de référence public (source de vérité unique). Ex. « 449 € HT/mois ».
const PRICE_LABEL = EMPLOYEE_PRICE; // "449 € HT/mois"

export default function PartenairesLanding() {
  return (
    <MotionConfig reducedMotion="user">
      {/* Fond global : halos radiaux froids + grille, animés lentement. */}
      <div className="pf-backdrop" aria-hidden="true">
        <span className="pf-backdrop__halo pf-backdrop__halo--a" />
        <span className="pf-backdrop__halo pf-backdrop__halo--b" />
        <span className="pf-backdrop__halo pf-backdrop__halo--c" />
        <span className="pf-backdrop__grid" />
      </div>

      <header className="pf-masthead">
        <Link href="/partenaires" className="pf-masthead__mark">
          <span className="pf-masthead__dot" aria-hidden="true" />
          Cabinets Fondateurs
        </Link>
        <Link href="/" className="pf-masthead__back">
          Retour à CloneStore
        </Link>
      </header>

      <main className="pf-root">
        <Hero />
        <NotAnotherTool />
        <ThreeModels />
        <StructuralPower />
        <PartnerRole />
        <Economics />
        <Calculator />
        <WhyClientsListen />
        <Governance />
        <Transparency />
        <FounderAdvantages />
        <Faq />
        <ApplicationForm />
        <FinalCta />
      </main>

      <footer className="pf-footer">
        <p>Cabinets Fondateurs CloneStore — programme partenaires.</p>
        <p>
          <Link href="/">CloneStore</Link> · Démonstrations illustratives · Les
          décisions sensibles restent humaines.
        </p>
      </footer>
    </MotionConfig>
  );
}

/* ── 1. Hero ──────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="pf-section pf-section--hero">
      <div className="pf-shell">
        <Reveal>
          <p className="pf-eyebrow">Cabinets Fondateurs CloneStore</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="pf-display" style={{ marginTop: "26px" }}>
            Proposez à vos clients <em>une équipe RH IA complète</em>.
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="pf-lede pf-mt-md">
            Pierre prend en charge l’opérationnel RH de bout en bout : demandes,
            documents, dossiers salariés, onboarding, recrutement opérationnel,
            absences, communications, relances, échéances, validations et
            traçabilité.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="pf-copy pf-mt-md">
            Selon l’organisation de votre client, il peut devenir son{" "}
            <strong style={{ color: "var(--pf-mist)" }}>équipe RH IA
            principale</strong>, le cœur d’une organisation hybride, ou la force
            opérationnelle qui démultiplie son service RH existant.
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <p className="pf-copy pf-mt-md">
            Vous sélectionnez les entreprises auxquelles Pierre peut apporter le
            plus de valeur. CloneStore assure la démonstration, la vente, le
            déploiement et l’accompagnement. Vous percevez{" "}
            <strong style={{ color: "var(--pf-mist)" }}>20 % de commission
            récurrente</strong>{" "}
            sur chaque client actif apporté.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="pf-cta-row pf-mt-lg">
            <a href="#candidature" className="pf-btn pf-btn--primary">
              Devenir Cabinet Fondateur
            </a>
            <a href="#capacite" className="pf-btn pf-btn--ghost">
              Voir ce que Pierre remplace
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.36}>
          <div
            className="pf-mt-lg"
            style={{ display: "inline-flex", flexWrap: "wrap", gap: "16px" }}
          >
            <span className="pf-seal">
              <span className="pf-seal__badge">Cabinet Fondateur</span>
              <span className="pf-chrome-num pf-chrome-num--xl">20 %</span>
              <span
                style={{
                  fontSize: "0.82rem",
                  color: "var(--pf-silver-2)",
                  letterSpacing: "0.04em",
                }}
              >
                de commission récurrente
              </span>
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.42}>
          <p className="pf-note">
            20 % de commission récurrente · 89,80 € par mois sur un abonnement à
            449 € HT · CloneStore prend en charge tout le déploiement.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 2. Ce n'est pas un outil RH de plus ──────────────────────────────────── */
const SOFTWARE_DOES = [
  "Donne des outils.",
  "Attend que l’équipe les utilise.",
  "Nécessite saisie, coordination et suivi humains.",
  "Ne porte pas la responsabilité du workflow.",
];

const PIERRE_DOES = [
  "Reçoit l’objectif.",
  "Organise le travail.",
  "Exécute les actions autorisées.",
  "Gère plusieurs missions en parallèle.",
  "Suit et relance.",
  "Conserve le contexte.",
  "Remonte uniquement ce qui exige réellement une décision humaine.",
  "Garde une trace complète.",
];

function NotAnotherTool() {
  return (
    <section className="pf-section" id="capacite">
      <div className="pf-shell">
        <div className="pf-pierre">
          <Reveal>
            <div className="pf-pierre__orb" aria-hidden="true">
              <span className="pf-pierre__ring" />
              <span className="pf-pierre__ring pf-pierre__ring--2" />
              <span className="pf-pierre__mono">P</span>
            </div>
          </Reveal>
          <div>
            <Reveal>
              <p className="pf-eyebrow">Ce que vous proposez réellement</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="pf-heading pf-mt-md">
                Ce n’est pas un outil RH de plus. C’est une fonction RH qui
                travaille.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="pf-copy pf-mt-md">
                Les logiciels RH organisent des informations et fournissent des
                écrans. Pierre prend le travail en charge. Il reçoit une demande,
                relit les règles de l’entreprise, structure la mission, exécute ce
                qui est autorisé, produit les documents, rassemble les
                informations, suit les dossiers, relance, attend les validations
                nécessaires, reprend et conserve la trace jusqu’à la clôture.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <p className="pf-copy pf-mt-md">
                Il ne s’arrête pas après avoir produit une réponse.{" "}
                <strong style={{ color: "var(--pf-mist)" }}>Il tient le
                périmètre dans la durée.</strong>
              </p>
            </Reveal>
          </div>
        </div>

        <div className="pf-split pf-mt-lg">
          <Reveal>
            <div className="pf-col">
              <div className="pf-col__head">
                <span className="pf-col__tag">Logiciel RH</span>
              </div>
              <ul className="pf-list">
                {SOFTWARE_DOES.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="pf-col pf-col--accent">
              <div className="pf-col__head">
                <span className="pf-col__tag">Pierre</span>
              </div>
              <ul className="pf-list">
                {PIERRE_DOES.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── 3. Une équipe RH, trois modèles ──────────────────────────────────────── */
const ORG_MODELS = [
  {
    t: "Équipe RH IA principale",
    c: "Un dirigeant ou une direction conserve les décisions sensibles. Pierre prend en charge l’opérationnel RH quotidien : missions, documents, suivis, relances, dossiers, communications autorisées et continuité.",
  },
  {
    t: "Cœur d’une équipe hybride",
    c: "Pierre absorbe l’exécution et la coordination opérationnelle. Les humains se concentrent sur la relation, le management, les arbitrages et les cas complexes.",
  },
  {
    t: "Équipe RH humaine démultipliée",
    c: "Le service existant traite davantage de missions, beaucoup plus vite, sans perdre le contexte, sans laisser les demandes s’accumuler et sans multiplier les recrutements.",
  },
];

function ThreeModels() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <Reveal>
          <p className="pf-eyebrow">Trois modèles d’organisation</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md pf-max">
            Pierre s’adapte à l’organisation, pas à une petite définition de
            l’assistance.
          </h2>
        </Reveal>

        <Stagger className="pf-cards pf-cards--3 pf-mt-lg" step={0.08}>
          {ORG_MODELS.map((m) => (
            <StaggerItem key={m.t} className="pf-card">
              <h3 className="pf-card__t">{m.t}</h3>
              <p className="pf-card__c">{m.c}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.16}>
          <p className="pf-copy pf-mt-lg">
            Pierre ne remplace pas nécessairement les mêmes personnes dans toutes
            les entreprises. Mais il remplace partout{" "}
            <strong style={{ color: "var(--pf-mist)" }}>une masse considérable
            d’exécution lente, dispersée, répétitive et coûteuse.</strong>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 4. Pourquoi Pierre est structurellement plus puissant ────────────────── */
const STRUCTURAL = [
  {
    t: "Travail en parallèle",
    c: "Pierre fait avancer plusieurs missions pendant qu’une équipe humaine doit répartir son attention.",
  },
  {
    t: "Continuité absolue",
    c: "Une mission ne disparaît pas après une réponse. Pierre attend, reprend, relance et suit jusqu’au résultat.",
  },
  {
    t: "Mémoire entreprise",
    c: "Règles, documents, modèles, validateurs, ton, permissions, habitudes, décisions et exceptions restent disponibles dans l’Empreinte Entreprise.",
  },
  {
    t: "Aucun oubli silencieux",
    c: "Échéances, informations manquantes, validations et actions en attente restent visibles et actives.",
  },
  {
    t: "Disponibilité opérationnelle",
    c: "Pierre ne dépend pas des horaires, des absences ou de la disponibilité immédiate d’un collaborateur.",
  },
  {
    t: "Traçabilité complète",
    c: "Chaque action, source, document, décision et validation reste visible grâce à CloneTrace.",
  },
];

function StructuralPower() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <Reveal>
          <p className="pf-eyebrow">Avantages structurels</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md pf-max">
            Pourquoi Pierre est structurellement plus puissant.
          </h2>
        </Reveal>

        <Stagger className="pf-cards pf-cards--3 pf-mt-lg" step={0.07}>
          {STRUCTURAL.map((c) => (
            <StaggerItem key={c.t} className="pf-card">
              <h3 className="pf-card__t">{c.t}</h3>
              <p className="pf-card__c">{c.c}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.14}>
          <div className="pf-glass pf-mt-lg" style={{ padding: "clamp(26px, 4vw, 44px)" }}>
            <h3 className="pf-card__t">Coût radicalement inférieur</h3>
            <p className="pf-copy pf-mt-md">
              449 € HT par mois pour une capacité RH opérationnelle qui, dans de
              nombreuses entreprises, mobiliserait autrement plusieurs
              collaborateurs.
            </p>
            <p className="pf-copy pf-mt-md">
              <strong style={{ color: "var(--pf-mist)" }}>Pierre change la
              capacité opérationnelle et l’économie entière de la fonction
              RH.</strong>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 5. Le rôle du partenaire ─────────────────────────────────────────────── */
const STEPS = [
  {
    t: "Vous identifiez cinq entreprises",
    c: "Choisissez les cinq clients pour lesquels les lenteurs, les coûts, la dispersion ou l’absence de fonction RH structurée créent le plus de friction. Cinq est un point de départ, jamais une limite : vous pouvez en présenter autant que vous le souhaitez.",
  },
  {
    t: "Vous réalisez la mise en relation",
    c: "Vous introduisez Pierre auprès du dirigeant ou du décideur. Rien de plus.",
  },
  {
    t: "CloneStore démontre la valeur",
    c: "Nous présentons Pierre à partir de cas RH réels et expliquons le modèle adapté : IA seule, hybride ou RH humain augmenté.",
  },
  {
    t: "CloneStore vend et déploie",
    c: "Compte, paiement, Empreinte Entreprise, onboarding, configuration et accompagnement sont pris en charge par CloneStore.",
  },
  {
    t: "Vous êtes rémunéré chaque mois",
    c: "20 % des montants HT réellement encaissés, tant que le client reste actif.",
  },
];

function PartnerRole() {
  return (
    <section className="pf-section" id="fonctionnement">
      <div className="pf-shell">
        <Reveal>
          <div className="pf-glass" style={{ padding: "clamp(30px, 5vw, 60px)" }}>
            <p className="pf-eyebrow">Un premier pas concret</p>
            <h2 className="pf-heading pf-mt-md pf-max">
              Présentez-nous cinq entreprises. On s’occupe du reste.
            </h2>
            <p className="pf-body pf-mt-md pf-max">
              Cinq, c’est le point de départ que nous recommandons — pas un plafond. Une seule
              entreprise suffit pour commencer, et rien ne vous empêche d’en présenter vingt,
              cinquante ou davantage : votre rémunération suit le même principe, sans limite.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="pf-eyebrow pf-mt-lg">Répartition des rôles</p>
        </Reveal>
        <Reveal delay={0.12}>
          <h2 className="pf-heading pf-mt-md pf-max">
            Vous ouvrez la porte. CloneStore prend en charge tout le reste.
          </h2>
        </Reveal>

        <Stagger className="pf-steps pf-mt-lg" step={0.07}>
          {STEPS.map((s, i) => (
            <StaggerItem key={s.t} className="pf-step">
              <span className="pf-step__n">{i + 1}</span>
              <h3 className="pf-step__t">{s.t}</h3>
              <p className="pf-step__c">{s.c}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.16}>
          <p className="pf-copy pf-mt-lg">
            Vous n’avez pas à devenir commercial CloneStore. Vous devez simplement{" "}
            <strong style={{ color: "var(--pf-mist)" }}>reconnaître les
            entreprises pour lesquelles Pierre peut transformer la fonction
            RH.</strong>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 6. Preuve économique ─────────────────────────────────────────────────── */
function Economics() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <div className="pf-proof">
          <div>
            <Reveal>
              <p className="pf-eyebrow">Preuve économique</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="pf-heading pf-mt-md">
                Chaque client actif génère 20 % du montant HT réellement encaissé.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="pf-copy pf-mt-md">
                Pierre est proposé à <strong>{PRICE_LABEL}</strong> par entreprise.
                Vous percevez <strong>20 %</strong> chaque mois, tant que le client
                reste actif. Aucune avance, aucun stock, aucune facturation à gérer
                de votre côté.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.12}>
            <div className="pf-glass pf-calc">
              <p className="pf-calc__k">Exemple par client</p>
              <div className="pf-proof__eq" style={{ marginTop: "18px" }}>
                <span>449 € HT</span>
                <span>×</span>
                <span>20 %</span>
                <span>=</span>
                <b>89,80 €/mois</b>
              </div>
              <p className="pf-note">
                Chiffres estimatifs. La commission réelle dépend des montants HT
                effectivement encaissés.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── 7. Calculateur dynamique ─────────────────────────────────────────────── */
const CALC_MIN = 1;
const CALC_MAX = 100;

function Calculator() {
  const [clients, setClients] = React.useState(5);
  const est = React.useMemo(() => estimateCommission(clients), [clients]);
  const monthly = formatMinorAmount(est.monthlyMinor, "eur");
  const yearly = formatMinorAmount(est.yearlyMinor, "eur");

  const pct = ((clients - CALC_MIN) / (CALC_MAX - CALC_MIN)) * 100;
  const fill = `linear-gradient(90deg, var(--pf-blue) 0%, var(--pf-violet) ${pct}%, rgba(214,222,238,0.12) ${pct}%, rgba(214,222,238,0.12) 100%)`;

  return (
    <section className="pf-section">
      <div className="pf-shell">
        <Reveal>
          <p className="pf-eyebrow">Calculateur</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md pf-max">
            Une recommandation. Un revenu récurrent qui s’additionne.
          </h2>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="pf-glass pf-calc pf-mt-lg">
            <div className="pf-calc__top">
              <label htmlFor="pf-clients" className="pf-calc__k">
                Nombre de clients actifs
              </label>
              <span className="pf-calc__clients">
                {clients}
                <small>{clients > 1 ? "clients" : "client"}</small>
              </span>
            </div>

            <input
              id="pf-clients"
              className="pf-slider"
              type="range"
              min={CALC_MIN}
              max={CALC_MAX}
              step={1}
              value={clients}
              onChange={(e) => setClients(Number(e.target.value))}
              style={{ background: fill }}
              aria-valuetext={`${clients} clients actifs, soit environ ${monthly} par mois`}
            />
            <div className="pf-slider__scale" aria-hidden="true">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>

            <div className="pf-calc__out">
              <div className="pf-calc__cell">
                <p className="pf-calc__k">Commission mensuelle estimée</p>
                <p className="pf-calc__v">
                  <em>{monthly}</em>
                </p>
              </div>
              <div className="pf-calc__cell">
                <p className="pf-calc__k">Sur douze mois</p>
                <p className="pf-calc__v">{yearly}</p>
              </div>
            </div>

            <p className="pf-note">
              Sur l’abonnement fondateur Pierre à 449 € HT par mois : 1 client =
              89,80 €/mois · 5 = 449 € · 10 = 898 € · 20 = 1 796 € · 50 = 4 490 €.
            </p>
            <p className="pf-note">
              Chiffres estimatifs, ils dépendent des montants HT réellement
              encaissés. La commission continue tant que le client reste actif et
              que les conditions du programme sont respectées.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 8. Pourquoi les clients écouteront le cabinet ────────────────────────── */
function WhyClientsListen() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <div className="pf-glass" style={{ padding: "clamp(30px, 5vw, 60px)" }}>
          <Reveal>
            <p className="pf-eyebrow">Votre position</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="pf-heading pf-mt-md pf-max">
              Vous connaissez déjà leur entreprise. Vous savez où Pierre peut
              changer la donne.
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="pf-copy pf-mt-md">
              Vous connaissez leurs effectifs, leur croissance, leurs retards,
              leurs dossiers, leurs habitudes de gestion, leur niveau de
              structuration et les tâches qui reviennent chaque mois.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="pf-copy pf-mt-md">
              Vous êtes donc mieux placé qu’une publicité ou qu’un commercial
              inconnu pour identifier les entreprises où Pierre peut immédiatement
              absorber une part massive du travail RH opérationnel.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <p className="pf-copy pf-mt-md">
              Vous ne recommandez pas une promesse abstraite. Vous mettez en
              relation une entreprise que vous connaissez avec{" "}
              <strong style={{ color: "var(--pf-mist)" }}>une capacité RH dont
              elle a réellement besoin.</strong>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── 9. Gouvernance ───────────────────────────────────────────────────────── */
const RULES_DECIDE = [
  "Ce que Pierre exécute seul.",
  "Ce qu’il prépare.",
  "Ce qu’il soumet à validation.",
  "Ce qu’il refuse.",
];

const HUMAN_KEEPS = [
  "Les décisions légales.",
  "Les sanctions et les licenciements.",
  "Les arbitrages humains sensibles.",
  "Les signatures officielles.",
  "La responsabilité finale.",
];

function Governance() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <Reveal>
          <p className="pf-eyebrow">Gouvernance</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md pf-max">
            Plus puissant ne veut pas dire incontrôlé.
          </h2>
        </Reveal>

        <div className="pf-split pf-mt-lg">
          <Reveal>
            <div className="pf-col">
              <div className="pf-col__head">
                <span className="pf-col__tag">Les règles de l’entreprise</span>
              </div>
              <ul className="pf-list">
                {RULES_DECIDE.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="pf-col pf-col--accent">
              <div className="pf-col__head">
                <span className="pf-col__tag">L’humain conserve</span>
              </div>
              <ul className="pf-list">
                {HUMAN_KEEPS.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.16}>
          <div className="pf-disclaimer pf-mt-lg">
            <span className="pf-disclaimer__dot" aria-hidden="true" />
            <p>
              Pierre exécute directement les actions opérationnelles autorisées et
              sollicite l’humain uniquement lorsque le contexte, la sensibilité ou
              les règles l’exigent. La gouvernance est une architecture de
              contrôle, pas une réduction de ses capacités.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 10. Sécurité & transparence des commissions ──────────────────────────── */
const TRANSPARENCY = [
  {
    t: "Calculée sur le réel",
    c: "La commission est calculée sur le montant HT effectivement encaissé, jamais sur un montant théorique.",
  },
  {
    t: "Versement mensuel",
    c: "Le versement est mensuel, opéré via Stripe, sur la base des paiements confirmés.",
  },
  {
    t: "Jamais annoncée d’avance",
    c: "Une commission n’est jamais présentée comme acquise avant l’encaissement effectif du client.",
  },
];

function Transparency() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <Reveal>
          <p className="pf-eyebrow">Sécurité &amp; transparence</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md pf-max">
            Des commissions traçables, calculées sur ce qui est réellement encaissé.
          </h2>
        </Reveal>

        <Stagger className="pf-cards pf-cards--3 pf-mt-lg" step={0.08}>
          {TRANSPARENCY.map((c) => (
            <StaggerItem key={c.t} className="pf-card">
              <h3 className="pf-card__t">{c.t}</h3>
              <p className="pf-card__c">{c.c}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ── 11. Avantages du statut Cabinet Fondateur ────────────────────────────── */
const ADVANTAGES = [
  {
    t: "Taux fondateur préservé",
    c: "Les cabinets présents à l’ouverture conservent leur taux de commission récurrente dans la durée.",
  },
  {
    t: "Un interlocuteur dédié",
    c: "Un interlocuteur CloneStore porte avec vous les présentations et les démonstrations.",
  },
  {
    t: "Suivi transparent",
    c: "Vous suivez vos clients apportés et vos commissions depuis un espace dédié.",
  },
  {
    t: "Aucune charge opérationnelle",
    c: "Ni stock, ni facturation, ni support technique à porter : CloneStore exécute.",
  },
];

function FounderAdvantages() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <Reveal>
          <p className="pf-eyebrow">Statut Cabinet Fondateur</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md pf-max">
            Les premiers cabinets partenaires gardent une longueur d’avance.
          </h2>
        </Reveal>

        <Stagger className="pf-cards pf-cards--2 pf-mt-lg" step={0.08}>
          {ADVANTAGES.map((a) => (
            <StaggerItem key={a.t} className="pf-card">
              <h3 className="pf-card__t">{a.t}</h3>
              <p className="pf-card__c">{a.c}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ── 12. FAQ ──────────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Pierre est-il un assistant RH ?",
    a: "Non. Un assistant produit une réponse et attend la prochaine demande. Pierre reçoit un objectif, structure une mission, exécute le travail RH opérationnel autorisé, suit, relance, attend, reprend, fait valider le sensible et garde la trace jusqu’au résultat.",
  },
  {
    q: "Pierre peut-il remplacer une équipe RH ?",
    a: "Sur le périmètre opérationnel, oui, selon l’organisation. Pierre peut devenir l’équipe RH IA principale d’une entreprise, le cœur opérationnel d’une équipe hybride ou la force qui démultiplie un service RH humain. Les humains conservent les décisions sensibles, la relation, les arbitrages et la responsabilité finale.",
  },
  {
    q: "Dois-je vendre Pierre moi-même ?",
    a: "Non. Vous identifiez les entreprises pertinentes et réalisez la mise en relation. CloneStore prend en charge la démonstration, la vente, le déploiement, l’onboarding et le support.",
  },
  {
    q: "Dois-je assurer le support ?",
    a: "Non. CloneStore gère directement l’accompagnement produit, technique et opérationnel.",
  },
  {
    q: "Pourquoi cinq entreprises ?",
    a: "Parce que c’est le point de départ le plus efficace : plutôt que de promouvoir Pierre à tout votre portefeuille, vous sélectionnez les entreprises où sa valeur sera la plus évidente. Cinq est une recommandation, pas une règle.",
  },
  {
    q: "Puis-je présenter plus de cinq entreprises ?",
    a: "Oui, sans aucune limite. Une, cinq, vingt, cent : vous présentez autant d’entreprises que vous le souhaitez, quand vous le souhaitez. Chaque client actif qui vous est attribué génère la même commission de 20 % des montants HT réellement encaissés, aussi longtemps qu’il reste client.",
  },
  {
    q: "Comment suis-je rémunéré ?",
    a: "Vous percevez 20 % des montants HT réellement encaissés pour chaque client actif qui vous est attribué. Sur un abonnement à 449 € HT par mois, cela représente 89,80 € de commission mensuelle.",
  },
  {
    q: "Pierre est-il seulement destiné aux petites entreprises ?",
    a: "Non. La compétence reste la même. Le volume, les règles, les permissions, les circuits de validation et le niveau d’autonomie s’adaptent à la taille et à la complexité de l’organisation.",
  },
  {
    q: "Pierre est-il meilleur qu’une équipe humaine ?",
    a: "Sur les dimensions opérationnelles de vitesse, parallélisme, mémoire, disponibilité, continuité, suivi et traçabilité, Pierre possède des avantages structurels qu’une organisation humaine ne peut pas reproduire au même coût. Les humains restent supérieurs et responsables lorsqu’une situation exige jugement, relation, négociation, management ou décision sensible.",
  },
];

function Faq() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section className="pf-section">
      <div className="pf-shell pf-shell--narrow">
        <Reveal>
          <p className="pf-eyebrow">Questions fréquentes</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md">Ce que les cabinets nous demandent.</h2>
        </Reveal>

        <div className="pf-faq pf-mt-lg">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="pf-faq__item" data-open={isOpen}>
                <button
                  type="button"
                  className="pf-faq__q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="pf-faq__sign" aria-hidden="true" />
                </button>
                <div className="pf-faq__a" role="region">
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── 13. Formulaire de candidature RÉEL ───────────────────────────────────── */
type FieldKey =
  | "cabinetName"
  | "firstName"
  | "lastName"
  | "email"
  | "country"
  | "cabinetType"
  | "consent"
  | "form";

const COUNTRIES = [
  { value: "FR", label: "France" },
  { value: "BE", label: "Belgique" },
  { value: "LU", label: "Luxembourg" },
  { value: "CH", label: "Suisse" },
];

const CABINET_TYPES = [
  { value: "expertise_comptable", label: "Expertise comptable" },
  { value: "conseil_rh", label: "Conseil RH" },
  { value: "avocat_droit_social", label: "Avocat en droit social" },
  { value: "autre", label: "Autre" },
];

const SERVICE_OPTIONS = [
  { value: "paie", label: "Paie & social" },
  { value: "comptabilite", label: "Comptabilité" },
  { value: "conseil_rh", label: "Conseil RH" },
  { value: "juridique", label: "Juridique" },
  { value: "gestion", label: "Gestion & administration" },
];

const CLIENT_BUCKETS = [
  { value: "1-10", label: "1 à 10 clients" },
  { value: "11-50", label: "11 à 50 clients" },
  { value: "51-200", label: "51 à 200 clients" },
  { value: "200+", label: "Plus de 200 clients" },
];

// Messages FR clairs par code d'erreur serveur.
const SERVER_ERROR_MESSAGES: Record<string, { field: FieldKey; message: string }> = {
  email_required: { field: "email", message: "Une adresse e-mail valide est requise." },
  consent_required: { field: "consent", message: "Veuillez accepter les deux consentements pour continuer." },
  identity_required: { field: "cabinetName", message: "Nom du cabinet, prénom et nom sont requis." },
  country_required: { field: "country", message: "Veuillez sélectionner un pays." },
  cabinet_type_required: { field: "cabinetType", message: "Veuillez sélectionner un type de cabinet." },
  program_closed: { field: "form", message: "Le programme n'accepte pas de nouvelle candidature pour le moment." },
  partner_program_disabled: { field: "form", message: "Le programme n'est pas encore ouvert aux candidatures. Revenez bientôt." },
  bad_request: { field: "form", message: "Le formulaire n'a pas pu être envoyé. Vérifiez les champs et réessayez." },
  unavailable: { field: "form", message: "Service momentanément indisponible. Merci de réessayer dans un instant." },
};

function ApplicationForm() {
  const [cabinetName, setCabinetName] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [roleTitle, setRoleTitle] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [cabinetType, setCabinetType] = React.useState("");
  const [clientsCountBucket, setClientsCountBucket] = React.useState("");
  const [services, setServices] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState("");
  const [consentContact, setConsentContact] = React.useState(false);
  const [consentPrivacy, setConsentPrivacy] = React.useState(false);
  const [websiteHp, setWebsiteHp] = React.useState(""); // honeypot — reste vide

  const [errors, setErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  // Issue décidée par le SERVEUR : admission automatique, ou revue humaine d'exception.
  const [admitted, setAdmitted] = React.useState<"auto" | "review">("auto");

  const toggleService = (value: string) => {
    setServices((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  };

  const validate = (): Partial<Record<FieldKey, string>> => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!cabinetName.trim() || !firstName.trim() || !lastName.trim()) {
      e.cabinetName = "Nom du cabinet, prénom et nom sont requis.";
    }
    if (!email.trim() || !email.includes("@")) {
      e.email = "Une adresse e-mail valide est requise.";
    }
    if (!country) e.country = "Veuillez sélectionner un pays.";
    if (!cabinetType) e.cabinetType = "Veuillez sélectionner un type de cabinet.";
    if (!consentContact || !consentPrivacy) {
      e.consent = "Veuillez accepter les deux consentements pour continuer.";
    }
    return e;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setStatus("error");
      return;
    }
    setErrors({});
    setStatus("loading");

    try {
      const res = await fetch("/api/partners/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cabinetName: cabinetName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          roleTitle: roleTitle.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          country,
          cabinetType,
          clientsCountBucket: clientsCountBucket || undefined,
          services,
          message: message.trim() || undefined,
          consentContact,
          consentPrivacy,
          website_hp: websiteHp, // honeypot, doit rester ""
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; admitted?: "auto" | "review" | "received"; spaceReady?: boolean }
        | null;

      if (data?.ok) {
        // Le serveur décide seul : accès immédiat, ou revue humaine par exception.
        setAdmitted(data.admitted === "review" ? "review" : "auto");
        setStatus("success");
        return;
      }

      const code = data?.error ?? "unavailable";
      const mapped = SERVER_ERROR_MESSAGES[code] ?? SERVER_ERROR_MESSAGES.unavailable;
      setErrors({ [mapped.field]: mapped.message });
      setStatus("error");
    } catch {
      setErrors({ form: SERVER_ERROR_MESSAGES.unavailable.message });
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <section className="pf-section" id="candidature">
        <div className="pf-shell pf-shell--narrow">
          <div className="pf-glass pf-success">
            <div className="pf-success__seal" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            {admitted === "review" ? (
              <>
                <h2 className="pf-heading">Candidature enregistrée.</h2>
                <p className="pf-copy" style={{ margin: "18px auto 0" }}>
                  Votre dossier demande une vérification rapide avant l’ouverture de votre
                  espace. Nous vous écrivons dès qu’elle est terminée — vous n’avez rien à faire.
                </p>
              </>
            ) : (
              <>
                <h2 className="pf-heading">Votre espace est ouvert.</h2>
                <p className="pf-copy" style={{ margin: "18px auto 0" }}>
                  Aucune validation à attendre : votre lien de recommandation et votre code
                  viennent de vous être envoyés par e-mail. Deux étapes vous restent, à votre
                  rythme — accepter les conditions du programme et renseigner vos coordonnées
                  bancaires (Stripe). Dès qu’elles sont faites, votre cabinet est activé
                  automatiquement et votre lien devient rémunérateur.
                </p>
                <a className="pf-btn pf-btn--primary" href="/partenaires/espace" style={{ marginTop: 24 }}>
                  Ouvrir mon espace partenaire
                </a>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pf-section" id="candidature">
      <div className="pf-shell pf-shell--narrow">
        <Reveal>
          <p className="pf-eyebrow">Candidature</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md">Devenez Cabinet Fondateur.</h2>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="pf-copy pf-mt-md">
            Votre espace, votre lien et votre code sont créés dès l’envoi de ce formulaire :
            aucun comité, aucune validation à attendre. Nous prenons en charge la démonstration,
            la vente, le déploiement et le support. Vous percevez 20 % de commission récurrente,
            sur autant d’entreprises que vous le souhaitez.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <form className="pf-glass pf-form pf-mt-lg" onSubmit={onSubmit} noValidate>
            {status === "error" && errors.form && (
              <p className="pf-notice pf-notice--err" role="alert">
                {errors.form}
              </p>
            )}

            <div className="pf-field">
              <label className="pf-label" htmlFor="pf-cabinet">
                Nom du cabinet
              </label>
              <input
                id="pf-cabinet"
                className="pf-input"
                type="text"
                autoComplete="organization"
                value={cabinetName}
                onChange={(e) => setCabinetName(e.target.value)}
                aria-invalid={Boolean(errors.cabinetName)}
                aria-describedby={errors.cabinetName ? "pf-cabinet-err" : undefined}
                required
              />
              {errors.cabinetName && (
                <span id="pf-cabinet-err" className="pf-err">
                  {errors.cabinetName}
                </span>
              )}
            </div>

            <div className="pf-row2">
              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-first">
                  Prénom
                </label>
                <input
                  id="pf-first"
                  className="pf-input"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  aria-invalid={Boolean(errors.cabinetName)}
                  required
                />
              </div>
              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-last">
                  Nom
                </label>
                <input
                  id="pf-last"
                  className="pf-input"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  aria-invalid={Boolean(errors.cabinetName)}
                  required
                />
              </div>
            </div>

            <div className="pf-field">
              <label className="pf-label" htmlFor="pf-role">
                Fonction <span>(facultatif)</span>
              </label>
              <input
                id="pf-role"
                className="pf-input"
                type="text"
                autoComplete="organization-title"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
              />
            </div>

            <div className="pf-row2">
              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-email">
                  E-mail professionnel
                </label>
                <input
                  id="pf-email"
                  className="pf-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "pf-email-err" : undefined}
                  required
                />
                {errors.email && (
                  <span id="pf-email-err" className="pf-err">
                    {errors.email}
                  </span>
                )}
              </div>
              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-phone">
                  Téléphone <span>(facultatif)</span>
                </label>
                <input
                  id="pf-phone"
                  className="pf-input"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="pf-field">
              <label className="pf-label" htmlFor="pf-website">
                Site web <span>(facultatif)</span>
              </label>
              <input
                id="pf-website"
                className="pf-input"
                type="url"
                autoComplete="url"
                inputMode="url"
                placeholder="https://"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="pf-row2">
              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-country">
                  Pays
                </label>
                <select
                  id="pf-country"
                  className="pf-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  aria-invalid={Boolean(errors.country)}
                  aria-describedby={errors.country ? "pf-country-err" : undefined}
                  required
                >
                  <option value="" disabled>
                    Sélectionnez…
                  </option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errors.country && (
                  <span id="pf-country-err" className="pf-err">
                    {errors.country}
                  </span>
                )}
              </div>
              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-type">
                  Type de cabinet
                </label>
                <select
                  id="pf-type"
                  className="pf-select"
                  value={cabinetType}
                  onChange={(e) => setCabinetType(e.target.value)}
                  aria-invalid={Boolean(errors.cabinetType)}
                  aria-describedby={errors.cabinetType ? "pf-type-err" : undefined}
                  required
                >
                  <option value="" disabled>
                    Sélectionnez…
                  </option>
                  {CABINET_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errors.cabinetType && (
                  <span id="pf-type-err" className="pf-err">
                    {errors.cabinetType}
                  </span>
                )}
              </div>
            </div>

            <div className="pf-field">
              <label className="pf-label" htmlFor="pf-bucket">
                Nombre de clients <span>(facultatif)</span>
              </label>
              <select
                id="pf-bucket"
                className="pf-select"
                value={clientsCountBucket}
                onChange={(e) => setClientsCountBucket(e.target.value)}
              >
                <option value="">Sélectionnez…</option>
                {CLIENT_BUCKETS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="pf-field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="pf-label" style={{ marginBottom: "12px" }}>
                Services proposés <span>(facultatif)</span>
              </legend>
              <div className="pf-checks">
                {SERVICE_OPTIONS.map((s) => (
                  <label key={s.value} className="pf-check">
                    <input
                      type="checkbox"
                      checked={services.includes(s.value)}
                      onChange={() => toggleService(s.value)}
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="pf-field">
              <label className="pf-label" htmlFor="pf-message">
                Message <span>(facultatif)</span>
              </label>
              <textarea
                id="pf-message"
                className="pf-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez brièvement votre cabinet et les entreprises que vous pourriez présenter."
              />
            </div>

            {/* Honeypot anti-spam : invisible, hors-écran, jamais rempli. */}
            <div className="pf-hp" aria-hidden="true">
              <label htmlFor="pf-website-hp">Ne pas remplir</label>
              <input
                id="pf-website-hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={websiteHp}
                onChange={(e) => setWebsiteHp(e.target.value)}
              />
            </div>

            <div className="pf-consents">
              <label className="pf-check">
                <input
                  type="checkbox"
                  checked={consentContact}
                  onChange={(e) => setConsentContact(e.target.checked)}
                  aria-invalid={Boolean(errors.consent)}
                />
                <span>
                  J&apos;accepte d&apos;être recontacté par CloneStore au sujet du
                  programme Cabinets Fondateurs.
                </span>
              </label>
              <label className="pf-check">
                <input
                  type="checkbox"
                  checked={consentPrivacy}
                  onChange={(e) => setConsentPrivacy(e.target.checked)}
                  aria-invalid={Boolean(errors.consent)}
                />
                <span>
                  J&apos;ai pris connaissance du traitement de mes données pour cette
                  candidature.
                </span>
              </label>
              {errors.consent && (
                <span className="pf-err" role="alert">
                  {errors.consent}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="pf-btn pf-btn--primary pf-btn--block"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Envoi en cours…" : "Envoyer ma candidature"}
            </button>

            <p className="pf-note" style={{ marginTop: 0 }}>
              Démonstrations illustratives. Pierre exécute les actions
              opérationnelles autorisées ; les décisions sensibles restent humaines.
              Les commissions sont calculées sur le HT réellement encaissé.
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 14. CTA final ────────────────────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <Reveal>
          <div className="pf-final">
            <p className="pf-eyebrow" style={{ justifyContent: "center" }}>
              Rejoindre le programme
            </p>
            <h2 className="pf-heading pf-mt-md" style={{ marginInline: "auto" }}>
              Donnez à cinq de vos clients la capacité RH qu’ils n’auraient jamais
              pu recruter à ce prix.
            </h2>
            <p className="pf-copy pf-mt-md" style={{ marginInline: "auto" }}>
              Vous réalisez la mise en relation. CloneStore démontre, vend, déploie
              et accompagne Pierre. Vous percevez 20 % de commission récurrente.
            </p>
            <div className="pf-cta-row">
              <a href="#candidature" className="pf-btn pf-btn--primary">
                Devenir Cabinet Fondateur
              </a>
              <Link href="/agents/pierre" className="pf-btn pf-btn--ghost">
                Découvrir Pierre
              </Link>
            </div>
            <p className="pf-note" style={{ marginInline: "auto" }}>
              Candidature étudiée par CloneStore. Aucun engagement pour rejoindre le
              programme. Versements soumis aux règles d’attribution et aux montants
              réellement encaissés.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
