import type { Directive } from "@lune-js/context";
import { getElementMetadata } from "../utils";

/**
 * Toggles element visibility via CSS style variations (`lu-show`).
 * Extracts and preserves the initial structural `display` configuration inside a non-polluting
 * `WeakMap` metadata block, falling back to it conditionally whenever the reactive source statement evaluates to truthy.
 * @param ctx - The execution context bundle provided to the directive engine.
 */
export const show: Directive<HTMLElement> = ({ el, get, effect }) => {
  // Store original display value in metadata (WeakMap)
  // This will be automatically garbage collected when the element is removed
  const metadata = getElementMetadata(el);
  if (metadata.originalDisplay === undefined) {
    metadata.originalDisplay = el.style.display || "";
  }
  effect(() => {
    const shouldShow = get();
    el.style.display = shouldShow ? metadata.originalDisplay! : "none";
  });
};
