// oxlint-disable no-unused-expressions
import { describe, expect, test, vi } from "bun:test";
import { effect, reactive } from "../src";
import { SystemFlags } from "../src/constants";
import { endBatch, endTracking, setActiveSub, startBatch, startTracking } from "../src/system";
import type { ReactiveNode } from "../src/types";

const isDev = import.meta.env.DEV;

describe("system", () => {
  describe("batching", () => {
    test("queues a subscriber once no matter how many of its dependencies change", () => {
      const state = reactive({ a: 0, b: 0 });
      const spy = vi.fn();
      effect(() => {
        state.a;
        state.b;
        spy();
      });
      expect(spy).toHaveBeenCalledTimes(1);

      startBatch();
      state.a++;
      state.b++;
      endBatch();

      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("does not flush until the outermost batch closes", () => {
      const state = reactive({ n: 0 });
      const spy = vi.fn();
      effect(() => spy(state.n));
      expect(spy).toHaveBeenCalledTimes(1);

      startBatch();
      startBatch();
      state.n++;
      endBatch();
      expect(spy).toHaveBeenCalledTimes(1);

      endBatch();
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  // `propagate` treats a subscriber that writes to one of its own dependencies mid-run
  // differently depending on whether that dependency is still part of the run being tracked,
  // which is what `isValidLink` decides by walking back from `depsTail`.
  describe("writes from inside a running effect", () => {
    test("does not re-run the effect when it writes to a dependency it already read", () => {
      const state = reactive({ a: 0, b: 0 });
      const spy = vi.fn();
      effect(() => {
        spy();
        state.a;
        state.b;
        if (spy.mock.calls.length === 1) {
          state.a++;
        }
      });

      // the write is seen, but it does not schedule another run of the writer itself
      expect(spy).toHaveBeenCalledTimes(1);
      expect(state.a).toBe(1);

      // the effect is left dirty, so the next unrelated change runs it once
      state.b++;
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("ignores a write to a dependency the current run has dropped", () => {
      const state = reactive({ useA: true, a: 0, b: 0 });
      const spy = vi.fn();
      effect(() => {
        spy();
        if (state.useA) {
          state.a;
        }
        state.b;
        if (!state.useA) {
          // a plain assignment, so `a` is written without being read back into this run
          state.a = 1;
        }
      });
      expect(spy).toHaveBeenCalledTimes(1);

      state.useA = false;
      expect(spy).toHaveBeenCalledTimes(2);
      expect(state.a).toBe(1);

      // the run dropped `a`, so the write neither re-ran the effect nor kept the dependency
      state.a = 2;
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe("endTracking", () => {
    test.skipIf(!isDev)("warns when the active subscriber was not restored", () => {
      const sub: ReactiveNode = {
        deps: undefined,
        depsTail: undefined,
        subs: undefined,
        subsTail: undefined,
        flags: SystemFlags.Watching
      };
      const other: ReactiveNode = { ...sub };

      const prevSub = startTracking(sub);
      // stands in for a nested tracking scope that failed to put `sub` back
      setActiveSub(other);
      endTracking(sub, prevSub);

      expect("Active effect was not restored correctly").toHaveBeenWarned();
      expect(sub.flags & SystemFlags.RecursedCheck).toBe(0);
    });
  });
});
