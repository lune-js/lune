import { execute, nextTick } from "@lune-js/context";
import type { Directive } from "@lune-js/context";

export const effect: Directive<Element> = ({ el, ctx, exp, effect }) => {
  nextTick(() => effect(() => execute(ctx.scope, exp, el)));
};
