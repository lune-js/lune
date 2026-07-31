import type { Directive } from "@lune-js/context";
import { Block, bindContextMethods, createContext, nextTick } from "@lune-js/context";
import { reactive } from "@lune-js/core";
import { error, isFunction, warn } from "@lune-js/utils";
import { walk } from "./directives";
import type { App, Plugin } from "./types";
import { toDisplayString } from "./utils";

const escapeRegex = (str: string): string => str.replace(/[-.*+?^${}()|[\]/\\]/g, "\\$&");
const installedPlugins = new WeakSet();

/**
 * Spawns a main isolated Lune application runtime lifecycle object.
 * initializes reactive global configurations, attaches structural template context properties,
 * provides plugin activation hooks, and binds a tree compiler instance to process target DOM frames.
 * @param initialData - Optional structure initializing base states, bindings, or override parameters.
 * @returns A pristine application container instance complete with lifecycle controls.
 */
export const createApp = (initialData?: any): App => {
  // root context
  const ctx = createContext();
  if (initialData) {
    ctx.scope = reactive(initialData);
    bindContextMethods(ctx.scope);

    // handle custom delimiters
    if (initialData.$delimiters) {
      const [open, close] = (ctx.delimiters = initialData.$delimiters);
      ctx.delimitersRE = new RegExp(escapeRegex(open) + "([^]+?)" + escapeRegex(close), "g");
    }
  }

  // global internal helpers
  ctx.scope.$s = toDisplayString;
  ctx.scope.$nextTick = nextTick;
  ctx.scope.$refs = Object.create(null);

  let rootBlocks: Block[];

  return {
    directive(name: string, def?: Directive) {
      if (def) {
        ctx.dirs[name] = def;
        return this;
      }

      return ctx.dirs[name];
    },

    mount(el?: string | Element | null) {
      if (typeof el === "string") {
        const selector = el;
        el = document.querySelector(el);
        if (!el) {
          if (import.meta.env.DEV) error(`selector ${selector} has no matching element.`);
          return;
        }
      }

      el = el ?? document.documentElement;
      let roots: Element[];
      if (el.hasAttribute("lu-scope")) {
        roots = [el];
      } else {
        roots = [...el.querySelectorAll(`[lu-scope]`)].filter((root) => !root.matches(`[lu-scope] [lu-scope]`));
      }

      if (!roots.length) {
        roots = [el];
      }

      if (import.meta.env.DEV && roots.length === 1 && roots[0] === document.documentElement) {
        warn(
          "Mounting on documentElement: this is non-optimal as Lune.js will be forced to crawl the entire page's DOM.",
          `Consider explicitly marking elements controlled by Lune.js with "lu-scope".`
        );
      }

      rootBlocks = roots.map((el) => new Block(el, ctx, walk, true));
      return this;
    },

    get rootBlocks() {
      return rootBlocks;
    },

    get scope() {
      return ctx.scope;
    },

    unmount() {
      for (const block of rootBlocks) {
        block.teardown();
      }
    },

    use(plugin: Plugin, ...options: any[]) {
      if (installedPlugins.has(plugin) && import.meta.env.DEV) {
        warn(`Plugin has already been applied to target app.`);
      } else if (plugin && isFunction(plugin.install)) {
        installedPlugins.add(plugin);
        plugin.install(this, ...options);
      } else if (isFunction(plugin)) {
        installedPlugins.add(plugin);
        plugin(this, ...options);
      } else if (import.meta.env.DEV) {
        warn(`A plugin must either be a function or an object with an "install" function.`);
      }
      return this;
    }
  };
};

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
export { nextTick } from "@lune-js/context";

autoMount();
