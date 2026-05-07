"use client";

import Link from "next/link";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  FileImage,
  FilePlus2,
  ImagePlus,
  Mail,
  Mic2,
  Paperclip,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { cn } from "@/lib/utils";

type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  time: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    time: "Maintenant",
    content:
      "Bonjour, je suis CloneStore. Je peux vous aider Ã  comprendre le systÃ¨me, choisir un employÃ© IA, expliquer Pierre, le cockpit, le paiement, la sÃ©curitÃ©, les accÃ¨s ou vous orienter vers le bon espace.",
  },
];

const quickPrompts = [
  "Quel employÃ© IA choisir pour les RH ?",
  "Explique-moi Pierre simplement.",
  "Comment accÃ©der Ã  mon espace aprÃ¨s paiement ?",
  "OÃ¹ voir mes missions et notifications ?",
  "Comment fonctionne CloneVoice ?",
];

const attachmentActions = [
  {
    label: "Ajouter un fichier",
    icon: FilePlus2,
  },
  {
    label: "Ajouter une image",
    icon: ImagePlus,
  },
  {
    label: "Joindre un document",
    icon: Paperclip,
  },
];

function nowLabel() {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    time: nowLabel(),
  };
}

function getCloneStoreReply(input: string) {
  const value = input.toLowerCase();

  if (value.includes("pierre") || value.includes("rh") || value.includes("ressources")) {
    return "Pour un besoin RH, lâ€™employÃ© le plus logique est Pierre. Il est pensÃ© comme un poste RH opÃ©rationnel automatisÃ© : documents, emails, relances, missions, validations et historique. Les sujets sensibles restent encadrÃ©s par validation humaine.";
  }

  if (value.includes("paiement") || value.includes("checkout") || value.includes("prix") || value.includes("tarif")) {
    return "Le parcours est simple : vous choisissez lâ€™employÃ© IA, vous passez par le paiement, puis lâ€™accÃ¨s est ouvert dans votre espace CloneStore. Le cockpit permet ensuite de suivre les employÃ©s, les missions, les notifications et les validations.";
  }

  if (value.includes("cockpit") || value.includes("mission") || value.includes("notification") || value.includes("mes employÃ©s")) {
    return "Le cockpit global sert Ã  piloter CloneStore : dialogue central avec le systÃ¨me, accÃ¨s aux employÃ©s possÃ©dÃ©s, missions, validations, notifications internes, messagerie et raccourcis vers les cockpits spÃ©cialisÃ©s.";
  }

  if (value.includes("voice") || value.includes("voix") || value.includes("clonevoice")) {
    return "CloneVoice est la couche vocale globale. Lâ€™objectif est de pouvoir parler Ã  CloneStore depuis le site, y compris depuis la homepage, puis transformer la demande en orientation, mission ou action contrÃ´lÃ©e.";
  }

  if (value.includes("sÃ©curitÃ©") || value.includes("rgpd") || value.includes("donnÃ©e") || value.includes("confidentiel")) {
    return "CloneStore doit rester gouvernÃ© : pÃ©rimÃ¨tres par employÃ©, validations humaines sur les actions sensibles, traÃ§abilitÃ© via CloneTrace, rÃ¨gles via CloneGuard et contrÃ´le clair cÃ´tÃ© entreprise.";
  }

  return "Je peux vous orienter dans CloneStore : choix dâ€™un employÃ© IA, fonctionnement de Pierre, cockpit, paiement, accÃ¨s, sÃ©curitÃ©, support ou technologies comme CloneOS, CloneADN, CloneGuard, CloneTrace et CloneVoice.";
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const hasConversation = useMemo(() => messages.length > 1, [messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function sendMessage(value: string) {
    const clean = value.trim();

    if (!clean) {
      return;
    }

    setMessages((current) => [
      ...current,
      createMessage("user", clean),
      createMessage("assistant", getCloneStoreReply(clean)),
    ]);

    setInput("");
    setAttachmentsOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <main className="cs-page clonechat-page">
      <div className="clonechat-shell">
        <section className="clonechat-topbar">
          <div className="clonechat-topbar-left">
            <span className="cs-pill">
              <Sparkles className="h-3.5 w-3.5 text-[#6f83ff]" />
              CloneChat
            </span>
            <span className="cs-pill">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
              Assistance systÃ¨me
            </span>
          </div>

          <div className="clonechat-topbar-right">
            <Link href="/questions">Support</Link>
            <Link href="/agents">EmployÃ©s IA</Link>
          </div>
        </section>

        <section className="clonechat-main">
          {!hasConversation ? (
            <div className="clonechat-welcome">
              <div className="clonechat-orb">
                <Bot className="h-8 w-8" />
              </div>

              <h1>Comment puis-je vous aider ?</h1>

              <p>
                Posez une question sur CloneStore, les employÃ©s IA, Pierre, le cockpit,
                le paiement, la sÃ©curitÃ© ou le support.
              </p>

              <div className="clonechat-suggestions">
                {quickPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="clonechat-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "clonechat-message-row",
                  message.role === "user" && "clonechat-message-row--user"
                )}
              >
                <div
                  className={cn(
                    "clonechat-message",
                    message.role === "user" && "clonechat-message--user"
                  )}
                >
                  <div className="clonechat-message-meta">
                    <span>{message.role === "assistant" ? "CloneStore" : "Vous"}</span>
                    <small>{message.time}</small>
                  </div>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </section>

        <section className="clonechat-composer-zone">
          {attachmentsOpen ? (
            <LiquidGlass
              variant="panel"
              intensity="medium"
              refractive
              className="clonechat-attachment-panel"
            >
              <div className="clonechat-attachment-head">
                <p>Ajouter au chat</p>
                <button type="button" onClick={() => setAttachmentsOpen(false)} aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="clonechat-attachment-grid">
                {attachmentActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button key={action.label} type="button">
                      <Icon className="h-4 w-4" />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="clonechat-attachment-note">
                Les fichiers et images seront exploitÃ©s plus tard par CloneStore pour analyser,
                expliquer ou orienter le client dans son espace.
              </p>
            </LiquidGlass>
          ) : null}

          <LiquidGlass
            variant="panel"
            intensity="strong"
            refractive
            className="clonechat-composer-glass"
          >
            <form onSubmit={handleSubmit} className="clonechat-composer">
              <button
                type="button"
                className="clonechat-icon-button"
                onClick={() => setAttachmentsOpen((value) => !value)}
                aria-label="Ajouter un fichier ou une image"
              >
                <Plus className="h-5 w-5" />
              </button>

              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Demandez Ã  CloneStore..."
              />

              <button type="button" className="clonechat-icon-button" aria-label="Ajouter une image">
                <FileImage className="h-5 w-5" />
              </button>

              <button type="button" className="clonechat-icon-button" aria-label="Parler Ã  CloneStore">
                <Mic2 className="h-5 w-5" />
              </button>

              <button type="submit" className="clonechat-send-button" aria-label="Envoyer">
                <ArrowUp className="h-5 w-5" />
              </button>
            </form>
          </LiquidGlass>

          <p className="clonechat-contact-hint">
            En dernier recours :{" "}
            <Link href="mailto:support@clonestore.pro">
              support@clonestore.pro
              <Mail className="h-3.5 w-3.5" />
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}