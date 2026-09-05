import { createApp } from ".";

export { createApp };

/**
 * Automatically mounts the application if the current script tag has an `init` attribute.
 */
export const autoMount = (): void => {
  const s = document.currentScript;
  if (s?.hasAttribute("init")) {
    createApp().mount();
  }
};

export { effect, reactive, readonly, shallowReactive, shallowReadonly } from "@lune-js/core";
export { allowGlobals, nextTick } from "@lune-js/context";

autoMount();
