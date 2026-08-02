import { describe, expect, test } from "bun:test";
import { reactive, effect } from "../src";
import { readonly } from "../src/reactive";
import { isProxy, isReactive, toRaw } from "../src/utils";

const isDev = import.meta.env.DEV;

describe("reactive", () => {
  test("Object", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    expect(observed).not.toBe(original);
    expect(isReactive(observed)).toBe(true);
    expect(isReactive(original)).toBe(false);
    // get
    expect(observed.foo).toBe(1);
    // has
    expect("foo" in observed).toBe(true);
    // ownKeys
    expect(Object.keys(observed)).toEqual(["foo"]);
  });

  test("proto", () => {
    const obj = {};
    const reactiveObj = reactive(obj);
    expect(isReactive(reactiveObj)).toBe(true);
    // @ts-expect-error: read prop of reactiveObject will cause reactiveObj[prop] to be reactive
    const _prototype = reactiveObj["__proto__"];
    const otherObj = { data: ["a"] };
    expect(isReactive(otherObj)).toBe(false);
    const reactiveOther = reactive(otherObj);
    expect(isReactive(reactiveOther)).toBe(true);
    expect(reactiveOther.data[0]).toBe("a");
  });

  test("nested reactives", () => {
    const original = {
      nested: {
        foo: 1
      },
      array: [{ bar: 2 }]
    };
    const observed = reactive(original);
    expect(isReactive(observed.nested)).toBe(true);
    expect(isReactive(observed.array)).toBe(true);
    expect(isReactive(observed.array[0])).toBe(true);
  });

  test("observed value should proxy mutations to original (Object)", () => {
    const original: any = { foo: 1 };
    const observed = reactive(original);
    // set
    observed.bar = 1;
    expect(observed.bar).toBe(1);
    expect(original.bar).toBe(1);
    // delete
    delete observed.foo;
    expect("foo" in observed).toBe(false);
    expect("foo" in original).toBe(false);
  });

  test("failed set operation should not trigger effects", () => {
    const original: any = {};
    Object.defineProperty(original, "foo", {
      value: 1,
      writable: false,
      configurable: true
    });
    const observed = reactive(original);
    let dummy: number | undefined;
    let run = 0;
    effect(() => {
      run++;
      dummy = observed.foo;
    });

    expect(() => {
      observed.foo = 2;
    }).toThrow(TypeError);
    expect(dummy).toBe(1);
    expect(run).toBe(1);
  });

  test("original value change should reflect in observed value (Object)", () => {
    const original: any = { foo: 1 };
    const observed = reactive(original);
    // set
    original.bar = 1;
    expect(original.bar).toBe(1);
    expect(observed.bar).toBe(1);
    // delete
    delete original.foo;
    expect("foo" in original).toBe(false);
    expect("foo" in observed).toBe(false);
  });

  test("setting a property with an unobserved value should wrap with reactive", () => {
    const observed = reactive<{ foo?: object }>({});
    const raw = {};
    observed.foo = raw;
    expect(observed.foo).not.toBe(raw);
    expect(isReactive(observed.foo)).toBe(true);
  });

  test("observing already observed value should return same Proxy", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    const observed2 = reactive(observed);
    expect(observed2).toBe(observed);
  });

  test("observing the same value multiple times should return same Proxy", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    const observed2 = reactive(original);
    expect(observed2).toBe(observed);
  });

  test("should not pollute original object with Proxies", () => {
    const original: any = { foo: 1 };
    const original2 = { bar: 2 };
    const observed = reactive(original);
    const observed2 = reactive(original2);
    observed.bar = observed2;
    expect(observed.bar).toBe(observed2);
    expect(original.bar).toBe(original2);
  });

  test("mutation on objects using reactive as prototype should not trigger", () => {
    const observed = reactive({ foo: 1 });
    const original = Object.create(observed);
    expect(isReactive(observed)).toBe(true);
    expect(isReactive(original)).toBe(true);

    let dummy: number | undefined;
    effect(() => (dummy = original.foo));
    expect(dummy).toBe(1);
    observed.foo = 2;
    expect(dummy).toBe(2);
    original.foo = 3;
    expect(dummy).toBe(2);
    original.foo = 4;
    expect(dummy).toBe(2);
  });

  test("toRaw", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    expect(toRaw(observed)).toBe(original);
    expect(toRaw(original)).toBe(original);
  });

  test("toRaw on object using reactive as prototype", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    const inherited = Object.create(observed);
    expect(toRaw(inherited)).toBe(inherited);
  });

  test("toRaw on user Proxy wrapping reactive", () => {
    const original = {};
    const re = reactive(original);
    const obj = new Proxy(re, {});
    const raw = toRaw(obj);
    expect(raw).toBe(original);
  });

  test.skipIf(!isDev)("non-observable values", () => {
    const assertValue = (value: any) => {
      reactive(value);
      void expect(`value cannot be made reactive: ${String(value)}`).toHaveBeenWarnedLast();
    };

    // number
    assertValue(1);
    // string
    assertValue("foo");
    // boolean
    assertValue(false);
    // null
    assertValue(null);
    // undefined
    assertValue(undefined);
    // symbol
    const s = Symbol();
    assertValue(s);
    // bigint
    const bn = BigInt("9007199254740991");
    assertValue(bn);

    // built-ins should work and return same value
    const p = Promise.resolve();
    expect(reactive(p)).toBe(p);
    const r = new RegExp("");
    expect(reactive(r)).toBe(r);
    const d = new Date();
    expect(reactive(d)).toBe(d);
  });

  test("should not observe non-extensible objects", () => {
    const obj = reactive({
      foo: Object.preventExtensions({ a: 1 }),
      // sealed or frozen objects are considered non-extensible as well
      bar: Object.freeze({ a: 1 }),
      baz: Object.seal({ a: 1 })
    });
    expect(isReactive(obj.foo)).toBe(false);
    expect(isReactive(obj.bar)).toBe(false);
    expect(isReactive(obj.baz)).toBe(false);
  });

  test("should not observe objects with __lu_skip", () => {
    const original = {
      foo: 1,
      __lu_skip: true
    };
    const observed = reactive(original);
    expect(isReactive(observed)).toBe(false);
  });

  test("hasOwnProperty edge case: Symbol values", () => {
    const key = Symbol();
    const obj = reactive({ [key]: 1 }) as { [key]?: 1 };
    let dummy: boolean | undefined;
    effect(() => {
      dummy = obj.hasOwnProperty(key);
    });
    expect(dummy).toBe(true);

    delete obj[key];
    expect(dummy).toBe(false);
  });

  test("hasOwnProperty edge case: non-string values", () => {
    const key = {};
    const obj = reactive({ "[object Object]": 1 }) as { "[object Object]"?: 1 };
    let dummy: boolean | undefined;
    effect(() => {
      // @ts-expect-error
      dummy = obj.hasOwnProperty(key);
    });
    expect(dummy).toBe(true);

    // @ts-expect-error
    delete obj[key];
    expect(dummy).toBe(false);
  });

  test("isProxy", () => {
    const foo = {};
    expect(isProxy(foo)).toBe(false);

    const fooRe = reactive(foo);
    expect(isProxy(fooRe)).toBe(true);

    const barRl = readonly(foo);
    expect(isProxy(barRl)).toBe(true);
  });

  test("should return true for reactive objects", () => {
    expect(isReactive(reactive({}))).toBe(true);
    expect(isReactive(readonly(reactive({})))).toBe(true);
  });

  test("should return false for non-reactive objects", () => {
    // subtypes of Map
    expect(isReactive(reactive(new Map()))).toBe(false);
    expect(isReactive(readonly(reactive(new Map())))).toBe(false);
    expect(isReactive(reactive(new WeakMap()))).toBe(false);
    expect(isReactive(readonly(reactive(new WeakMap())))).toBe(false);

    // subtypes of Set
    expect(isReactive(reactive(new Set()))).toBe(false);
    expect(isReactive(readonly(reactive(new Set())))).toBe(false);
    expect(isReactive(reactive(new WeakSet()))).toBe(false);
    expect(isReactive(readonly(reactive(new WeakSet())))).toBe(false);
  });
});
