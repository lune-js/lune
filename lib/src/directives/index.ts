import { createScopedContext, evaluate, setInOnce } from "@lune-js/context";
import type { Context, Directive } from "@lune-js/context";
import { error } from "@lune-js/utils";
import { checkAttr } from "../utils";
import { bind } from "./bind";
import { effect } from "./effect";
import { _for } from "./for";
import { html } from "./html";
import { _if } from "./if";
import { model } from "./model";
import { on } from "./on";
import { ref } from "./ref";
import { show } from "./show";
import { text } from "./text";

export const builtInDirectives = {
  bind,
  effect,
  html,
  model,
  on,
  ref,
  show,
  text
};

const dirRE = /^(?:lu-|:|@)/;
const modifierRE = /\.([\w-]+)/g;

/**
 * Recursively traverses the DOM tree starting from a given root node.
 * Evaluates attributes for structural directives (`lu-if`, `lu-for`), processes normal attributes
 * for property/event bindings, or performs text interpolation on text nodes.
 * @param node - The starting DOM Node (Element, Text, DocumentFragment, etc.).
 * @param ctx - The reactive context layer containing the execution scopes, effects, and definitions.
 * @returns A pointer to the next valid sibling node if structural tree manipulation takes place.
 */
export function walk(node: Node, ctx: Context): ChildNode | null | void {
  const parentCtx = ctx;
  const type = node.nodeType;

  if (type === 1) {
    // Element
    const el = node as Element;
    if (el.hasAttribute("lu-pre")) return;

    checkAttr(el, "lu-cloak");

    let exp: string | null;

    // lu-if
    if ((exp = checkAttr(el, "lu-if"))) {
      return _if(el, exp, ctx);
    }

    // lu-for
    if ((exp = checkAttr(el, "lu-for"))) {
      return _for(el, exp, ctx);
    }

    // lu-scope
    if ((exp = checkAttr(el, "lu-scope")) || exp === "") {
      const scope = (exp ? evaluate(ctx.scope, exp, el) : {}) ?? {};
      scope.$root = el;

      ctx = createScopedContext(ctx, scope);
      if (scope.$template) {
        resolveTemplate(el, scope.$template);
      }
    }

    // lu-once
    const hasVOnce = checkAttr(el, "lu-once") != null;
    if (hasVOnce) {
      setInOnce(true);
    }

    // ref
    if ((exp = checkAttr(el, "ref"))) {
      if (ctx !== parentCtx) {
        applyDirective(el, ref, `"${exp}"`, parentCtx);
      }

      applyDirective(el, ref, `"${exp}"`, ctx);
    }

    // process children first before self attrs
    walkChildren(el, ctx);

    // other directives
    const deferred: [string, string][] = [];
    for (const { name, value } of Array.from(el.attributes)) {
      if (dirRE.test(name) && name !== "lu-cloak") {
        if (name === "lu-model") {
          // defer lu-model since it relies on :value bindings to be processed
          // first, but also before lu-on listeners (#73)
          deferred.unshift([name, value]);
        } else if (name[0] === "@" || /^lu-on\b/.test(name)) {
          deferred.push([name, value]);
        } else {
          processDirective(el, name, value, ctx);
        }
      }
    }
    for (const [name, value] of deferred) {
      processDirective(el, name, value, ctx);
    }

    if (hasVOnce) {
      setInOnce(false);
    }
  } else if (type === 3) {
    // Text
    const data = (node as Text).data;
    if (data.includes(ctx.delimiters[0])) {
      let segments: string[] = [];
      let lastIndex = 0;
      let match;
      while ((match = ctx.delimitersRE.exec(data))) {
        const leading = data.slice(lastIndex, match.index);
        if (leading) segments.push(JSON.stringify(leading));
        segments.push(`$s(${match[1]})`);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < data.length) {
        segments.push(JSON.stringify(data.slice(lastIndex)));
      }
      applyDirective(node, text, segments.join("+"), ctx);
    }
  } else if (type === 11) {
    walkChildren(node as DocumentFragment, ctx);
  }
}

function walkChildren(node: Element | DocumentFragment, ctx: Context): void {
  let child = node.firstChild;
  while (child) {
    child = walk(child, ctx) ?? child.nextSibling;
  }
}

function processDirective(el: Element, raw: string, exp: string, ctx: Context): void {
  let dir: (typeof builtInDirectives)[keyof typeof builtInDirectives];
  let arg: string | undefined;
  let modifiers: Record<string, true> | undefined;

  // modifiers
  let directive = raw.replace(modifierRE, (_, m) => {
    (modifiers ??= {})[m] = true;
    return "";
  });

  if (directive[0] === ":") {
    dir = bind;
    arg = directive.slice(1);
  } else if (directive[0] === "@") {
    dir = on;
    arg = directive.slice(1);
  } else {
    const argIndex = directive.indexOf(":");
    const dirName = argIndex > 0 ? directive.slice(3, argIndex) : directive.slice(3);
    dir =
      dirName in builtInDirectives ? builtInDirectives[dirName as keyof typeof builtInDirectives] : ctx.dirs[dirName];
    arg = argIndex > 0 ? directive.slice(argIndex + 1) : undefined;
  }
  if (dir) {
    if (dir === bind && arg === "ref") dir = ref;
    applyDirective(el, dir, exp, ctx, arg, modifiers);
    el.removeAttribute(raw);
  } else if (import.meta.env.DEV) {
    error(`unknown custom directive: "${raw}"`);
  }
}

/**
 * Instantiates and binds a directive pipeline instance safely to an execution lifecycle container.
 * Registers optional destructor cleanup functions directly into the tracking context frame.
 * @param el - The target DOM Element or Node.
 * @param dir - The custom or built-in structural directive definition closure.
 * @param exp - The unparsed string expression extracted from the raw DOM token attribute.
 * @param ctx - The active data execution frame context block.
 * @param arg - Optional argument modifiers following the colon token (e.g., `class` in `lu-bind:class`).
 * @param modifiers - Map containing specialized true flags parsed from dot syntax elements.
 */
function applyDirective(
  el: Node,
  dir: Directive<any>,
  exp: string,
  ctx: Context,
  arg?: string,
  modifiers?: Record<string, true>
): void {
  const get = (e = exp) => evaluate(ctx.scope, e, el);
  const cleanup = dir({
    el,
    get,
    effect: ctx.effect,
    ctx,
    exp,
    arg,
    modifiers
  });
  if (cleanup) {
    ctx.cleanups.push(cleanup);
  }
}

function resolveTemplate(el: Element, template: string): void {
  if (template[0] === "#") {
    const templateEl = document.querySelector(template);
    if (import.meta.env.DEV && !templateEl) {
      error(`template selector ${template} has no matching <template> element.`);
    }
    if (templateEl) {
      el.appendChild((templateEl as HTMLTemplateElement).content.cloneNode(true));
    }
    return;
  }

  el.innerHTML = template.replace(/<[/\s]*template\s*>/gi, "");
}
