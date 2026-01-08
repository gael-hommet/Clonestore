export const metadata = {
  title: "Politique de confidentialité — CloneStore",
  description: "Politique de confidentialité de CloneStore.",
};

export default function ConfidentialitePage() {
  return (
    <section className="mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-2xl font-semibold">Politique de confidentialité</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
      </p>

      <div className="prose prose-sm mt-8">
        <h2>1. Données collectées</h2>
        <p>
          Lors de la création d’un compte et de l’utilisation de nos services, nous collectons
          des informations telles que votre email, vos informations de commande et des journaux
          techniques nécessaires au fonctionnement des agents IA.
        </p>

        <h2>2. Finalités</h2>
        <p>
          Nous utilisons vos données pour fournir le service, gérer votre compte, assurer la
          facturation, la sécurité et l’amélioration continue de nos agents.
        </p>

        <h2>3. Base légale</h2>
        <p>
          L’exécution du contrat (CGV), l’intérêt légitime (sécurité, prévention de fraude) et
          votre consentement pour certaines finalités (ex. communications marketing).
        </p>

        <h2>4. Partage</h2>
        <p>
          Nous pouvons partager des données avec nos sous-traitants techniques (hébergement, paiement),
          sous accords conformes au RGPD. Aucune revente de vos données à des tiers.
        </p>

        <h2>5. Durées de conservation</h2>
        <p>
          Les données sont conservées pendant la durée strictement nécessaire aux finalités
          ou aux obligations légales applicables.
        </p>

        <h2>6. Vos droits</h2>
        <p>
          Vous disposez d’un droit d’accès, rectification, effacement, opposition, limitation
          et portabilité. Pour exercer vos droits : contact@clonestore.pro
        </p>

        <h2>7. Sécurité</h2>
        <p>
          Mesures techniques et organisationnelles proportionnées pour protéger vos données contre
          l’accès non autorisé, la perte ou la divulgation.
        </p>

        <h2>8. Transferts hors UE</h2>
        <p>
          Si des transferts ont lieu, ils sont encadrés par des garanties appropriées (clauses
          contractuelles types ou équivalents).
        </p>

        <h2>9. Contact</h2>
        <p>
          Pour toute question, contactez : contact@clonestore.pro
        </p>
      </div>
    </section>
  );
}
