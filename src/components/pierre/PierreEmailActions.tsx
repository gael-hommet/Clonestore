"use client";

import { useEffect, useState } from "react";

type PierreEmailActionsProps = {
  initialSubject?: string;
  initialBodyText?: string;
  initialBodyHtml?: string;
  disabled?: boolean;
  isLoading?: boolean;
  onSend: (payload: {
    recipient_email: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body_text: string;
    body_html: string;
  }) => Promise<unknown> | unknown;
  onDraft: (payload: {
    recipient_email?: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body_text: string;
    body_html: string;
  }) => Promise<unknown> | unknown;
};

export function PierreEmailActions({
  initialSubject,
  initialBodyText,
  initialBodyHtml,
  disabled,
  isLoading,
  onSend,
  onDraft,
}: PierreEmailActionsProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(initialSubject || "");
  const [bodyText, setBodyText] = useState(initialBodyText || "");
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml || "");

  useEffect(() => {
    setSubject(initialSubject || "");
  }, [initialSubject]);

  useEffect(() => {
    setBodyText(initialBodyText || "");
  }, [initialBodyText]);

  useEffect(() => {
    setBodyHtml(initialBodyHtml || "");
  }, [initialBodyHtml]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-white">Email</p>
        <p className="mt-1 text-xs leading-6 text-white/50">
          Envoi ou brouillon Pierre. Destinataires pro et perso autorisés.
        </p>
      </div>

      <div className="space-y-3">
        <input
          value={recipientEmail}
          onChange={(event) => setRecipientEmail(event.target.value)}
          placeholder="Destinataire principal"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={cc}
            onChange={(event) => setCc(event.target.value)}
            placeholder="CC"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />

          <input
            value={bcc}
            onChange={(event) => setBcc(event.target.value)}
            placeholder="BCC"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>

        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Objet"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
        />

        <textarea
          value={bodyText}
          onChange={(event) => setBodyText(event.target.value)}
          placeholder="Version texte"
          className="min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/30"
        />

        <textarea
          value={bodyHtml}
          onChange={(event) => setBodyHtml(event.target.value)}
          placeholder="Version HTML"
          className="min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/30"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            disabled={disabled || isLoading}
            onClick={() =>
              void onDraft({
                recipient_email: recipientEmail,
                cc,
                bcc,
                subject,
                body_text: bodyText,
                body_html: bodyHtml,
              })
            }
            className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Action..." : "Créer le brouillon"}
          </button>

          <button
            type="button"
            disabled={disabled || isLoading || !recipientEmail.trim()}
            onClick={() =>
              void onSend({
                recipient_email: recipientEmail,
                cc,
                bcc,
                subject,
                body_text: bodyText,
                body_html: bodyHtml,
              })
            }
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Envoi..." : "Envoyer maintenant"}
          </button>
        </div>
      </div>
    </div>
  );
}