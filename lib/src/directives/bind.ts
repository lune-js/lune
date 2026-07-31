import type { Directive } from "@lune-js/context";
import { camelCase, isArray, isObject, isString, kebabCase } from "@lune-js/utils";
import { getElementMetadata, normalizeClass, normalizeStyle } from "../utils";

// Properties that should be set as attributes for consistency
const DOM_ATTR_PROPS = new Set(["id", "title", "lang", "dir"]);

const forceAttrRE = /^(spellcheck|draggable|form|list|type)$/;
const importantRE = /\s*!important$/;

/**
 * Drives dynamic reactive data synchronization to specific element elements via attribute properties.
 * normalizes complex class and layout style objects, maps explicit attribute fallbacks, and establishes
 * tracking side effects to synchronize raw properties instantly upon mutation updates.
 */
export const bind: Directive<Element> = ({ el, get, effect, arg, modifiers }) => {
  let prevValue: any;

  // Record static class in metadata instead of on element
  if (arg === "class") {
    const metadata = getElementMetadata(el);
    metadata.originalClass = el.className;
  }

  effect(() => {
    let value = get();
    if (arg) {
      if (modifiers?.camel) {
        arg = camelCase(arg);
      }
      setProp(el, arg, value, prevValue, modifiers?.camel);
    } else {
      for (const key in value) {
        setProp(el, key, value[key], prevValue?.[key]);
      }
      for (const key in prevValue) {
        if (!value || !(key in value)) {
          setProp(el, key, null);
        }
      }
    }
    prevValue = value;
  });
};

function handleClass(el: Element, value: any): void {
  const metadata = getElementMetadata(el);
  const originalClass = metadata.originalClass;
  const newClass = normalizeClass(originalClass ? [originalClass, value] : value) ?? "";
  el.removeAttribute("class");
  el.setAttribute("class", newClass);
}

function handleStyle(el: HTMLElement, value: any, prevValue?: any): void {
  const removeStyleAttribute = () => el.removeAttribute("style");
  const styleValue = normalizeStyle(value);

  if (!styleValue) {
    removeStyleAttribute();
  } else if (isString(styleValue) && styleValue !== prevValue) {
    removeStyleAttribute();
    el.style.cssText = styleValue;
  } else {
    removeStyleAttribute();

    if (isObject(styleValue)) {
      for (const key in styleValue) {
        setStyle(el.style, key, styleValue[key as keyof typeof styleValue]);
      }

      if (prevValue && isObject(prevValue)) {
        // ? Remove style again
        for (const key in prevValue) {
          // @ts-expect-error:  No index signature with a parameter of type 'string' was found on type 'object | NormalizedStyle'.
          if (styleValue[key] == null) {
            setStyle(el.style, key, "");
          }
        }
      }
    }
  }
}

function setElementAttribute(el: Element, key: string, value: any): void {
  if (key === "true-value") {
    (el as any)._trueValue = value;
  } else if (key === "false-value") {
    (el as any)._falseValue = value;
  } else {
    el.removeAttribute(key);
    if (value != null) {
      el.setAttribute(key, value);
    }
  }
}

function setElementProperty(el: Element, key: string, value: any): void {
  if (DOM_ATTR_PROPS.has(key)) {
    el.removeAttribute(key);
    if (value != null) {
      el.setAttribute(key, value);
    }
  } else {
    (el as any)[key] = value;
    if (key === "value") {
      (el as any)._value = value;
    }
  }
}

function setProp(el: Element & { _class?: string }, key: string, value: any, prevValue?: any, isCamel?: boolean): void {
  switch (key) {
    case "class":
      handleClass(el, value);
      break;
    case "style":
      handleStyle(el as HTMLElement, value, prevValue);
      break;
    default: {
      if (shouldSetProperty(el, key, isCamel)) {
        setElementProperty(el, key, value);
      } else {
        setElementAttribute(el, key, value);
      }
      break;
    }
  }
}

// Use modern CSS custom properties API
function setStyle(style: CSSStyleDeclaration, name: string, val: string | string[]): void {
  if (isArray(val)) {
    val.forEach((v) => setStyle(style, name, v));
  } else if (name.startsWith("--")) {
    style.setProperty(name, val);
  } else if (importantRE.test(val)) {
    // !important
    style.setProperty(kebabCase(name), val.replace(importantRE, ""), "important");
  } else {
    style[name as any] = val;
  }
}

function shouldSetProperty(el: Element, key: string, isCamel?: boolean): boolean {
  return (
    key !== "class" &&
    key !== "style" &&
    !(el instanceof SVGElement) &&
    (key in el || !!isCamel) &&
    !forceAttrRE.test(key)
  );
}
