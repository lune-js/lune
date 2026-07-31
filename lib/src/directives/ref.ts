import type { Directive } from "@lune-js/context";

/**
 * Provisions template reference registration (`lu-ref`).
 * Synchronizes DOM element references or components into the context's local `$refs` collection.
 * Tracks dynamic reference name expressions reactively, cleaning up obsolete dictionary records
 * on identifier reassignment or DOM unmounting.
 * @param ctx - The execution context bundle provided to the directive engine.
 * @returns A teardown cleanup closure to safely purge the instance link from the global registry map.
 */
export const ref: Directive<Element> = ({
  el,
  ctx: {
    scope: { $refs }
  },
  get,
  effect,
  exp
}) => {
  let prevRef: any;
  effect(() => {
    let ref = get();
    // If get() returns undefined and exp is a simple string, use exp directly
    if (ref === undefined && exp && !exp.includes("${") && !exp.includes("}")) {
      ref = exp;
    }

    $refs[ref] = el;
    if (prevRef && ref !== prevRef) {
      delete $refs[prevRef];
    }
    prevRef = ref;
  });
  return () => {
    if (prevRef) {
      delete $refs[prevRef];
    }
  };
};
