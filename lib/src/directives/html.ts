import type { Directive } from "@lune-js/context";

export const html: Directive<Element> = ({ el, get, effect }) => {
  effect(() => {
    el.innerHTML = get();
  });
};
