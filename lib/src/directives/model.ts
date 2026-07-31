import type { Directive } from "@lune-js/context";
import { isArray, toNumber } from "@lune-js/utils";
import { listen, looseEqual, looseIndexOf } from "../utils";

// Consolidated value handling utilities
export function createValueHandler(resolveValue: (val: string) => any) {
  return function (el: HTMLInputElement | HTMLTextAreaElement, assign: (val: any) => void) {
    if ((el as any).composing) return;
    assign(resolveValue(el.value));
  };
}

// retrieve raw value for true-value and false-value set via :true-value or :false-value bindings
function getCheckboxValue(el: HTMLInputElement & { _trueValue?: any; _falseValue?: any }, checked: boolean) {
  const key = checked ? "_trueValue" : "_falseValue";
  return key in el ? el[key] : checked;
}

function getValue(el: any) {
  return "_value" in el ? el._value : el.value;
}

export function handleCheckboxChange(el: HTMLInputElement, get: () => any, assign: (val: any) => void): void {
  const modelValue = get();
  const checked = el.checked;
  if (isArray(modelValue)) {
    const elementValue = getValue(el);
    const index = looseIndexOf(modelValue, elementValue);
    const found = index !== -1;
    if (checked && !found) {
      assign(modelValue.concat(elementValue));
    } else if (!checked && found) {
      const filtered = [...modelValue];
      filtered.splice(index, 1);
      assign(filtered);
    }
  } else {
    assign(getCheckboxValue(el, checked));
  }
}

export function handleRadioChange(el: HTMLInputElement, assign: (val: any) => void): void {
  assign(getValue(el));
}

/**
 * Orchestrates two-way data binding primitives between view layouts and scope records (`lu-model`).
 * Intercepts specialized target composition events, maps input value behaviors, registers native
 * change handlers, and provisions fallback states to keep physical form states coupled to reactive contexts.
 */
export const model: Directive<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = ({
  el,
  exp,
  get,
  effect,
  modifiers
}) => {
  const type = el.type;
  const assign = get(`(val) => { ${exp} = val }`);
  const { trim, number = type === "number" || type === "range" } = modifiers ?? {};

  if (el.tagName === "SELECT") {
    const sel = el as HTMLSelectElement;
    listen(el, "change", () => {
      const selectedVal = Array.prototype.filter
        .call(sel.options, (o: HTMLOptionElement) => o.selected)
        .map((o: HTMLOptionElement) => {
          const val = getValue(o);
          const num = toNumber(getValue(o));

          return number && !Number.isNaN(num) ? num : val;
        });
      assign(sel.multiple ? selectedVal : selectedVal[0]);
    });
    effect(() => {
      const value = get();
      const isMultiple = sel.multiple;
      const options = sel.options;
      for (let i = 0, l = options.length; i < l; i++) {
        const option = options[i];
        const optionValue = getValue(option);
        if (isMultiple) {
          if (isArray(value)) {
            option.selected = looseIndexOf(value, optionValue) > -1;
          } else {
            option.selected = false;
          }
        } else {
          if (looseEqual(optionValue, value)) {
            if (sel.selectedIndex !== i) sel.selectedIndex = i;
            return;
          }
        }
      }
      if (!isMultiple && sel.selectedIndex !== -1) {
        sel.selectedIndex = -1;
      }
    });
  } else if (type === "checkbox") {
    listen(el, "change", () => {
      handleCheckboxChange(el as HTMLInputElement, get, assign);
    });

    let oldValue: any;
    effect(() => {
      updateCheckboxValue(el as HTMLInputElement, get, oldValue);
      oldValue = get();
    });
  } else if (type === "radio") {
    listen(el, "change", () => {
      handleRadioChange(el as HTMLInputElement, assign);
    });
    effect(() => {
      const value = get();
      (el as HTMLInputElement).checked = looseEqual(value, getValue(el));
    });
  } else {
    // text-like
    const resolveValue = (val: string) => {
      if (trim) return val.trim();
      if (number) {
        const num = toNumber(val);
        if (!Number.isNaN(toNumber(val))) return num;
      }
      return val;
    };

    const handleInput = createValueHandler(resolveValue);
    const handlers: Record<string, EventListener> = {
      compositionstart: onCompositionStart,
      compositionend: onCompositionEnd,
      [modifiers?.lazy ? "change" : "input"]: () => handleInput(el as HTMLInputElement | HTMLTextAreaElement, assign)
    };

    if (trim) {
      handlers.change = () => {
        el.value = el.value.trim();
      };
    }

    setupInputHandlers(el, handlers);

    effect(() => {
      updateTextValue(el as HTMLInputElement | HTMLTextAreaElement, get, resolveValue);
    });
  }
};

export function onCompositionEnd(e: Event): void {
  const target = e.target as any;
  if (target.composing) {
    target.composing = false;
    trigger(target, "input");
  }
}

function onCompositionStart(e: Event): void {
  (e.target as any).composing = true;
}

function setupInputHandlers(el: Element, handlers: Record<string, EventListener>): void {
  Object.entries(handlers).forEach(([event, handler]) => {
    listen(el, event, handler);
  });
}

export function updateCheckboxValue(el: HTMLInputElement, get: () => any, oldValue: any): void {
  const value = get();
  if (isArray(value)) {
    el.checked = looseIndexOf(value, getValue(el)) > -1;
  } else if (value !== oldValue) {
    el.checked = looseEqual(value, getCheckboxValue(el, true));
  }
}

export function updateTextValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  get: () => any,
  resolveValue: (val: string) => any
): void {
  if ((el as any).composing) {
    return;
  }
  const curVal = el.value;
  const newVal = get();
  if (document.activeElement === el && resolveValue(curVal) === newVal) {
    return;
  }
  if (curVal !== newVal) {
    el.value = newVal;
  }
}

function trigger(el: HTMLElement, type: string): void {
  const e = document.createEvent("HTMLEvents");
  e.initEvent(type, true, true);
  el.dispatchEvent(e);
}
