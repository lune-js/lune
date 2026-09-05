// Ported from alien-signals. Diff against upstream main:
// https://github.com/stackblitz/alien-signals/compare/7e53655f40c3dd298168c278b3bf248a72f742d9...main
// ! Removed from original: `./computed.js` and `./effectScope.js`.
// Upstream's multi-level machinery (`checkDirty`, the traversal stacks and
// the `dep.deps` cascade in `unlink`) has been dropped rather than left unreachable.
import { warn } from "@lune-js/utils";
import { SystemFlags } from "./constants";
import type { ReactiveEffect as Effect } from "./effect";
import type { Link, ReactiveNode } from "./types";

const notifyBuffer: (Effect | undefined)[] = [];

export let batchDepth = 0;
export let activeSub: ReactiveNode | undefined = undefined;

let runDepth = 0;

export function incRunDepth(): void {
  ++runDepth;
}

export function decRunDepth(): void {
  --runDepth;
}

let globalVersion = 0;
let notifyIndex = 0;
let notifyBufferLength = 0;

export function setActiveSub(sub?: ReactiveNode): ReactiveNode | undefined {
  try {
    return activeSub;
  } finally {
    activeSub = sub;
  }
}

/**
 * Opens a batch block window. State modifications during a batch defer synchronous effect flushes
 * until the parent batch context reaches completion.
 */
export function startBatch(): void {
  ++batchDepth;
}

/**
 * Decrements the current batch window scale depth, executing and flushing all queued dirty subscriber nodes
 * once the outermost batch block closes down completely.
 */
export function endBatch(): void {
  if (!--batchDepth && notifyBufferLength) {
    flush();
  }
}

export function link(dep: ReactiveNode, sub: ReactiveNode): void {
  const prevDep = sub.depsTail;
  if (prevDep !== undefined && prevDep.dep === dep) {
    return;
  }
  const nextDep = prevDep !== undefined ? prevDep.nextDep : sub.deps;
  if (nextDep !== undefined && nextDep.dep === dep) {
    nextDep.version = globalVersion;
    sub.depsTail = nextDep;
    return;
  }
  const prevSub = dep.subsTail;
  if (prevSub !== undefined && prevSub.version === globalVersion && prevSub.sub === sub) {
    return;
  }
  const newLink =
    (sub.depsTail =
    dep.subsTail =
      {
        version: globalVersion,
        dep,
        sub,
        prevDep,
        nextDep,
        prevSub,
        nextSub: undefined
      });
  if (nextDep !== undefined) {
    nextDep.prevDep = newLink;
  }
  if (prevDep !== undefined) {
    prevDep.nextDep = newLink;
  } else {
    sub.deps = newLink;
  }
  if (prevSub !== undefined) {
    prevSub.nextSub = newLink;
  } else {
    dep.subs = newLink;
  }
}

export function unlink(link: Link, sub: ReactiveNode = link.sub): Link | undefined {
  const dep = link.dep;
  const prevDep = link.prevDep;
  const nextDep = link.nextDep;
  const nextSub = link.nextSub;
  const prevSub = link.prevSub;
  if (nextDep !== undefined) {
    nextDep.prevDep = prevDep;
  } else {
    sub.depsTail = prevDep;
  }
  if (prevDep !== undefined) {
    prevDep.nextDep = nextDep;
  } else {
    sub.deps = nextDep;
  }
  if (nextSub !== undefined) {
    nextSub.prevSub = prevSub;
  } else {
    dep.subsTail = prevSub;
  }
  if (prevSub !== undefined) {
    prevSub.nextSub = nextSub;
  } else {
    // `Dep` drops itself from its target's key map when this is set to undefined
    dep.subs = nextSub;
  }
  return nextDep;
}

/**
 * Walks the subscribers of a changed dependency, marking each one pending and queueing it for
 * the next flush. A subscriber that is already queued, or that is only re-entering itself from
 * inside its own run, is marked but not queued.
 */
export function propagate(link: Link): void {
  do {
    const sub = link.sub;
    const nextSub = link.nextSub;
    const flags = sub.flags;

    if (flags & SystemFlags.Watching) {
      let notify = true;

      if (!(flags & (SystemFlags.RecursedCheck | SystemFlags.Recursed | SystemFlags.Dirty | SystemFlags.Pending))) {
        sub.flags = flags | SystemFlags.Pending;
        if (runDepth) {
          sub.flags |= SystemFlags.Recursed;
        }
      } else if (!(flags & (SystemFlags.RecursedCheck | SystemFlags.Recursed))) {
        // already queued by an earlier trigger in this batch
        notify = false;
      } else if (!(flags & SystemFlags.RecursedCheck)) {
        sub.flags = (flags & ~SystemFlags.Recursed) | SystemFlags.Pending;
      } else if (!(flags & (SystemFlags.Dirty | SystemFlags.Pending)) && isValidLink(link, sub)) {
        // the subscriber wrote to one of its own dependencies while running: flag it so `run`
        // can decide whether to re-enter, but never queue it from here
        sub.flags = flags | SystemFlags.Recursed | SystemFlags.Pending;
        notify = false;
      } else {
        notify = false;
      }

      if (notify) {
        notifyBuffer[notifyBufferLength++] = sub as Effect;
      }
    }

    link = nextSub!;
  } while (link !== undefined);
}

export function startTracking(sub: ReactiveNode): ReactiveNode | undefined {
  ++globalVersion;
  sub.depsTail = undefined;
  sub.flags =
    (sub.flags & ~(SystemFlags.Recursed | SystemFlags.Dirty | SystemFlags.Pending)) | SystemFlags.RecursedCheck;
  return setActiveSub(sub);
}

export function endTracking(sub: ReactiveNode, prevSub: ReactiveNode | undefined): void {
  if (import.meta.env.DEV && activeSub !== sub) {
    warn("Active effect was not restored correctly - this is likely a internal bug in Lune.");
  }
  activeSub = prevSub;

  const depsTail = sub.depsTail;
  let toRemove = depsTail !== undefined ? depsTail.nextDep : sub.deps;
  while (toRemove !== undefined) {
    toRemove = unlink(toRemove, sub);
  }
  sub.flags &= ~SystemFlags.RecursedCheck;
}

function flush(): void {
  while (notifyIndex < notifyBufferLength) {
    const effect = notifyBuffer[notifyIndex]!;
    notifyBuffer[notifyIndex++] = undefined;
    effect.notify();
  }
  notifyIndex = 0;
  notifyBufferLength = 0;
}

export function shallowPropagate(link: Link): void {
  do {
    const sub = link.sub;
    const nextSub = link.nextSub;
    const subFlags = sub.flags;
    if ((subFlags & (SystemFlags.Pending | SystemFlags.Dirty)) === SystemFlags.Pending) {
      sub.flags = subFlags | SystemFlags.Dirty;
    }
    link = nextSub!;
  } while (link !== undefined);
}

function isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
  let link = sub.depsTail;
  while (link !== undefined) {
    if (link === checkLink) {
      return true;
    }
    link = link.prevDep;
  }
  return false;
}
