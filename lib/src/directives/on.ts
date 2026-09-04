import { nextTick } from "@lune-js/context";
import type { Directive } from "@lune-js/context";
import { error, kebabCase } from "@lune-js/utils";
import { listen } from "../utils";

// same as vue 2
const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/;

const systemModifiers = ["ctrl", "shift", "alt", "meta"];

// forwarded to addEventListener rather than checked when the event fires
const listenerOptions = new Set(["capture", "once", "passive"]);

type KeyedEvent = KeyboardEvent | MouseEvent | TouchEvent;

const modifierGuards: Record<string, (e: Event, modifiers: Record<string, true>) => void | boolean> = {
  stop: (e) => e.stopPropagation(),
  prevent: (e) => e.preventDefault(),
  self: (e) => e.target !== e.currentTarget,
  ctrl: (e) => !(e as KeyedEvent).ctrlKey,
  shift: (e) => !(e as KeyedEvent).shiftKey,
  alt: (e) => !(e as KeyedEvent).altKey,
  meta: (e) => !(e as KeyedEvent).metaKey,
  left: (e) => "button" in e && (e as MouseEvent).button !== 0,
  middle: (e) => "button" in e && (e as MouseEvent).button !== 1,
  right: (e) => "button" in e && (e as MouseEvent).button !== 2,
  exact: (e, modifiers) => systemModifiers.some((m) => (e as any)[`${m}Key`] && !modifiers[m])
};

/**
 * Drives event listener attachments and modifier strategies (`lu-on` or `@`).
 * Resolves expression types into executable method invocations, abstracts special lifecycles
 * like `vue:mounted` or `vue:unmounted`, and intercepts events via structured modifier filters
 * (e.g., `.stop`, `.prevent`, `.ctrl`, `.exact`).
 * @param ctx - The execution context bundle provided to the directive engine.
 * @returns An optional cleanup subroutine to tear down global window/element listeners.
 */
export const on: Directive<Element> = ({ el, exp, get, arg, modifiers }) => {
  if (!arg) {
    if (import.meta.env.DEV) {
      error(`lu-on="obj" syntax is not supported.`);
    }
    return;
  }

  let handler = simplePathRE.test(exp) ? get(`(e => ${exp}(e))`) : get(`($event => { ${exp} })`);

  // special lifecycle events
  if (import.meta.env.DEV && (arg === "mounted" || arg === "unmounted")) {
    error("Mounted and unmounted hooks now need to be prefixed with lune.", `Use '@lune:${arg}="handler"' instead.`);
  }
  if (arg === "lune:mounted") {
    nextTick(handler);
    return;
  } else if (arg === "lune:unmounted") {
    return () => handler();
  }

  if (modifiers) {
    // map modifiers
    if (arg === "click") {
      if (modifiers.right) arg = "contextmenu";
      if (modifiers.middle) arg = "mouseup";
    }

    // anything that is neither a guard nor a listener option names a key
    const keyModifiers = Object.keys(modifiers).filter((m) => !(m in modifierGuards) && !listenerOptions.has(m));

    const raw = handler;
    handler = (e: Event) => {
      if (keyModifiers.length && "key" in e && !keyModifiers.includes(kebabCase((e as KeyboardEvent).key))) {
        return;
      }
      for (const key in modifiers) {
        const guard = modifierGuards[key];
        if (guard?.(e, modifiers)) {
          return;
        }
      }
      return raw(e);
    };
  }

  listen(el, arg, handler, modifiers);
};
