# P-FINAL 02 — Legal Proof Template Generator
# Genere le template de proof JSON pour les validations juridiques.
# Ne valide rien juridiquement. Ne contacte aucun service externe.
# Compatible PowerShell 5.

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " P-FINAL 02 — Legal Proof Template" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ce script genere un template de preuve JSON pour les validations juridiques." -ForegroundColor White
Write-Host "Aucune validation juridique n'est effectuee ici." -ForegroundColor White
Write-Host ""

Write-Host "CHECKLIST LEGALE" -ForegroundColor Yellow
Write-Host "----------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pages a valider par le juriste:" -ForegroundColor White
Write-Host "  [ ] /legal/cgu          — Conditions Generales d'Utilisation" -ForegroundColor Cyan
Write-Host "  [ ] /legal/cgv          — Conditions Generales de Vente (449EUR/an)" -ForegroundColor Cyan
Write-Host "  [ ] /legal/dpa          — Data Processing Agreement RGPD" -ForegroundColor Cyan
Write-Host "  [ ] /legal/confidentialite — Politique de confidentialite" -ForegroundColor Cyan
Write-Host "  [ ] /legal/mentions     — Mentions legales (verifier 0 placeholder)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Informations societe a remplir dans mentions legales:" -ForegroundColor White
Write-Host "  [ ] Raison sociale et forme juridique" -ForegroundColor Cyan
Write-Host "  [ ] Capital social" -ForegroundColor Cyan
Write-Host "  [ ] SIREN/SIRET" -ForegroundColor Cyan
Write-Host "  [ ] Numero de TVA intracommunautaire" -ForegroundColor Cyan
Write-Host "  [ ] Adresse du siege social" -ForegroundColor Cyan
Write-Host "  [ ] Nom du directeur de publication" -ForegroundColor Cyan
Write-Host "  [ ] Hebergeur (Vercel/Railway + adresse + contact)" -ForegroundColor Cyan
Write-Host "  [ ] Contact RGPD / DPO" -ForegroundColor Cyan
Write-Host ""
Write-Host "Documents a envoyer au juriste:" -ForegroundColor White
Write-Host "  [ ] docs/PFINAL02_LEGAL_REVIEW_PACKET.md" -ForegroundColor Cyan
Write-Host "  [ ] docs/B47_FINAL_LEGAL_REVIEW_CHECKLIST.md" -ForegroundColor Cyan
Write-Host "  [ ] docs/B47_PIERRE_ALLOWED_AND_FORBIDDEN_CLAIMS.md" -ForegroundColor Cyan
Write-Host ""

$now = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"

Write-Host "TEMPLATE DE PREUVE JSON" -ForegroundColor Yellow
Write-Host "-----------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Coller dans go-live-proofs.local.json APRES validation juridique reelle:" -ForegroundColor White
Write-Host ""

$template = @"
{
  "proof_id": "LEGAL_CGU_VALIDATED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "",
  "evidence_type": "document",
  "evidence_ref": "go-live-evidence/legal/cgu-validation-email.pdf",
  "notes": "Email de validation de [Nom du juriste] en date du [date]"
},
{
  "proof_id": "LEGAL_CGV_VALIDATED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "",
  "evidence_type": "document",
  "evidence_ref": "go-live-evidence/legal/cgv-validation-email.pdf",
  "notes": "Email de validation de [Nom du juriste] en date du [date]"
},
{
  "proof_id": "LEGAL_DPA_VALIDATED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "",
  "evidence_type": "document",
  "evidence_ref": "go-live-evidence/legal/dpa-validation-dpo.pdf",
  "notes": "Validation DPO de [Nom du DPO] en date du [date]"
},
{
  "proof_id": "LEGAL_PRIVACY_VALIDATED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "",
  "evidence_type": "document",
  "evidence_ref": "go-live-evidence/legal/confidentialite-validation.pdf",
  "notes": "Validation politique confidentialite par [Nom du juriste]"
},
{
  "proof_id": "LEGAL_MENTIONS_VALIDATED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "Gael Hommet",
  "evidence_type": "screenshot",
  "evidence_ref": "go-live-evidence/legal/mentions-legales-sans-placeholder.png",
  "notes": "Verification manuelle: aucun placeholder visible sur /legal/mentions"
},
{
  "proof_id": "LEGAL_ENTITY_INFO_COMPLETED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "Gael Hommet",
  "evidence_type": "screenshot",
  "evidence_ref": "go-live-evidence/legal/infos-societe-completes.png",
  "notes": "SIREN, adresse, capital, hebergeur remplis"
},
{
  "proof_id": "LEGAL_HUMAN_REVIEW_COMPLETED",
  "status": "pending",
  "verified_at": "",
  "verified_by": "",
  "evidence_type": "document",
  "evidence_ref": "go-live-evidence/legal/revue-juridique-globale.pdf",
  "notes": "Revue globale des claims Pierre et guardrails B47 par [Nom du juriste]"
}
"@

Write-Host $template -ForegroundColor DarkGray
Write-Host ""
Write-Host "Documentation complete: docs/PFINAL02_LEGAL_REVIEW_PACKET.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " FIN — Template genere. Aucune validation effectuee." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
