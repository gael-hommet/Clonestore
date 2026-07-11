"use client";

// Cabinets Fondateurs CloneStore — landing publique interactive.
//
// SSR-safe : <MotionConfig reducedMotion="user"> au sommet ; on ne branche
// JAMAIS le rendu initial sur prefers-reduced-motion (pas d'écart d'hydratation).
// Effets « liquid metal » réalisés en CSS pur (halos radiaux + reflets chrome via
// dégradés) — aucun three.js / R3F / shadergradient. Fort dégradé mobile via CSS.
//
// COPY : formulations publiques sûres uniquement. Pierre = employé IA RH qui
// prépare / structure / suit / relance / documente / trace ; ses productions sont
// des brouillons soumis à validation humaine. Copy publique prudente : pas de
// promesse de garantie, de conformité légale, ni de substitution à une expertise.

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
        <Economics />
        <Calculator />
        <FiveCompanies />
        <HowItWorks />
        <WhoDoesWhat />
        <PierreIntro />
        <Transparency />
        <FounderAdvantages />
        <Faq />
        <ApplicationForm />
        <FinalCta />
      </main>

      <footer className="pf-footer">
        <p>Cabinets Fondateurs CloneStore — programme partenaires.</p>
        <p>
          <Link href="/">CloneStore</Link> · Démonstrations illustratives ·
          Brouillons soumis à validation humaine.
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
          <p className="pf-eyebrow">Programme partenaires — cabinets</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="pf-display" style={{ marginTop: "26px" }}>
            Ajoutez un <em>employé IA RH</em> à l&apos;offre de votre cabinet.
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="pf-lede pf-mt-md">
            Vous nous présentez les entreprises qui en ont besoin. CloneStore
            assure la démonstration, la vente, le déploiement et le support. Vous
            recevez <strong style={{ color: "var(--pf-mist)" }}>20 % de commission
            récurrente</strong>.
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <div className="pf-cta-row pf-mt-lg">
            <a href="#candidature" className="pf-btn pf-btn--primary">
              Devenir Cabinet Fondateur
            </a>
            <a href="#fonctionnement" className="pf-btn pf-btn--ghost">
              Découvrir le fonctionnement
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.34}>
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
      </div>
    </section>
  );
}

/* ── 2. Preuve économique ─────────────────────────────────────────────────── */
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
                Une commission simple, récurrente et lisible.
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

/* ── 3. Calculateur dynamique ─────────────────────────────────────────────── */
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
            Estimez votre commission récurrente.
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
              Chiffres estimatifs, ils dépendent des montants HT réellement
              encaissés. Repères : 5 clients ≈ 449 €/mois · 10 ≈ 898 € · 20 ≈
              1 796 € · 50 ≈ 4 490 €.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 4. Présentez-nous cinq entreprises ───────────────────────────────────── */
function FiveCompanies() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <div className="pf-glass" style={{ padding: "clamp(30px, 5vw, 60px)" }}>
          <Reveal>
            <p className="pf-eyebrow">Un premier pas concret</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="pf-heading pf-mt-md pf-max">
              Présentez-nous cinq entreprises. Nous faisons le reste.
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="pf-copy pf-mt-md">
              Vous connaissez des dirigeants qui passent trop de temps sur leur
              administration RH. Vous nous les présentez&nbsp;: nous préparons la
              démonstration illustrative, nous menons la vente, nous déployons Pierre
              et nous assurons le support. Votre nom reste associé à chaque client
              que vous avez apporté.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── 5. Fonctionnement en 5 étapes ────────────────────────────────────────── */
const STEPS = [
  {
    t: "Vous présentez",
    c: "Vous nous mettez en relation avec une entreprise qui a besoin de structurer sa RH.",
  },
  {
    t: "Nous démontrons",
    c: "CloneStore réalise une démonstration illustrative de Pierre, adaptée au contexte.",
  },
  {
    t: "Nous vendons",
    c: "Nous portons la proposition commerciale et l'abonnement à 449 €/mois.",
  },
  {
    t: "Nous déployons",
    c: "Pierre est mis en place ; il prépare, suit et relance, brouillons soumis à validation humaine.",
  },
  {
    t: "Vous êtes rémunéré",
    c: "20 % de commission récurrente, calculée sur le HT réellement encaissé, chaque mois.",
  },
];

function HowItWorks() {
  return (
    <section className="pf-section" id="fonctionnement">
      <div className="pf-shell">
        <Reveal>
          <p className="pf-eyebrow">Fonctionnement</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md pf-max">
            Cinq étapes, un rôle clair pour chacun.
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
      </div>
    </section>
  );
}

/* ── 6. Ce que fait le cabinet / ce que fait CloneStore ───────────────────── */
function WhoDoesWhat() {
  return (
    <section className="pf-section">
      <div className="pf-shell">
        <Reveal>
          <p className="pf-eyebrow">Répartition des rôles</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="pf-heading pf-mt-md pf-max">
            Vous ouvrez la porte. Nous portons l&apos;exécution.
          </h2>
        </Reveal>

        <div className="pf-split pf-mt-lg">
          <Reveal>
            <div className="pf-col">
              <div className="pf-col__head">
                <span className="pf-col__tag">Le cabinet</span>
              </div>
              <ul className="pf-list">
                <li>Présente les entreprises de son réseau qui en ont besoin.</li>
                <li>Apporte sa connaissance du terrain et sa relation de confiance.</li>
                <li>Reste l&apos;interlocuteur privilégié de ses clients.</li>
                <li>Perçoit une commission récurrente, sans gérer la facturation.</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="pf-col pf-col--accent">
              <div className="pf-col__head">
                <span className="pf-col__tag">CloneStore</span>
              </div>
              <ul className="pf-list">
                <li>Réalise la démonstration illustrative de Pierre.</li>
                <li>Mène la vente et met en place l&apos;abonnement.</li>
                <li>Déploie Pierre et forme l&apos;entreprise à son usage.</li>
                <li>Assure le support et la continuité dans le temps.</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── 7. Présentation courte de Pierre ─────────────────────────────────────── */
function PierreIntro() {
  return (
    <section className="pf-section">
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
              <p className="pf-eyebrow">L&apos;employé que vous présentez</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="pf-heading pf-mt-md">Pierre, employé IA RH.</h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="pf-copy pf-mt-md">
                Pierre reçoit une demande RH, la transforme en mission, prépare le
                travail, suit, relance et garde la trace. Il structure des documents
                prêts à relire et à valider. Ses productions sont des{" "}
                <strong>brouillons soumis à validation humaine</strong> : les
                décisions sensibles restent entre les mains de l&apos;entreprise.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="pf-disclaimer pf-mt-md">
                <span className="pf-disclaimer__dot" aria-hidden="true" />
                <p>
                  Validation humaine systématique sur le sensible. Pierre prépare et
                  documente&nbsp;; il vient en appui de votre expertise et de celle de
                  vos clients, et n&apos;engage aucune action à leur place sans revue.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 8. Sécurité & transparence des commissions ───────────────────────────── */
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
    t: "Jamais annoncée d'avance",
    c: "Une commission n'est jamais présentée comme acquise avant l'encaissement effectif du client.",
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

/* ── 9. Avantages du statut Cabinet Fondateur ─────────────────────────────── */
const ADVANTAGES = [
  {
    t: "Taux fondateur préservé",
    c: "Les cabinets présents à l'ouverture conservent leur taux de commission récurrente dans la durée.",
  },
  {
    t: "Accompagnement dédié",
    c: "Un interlocuteur CloneStore vous accompagne sur les présentations et les démonstrations.",
  },
  {
    t: "Suivi transparent",
    c: "Vous suivez vos clients apportés et vos commissions estimées depuis un espace dédié.",
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
            Les premiers cabinets partenaires gardent une longueur d&apos;avance.
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

/* ── 10. FAQ ──────────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Que dois-je faire concrètement ?",
    a: "Vous nous présentez des entreprises de votre réseau qui gagneraient du temps sur leur RH. CloneStore prend en charge la démonstration, la vente, le déploiement et le support.",
  },
  {
    q: "Combien suis-je rémunéré ?",
    a: "20 % de commission récurrente sur chaque client actif que vous avez apporté, calculée sur le montant HT réellement encaissé, versée chaque mois via Stripe.",
  },
  {
    q: "Dois-je gérer la facturation ou le support ?",
    a: "Non. Vous n'avez ni stock, ni facturation, ni support technique à porter. CloneStore assure l'ensemble de l'exécution et de la relation d'abonnement.",
  },
  {
    q: "Qu'est-ce que Pierre fait exactement ?",
    a: "Pierre est un employé IA RH : il prépare, structure, suit, relance et documente le travail RH. Ses productions sont des brouillons soumis à validation humaine ; les décisions sensibles restent prises par l'entreprise.",
  },
  {
    q: "Quand la commission est-elle acquise ?",
    a: "Une commission n'est jamais présentée comme acquise avant l'encaissement effectif. Elle est calculée sur les paiements confirmés, puis versée mensuellement.",
  },
  {
    q: "Dans quels pays le programme est-il ouvert ?",
    a: "Le programme s'adresse aux cabinets en France, Belgique, Luxembourg et Suisse. Indiquez votre pays dans le formulaire de candidature.",
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

/* ── 11. Formulaire de candidature RÉEL ───────────────────────────────────── */
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
        | { ok: boolean; error?: string }
        | null;

      if (data?.ok) {
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
            <h2 className="pf-heading">Candidature reçue.</h2>
            <p className="pf-copy" style={{ margin: "18px auto 0" }}>
              Merci. Votre candidature au programme Cabinets Fondateurs CloneStore a
              bien été enregistrée. Notre équipe revient vers vous pour la suite.
            </p>
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
            Remplissez ce formulaire pour rejoindre le programme. Nous revenons vers
            vous pour organiser une première présentation.
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
              Démonstrations illustratives. Pierre prépare des brouillons soumis à
              validation humaine. Les commissions sont calculées sur le HT réellement
              encaissé.
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 12. CTA final ────────────────────────────────────────────────────────── */
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
              Ajoutez un employé IA RH à l&apos;offre de votre cabinet.
            </h2>
            <p className="pf-copy pf-mt-md" style={{ marginInline: "auto" }}>
              Présentez-nous cinq entreprises pour commencer. Nous assurons la
              démonstration, la vente, le déploiement et le support. Vous recevez 20 %
              de commission récurrente.
            </p>
            <div className="pf-cta-row">
              <a href="#candidature" className="pf-btn pf-btn--primary">
                Devenir Cabinet Fondateur
              </a>
              <Link href="/agents/pierre" className="pf-btn pf-btn--ghost">
                Découvrir Pierre
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
