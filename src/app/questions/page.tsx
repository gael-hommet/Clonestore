import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CreditCard,
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
    title: "Choisir un employÃ© IA",
    text: "CloneStore vous aide Ã  savoir si Pierre, Clara, Emma, Noah ou un autre employÃ© correspond Ã  votre besoin.",
    icon: UserRoundCheck,
  },
  {
    title: "Comprendre Pierre",
    text: "RÃ´le RH, documents, emails, missions, validations, historique et limites sur les sujets sensibles.",
    icon: Sparkles,
  },
  {
    title: "Paiement & accÃ¨s",
    text: "Aide sur le checkout, lâ€™activation dâ€™un employÃ© IA, lâ€™accÃ¨s au compte et les Ã©tapes aprÃ¨s paiement.",
    icon: CreditCard,
  },
  {
    title: "Cockpit & missions",
    text: "Comprendre Mes employÃ©s, les notifications, les validations, les rapports et lâ€™accÃ¨s aux cockpits spÃ©cialisÃ©s.",
    icon: Workflow,
  },
  {
    title: "SÃ©curitÃ© & contrÃ´le",
    text: "Explication des validations humaines, de CloneGuard, CloneTrace, des rÃ¨gles et des limites dâ€™autonomie.",
    icon: ShieldCheck,
  },
  {
    title: "Support gÃ©nÃ©ral",
    text: "Orientation vers le bon espace si vous ne savez pas encore oÃ¹ aller dans CloneStore.",
    icon: MessageSquareText,
  },
];

const suggestedQuestions = [
  "Quel employÃ© IA correspond Ã  mon besoin ?",
  "Je veux automatiser une partie RH, je commence par quoi ?",
  "Comment activer Pierre aprÃ¨s paiement ?",
  "OÃ¹ voir mes missions, validations et notifications ?",
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
                  Assistance guidÃ©e
                </span>
              </div>

              <h1>
                Une question ?
                <br />
                CloneStore vous rÃ©pond dâ€™abord.
              </h1>

              <p>
                Le support reste simple : vous posez votre question Ã  CloneStore,
                le systÃ¨me vous oriente vers le bon employÃ©, le bon espace ou la bonne action.
                Le contact email existe, mais il reste discret.
              </p>

              <div className="clonesupport-actions">
                <Link href="/assistant" className="clone-liquid-button clone-liquid-button--dark">
                  Ouvrir CloneChat
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link href="/agents" className="clone-liquid-button">
                  Voir les employÃ©s IA
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
                  <span>Support systÃ¨me</span>
                </div>
              </div>

              <div className="clonesupport-mini-bubbles">
                <span>â€œQuel employÃ© IA choisir ?â€</span>
                <span>â€œComment fonctionne Pierre ?â€</span>
                <span>â€œOÃ¹ suivre mes missions ?â€</span>
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
                  Demander Ã  CloneStore
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </LiquidGlass>
            );
          })}
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
              Ã€ utiliser uniquement si CloneChat ne suffit pas.
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