import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CreditCard,
  Eye,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Workflow,
} from "lucide-react";

import { LiquidGlass } from "@/components/ui/LiquidGlass";

const supportSections = [
  {
    title: "Choisir un employé IA",
    text: "CloneStore vous aide à savoir si Pierre, Clara, Emma, Noah ou un autre employé correspond à votre besoin.",
    icon: UserRoundCheck,
  },
  {
    title: "Comprendre Pierre",
    text: "Rôle RH, documents, emails, missions, validations, historique et limites sur les sujets sensibles.",
    icon: Sparkles,
  },
  {
    title: "Paiement & accès",
    text: "Aide sur le checkout, l’activation d’un employé IA, l’accès au compte et les étapes après paiement.",
    icon: CreditCard,
  },
  {
    title: "Cockpit & missions",
    text: "Comprendre Mes employés, les notifications, les validations, les rapports et l’accès aux cockpits spécialisés.",
    icon: Workflow,
  },
  {
    title: "Sécurité & contrôle",
    text: "Explication des validations humaines, de CloneGuard, CloneTrace, des règles et des limites d’autonomie.",
    icon: ShieldCheck,
  },
  {
    title: "Support général",
    text: "Orientation vers le bon espace si vous ne savez pas encore où aller dans CloneStore.",
    icon: MessageSquareText,
  },
];

const suggestedQuestions = [
  "Quel employé IA correspond à mon besoin ?",
  "Je veux automatiser une partie RH, je commence par quoi ?",
  "Comment activer Pierre après paiement ?",
  "Où voir mes missions, validations et notifications ?",
];

export default function QuestionsPage() {
  return (
    <main className="cs-page clonesupport-page">
      <div className="clonesupport-shell">
        <section className="clonesupport-hero">
          <LiquidGlass
            variant="panel"
            intensity="strong"
            refractive
            className="clonesupport-hero-panel"
          >
            <div className="clonesupport-ambient" aria-hidden="true" />

            <div className="clonesupport-copy">
              <div className="flex flex-wrap gap-2">
                <span className="cs-pill">
                  <MessageSquareText className="h-3.5 w-3.5 text-[#6f83ff]" />
                  Support CloneStore
                </span>
                <span className="cs-pill">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                  Assistance guidée
                </span>
              </div>

              <h1>
                Une question ?
                <br />
                CloneStore vous répond d’abord.
              </h1>

              <p>
                Le support reste simple : vous posez votre question à CloneStore,
                le système vous oriente vers le bon employé, le bon espace ou la bonne action.
                Le contact email existe, mais il reste discret.
              </p>

              <div className="clonesupport-actions">
                <Link href="/assistant" className="clone-liquid-button clone-liquid-button--dark">
                  Ouvrir CloneChat
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link href="/agents" className="clone-liquid-button">
                  Voir les employés IA
                  <Bot className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <LiquidGlass
              variant="clear"
              intensity="soft"
              className="clonesupport-mini-chat"
            >
              <div className="clonesupport-mini-head">
                <div className="clonesupport-mini-orb">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p>CloneStore</p>
                  <span>Support système</span>
                </div>
              </div>

              <div className="clonesupport-mini-bubbles">
                <span>“Quel employé IA choisir ?”</span>
                <span>“Comment fonctionne Pierre ?”</span>
                <span>“Où suivre mes missions ?”</span>
              </div>

              <Link href="/assistant">
                Poser la question dans CloneChat
                <ArrowRight className="h-4 w-4" />
              </Link>
            </LiquidGlass>
          </LiquidGlass>
        </section>

        <section className="clonesupport-grid">
          {supportSections.map((section) => {
            const Icon = section.icon;

            return (
              <LiquidGlass
                key={section.title}
                variant="panel"
                intensity="medium"
                interactive
                className="clonesupport-card"
              >
                <div className="clonesupport-card-icon">
                  <Icon className="h-5 w-5" />
                </div>
                <p>{section.title}</p>
                <span>{section.text}</span>
                <Link href="/assistant">
                  Demander à CloneStore
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </LiquidGlass>
            );
          })}
        </section>

        {/* FAQ Pierre */}
        <section>
          <LiquidGlass
            variant="panel"
            intensity="medium"
            className="rounded-[2.2rem] p-6 md:p-8"
          >
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="cs-eyebrow">Pierre — Questions fréquentes</p>
                <h2 className="cs-heading mt-2 text-xl md:text-2xl">
                  Tout comprendre avant de décider.
                </h2>
              </div>
              <Link
                href="/demo/pierre"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.82),rgba(255,250,244,0.56))] px-4 py-2 text-sm font-medium text-[var(--cs-ink-2)] transition hover:-translate-y-0.5"
              >
                <Eye className="h-4 w-4" />
                Voir la démo Pierre
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                {
                  q: "Pierre est-il un chatbot ?",
                  a: "Non. Pierre est un poste RH opérationnel automatisé. Il comprend une demande RH libre, la transforme en mission structurée, prépare des documents et des emails, suit les relances et garde une trace claire — comme un collaborateur RH, pas comme un bot de réponses.",
                },
                {
                  q: "Puis-je voir Pierre en action avant d'acheter ?",
                  a: "Oui. La démo illustrative sur /demo/pierre montre 3 scénarios complets : recrutement, absence et onboarding. Vous voyez la mission interprétée, les tâches créées, le document brouillon, l'email prêt et la trace CloneTrace. Données fictives, aucun appel IA réel.",
                },
                {
                  q: "La démo utilise-t-elle mes données ?",
                  a: "Non. La démo est 100% illustrative avec des données entièrement fictives. Aucune donnée n'est enregistrée, aucun email n'est envoyé, aucun compte n'est créé.",
                },
                {
                  q: "Pierre envoie-t-il des emails tout seul ?",
                  a: "Non. Pierre prépare les emails sous forme de brouillons. L'envoi nécessite toujours une validation humaine explicite. Pierre ne prend aucune action externe sans autorisation.",
                },
                {
                  q: "Pierre remplace-t-il un juriste ou un avocat ?",
                  a: "Non. Pierre prépare des documents RH opérationnels courants. Il ne fournit pas d'avis juridique, ne remplace pas un avocat et ne prend pas de décisions disciplinaires autonomes. La validation humaine reste obligatoire pour les actes sensibles.",
                },
                {
                  q: "Pourquoi Pierre vaut 449 €/mois ?",
                  a: "Pierre absorbe une part réelle du travail RH répétitif : documents, emails, relances, suivi de missions, traçabilité. Le gain de temps et la réduction de charge mentale sont généralement perceptibles dès les premières semaines d'utilisation, selon le volume RH de l'entreprise — un résultat individuel peut varier.",
                },
              ].map((item) => (
                <LiquidGlass
                  key={item.q}
                  variant="clear"
                  intensity="soft"
                  className="rounded-[1.5rem] p-5 space-y-2"
                >
                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{item.q}</p>
                  <p className="text-sm leading-7 text-[var(--cs-ink-4)]">{item.a}</p>
                </LiquidGlass>
              ))}
            </div>
          </LiquidGlass>
        </section>

        <section className="clonesupport-bottom">
          <LiquidGlass
            variant="panel"
            intensity="medium"
            refractive
            className="clonesupport-questions"
          >
            <div>
              <p className="cs-eyebrow">Questions utiles</p>
              <h2>Commencez par CloneChat.</h2>
            </div>

            <div className="clonesupport-question-list">
              {suggestedQuestions.map((question) => (
                <Link key={question} href={`/assistant?question=${encodeURIComponent(question)}`}>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{question}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </LiquidGlass>

          <LiquidGlass
            variant="clear"
            intensity="soft"
            className="clonesupport-contact"
          >
            <p>Contact direct</p>
            <span>
              À utiliser uniquement si CloneChat ne suffit pas.
            </span>

            <Link href="mailto:support@clonestore.pro">
              <Mail className="h-4 w-4" />
              support@clonestore.pro
            </Link>
          </LiquidGlass>
        </section>
      </div>
    </main>
  );
}