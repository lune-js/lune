import { describe, expect, test, vi } from "bun:test";
import { effect, reactive, readonly, shallowReactive } from "../src";
import { isReactive, isReadonly, toRaw } from "../src/utils";

describe("arrayInstrumentations", () => {
  describe("iterators", () => {
    test("Symbol.iterator wraps values of a deep reactive array", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);
      const seen = [...arr];

      expect(seen).toHaveLength(2);
      expect(isReactive(seen[0])).toBe(true);
      expect(isReactive(seen[1])).toBe(true);
      expect(seen[0].n).toBe(1);
    });

    test("values() wraps items and tracks iteration", () => {
      const arr = reactive([{ n: 1 }]);
      let count = 0;
      effect(() => {
        count = 0;
        for (const item of arr.values()) {
          expect(isReactive(item)).toBe(true);
          count++;
        }
      });
      expect(count).toBe(1);

      arr.push({ n: 2 });
      expect(count).toBe(2);
    });

    test("entries() wraps the value half of each pair", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);
      const pairs = [...arr.entries()];

      expect(pairs.map(([i]) => i)).toEqual([0, 1]);
      expect(isReactive(pairs[0][1])).toBe(true);
      expect(toRaw(pairs[1][1])).toBe(toRaw(arr)[1]);
    });

    test("entries() is reactive", () => {
      const arr = reactive([{ n: 1 }]);
      let keys: number[] = [];
      effect(() => {
        keys = [...arr.entries()].map(([i]) => i);
      });
      expect(keys).toEqual([0]);

      arr.push({ n: 2 });
      expect(keys).toEqual([0, 1]);
    });

    test("does not wrap values of a shallow reactive array", () => {
      const raw = { n: 1 };
      const arr = shallowReactive([raw]);

      expect([...arr][0]).toBe(raw);
      expect([...arr.values()][0]).toBe(raw);
      expect([...arr.entries()][0][1]).toBe(raw);
    });

    test("wraps values of a readonly array as readonly", () => {
      const arr = readonly([{ n: 1 }]);
      const [item] = [...arr];

      expect(isReadonly(item)).toBe(true);
      expect(isReactive(item)).toBe(false);
    });

    test("wraps values of a readonly reactive array as readonly reactive", () => {
      const arr = readonly(reactive([{ n: 1 }]));
      const [item] = [...arr];

      expect(isReadonly(item)).toBe(true);
      expect(isReactive(item)).toBe(true);
    });
  });

  describe("read-only copies", () => {
    test("concat merges raw and reactive arrays with reactive items", () => {
      const arr = reactive([{ n: 1 }]);
      const other = reactive([{ n: 2 }]);
      const res = arr.concat(other, [{ n: 3 }], 4 as any);

      expect(res).toHaveLength(4);
      expect(isReactive(res[0])).toBe(true);
      expect(isReactive(res[1])).toBe(true);
      expect(res[3]).toBe(4 as any);
    });

    test("concat tracks iteration", () => {
      const arr = reactive([1]);
      let res: number[] = [];
      effect(() => {
        res = arr.concat([9]);
      });
      expect(res).toEqual([1, 9]);

      arr.push(2);
      expect(res).toEqual([1, 2, 9]);
    });

    test("join tracks iteration", () => {
      const arr = reactive(["a", "b"]);
      let res = "";
      effect(() => {
        res = arr.join("-");
      });
      expect(res).toBe("a-b");

      arr.push("c");
      expect(res).toBe("a-b-c");
    });

    test("toReversed returns a plain array of reactive items", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);
      const res = arr.toReversed();

      expect(isReactive(res)).toBe(false);
      expect(res[0].n).toBe(2);
      expect(isReactive(res[0])).toBe(true);
    });

    test("toSorted works with and without a comparer", () => {
      const arr = reactive([3, 1, 2]);
      expect(arr.toSorted()).toEqual([1, 2, 3]);
      expect(arr.toSorted((a, b) => b - a)).toEqual([3, 2, 1]);
      expect(arr).toEqual([3, 1, 2]);
    });

    test("toSorted tracks iteration", () => {
      const arr = reactive([3, 1]);
      let res: number[] = [];
      effect(() => {
        res = arr.toSorted((a, b) => a - b);
      });
      expect(res).toEqual([1, 3]);

      arr.push(2);
      expect(res).toEqual([1, 2, 3]);
    });

    test("toSpliced returns a copy without mutating the source", () => {
      const arr = reactive([1, 2, 3]);
      const res = arr.toSpliced(1, 1, 9, 10);

      expect(res).toEqual([1, 9, 10, 3]);
      expect(arr).toEqual([1, 2, 3]);
    });

    test("copy helpers on a shallow array keep raw items", () => {
      const raw = { n: 1 };
      const arr = shallowReactive([raw]);

      expect(arr.concat()[0]).toBe(raw);
      expect(arr.toReversed()[0]).toBe(raw);
    });
  });

  describe("iteration callbacks", () => {
    test("every / some receive reactive items", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);

      expect(arr.every((item) => isReactive(item))).toBe(true);
      expect(arr.every((item) => item.n > 1)).toBe(false);
      expect(arr.some((item) => item.n > 1)).toBe(true);
      expect(arr.some((item) => item.n > 5)).toBe(false);
    });

    test("forEach receives reactive items, index and the proxy itself", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);
      const seen: [number, boolean, boolean][] = [];

      arr.forEach((item, index, array) => {
        seen.push([index, isReactive(item), array === arr]);
      });

      expect(seen).toEqual([
        [0, true, true],
        [1, true, true]
      ]);
    });

    test("map returns a plain array of the callback results", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);
      const res = arr.map((item) => item.n * 2);

      expect(res).toEqual([2, 4]);
      expect(isReactive(res)).toBe(false);
    });

    test("filter returns reactive items", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);
      const res = arr.filter((item) => item.n > 1);

      expect(res).toHaveLength(1);
      expect(isReactive(res[0])).toBe(true);
      expect(res[0].n).toBe(2);
    });

    test("find / findLast return reactive items", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }, { n: 1 }]);

      const first = arr.find((item) => item.n === 1)!;
      const last = arr.findLast((item) => item.n === 1)!;

      expect(isReactive(first)).toBe(true);
      expect(isReactive(last)).toBe(true);
      expect(toRaw(first)).toBe(toRaw(arr)[0]);
      expect(toRaw(last)).toBe(toRaw(arr)[2]);
      expect(arr.find((item) => item.n === 99)).toBeUndefined();
    });

    test("findIndex / findLastIndex return plain indexes", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }, { n: 1 }]);

      expect(arr.findIndex((item) => item.n === 1)).toBe(0);
      expect(arr.findLastIndex((item) => item.n === 1)).toBe(2);
      expect(arr.findIndex((item) => item.n === 99)).toBe(-1);
    });

    test("iteration callbacks honour thisArg", () => {
      const arr = reactive([1, 2]);
      const thisArg = { offset: 10 };

      expect(
        arr.map(function (this: typeof thisArg, item) {
          return item + this.offset;
        }, thisArg)
      ).toEqual([11, 12]);
    });

    test("iteration callbacks are reactive", () => {
      const arr = reactive([1, 2]);
      const spy = vi.fn();
      effect(() => {
        spy(arr.filter((n) => n > 1));
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toEqual([2]);

      arr.push(3);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][0]).toEqual([2, 3]);
    });

    test("shallow arrays pass raw items but still pass the proxy as third arg", () => {
      const raw = { n: 1 };
      const arr = shallowReactive([raw]);
      const seen: unknown[] = [];

      arr.forEach((item, _index, array) => {
        seen.push(item, array);
      });

      expect(seen[0]).toBe(raw);
      expect(seen[1]).toBe(arr);
      expect(arr.find((item) => item === raw)).toBe(raw);
      expect(arr.filter((item) => item === raw)[0]).toBe(raw);
    });

    test("shallow arrays skip wrapping when the callback ignores the array arg", () => {
      const raw = { n: 1 };
      const arr = shallowReactive([raw]);

      expect(arr.map((item) => item)).toEqual([raw]);
    });

    test("readonly arrays pass readonly items to callbacks", () => {
      const arr = readonly([{ n: 1 }]);
      const res = arr.filter(() => true);

      expect(isReadonly(res[0])).toBe(true);
      expect(isReadonly(arr.find(() => true)!)).toBe(true);
    });

    test("readonly arrays leave primitives untouched", () => {
      const arr = readonly([1, "two", null]);

      expect(arr.filter(() => true)).toEqual([1, "two", null]);
      expect([...arr]).toEqual([1, "two", null]);
    });
  });

  describe("reduce / reduceRight", () => {
    test("reduce receives reactive items, index and the proxy", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);
      const seen: [number, boolean][] = [];

      const total = arr.reduce((acc, item, index, array) => {
        seen.push([index, array === arr]);
        expect(isReactive(item)).toBe(true);
        return acc + item.n;
      }, 0);

      expect(total).toBe(3);
      expect(seen).toEqual([
        [0, true],
        [1, true]
      ]);
    });

    test("reduce without an initial value wraps the first accumulator", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);
      const accs: boolean[] = [];

      const res = arr.reduce((acc: any, item: any) => {
        accs.push(isReactive(acc));
        return { n: acc.n + item.n };
      });

      expect(accs).toEqual([true]);
      expect(res.n).toBe(3);
    });

    test("reduce without an initial value on a single-item array wraps the result", () => {
      const arr = reactive([{ n: 1 }]);
      const res = arr.reduce((acc) => acc);

      expect(isReactive(res)).toBe(true);
      expect(res.n).toBe(1);
    });

    test("reduceRight walks from the end", () => {
      const arr = reactive([{ n: 1 }, { n: 2 }]);
      const order: number[] = [];

      const res = arr.reduceRight((acc, item) => {
        order.push(item.n);
        return acc + item.n;
      }, 0);

      expect(res).toBe(3);
      expect(order).toEqual([2, 1]);
    });

    test("reduce is reactive", () => {
      const arr = reactive([1, 2]);
      let total = 0;
      effect(() => {
        total = arr.reduce((acc, n) => acc + n, 0);
      });
      expect(total).toBe(3);

      arr.push(3);
      expect(total).toBe(6);
    });

    test("reduce on a shallow array passes raw items and the proxy", () => {
      const raw = { n: 1 };
      const arr = shallowReactive([raw]);
      const seen: unknown[] = [];

      arr.reduce((acc, item, _index, array) => {
        seen.push(item, array);
        return acc;
      }, null);

      expect(seen[0]).toBe(raw);
      expect(seen[1]).toBe(arr);
    });

    test("reduce on a shallow array skips wrapping for short callbacks", () => {
      const arr = shallowReactive([1, 2]);
      expect(arr.reduce((acc, n) => acc + n, 0)).toBe(3);
    });

    test("reduce on a readonly array passes readonly items", () => {
      const arr = readonly([{ n: 1 }]);
      const res = arr.reduce((_acc: unknown, item) => item, null as any);

      expect(isReadonly(res)).toBe(true);
    });
  });

  describe("Array subclasses", () => {
    class SubArray<T> extends Array<T> {
      lastMapper: unknown;

      map(fn: any, thisArg?: any): any {
        this.lastMapper = fn;
        return super.map(fn, thisArg);
      }
    }

    test("calls the overridden method with the original arguments", () => {
      const subArray = new SubArray<number>();
      subArray.push(1, 2);
      const observed = reactive(subArray);

      const mapper = (n: number) => n * 2;
      const res = observed.map(mapper);

      expect(observed.lastMapper).toBe(mapper);
      expect([...res]).toEqual([2, 4]);
    });

    test("wraps the result of an overridden method that returns an object", () => {
      const subArray = new SubArray<{ n: number }>();
      subArray.push({ n: 1 });
      const observed = reactive(subArray);

      const res = observed.map((item: { n: number }) => item);
      expect(isReactive(res)).toBe(true);
    });
  });
});
