import { describe, expect, test, vi } from "bun:test";
import { effect, reactive, shallowReactive, shallowReadonly } from "../src";
import { isReactive, isShallow } from "../src/utils";

const isDev = import.meta.env.DEV;

describe("shallowReactive", () => {
  test("should not make non-reactive properties reactive", () => {
    const props = shallowReactive({ n: { foo: 1 } });
    expect(isReactive(props.n)).toBe(false);
  });

  test("should keep reactive properties reactive", () => {
    const props: any = shallowReactive({ n: reactive({ foo: 1 }) });
    props.n = reactive({ foo: 2 });
    expect(isReactive(props.n)).toBe(true);
  });

  // https://github.com/vuejs/core/issues/2843
  test("should allow shallow and normal reactive for same target", () => {
    const original = { foo: {} };
    const shallowProxy = shallowReactive(original);
    const reactiveProxy = reactive(original);
    expect(shallowProxy).not.toBe(reactiveProxy);
    expect(isReactive(shallowProxy.foo)).toBe(false);
    expect(isReactive(reactiveProxy.foo)).toBe(true);
  });

  test("isShallow", () => {
    expect(isShallow(shallowReactive({}))).toBe(true);
    expect(isShallow(shallowReadonly({}))).toBe(true);
  });

  // https://github.com/vuejs/core/issues/5271
  test("should respect shallow reactive nested inside reactive on reset", () => {
    const r = reactive({ foo: shallowReactive({ bar: {} }) });
    expect(isShallow(r.foo)).toBe(true);
    expect(isReactive(r.foo.bar)).toBe(false);

    r.foo = shallowReactive({ bar: {} });
    expect(isShallow(r.foo)).toBe(true);
    expect(isReactive(r.foo.bar)).toBe(false);
  });

  test("should respect shallow/deep versions of same target on access", () => {
    const original = {};
    const shallow = shallowReactive(original);
    const deep = reactive(original);
    const r = reactive({ shallow, deep });
    expect(r.shallow).toBe(shallow);
    expect(r.deep).toBe(deep);
  });

  describe("array", () => {
    test("should be reactive", () => {
      const shallowArray = shallowReactive<unknown[]>([]);
      const a = {};
      let size: number | undefined;

      effect(() => {
        size = shallowArray.length;
      });

      expect(size).toBe(0);

      shallowArray.push(a);
      expect(size).toBe(1);

      shallowArray.pop();
      expect(size).toBe(0);
    });

    test("should not observe when iterating", () => {
      const shallowArray = shallowReactive<object[]>([]);
      const a = {};
      shallowArray.push(a);

      const spreadA = [...shallowArray][0];
      expect(isReactive(spreadA)).toBe(false);
    });

    test.skipIf(!isDev)("onTrack on called on objectSpread", () => {
      const onTrackFn = vi.fn();
      const shallowArray = shallowReactive([]);
      let a;
      effect(
        () => {
          a = Array.from(shallowArray);
        },
        {
          onTrack: onTrackFn
        }
      );

      expect(a).toMatchObject([]);
      expect(onTrackFn).toHaveBeenCalled();
    });
  });
});
