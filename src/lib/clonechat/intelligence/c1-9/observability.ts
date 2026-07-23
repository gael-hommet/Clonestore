// C1.9 — OBSERVABILITÉ.
//
// La trace doit permettre de répondre à « pourquoi CloneChat a-t-il répondu cela ? »
// SANS exposer le raisonnement privé brut du modèle ni la moindre donnée sensible.
// On enregistre donc des DÉCISIONS et des MESURES, jamais le texte de l'utilisateur ni
// le contenu des sources.
export interface StageTrace {
  readonly stage: string;
  readonly ok: boolean;
  readonly ms: number;
  readonly detail: Readonly<Record<string, string | number | boolean | null>>;
}

export interface TurnTrace {
  readonly turnId: string;
  readonly mode: string;
  readonly viewer: "anonymous" | "user";
  readonly stages: readonly StageTrace[];
  readonly modelCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly finalAction: string;
  readonly totalMs: number;
}

export class TraceCollector {
  private readonly stages: StageTrace[] = [];
  private calls = 0;
  private inTok = 0;
  private outTok = 0;
  private readonly startedAt: number;

  constructor(
    private readonly turnId: string,
    private readonly mode: string,
    private readonly viewer: "anonymous" | "user",
    now: () => number = () => Date.now(),
  ) {
    this.nowFn = now;
    this.startedAt = now();
  }
  private readonly nowFn: () => number;

  /** Mesure une étape. Le détail ne doit contenir que des faits non sensibles. */
  async stage<T>(
    name: string,
    fn: () => Promise<T>,
    describe: (r: T) => Readonly<Record<string, string | number | boolean | null>>,
    okOf: (r: T) => boolean = () => true,
  ): Promise<T> {
    const t0 = this.nowFn();
    try {
      const r = await fn();
      this.stages.push({ stage: name, ok: okOf(r), ms: this.nowFn() - t0, detail: describe(r) });
      return r;
    } catch (e) {
      this.stages.push({ stage: name, ok: false, ms: this.nowFn() - t0, detail: { error: String(e).slice(0, 120) } });
      throw e;
    }
  }

  recordModelCall(usage: { readonly inputTokens: number; readonly outputTokens: number } | null): void {
    this.calls += 1;
    if (usage) { this.inTok += usage.inputTokens; this.outTok += usage.outputTokens; }
  }

  finish(finalAction: string): TurnTrace {
    return Object.freeze({
      turnId: this.turnId,
      mode: this.mode,
      viewer: this.viewer,
      stages: Object.freeze([...this.stages]),
      modelCalls: this.calls,
      inputTokens: this.inTok,
      outputTokens: this.outTok,
      finalAction,
      totalMs: this.nowFn() - this.startedAt,
    });
  }
}
