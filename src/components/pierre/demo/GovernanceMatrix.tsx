"use client";

// PIERRE FINAL INTERACTIVE DEMO — beat 05 · GOVERNANCE (the key differentiator).
// The old guardrail was buried inside the cockpit. Here it is a standalone,
// side-by-side premium block that answers the one question a chatbot cannot:
// "what does it do alone / what must it submit / what can it never do alone?"
// — followed by the concrete human-validation moment.
//
// Every item is DERIVED from the active scenario:
//   • PEUT agir seul      ← roleSplit.pierre (autonomous operational work)
//   • DOIT faire valider  ← the dependsOn of every validation-required mission
//   • NE décide pas seul   ← roleSplit.humans (what humans keep) + the guardrail
// Nothing is invented.

import { Bot, ShieldCheck, UserCheck, Check, ArrowRight } from "lucide-react";
import type { DemoScenario } from "@/lib/pierre/demo";
import { BeatHeading, Chip, Disclosure } from "./parts";
import { GuardrailMoment } from "./GuardrailMoment";

function validationClauses(scenario: DemoScenario): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of scenario.missions) {
    if (m.autonomy !== "validation_requise") continue;
    const clause = m.dependsOn ?? `Validation humaine — ${m.title}`;
    if (seen.has(clause)) continue;
    seen.add(clause);
    out.push(clause);
  }
  return out;
}

export function GovernanceMatrix({ scenario }: { scenario: DemoScenario }) {
  const canAlone = scenario.roleSplit?.pierre ?? [];
  const mustAsk = validationClauses(scenario);
  const humanOnly = scenario.roleSplit?.humans ?? [];
  const validations = mustAsk.length;

  const columns = [
    {
      key: "can",
      tone: "can",
      Icon: Bot,
      title: "Pierre PEUT agir seul",
      sub: "Le travail opérationnel, en autonomie.",
      items: canAlone,
    },
    {
      key: "ask",
      tone: "ask",
      Icon: ShieldCheck,
      title: "Pierre DOIT faire valider",
      sub: `${validations} validation${validations > 1 ? "s" : ""} isolée${validations > 1 ? "s" : ""} — il s'arrête et vous sollicite.`,
      items: mustAsk,
    },
    {
      key: "cannot",
      tone: "cannot",
      Icon: UserCheck,
      title: "Pierre NE décide pas seul",
      sub: "Les arbitrages restent humains — toujours.",
      items: humanOnly,
    },
  ] as const;

  return (
    <section aria-label="La gouvernance de Pierre">
      <BeatHeading
        n="05"
        eyebrow="La gouvernance"
        title="Ce qu'il fait seul. Ce qu'il vous soumet. Ce qu'il ne fait jamais."
        caption="Une frontière explicite, tenue par CloneGuard — la différence avec une IA générale."
      />

      <div className="pd-gov">
        {columns.map((c) => (
          <div key={c.key} className={`pd-gov__col pd-gov__col--${c.tone}`}>
            <div className="pd-gov__head">
              <span className="pd-gov__ico" aria-hidden><c.Icon className="h-4 w-4" aria-hidden /></span>
              <span className="pd-gov__title">{c.title}</span>
            </div>
            <p className="pd-gov__sub">{c.sub}</p>
            <ul className="pd-gov__list">
              {c.items.map((it) => (
                <li key={it} className="pd-gov__item">
                  <Check className="h-3.5 w-3.5" aria-hidden style={{ flex: "none", marginTop: 2 }} />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* The concrete human-validation moment: a sensitive request, a governed
          refusal — kept out of the initial scroll behind an accessible toggle
          (the proof stays, just one tap away). */}
      <div className="pd-gov__concrete">
        <Disclosure
          label="Voir le cas concret — une demande sensible"
          labelOpen="Masquer le cas concret"
          hint="garde-fou"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "2px 0 8px" }}>
            <Chip variant="warn"><ArrowRight className="h-3.5 w-3.5" aria-hidden /> Cas concret</Chip>
            <span style={{ fontSize: "0.78rem", color: "var(--pd-ink-3)" }}>
              Une demande sensible : voici, mot pour mot, sa réponse gouvernée.
            </span>
          </div>
          <GuardrailMoment scenario={scenario} />
        </Disclosure>
      </div>
    </section>
  );
}
