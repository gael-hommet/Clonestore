import Link from "next/link";
import { Card } from "@/components/ui/card";

const agents = [
  { slug: "pierre", name: "Pierre", tag: "Assistant RH – mails & relances", soon: false },
  { slug: "clara",  name: "Clara",  tag: "Recruteuse IA – shortlist & agenda", soon: true },
  { slug: "alex",   name: "Alex",   tag: "Commercial IA – prospection & relances", soon: true },
  { slug: "lea",    name: "Léa",    tag: "Assistante de direction – agenda & CR", soon: true },
  { slug: "noah",   name: "Noah",   tag: "Support IA – tickets & réponses clients", soon: true },
];

export default function AgentsPage() {
  return (
    <section className="mx-auto max-w-6xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Agents disponibles</h1>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => (
          <Card key={a.slug} className="p-5 hover:shadow-md transition rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium">{a.name}</h2>
              {a.soon && (
                <span className="text-xs rounded-full border px-2 py-1 opacity-70">
                  bientôt
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground">{a.tag}</p>

            <div className="mt-4">
              {!a.soon ? (
                <Link
                  href={`/agents/${a.slug}`}
                  prefetch={false}
                  className="text-sm underline hover:opacity-80"
                >
                  Voir l’agent
                </Link>
              ) : (
                <span className="text-sm opacity-60">Fiche en préparation</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

