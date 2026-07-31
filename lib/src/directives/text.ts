import type { Directive } from "@lune-js/context";
import { toDisplayString } from "../utils";

/**
 * Updates basic string layouts cleanly inside DOM nodes (`lu-text`).
 * Evaluates the targeted scope path, stringifies the result safely via internal formatting routines,
 * and overrides the Node's active text content directly upon value mutations.
 * @param ctx - The execution context bundle provided to the directive engine.
 */
export const text: Directive<Text | Element> = ({ el, get, effect }): void => {
  effect(() => {
    el.textContent = toDisplayString(get());
  });
};
