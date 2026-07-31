import { Block, evaluate } from "@lune-js/context";
import type { Context } from "@lune-js/context";
import { warn } from "@lune-js/utils";
import { walk } from ".";
import { checkAttr } from "../utils";

interface Branch {
  exp?: string | null;
  el: Element;
}

/**
 * Implements conditional rendering logic (`lu-if`, `lu-else-if`, `lu-else`).
 * extracts sibling branches synchronously from the DOM, replaces the active node with an empty Comment anchor,
 * and handles localized view rendering/teardown within a micro-managed sub-context container block.
 * @param el - The source template node holding the initial structural constraint indicator.
 * @param exp - The boolean expression parsed to verify active layout rendering states.
 * @param ctx - The running parent scope execution context.
 * @returns The next valid runtime child node layer targeting subsequent walker steps.
 */
export function _if(el: Element, exp: string, ctx: Context): ChildNode | null | undefined {
  if (import.meta.env.DEV && !exp.trim()) {
    warn("lu-if expression cannot be empty");
  }

  const parent = el.parentElement ?? (el.parentNode as Element | DocumentFragment);
  if (!parent) return undefined;

  const anchor = new Comment("lu-if");
  parent.insertBefore(anchor, el);

  const branches: Branch[] = [
    {
      exp,
      el
    }
  ];

  // locate else branch
  let elseEl: Element | null;
  let elseExp: string | null;
  while ((elseEl = el.nextElementSibling)) {
    elseExp = null;
    if (checkAttr(elseEl, "lu-else") === "" || (elseExp = checkAttr(elseEl, "lu-else-if"))) {
      parent.removeChild(elseEl);
      branches.push({ exp: elseExp, el: elseEl });
    } else {
      break;
    }
  }

  const nextNode = el.nextSibling;
  parent.removeChild(el);

  let block: Block | undefined;
  let activeBranchIndex: number = -1;

  const removeActiveBlock = (): void => {
    if (block) {
      parent.insertBefore(anchor, block.el);
      block.remove();
      block = undefined;
    }
  };

  ctx.effect(() => {
    for (let i = 0; i < branches.length; i++) {
      const { exp, el } = branches[i];
      if (exp == null || evaluate(ctx.scope, exp, el)) {
        if (i !== activeBranchIndex) {
          removeActiveBlock();
          block = new Block(el, ctx, walk);
          block.insert(parent, anchor);
          parent.removeChild(anchor);
          activeBranchIndex = i;
        }
        return;
      }
    }
    // no matched branch.
    activeBranchIndex = -1;
    removeActiveBlock();
  });

  return nextNode;
}
