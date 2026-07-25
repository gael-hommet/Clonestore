"use client";

// §28 — Questions fréquentes (section secondaire, discrète, en bas de page).

import * as React from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives/motion";
import { DEMO_FAQ } from "@/lib/demo/presentation/content";

export function DemoFaq() {
  const [open, setOpen] = React.useState<number | null>(0);

  // content-visibility retiré : son estimation de hauteur (contain-intrinsic-size)
  // faussait l'ancrage du scroll pendant la traversée des scènes.
  return (
    <section className="demo-section" aria-label="Questions fréquentes">
      <div className="demo-shell">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="demo-kicker text-center">Questions fréquentes</p>
          </Reveal>

          <div className="mt-6 space-y-2.5">
            {DEMO_FAQ.map((item, idx) => {
              const isOpen = open === idx;
              return (
                <Reveal key={item.q} delay={idx * 0.03}>
                  <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/45 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-[0.92rem] font-semibold text-[var(--cs-ink-1)]">
                        {item.q}
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/65 bg-white/60 text-[var(--cs-ink-3)]">
                        {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    <div
                      className={cn(
                        "grid transition-all duration-300 ease-[var(--cs-ease-premium)]",
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-4 text-[0.86rem] leading-relaxed text-[var(--cs-ink-3)]">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
