// Page de santé technique (ne doit pas être indexée ni découverte par un prospect).
export const metadata = {
  robots: { index: false, follow: false },
};

export default function HealthPage() {
  return (
    <section className="mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-2xl font-semibold">Health OK</h1>
      <p className="text-muted-foreground mt-2">Si tu vois cette page, le routing et le layout fonctionnent.</p>
    </section>
  );
}
