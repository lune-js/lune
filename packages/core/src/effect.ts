import { SystemFlags } from "./constants";
import { setupOnTrigger } from "./debug";
import { checkDirty, decRunDepth, endTracking, incRunDepth, startTracking, unlink } from "./system";
import type { DebuggerEvent, Link, ReactiveEffectOptions, ReactiveEffectRunner, ReactiveNode } from "./types";

enum EffectFlags {
  /**
   * ReactiveEffect only
   */
  ALLOW_RECURSE = 1 << 7,
  PAUSED = 1 << 8,
  STOP = 1 << 10
}

/**
 * Core representation of a graph tracking node managing reactive side effects.
 * Manages links between dependency maps and executing subscribers.
 */
export class ReactiveEffect<T = any> implements ReactiveEffectOptions, ReactiveNode {
  deps: Link | undefined = undefined;
  depsTail: Link | undefined = undefined;
  subs: Link | undefined = undefined;
  subsTail: Link | undefined = undefined;
  flags: number = SystemFlags.Watching | SystemFlags.Dirty;

  /**
   * @internal
   */
  cleanups: (() => void)[] = [];
  /**
   * @internal
   */
  cleanupsLength = 0;

  // `declare` keeps these off the instance: class fields are defined (not assigned) on
  // construction, and an own `onTrigger` would shadow the prototype accessor that
  // `setupOnTrigger` installs, so assigning the hook would never arm the trigger events.

  // dev only
  declare onTrack?: (event: DebuggerEvent) => void;
  // dev only
  declare onTrigger?: (event: DebuggerEvent) => void;

  // @ts-expect-error
  fn(): T {}

  constructor(fn?: () => T) {
    if (fn !== undefined) {
      this.fn = fn;
    }
  }

  get active(): boolean {
    return !(this.flags & EffectFlags.STOP);
  }

  /**
   * Pauses property update notifications from propagating into this effect runner.
   */
  pause(): void {
    this.flags |= EffectFlags.PAUSED;
  }

  /**
   * Resumes and flushes deferred updates, synchronously evaluating side effects if dependencies became dirty.
   */
  resume(): void {
    const flags = (this.flags &= ~EffectFlags.PAUSED);
    if (flags & (SystemFlags.Dirty | SystemFlags.Pending)) {
      this.notify();
    }
  }

  notify(): void {
    if (!(this.flags & EffectFlags.PAUSED) && this.dirty) {
      this.run();
    }
  }

  /**
   * Triggers evaluation tracking hooks, establishing this node as the active global subscriber.
   */
  run(): T {
    if (!this.active) return this.fn();

    cleanup(this);
    const prevSub = startTracking(this);
    incRunDepth();
    try {
      return this.fn();
    } finally {
      decRunDepth();
      endTracking(this, prevSub);
      const flags = this.flags;
      if (
        (flags & (SystemFlags.Recursed | EffectFlags.ALLOW_RECURSE)) ===
        (SystemFlags.Recursed | EffectFlags.ALLOW_RECURSE)
      ) {
        this.flags = flags & ~SystemFlags.Recursed;
        this.notify();
      }
    }
  }

  /**
   * severs all data-graph associations for this effect context, preventing any future tracking executions.
   */
  stop(): void {
    if (!this.active) return;

    this.flags = EffectFlags.STOP;
    let dep = this.deps;
    while (dep !== undefined) {
      dep = unlink(dep, this);
    }
    const sub = this.subs;
    if (sub !== undefined) {
      unlink(sub);
    }
    cleanup(this);
  }

  get dirty(): boolean {
    const flags = this.flags;
    if (flags & SystemFlags.Dirty) {
      return true;
    }

    if (flags & SystemFlags.Pending) {
      if (checkDirty(this.deps!, this)) {
        this.flags = flags | SystemFlags.Dirty;
        return true;
      }

      this.flags = flags & ~SystemFlags.Pending;
    }
    return false;
  }
}

if (import.meta.env.DEV) {
  setupOnTrigger(ReactiveEffect);
}

export function cleanup(sub: ReactiveNode & { cleanups: (() => void)[]; cleanupsLength: number }): void {
  const l = sub.cleanupsLength;
  if (l) {
    for (let i = 0; i < l; i++) {
      sub.cleanups[i]();
    }
    sub.cleanupsLength = 0;
  }
}

/**
 * Wraps a side-effect function inside a tracking context (`ReactiveEffect`).
 * Automatically invokes the side-effect immediately to trace dependency properties,
 * subsequently re-running the function whenever tracked proxy states mutate.
 * @param fn - The execution function containing reactive properties.
 * @param options - Configurable hooks, such as a custom execution `scheduler` or dev-only `onTrack` / `onTrigger` debug triggers.
 * @returns The runner function linked to the internal `ReactiveEffect` node instance.
 */
export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions): ReactiveEffectRunner<T> {
  if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
    // oxlint-disable-next-line typescript/unbound-method
    fn = (fn as ReactiveEffectRunner).effect.fn;
  }

  const e = new ReactiveEffect(fn);
  if (options) {
    const { onStop, scheduler } = options;
    if (onStop) {
      options.onStop = undefined;
      const stop = e.stop.bind(e);
      e.stop = () => {
        stop();
        onStop();
      };
    }
    if (scheduler) {
      options.scheduler = undefined;
      e.notify = () => {
        if (!(e.flags & EffectFlags.PAUSED)) {
          scheduler();
        }
      };
    }
    Object.assign(e, options);
  }
  try {
    e.run();
  } catch (err) {
    e.stop();
    throw err;
  }
  const runner = e.run.bind(e) as ReactiveEffectRunner;
  runner.effect = e;
  return runner;
}

/**
 * Stops the effect associated with the given runner.
 *
 * @param runner - Association with the effect to stop tracking.
 */
export function stop(runner: ReactiveEffectRunner): void {
  runner.effect.stop();
}
