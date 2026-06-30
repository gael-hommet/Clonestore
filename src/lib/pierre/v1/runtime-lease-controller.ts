// src/lib/pierre/v1/runtime-lease-controller.ts
// PHASE 8.5-R4 §R4.11 — keep a long-running action's LEASE alive. A handler that performs a slow external
// call (a signature provider round-trip, a multi-page render) would otherwise let its lease EXPIRE mid-
// flight; the recovery sweeper would then reclaim the job (bumping the fencing generation) and a second
// worker could redo the work. The controller heartbeats on an interval via the governed
// pierre_rt_runtime_heartbeat (which re-asserts ownership + fencing + lease). If a heartbeat is REFUSED
// (a newer generation already owns the job), the lease is LOST: the controller stops, flips isLost, and
// ensureHeld() throws so the action aborts BEFORE committing any irreversible external effect. The timer
// is injectable so the behaviour is proven deterministically (no real wall-clock in tests).

export type LeaseScheduler = {
  /** schedule `fn` to run every `ms`; returns an opaque handle. */
  schedule(fn: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
};

const realScheduler: LeaseScheduler = {
  schedule: (fn, ms) => setInterval(fn, ms),
  cancel: (h) => clearInterval(h as ReturnType<typeof setInterval>),
};

export type LeaseControllerOptions = {
  /** the governed heartbeat — must REJECT (throw) when the lease/fencing is no longer ours. */
  heartbeat: () => Promise<void>;
  /** heartbeat cadence in ms (default: half the lease, so two beats per lease window). */
  intervalMs: number;
  scheduler?: LeaseScheduler;
  /** called once when the lease is first observed lost (for logging / metrics). */
  onLost?: (err: unknown) => void;
};

export class LeaseLostError extends Error {
  constructor(public readonly cause?: unknown) { super("runtime lease lost (a newer generation owns the job)"); this.name = "LeaseLostError"; }
}

export class RuntimeLeaseController {
  private readonly opts: LeaseControllerOptions;
  private readonly scheduler: LeaseScheduler;
  private handle: unknown = null;
  private _lost = false;
  private _beats = 0;
  private inFlight: Promise<void> | null = null;

  constructor(opts: LeaseControllerOptions) {
    this.opts = opts;
    this.scheduler = opts.scheduler ?? realScheduler;
  }

  get isLost(): boolean { return this._lost; }
  get beats(): number { return this._beats; }

  /** throws LeaseLostError if the lease has been observed lost — handlers call this before/after any
   *  external effect (cooperative abort). */
  ensureHeld(): void { if (this._lost) throw new LeaseLostError(); }

  /** one heartbeat; marks the lease lost (and stops the loop) on refusal. Exposed for manual ticks. */
  async beat(): Promise<void> {
    if (this._lost) return;
    try {
      await this.opts.heartbeat();
      this._beats += 1;
    } catch (err) {
      if (!this._lost) { this._lost = true; this.opts.onLost?.(err); }
      this.stop();
    }
  }

  private start(): void {
    if (this.handle !== null) return;
    this.handle = this.scheduler.schedule(() => {
      // never overlap heartbeats; swallow rejection (beat records the loss)
      if (this.inFlight) return;
      this.inFlight = this.beat().finally(() => { this.inFlight = null; });
    }, Math.max(this.opts.intervalMs, 1));
  }

  stop(): void {
    if (this.handle !== null) { this.scheduler.cancel(this.handle); this.handle = null; }
  }

  /** run a long action under an auto-renewing lease; always stops the timer; surfaces a lost lease. */
  async runWithLease<T>(action: (controller: RuntimeLeaseController) => Promise<T>): Promise<T> {
    this.start();
    try {
      const result = await action(this);
      this.ensureHeld(); // if the lease was lost while the action ran, this is NOT a success
      return result;
    } finally {
      this.stop();
      if (this.inFlight) { try { await this.inFlight; } catch { /* already recorded */ } }
    }
  }
}
