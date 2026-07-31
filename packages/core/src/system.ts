// oxlint-disable no-constant-condition
// Ported from alien-signals. Diff against upstream main:
// https://github.com/stackblitz/alien-signals/compare/7e53655f40c3dd298168c278b3bf248a72f742d9...main
// ! Removed from original: `./computed.js` and `./effectScope.js`
import { warn } from "@lune-js/utils";
import { SystemFlags } from "./constants";
import type { ReactiveEffect as Effect } from "./effect";
import type { Link, ReactiveNode } from "./types";

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

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
  } else if ((dep.subs = nextSub) === undefined) {
    let toRemove = dep.deps;
    if (toRemove !== undefined) {
      do {
        toRemove = unlink(toRemove, dep);
      } while (toRemove !== undefined);
      dep.flags |= SystemFlags.Dirty;
    }
  }
  return nextDep;
}

export function propagate(link: Link): void {
  let next = link.nextSub;
  let stack: Stack<Link | undefined> | undefined;

  top: do {
    const sub = link.sub;
    let flags = sub.flags;

    if (flags & (SystemFlags.Mutable | SystemFlags.Watching)) {
      if (!(flags & (SystemFlags.RecursedCheck | SystemFlags.Recursed | SystemFlags.Dirty | SystemFlags.Pending))) {
        sub.flags = flags | SystemFlags.Pending;
        if (runDepth) {
          sub.flags |= SystemFlags.Recursed;
        }
      } else if (!(flags & (SystemFlags.RecursedCheck | SystemFlags.Recursed))) {
        flags = SystemFlags.None;
      } else if (!(flags & SystemFlags.RecursedCheck)) {
        sub.flags = (flags & ~SystemFlags.Recursed) | SystemFlags.Pending;
      } else if (!(flags & (SystemFlags.Dirty | SystemFlags.Pending)) && isValidLink(link, sub)) {
        sub.flags = flags | SystemFlags.Recursed | SystemFlags.Pending;
        flags &= SystemFlags.Mutable;
      } else {
        flags = SystemFlags.None;
      }

      if (flags & SystemFlags.Watching) {
        notifyBuffer[notifyBufferLength++] = sub as Effect;
      }

      if (flags & SystemFlags.Mutable) {
        const subSubs = sub.subs;
        if (subSubs !== undefined) {
          link = subSubs;
          if (subSubs.nextSub !== undefined) {
            stack = { value: next, prev: stack };
            next = link.nextSub;
          }
          continue;
        }
      }
    }

    if ((link = next!) !== undefined) {
      next = link.nextSub;
      continue;
    }

    while (stack !== undefined) {
      link = stack.value!;
      stack = stack.prev;
      if (link !== undefined) {
        next = link.nextSub;
        continue top;
      }
    }

    break;
  } while (true);
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
    warn("Active effect was not restored correctly - this is likely a Lune.js internal bug.");
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

export function checkDirty(link: Link, sub: ReactiveNode): boolean {
  let stack: Stack<Link> | undefined;
  let checkDepth = 0;

  top: do {
    const dep = link.dep;
    const depFlags = dep.flags;

    let dirty = false;

    if (sub.flags & SystemFlags.Dirty) {
      dirty = true;
    } else if (
      (depFlags & (SystemFlags.Mutable | SystemFlags.Pending)) ===
      (SystemFlags.Mutable | SystemFlags.Pending)
    ) {
      stack = { value: link, prev: stack };
      link = dep.deps!;
      sub = dep;
      ++checkDepth;
      continue;
    }

    if (!dirty && link.nextDep !== undefined) {
      link = link.nextDep;
      continue;
    }

    while (checkDepth) {
      --checkDepth;
      link = stack!.value;
      stack = stack!.prev;
      if (!dirty) {
        sub.flags &= ~SystemFlags.Pending;
      }
      sub = link.sub;
      if (link.nextDep !== undefined) {
        link = link.nextDep;
        continue top;
      }
      dirty = false;
    }

    return dirty && !!sub.flags;
  } while (true);
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
