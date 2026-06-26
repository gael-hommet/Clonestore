// CloneStory — emails (SERVER-ONLY). Ton institutionnel, humain, élégant, très court.
// AUCUN vocabulaire d'affiliation, de gain, de part ou de richesse.
// Réutilise le fournisseur Phase E (Resend + mode local explicite, jamais de faux
// succès en production).

import { resolveFounderEmailProvider, type EmailSendResult } from "@/lib/founder-access/email-provider";
import { assertEmailConfigured } from "./config";

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#0a0a0b;font-family:Georgia,'Times New Roman',serif;color:#f5f1e8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;background:#101013;border:1px solid rgba(184,168,136,.28);border-radius:2px">
<tr><td style="padding:34px 36px">
<p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:#b8a888;font-weight:600">CloneStory — Le Cercle des Partenaires Fondateurs</p>
<h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:#f5f1e8;font-weight:500">${title}</h1>
${bodyHtml}
<p style="margin:30px 0 0;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:#66635c">Le Cercle est un registre honorifique. Il ne confère aucune part, action, rémunération ni mandat. <a href="https://clonestore.pro/founding-partners/conditions" style="color:#8d887d">Conditions du Cercle</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
}

function btn(href: string, label: string): string {
  return `<p style="margin:0 0 20px"><a href="${href}" style="display:inline-block;background:#f5f1e8;color:#0a0a0b;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:14px;padding:14px 28px;border-radius:2px">${label}</a></p>`;
}
function para(t: string): string {
  return `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#b9b4a8">${t}</p>`;
}

export function renderVerificationEmail(verifyUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: "Confirmez votre entrée dans le Cercle",
    html: shell(
      "Confirmez votre adresse",
      `${para("Vous venez de demander à rejoindre le Cercle des Partenaires Fondateurs de CloneStore. Confirmez votre adresse pour ouvrir votre registre personnel.")}${btn(verifyUrl, "Confirmer mon adresse")}${para("Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.")}`,
    ),
    text: `Confirmez votre adresse pour rejoindre le Cercle des Partenaires Fondateurs : ${verifyUrl}`,
  };
}

export function renderWelcomeEmail(registryUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: "Bienvenue dans le Cercle",
    html: shell(
      "Votre registre est ouvert",
      `${para("Vous êtes désormais Membre du Cercle Fondateur. Votre registre personnel vous attend : lien et code personnels, et la possibilité de faire une introduction.")}${btn(registryUrl, "Ouvrir mon registre")}${para("Le titre de Partenaire Fondateur de CloneStore et le numéro de registre définitif sont accordés après une première contribution vérifiée.")}`,
    ),
    text: `Bienvenue dans le Cercle. Ouvrez votre registre : ${registryUrl}`,
  };
}

export function renderConfirmIntroductionEmail(memberName: string, confirmUrl: string, refuseUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: `Confirmez-vous avoir découvert CloneStore grâce à ${memberName} ?`,
    html: shell(
      "Une confirmation vous est demandée",
      `${para(`${memberName} vous a présenté CloneStore et souhaite l'inscrire au registre du Cercle Fondateur.`)}${para(`Confirmez-vous avoir découvert CloneStore grâce à ${memberName} ?`)}${btn(confirmUrl, "Oui, je confirme")}<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px"><a href="${refuseUrl}" style="color:#8d887d">Non, je ne le confirme pas</a></p>${para("Sans confirmation, aucune contribution n'est enregistrée. En cas de refus, vos données sont effacées.")}`,
    ),
    text: `Confirmez-vous avoir découvert CloneStore grâce à ${memberName} ?\nOui : ${confirmUrl}\nNon : ${refuseUrl}`,
  };
}

export function renderIntroductionConfirmedEmail(prospectCompany: string, registryUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: "Une introduction a été confirmée",
    html: shell(
      "Introduction confirmée",
      `${para(`L'introduction de ${prospectCompany} a été confirmée et inscrite à votre registre. Elle deviendra une contribution vérifiée si elle aboutit à un client réel.`)}${btn(registryUrl, "Voir mon registre")}`,
    ),
    text: `L'introduction de ${prospectCompany} a été confirmée. Voir votre registre : ${registryUrl}`,
  };
}

export function renderIntroductionRefusedEmail(): { subject: string; html: string; text: string } {
  return {
    subject: "Une introduction n'a pas été confirmée",
    html: shell(
      "Introduction non confirmée",
      `${para("Une de vos introductions n'a pas été confirmée par le contact. Aucune contribution n'est enregistrée et les données du contact ont été effacées.")}`,
    ),
    text: "Une de vos introductions n'a pas été confirmée. Aucune contribution n'est enregistrée.",
  };
}

export function renderLinkRevokedEmail(): { subject: string; html: string; text: string } {
  return {
    subject: "Votre lien personnel a été révoqué",
    html: shell(
      "Lien personnel révoqué",
      `${para("Votre lien personnel a été révoqué. Vous pouvez en générer un nouveau depuis votre registre. Vos introductions déjà confirmées sont conservées.")}`,
    ),
    text: "Votre lien personnel a été révoqué. Générez-en un nouveau depuis votre registre.",
  };
}

export function renderContributionVerifiedEmail(registryUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: "Une contribution a été vérifiée",
    html: shell(
      "Contribution vérifiée",
      `${para("Une de vos contributions au commencement de CloneStore a été vérifiée. Elle est désormais inscrite de manière permanente à votre registre.")}${btn(registryUrl, "Voir mon registre")}`,
    ),
    text: `Une de vos contributions a été vérifiée. Voir votre registre : ${registryUrl}`,
  };
}

/** Notice institutionnelle générique (suspension/rétablissement/retrait). Ton sobre. */
export function renderSimpleNoticeEmail(title: string, body: string, registryUrl?: string): { subject: string; html: string; text: string } {
  return {
    subject: title,
    html: shell(title, `${para(body)}${registryUrl ? btn(registryUrl, "Ouvrir mon registre") : ""}`),
    text: registryUrl ? `${body}\n${registryUrl}` : body,
  };
}

/** Envoi best-effort via le fournisseur (Resend en prod, local en dev). */
export async function sendClonestoryEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}): Promise<EmailSendResult> {
  assertEmailConfigured(); // fail-closed en production (RESEND_API_KEY + expéditeur)
  const provider = resolveFounderEmailProvider();
  return provider.send(msg);
}
