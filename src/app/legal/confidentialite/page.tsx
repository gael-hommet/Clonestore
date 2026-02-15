export const metadata = {
  title: "Politique de confidentialité — CloneStore",
  description: "Politique de confidentialité de CloneStore.",
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      {/* Header */}
      <header className="space-y-4 border-b pb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Politique de confidentialité
        </h1>
        <p className="text-sm text-muted-foreground">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
        </p>
        <p className="text-muted-foreground max-w-2xl">
          Chez CloneStore, la protection de vos données est une priorité. Cette politique
          explique de manière transparente quelles données nous collectons, pourquoi nous les
          utilisons et quels sont vos droits conformément au RGPD.
        </p>
      </header>

      {/* Content */}
      <div className="mt-10 space-y-10 text-sm leading-relaxed">
        {/* Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Données collectées</h2>
          <p className="text-muted-foreground">
            Lors de la création d’un compte et de l’utilisation des services CloneStore,
            nous pouvons collecter différentes catégories de données personnelles :
          </p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>données d’identification (email, nom si fourni),</li>
            <li>données de commande et d’abonnement,</li>
            <li>données d’utilisation des clones IA,</li>
            <li>journaux techniques nécessaires au bon fonctionnement du service.</li>
          </ul>
          <p className="text-muted-foreground">
            Nous ne collectons que les données strictement nécessaires au fonctionnement
            et à l’amélioration du service.
          </p>
        </section>

        {/* Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Finalités du traitement</h2>
          <p className="text-muted-foreground">
            Les données personnelles sont utilisées uniquement pour des finalités déterminées,
            explicites et légitimes, notamment :
          </p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>fourniture et fonctionnement des clones IA,</li>
            <li>gestion des comptes utilisateurs,</li>
            <li>gestion des paiements et abonnements,</li>
            <li>sécurité de la plateforme et prévention de la fraude,</li>
            <li>amélioration continue des services CloneStore.</li>
          </ul>
        </section>

        {/* Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Base légale</h2>
          <p className="text-muted-foreground">
            Les traitements de données reposent sur :
          </p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>l’exécution du contrat lors de l’utilisation du service,</li>
            <li>l’intérêt légitime (sécurité, prévention des abus, amélioration produit),</li>
            <li>votre consentement lorsque celui-ci est requis (ex : communications marketing).</li>
          </ul>
        </section>

        {/* Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Partage des données</h2>
          <p className="text-muted-foreground">
            CloneStore ne revend jamais vos données personnelles.
          </p>
          <p className="text-muted-foreground">
            Certaines données peuvent être transmises à des sous-traitants techniques
            strictement nécessaires au fonctionnement du service, notamment :
          </p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>hébergement et infrastructure cloud,</li>
            <li>prestataires de paiement sécurisés,</li>
            <li>outils techniques indispensables au fonctionnement des clones.</li>
          </ul>
          <p className="text-muted-foreground">
            Tous nos sous-traitants sont soumis à des obligations de confidentialité
            et de conformité au RGPD.
          </p>
        </section>

        {/* Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Durée de conservation</h2>
          <p className="text-muted-foreground">
            Les données personnelles sont conservées uniquement pendant la durée
            nécessaire aux finalités pour lesquelles elles ont été collectées,
            sauf obligations légales contraires.
          </p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>données de compte : pendant la durée de vie du compte,</li>
            <li>données de facturation : selon les obligations comptables légales,</li>
            <li>logs techniques : durée limitée pour la sécurité et le diagnostic.</li>
          </ul>
        </section>

        {/* Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Vos droits</h2>
          <p className="text-muted-foreground">
            Conformément au RGPD, vous disposez des droits suivants :
          </p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>droit d’accès à vos données,</li>
            <li>droit de rectification,</li>
            <li>droit à l’effacement (« droit à l’oubli »),</li>
            <li>droit à la limitation du traitement,</li>
            <li>droit d’opposition,</li>
            <li>droit à la portabilité des données.</li>
          </ul>
          <p className="text-muted-foreground">
            Pour exercer vos droits :{" "}
            <span className="font-medium">contact@clonestore.pro</span>
          </p>
        </section>

        {/* Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Sécurité</h2>
          <p className="text-muted-foreground">
            CloneStore met en œuvre des mesures techniques et organisationnelles
            appropriées afin de protéger vos données personnelles contre tout accès
            non autorisé, perte, altération ou divulgation.
          </p>
          <p className="text-muted-foreground">
            Ces mesures incluent notamment le chiffrement des communications,
            la gestion des accès et la surveillance de sécurité.
          </p>
        </section>

        {/* Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Transferts hors Union européenne</h2>
          <p className="text-muted-foreground">
            Lorsque certains de nos prestataires sont situés en dehors de l’Union
            européenne, les transferts sont encadrés par des garanties appropriées
            (telles que les clauses contractuelles types de la Commission européenne)
            afin d’assurer un niveau de protection adéquat.
          </p>
        </section>

        {/* Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Contact</h2>
          <p className="text-muted-foreground">
            Pour toute question relative à cette politique de confidentialité
            ou au traitement de vos données personnelles, vous pouvez nous contacter :
          </p>
          <p className="font-medium">clonestore@clonestore.pro</p>
        </section>
      </div>
    </main>
  );
}
