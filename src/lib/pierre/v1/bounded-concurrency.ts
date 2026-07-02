// src/lib/pierre/v1/bounded-concurrency.ts
// PHASE 8.9 — governed bounded concurrency with backpressure.
//
// The document pipeline (renderers.ts → file-storage.ts) had NO concurrency bound: an
// unbounded producer (e.g. a burst of document-generation jobs) could start N renders +
// N storage writes at once, growing heap/temp-files/open-handles without limit. This
// primitive caps in-flight work at `maxConcurrent` and makes callers AWAIT a free slot
// (backpressure) rather than piling up unbounded promises. `maxQueued` optionally bounds
// the pending waiters so an overwhelmed stage sheds load explicitly (throws) instead of
// growing memory silently. Pure, dependency-free, deterministic — reusable anywhere a
// stage must be bounded (documents, communications, imports).

export type BoundedConcurrencyOptions = {
  maxConcurrent: number;   // hard cap on simultaneously-running tasks
  maxQueued?: number;      // optional cap on pending waiters (default: unbounded queue, still backpressured)
};

export class QueueOverflowError extends Error {
  constructor(maxQueued: number) {
    super(`bounded-concurrency: pending queue is full (maxQueued=${maxQueued})`);
    this.name = "QueueOverflowError";
  }
}

export class BoundedConcurrency {
  private readonly max: number;
  private readonly maxQueued: number;
  private active = 0;
  private peak = 0;
  private started = 0;
  private completed = 0;
  private rejected = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(opts: BoundedConcurrencyOptions) {
    this.max = Math.max(1, Math.floor(opts.maxConcurrent));
    this.maxQueued = opts.maxQueued && opts.maxQueued > 0 ? Math.floor(opts.maxQueued) : Number.POSITIVE_INFINITY;
  }

  get inFlight(): number { return this.active; }
  get queued(): number { return this.waiters.length; }
  get peakInFlight(): number { return this.peak; }
  get stats(): { peak: number; started: number; completed: number; rejected: number; maxConcurrent: number } {
    return { peak: this.peak, started: this.started, completed: this.completed, rejected: this.rejected, maxConcurrent: this.max };
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) { this.active++; if (this.active > this.peak) this.peak = this.active; return Promise.resolve(); }
    if (this.waiters.length >= this.maxQueued) { this.rejected++; return Promise.reject(new QueueOverflowError(this.maxQueued)); }
    return new Promise<void>((res) => this.waiters.push(res));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) { if (this.active > this.peak) this.peak = this.active; next(); }
    else this.active--;
  }

  /** Run `fn` when a slot is free. Awaits a slot (backpressure). Rejects immediately
   *  with QueueOverflowError if maxQueued waiters are already pending. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    this.started++;
    try {
      return await fn();
    } finally {
      this.completed++;
      this.release();
    }
  }

  /** Resolve once no task is active and no waiter is pending. */
  async drain(): Promise<void> {
    while (this.active > 0 || this.waiters.length > 0) {
      await new Promise((r) => setTimeout(r, 2));
    }
  }
}

/**
 * Map `items` through `fn` with at most `maxConcurrent` in flight; results preserve input
 * order. Backpressured: the (n+maxConcurrent)-th task starts only when an earlier one frees
 * a slot — so a huge `items` array never spawns more than `maxConcurrent` live promises.
 */
export async function mapBounded<T, R>(items: readonly T[], maxConcurrent: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const gate = new BoundedConcurrency({ maxConcurrent });
  const results = new Array<R>(items.length);
  await Promise.all(items.map((item, i) => gate.run(async () => { results[i] = await fn(item, i); })));
  return results;
}
