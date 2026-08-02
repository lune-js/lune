import { describe, expect, test } from "bun:test";
import { readonly, shallowReadonly } from "../src";
import { isReactive, isReadonly } from "../src/utils";

const isDev = import.meta.env.DEV;

describe("shallowReadonly", () => {
  test("should not make non-reactive properties reactive", () => {
    const props = shallowReadonly({ n: { foo: 1 } });
    expect(isReactive(props.n)).toBe(false);
  });

  test.skipIf(!isDev)("should make root level properties readonly", () => {
    const props = shallowReadonly({ n: 1 });
    // @ts-expect-error
    props.n = 2;
    expect(props.n).toBe(1);
    expect(`Set operation on key "n" failed: target is readonly.`).toHaveBeenWarned();
  });

  // to retain 2.x behavior.
  test.skipIf(!isDev)("should NOT make nested properties readonly", () => {
    const props = shallowReadonly({ n: { foo: 1 } });

    props.n.foo = 2;
    expect(props.n.foo).toBe(2);
    expect(`Set operation on key "foo" failed: target is readonly.`).not.toHaveBeenWarned();
  });

  // https://github.com/vuejs/core/issues/2843
  test("should differentiate from normal readonly calls", () => {
    const original = { foo: {} };
    const shallowProxy = shallowReadonly(original);
    const reactiveProxy = readonly(original);
    expect(shallowProxy).not.toBe(reactiveProxy);
    expect(isReadonly(shallowProxy.foo)).toBe(false);
    expect(isReadonly(reactiveProxy.foo)).toBe(true);
  });
});
