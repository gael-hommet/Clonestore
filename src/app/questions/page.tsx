export const metadata = {
  title: "Support — CloneStore",
  description: "Centre d’aide et support CloneStore.",
};

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      {/* Header */}
      <header className="space-y-4 border-b pb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Support CloneStore
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Une question sur un clone, un abonnement ou l’utilisation de la plateforme ?
          Notre équipe support vous répond rapidement.
        </p>
      </header>

      {/* Contact card */}
      <section className="mt-10">
        <div className="rounded-2xl border p-6 md:p-8 space-y-4">
          <h2 className="text-xl font-semibold">Contacter le support</h2>

          <p className="text-sm text-muted-foreground">
            Pour toute demande technique, commerciale ou liée à votre compte,
            écrivez-nous à l’adresse ci-dessous. Nous faisons le maximum pour
            répondre dans les meilleurs délais.
          </p>

          <div className="rounded-xl bg-muted/40 border px-4 py-3 font-mono text-sm">
            clonestore@clonestore.pro
          </div>

          <p className="text-xs text-muted-foreground">
            Conseil : pour un traitement plus rapide, précisez votre email de compte
            CloneStore et le clone concerné.
          </p>
        </div>
      </section>

      {/* FAQ rapide */}
      <section className="mt-12 space-y-6">
        <h2 className="text-xl font-semibold">Questions fréquentes</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-5 space-y-2">
            <p className="font-medium">Comment accéder à mon clone ?</p>
            <p className="text-sm text-muted-foreground">
              Après paiement, votre clone est activé automatiquement dans votre
              espace client, rubrique « Mes clones ».
            </p>
          </div>

          <div className="rounded-xl border p-5 space-y-2">
            <p className="font-medium">Puis-je résilier à tout moment ?</p>
            <p className="text-sm text-muted-foreground">
              Oui. La résiliation se fait depuis votre espace client. L’accès reste
              actif jusqu’à la fin de la période en cours.
            </p>
          </div>

          <div className="rounded-xl border p-5 space-y-2">
            <p className="font-medium">Mes données sont-elles sécurisées ?</p>
            <p className="text-sm text-muted-foreground">
              Oui. CloneStore applique des mesures techniques et organisationnelles
              strictes pour protéger les données de votre entreprise.
            </p>
          </div>

          <div className="rounded-xl border p-5 space-y-2">
            <p className="font-medium">Je ne trouve pas ma réponse</p>
            <p className="text-sm text-muted-foreground">
              Contactez-nous directement par email, nous vous aiderons rapidement.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
