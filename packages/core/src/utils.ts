import { isString } from "@lune-js/utils";
import { ReactiveFlags } from "./constants";
import type { Target } from "./types";

/**
 * Checks if `key` is an integer key.
 *
 * This function is taken from Vue's source code:
 * https://github.com/vuejs/core/blob/v3.5.34/packages/shared/src/general.ts
 *
 * @param {unknown} key The value to check if it is an integer key.
 * @returns {boolean} Returns `true` if `key` is an integer key, else `false`.
 *
 * @example
 * console.log(isIntegerKey('0')); // true
 * console.log(isIntegerKey('1')); // true
 * console.log(isIntegerKey('-1')); // false
 * console.log(isIntegerKey('NaN')); // false
 * console.log(isIntegerKey('1.5')); // false
 * console.log(isIntegerKey('abc')); // false
 * console.log(isIntegerKey(0)); // false
 */
export function isIntegerKey(key: unknown): boolean {
  return isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
}

/**
 * Checks if an object is a proxy created by {@link reactive},
 * {@link readonly}, {@link shallowReactive} or {@link shallowReadonly}.
 *
 * @param value - The value to check.
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#isproxy}
 */
/*@__NO_SIDE_EFFECTS__*/
export function isProxy(value: any): boolean {
  return value ? !!value[ReactiveFlags.RAW] : false;
}

/**
 * Checks if an object is a proxy created by {@link reactive} or
 * {@link shallowReactive} (or {@link ref} in some cases).
 *
 * @example
 * ```js
 * isReactive(reactive({}))            // => true
 * isReactive(readonly(reactive({})))  // => true
 * isReactive(ref({}).value)           // => true
 * isReactive(readonly(ref({})).value) // => true
 * isReactive(ref(true))               // => false
 * isReactive(shallowRef({}).value)    // => false
 * isReactive(shallowReactive({}))     // => true
 * ```
 *
 * @param value - The value to check.
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#isreactive}
 */
/*@__NO_SIDE_EFFECTS__*/
export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW]);
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE]);
}

/**
 * Checks whether the passed value is a readonly object. The properties of a
 * readonly object can change, but they can't be assigned directly via the
 * passed object.
 *
 * The proxies created by {@link readonly} and {@link shallowReadonly} are
 * both considered readonly, as is a computed ref without a set function.
 *
 * @param value - The value to check.
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#isreadonly}
 */
/*@__NO_SIDE_EFFECTS__*/
export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY]);
}

/*@__NO_SIDE_EFFECTS__*/
export function isShallow(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_SHALLOW]);
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * IMPORTANT: all calls of this function must be prefixed with
 * \/\*#\_\_PURE\_\_\*\/
 * So that rollup can tree-shake them if necessary.
 */

/*@__NO_SIDE_EFFECTS__*/
export function makeMap(str: string): (key: string) => boolean {
  const map = Object.create(null);
  for (const key of str.split(",")) map[key] = 1;
  return (val) => val in map;
}

/**
 * Returns the raw, original object of a Lune-created proxy.
 *
 * `toRaw()` can return the original object from proxies created by
 * {@link reactive}, {@link readonly}, {@link shallowReactive} or
 * {@link shallowReadonly}.
 *
 * This is an escape hatch that can be used to temporarily read without
 * incurring proxy access / tracking overhead or write without triggering
 * changes. It is **not** recommended to hold a persistent reference to the
 * original object. Use with caution.
 *
 * @example
 * ```js
 * const foo = {}
 * const reactiveFoo = reactive(foo)
 *
 * console.log(toRaw(reactiveFoo) === foo) // true
 * ```
 *
 * @param observed - The object for which the "raw" value is requested.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#toraw}
 */
/*@__NO_SIDE_EFFECTS__*/
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW];
  return raw ? toRaw(raw) : observed;
}

export function toRawType(value: unknown): string {
  // extract "RawType" from strings like "[object RawType]"
  return Object.prototype.toString.call(value).slice(8, -1);
}
