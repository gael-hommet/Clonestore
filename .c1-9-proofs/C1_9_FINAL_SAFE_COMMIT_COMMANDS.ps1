# C1.9 — COMMANDES DE MISE EN SCÈNE, À EXÉCUTER PAR LE PROPRIÉTAIRE UNIQUEMENT.
#
# Ce fichier n'est PAS exécuté par la session qui l'a écrit. Aucun `git add`, aucun commit,
# aucun push, aucun déploiement n'a eu lieu.
#
# Il met en scène EXACTEMENT les fichiers CloneChat de cette session, un par un. Pas de
# `git add .` : le dépôt contient le travail en cours d'une session P20 voisine, qui ne doit
# jamais être emporté par accident.
#
# ATTENTION — `git.exe` est bloqué par l'OS dans ce dépôt pour la session agent. Ces
# commandes sont destinées à un terminal propriétaire où git fonctionne.
#
# Vérifier AVANT : que `git status` ne montre rien d'inattendu, et que les fichiers listés
# ci-dessous sont bien les seuls que vous souhaitez publier.

$ErrorActionPreference = "Stop"
Set-Location "C:\Users\homme\clonestore"

# ── 1) Sources CloneChat modifiées ou créées par cette session ────────────────
$sources = @(
  "src/app/api/assistant/chat/route.ts",
  "src/lib/clonechat/intelligence/c1-1/parrain-turn-runtime.ts",
  "src/lib/clonechat/intelligence/c1-9/conversation-memory.ts",
  "src/lib/clonechat/intelligence/c1-9/intelligence-runtime.ts",
  "src/lib/clonechat/intelligence/c1-9/response-composer.ts",
  "src/lib/clonechat/intelligence/c1-9/semantic-retrieval.ts",
  "src/lib/clonechat/intelligence/c1-9/shadow-context.ts",
  "src/lib/clonechat/intelligence/c1-9/shadow-log.ts",
  "src/lib/clonechat/intelligence/c1-9/shadow-runner.ts",
  "src/lib/clonechat/intelligence/c1-9/truth-context.ts",
  "src/lib/clonechat/knowledge/sources.ts",
  "src/lib/clonechat/public-answer/index.ts",
  "src/lib/clonechat/public-answer/public-output-guard.ts"
)

# ── 2) Tests ──────────────────────────────────────────────────────────────────
$tests = @(
  "src/app/api/assistant/__tests__/c1-9-shadow-isolation.test.ts",
  "src/app/api/assistant/__tests__/c1-9-mode-on.test.ts",
  "src/app/api/assistant/__tests__/c18-reopened-route-reference.test.ts",
  "src/lib/clonechat/intelligence/c1-9/__tests__/c1-9-neutralization.test.ts",
  "src/lib/clonechat/intelligence/c1-9/__tests__/c1-9-memory-correction.test.ts",
  "src/lib/clonechat/intelligence/c1-9/__tests__/c1-9-grounding-diagnostic.test.ts",
  "src/lib/clonechat/intelligence/c1-9/__tests__/c1-9-campaign-100.test.ts",
  "src/lib/clonechat/intelligence/c1-9/__tests__/c1-9-campaign-targeted.test.ts",
  "src/lib/clonechat/navigation/__tests__/torture-1000.test.ts",
  "src/lib/clonechat/navigation/__tests__/frozen-capture.test.ts",
  "src/lib/clonechat/navigation/__tests__/c18-a2-remediated-recapture.test.ts"
)

# ── 3) Outil de campagne navigateur ───────────────────────────────────────────
$scripts = @("scripts/c1-9-browser-campaign.mjs")

foreach ($f in ($sources + $tests + $scripts)) {
  if (Test-Path $f) { git add -- $f } else { Write-Warning "absent, ignoré : $f" }
}

# ── 4) Preuves (facultatif — décommentez si vous versionnez les artefacts) ────
# git add -- .c1-9-proofs

# ── 5) NE JAMAIS mettre en scène ──────────────────────────────────────────────
#   .env.local              (contient des clés ET une URL de base de PRODUCTION)
#   .next*, .next-c19       (sorties de compilation)
#   src/lib/clonestore/**   (chantier P20 voisin)
#   src/lib/pierre/**       (chantier P20 voisin)
#   journaux temporaires

Write-Output "--- Contrôle avant commit : relisez cette liste ---"
git status --short

Write-Output ""
Write-Output "Si et seulement si la liste ci-dessus ne contient QUE du CloneChat :"
Write-Output '  git commit -m "feat(clonechat): C1.9 shadow + mode on + grounding fixes"'
Write-Output "Aucun push n'est proposé ici : la décision reste la vôtre."
