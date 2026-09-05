import { isObject, warn } from "@lune-js/utils";
import { ReactiveFlags, TargetType } from "./constants";
import { mutableHandlers, readonlyHandlers, shallowReactiveHandlers, shallowReadonlyHandlers } from "./handlers";
import type { DeepReadonly, Reactive, Target } from "./types";
import { isReadonly, toRawType } from "./utils";

export const reactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>();
export const readonlyMap: WeakMap<Target, any> = new WeakMap<Target, any>();
export const shallowReactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>();
export const shallowReadonlyMap: WeakMap<Target, any> = new WeakMap<Target, any>();

function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  handler: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  if (!isObject(target)) {
    if (import.meta.env.DEV) {
      warn(`value cannot be made ${isReadonly ? "readonly" : "reactive"}: ${String(target)}`);
    }
    return target;
  }

  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
    return target;
  }
  // only specific value types can be observed.
  if (target[ReactiveFlags.SKIP] || !Object.isExtensible(target)) {
    return target;
  }

  // target already has corresponding Proxy
  const existingProxy = proxyMap.get(target);
  if (existingProxy) return existingProxy;

  // only a whitelist of value types can be observed
  const targetType = targetTypeMap(toRawType(target));
  if (targetType === TargetType.INVALID) return target;

  const proxy = new Proxy(target, handler);
  proxyMap.set(target, proxy);
  return proxy;
}

/**
 * Creates a deeply reactive proxy of the given target object.
 * Re-runs any tracking `effect` functions automatically whenever nested properties are accessed
 * or mutated. Delegates proxy traps to specialized mutable handlers.
 * @param target - The source object or array to observe.
 * @returns A reactive proxy wrapping the target object.
 * @see {@link http://lune-js.com/guide/reactivity#reactive-object}
 */
export function reactive<T extends object>(target: T): Reactive<T>;
/*@__NO_SIDE_EFFECTS__*/
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  if (isReadonly(target)) return target;

  return createReactiveObject(target, false, mutableHandlers, reactiveMap);
}

/**
 * Creates a shallow reactive proxy where only top-level properties trigger tracking and reactive updates.
 * Nested objects inside the properties remain un-proxied raw values.
 * @param target - The source object or array.
 * @returns A shallow reactive proxy.
 * @see {@link http://lune-js.com/guide/reactivity#shallowreactive-object-shallowreadonly-object}
 */
/*@__NO_SIDE_EFFECTS__*/
export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(target, false, shallowReactiveHandlers, shallowReactiveMap);
}

/**
 * Creates a deeply read-only proxy. Attempts to set properties or trigger structural
 * mutations emit warnings in development mode and fail gracefully.
 * @param target - The source object to make read-only.
 * @returns A deeply immutable and reactive proxy window.
 * @see {@link http://lune-js.com/guide/reactivity#readonly-object}
 */
/*@__NO_SIDE_EFFECTS__*/
export function readonly<T extends object>(target: T): DeepReadonly<Reactive<T>> {
  return createReactiveObject(target, true, readonlyHandlers, readonlyMap);
}

/**
 * Shallow version of {@link readonly}.
 *
 * Unlike {@link readonly}, there is no deep conversion: only root-level
 * properties are made readonly. Property values are stored and exposed as-is -
 * this also means properties with ref values will not be automatically
 * unwrapped.
 *
 * @example
 * ```js
 * const state = shallowReadonly({
 *   foo: 1,
 *   nested: {
 *     bar: 2
 *   }
 * })
 *
 * // mutating state's own properties will fail
 * state.foo++
 *
 * // ...but works on nested objects
 * isReadonly(state.nested) // false
 *
 * // works
 * state.nested.bar++
 * ```
 *
 * @param target - The source object.
 * @see {@link http://lune-js.com/guide/reactivity#shallowreactive-object-shallowreadonly-object}
 */
/*@__NO_SIDE_EFFECTS__*/
export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReactiveObject(target, true, shallowReadonlyHandlers, shallowReadonlyMap);
}

function targetTypeMap(rawType: string): TargetType {
  switch (rawType) {
    case "Object":
    case "Array":
      return TargetType.COMMON;
    default:
      return TargetType.INVALID;
  }
}
