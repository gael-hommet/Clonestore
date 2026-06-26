// CloneStory — emails COMMERCIAUX (SERVER-ONLY). Ton institutionnel, humain, très court.
// AUCUN vocabulaire d'affiliation, de gain, de commission, de part ni de richesse :
// le registre est honorifique. Réutilise le fournisseur d'envoi (Resend en prod,
// mode local explicite, jamais de faux succès en production).

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#0a0a0b;font-family:Georgia,'Times New Roman',serif;color:#f5f1e8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;background:#101013;border:1px solid rgba(184,168,136,.28);border-radius:2px">
<tr><td style="padding:34px 36px">
<p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:#b8a888;font-weight:600">CloneStory — Le Cercle des Partenaires Fondateurs</p>
<h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:#f5f1e8;font-weight:500">${title}</h1>
${bodyHtml}
<p style="margin:30px 0 0;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:#66635c">Le Cercle est un registre honorifique. Il ne confère aucune part, action, rémunération ni mandat.</p>
</td></tr></table></td></tr></table></body></html>`;
}
function btn(href: string, label: string): string {
  return `<p style="margin:0 0 20px"><a href="${href}" style="display:inline-block;background:#f5f1e8;color:#0a0a0b;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:14px;padding:14px 28px;border-radius:2px">${label}</a></p>`;
}
function para(t: string): string {
  return `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#b9b4a8">${t}</p>`;
}

export interface RenderedEmail { subject: string; html: string; text: string }

/** Rend l'email correspondant au type d'événement commercial. `registryUrl` = registre. */
export function renderCommercialEmail(kind: string, registryUrl: string): RenderedEmail {
  switch (kind) {
    case "client_paid":
      return {
        subject: "Une entreprise présentée est devenue cliente",
        html: shell("Une entreprise est devenue cliente",
          `${para("Une entreprise que vous avez présentée à CloneStore est devenue cliente. La contribution suit son cours de validation avant inscription définitive à votre registre.")}${btn(registryUrl, "Voir mon registre")}`),
        text: `Une entreprise que vous avez présentée est devenue cliente de CloneStore. Voir votre registre : ${registryUrl}`,
      };
    case "activation_completed":
      return {
        subject: "Une activation a été confirmée",
        html: shell("Activation confirmée",
          `${para("L'activation du produit par une entreprise que vous avez présentée a été confirmée. La contribution entre en période de validation.")}${btn(registryUrl, "Voir mon registre")}`),
        text: `Une activation a été confirmée. Voir votre registre : ${registryUrl}`,
      };
    case "validation_pending":
      return {
        subject: "Une contribution est en cours de validation",
        html: shell("Contribution en validation",
          `${para("Une de vos contributions au commencement de CloneStore est en cours de validation. Elle sera inscrite définitivement une fois toutes les vérifications satisfaites.")}${btn(registryUrl, "Voir mon registre")}`),
        text: `Une contribution est en cours de validation. Voir votre registre : ${registryUrl}`,
      };
    case "contribution_verified":
      return {
        subject: "Une contribution a été vérifiée",
        html: shell("Contribution vérifiée",
          `${para("Une de vos contributions au commencement de CloneStore a été vérifiée. Elle est désormais inscrite de manière permanente à votre registre.")}${btn(registryUrl, "Voir mon registre")}`),
        text: `Une de vos contributions a été vérifiée. Voir votre registre : ${registryUrl}`,
      };
    case "contribution_refunded":
      return {
        subject: "Une contribution a été annulée",
        html: shell("Contribution annulée",
          `${para("Une contribution précédemment enregistrée a été annulée à la suite d'un remboursement. Votre registre a été mis à jour en conséquence ; l'historique est conservé.")}${btn(registryUrl, "Voir mon registre")}`),
        text: `Une contribution a été annulée à la suite d'un remboursement. Voir votre registre : ${registryUrl}`,
      };
    case "contribution_disputed":
      return {
        subject: "Une contribution est en litige",
        html: shell("Contribution en litige",
          `${para("Une contribution fait l'objet d'un litige de paiement. Sa validation est suspendue le temps de la résolution. Aucune action de votre part n'est requise.")}${btn(registryUrl, "Voir mon registre")}`),
        text: `Une contribution fait l'objet d'un litige. Sa validation est suspendue. Voir votre registre : ${registryUrl}`,
      };
    case "distinction_awarded":
      return {
        subject: "Une distinction vous a été décernée",
        html: shell("Une distinction vous est décernée",
          `${para("Une distinction du Cercle des Partenaires Fondateurs vous a été décernée à la suite d'une contribution vérifiée. Elle figure désormais à votre registre.")}${btn(registryUrl, "Voir mon registre")}`),
        text: `Une distinction du Cercle vous a été décernée. Voir votre registre : ${registryUrl}`,
      };
    default:
      return {
        subject: "Mise à jour de votre registre",
        html: shell("Mise à jour", `${para("Votre registre a été mis à jour.")}${btn(registryUrl, "Voir mon registre")}`),
        text: `Votre registre a été mis à jour : ${registryUrl}`,
      };
  }
}
