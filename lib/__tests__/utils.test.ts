import { describe, it, expect, beforeEach, vi } from "bun:test";
import {
  checkAttr,
  getElementMetadata,
  listen,
  looseEqual,
  looseIndexOf,
  normalizeClass,
  normalizeProps,
  normalizeStyle,
  toDisplayString
} from "../src/utils";

describe("utils", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("div");
  });

  describe("checkAttr", () => {
    it("should return attribute value and remove it", () => {
      el.setAttribute("test-attr", "test-value");
      const value = checkAttr(el, "test-attr");

      expect(value).toBe("test-value");
      expect(el.hasAttribute("test-attr")).toBe(false);
    });

    it("should return null if attribute does not exist", () => {
      const value = checkAttr(el, "non-existent");
      expect(value).toBeNull();
    });

    it("should return null if attribute value is null", () => {
      el.setAttribute("test-attr", "null");
      const value = checkAttr(el, "test-attr");
      expect(value).toBe("null");
    });
  });

  describe("listen", () => {
    it("should add event listener to element", () => {
      const handler = vi.fn();
      listen(el, "click", handler);

      el.click();
      expect(handler).toHaveBeenCalled();
    });

    it("should pass options to addEventListener", () => {
      const handler = vi.fn();
      const options = { once: true };
      const spy = vi.spyOn(el, "addEventListener");

      listen(el, "click", handler, options);

      expect(spy).toHaveBeenCalledWith("click", handler, options);
    });
  });

  describe("getElementMetadata", () => {
    it("initializes separate metadata objects per element via WeakMap", () => {
      const el1 = document.createElement("div");
      const el2 = document.createElement("div");

      const meta1 = getElementMetadata(el1);
      const meta2 = getElementMetadata(el2);

      expect(meta1).toBeObject();
      expect(meta2).toBeObject();
      expect(meta1).not.toBe(meta2); // Must treat memory independently

      meta1.originalDisplay = "block";
      expect(getElementMetadata(el1).originalDisplay).toBe("block");
      expect(getElementMetadata(el2).originalDisplay).toBeUndefined();
    });
  });

  describe("normalizeClass", () => {
    it("handles plain string classes", () => {
      expect(normalizeClass("foo bar")).toBe("foo bar");
    });

    it("flattens arrays of strings and filter spacing", () => {
      expect(normalizeClass(["foo", "bar", "baz"])).toBe("foo bar baz");
      expect(normalizeClass(["foo", ["inner-class"]])).toBe("foo inner-class");
    });

    it("evaluates object keys mapped to truthy expressions", () => {
      const activeClasses = {
        "is-active": true,
        "is-disabled": false,
        "has-error": 1
      };
      // Expect only keys evaluating to truthy matching keys
      expect(normalizeClass(activeClasses)).toBe("is-active has-error");
    });

    it("handles complex mixed variants safely", () => {
      const complex = ["base-style", { "conditional-one": true, "conditional-two": false }, ["nested-item"]];
      expect(normalizeClass(complex)).toBe("base-style conditional-one nested-item");
    });
  });

  describe("normalizeStyle", () => {
    it("leaves plain style string or objects pristine", () => {
      const styleObj = { color: "red", display: "flex" };
      expect(normalizeStyle(styleObj)).toEqual(styleObj);
      expect(normalizeStyle("color: red;")).toBe("color: red;");
    });

    it("merges nested array objects sequentially", () => {
      const mix = [
        { color: "blue", margin: "10px" },
        { color: "red", padding: "5px" }
      ];
      expect(normalizeStyle(mix)).toEqual({
        color: "red", // overwritten sequentially
        margin: "10px",
        padding: "5px"
      });
    });
  });
  describe("normalizeStyle string parsing", () => {
    it("parses a style string inside an array into an object", () => {
      expect(normalizeStyle(["color: red; font-size: 12px"])).toEqual({
        color: "red",
        "font-size": "12px"
      });
    });

    it("strips comments and ignores empty or malformed declarations", () => {
      expect(normalizeStyle(["/* hidden */ color: blue;; display"])).toEqual({
        color: "blue"
      });
    });

    it("keeps delimiters inside parentheses intact", () => {
      expect(normalizeStyle(["background: url(a;b.png); color: red"])).toEqual({
        background: "url(a;b.png)",
        color: "red"
      });
    });

    it("merges string entries with object entries", () => {
      expect(normalizeStyle(["color: red", { margin: "1px" }, [{ padding: "2px" }]])).toEqual({
        color: "red",
        margin: "1px",
        padding: "2px"
      });
    });

    it("returns undefined for values that are neither string, array nor object", () => {
      expect(normalizeStyle(42)).toBeUndefined();
      expect(normalizeStyle(null)).toBeUndefined();
      expect(normalizeStyle(undefined)).toBeUndefined();
    });
  });

  describe("normalizeProps", () => {
    it("returns null when props are missing", () => {
      expect(normalizeProps(null)).toBeNull();
    });

    it("normalizes a non-string class value", () => {
      const props = { class: ["foo", { bar: true, baz: false }] };
      expect(normalizeProps(props)).toEqual({ class: "foo bar" });
    });

    it("leaves an existing class string untouched", () => {
      const props = { class: "foo bar" };
      expect(normalizeProps(props)!.class).toBe("foo bar");
    });

    it("normalizes a style value", () => {
      const props = { style: ["color: red", { margin: "1px" }] };
      expect(normalizeProps(props)).toEqual({ style: { color: "red", margin: "1px" } });
    });

    it("leaves props without class or style untouched", () => {
      const props = { id: "app" };
      expect(normalizeProps(props)).toBe(props);
      expect(props).toEqual({ id: "app" });
    });
  });

  describe("looseEqual", () => {
    it("treats identical references and primitives as equal", () => {
      const obj = { a: 1 };
      expect(looseEqual(obj, obj)).toBe(true);
      expect(looseEqual(1, 1)).toBe(true);
    });

    it("compares dates by time", () => {
      expect(looseEqual(new Date(0), new Date(0))).toBe(true);
      expect(looseEqual(new Date(0), new Date(1))).toBe(false);
      expect(looseEqual(new Date(0), 0)).toBe(false);
      expect(looseEqual(0, new Date(0))).toBe(false);
    });

    it("compares symbols by identity", () => {
      const sym = Symbol("a");
      expect(looseEqual(sym, sym)).toBe(true);
      expect(looseEqual(Symbol("a"), Symbol("a"))).toBe(false);
      expect(looseEqual(sym, "a")).toBe(false);
    });

    it("compares arrays element-wise", () => {
      expect(looseEqual([1, 2], [1, 2])).toBe(true);
      expect(looseEqual([1, 2], [1, 3])).toBe(false);
      expect(looseEqual([1, 2], [1])).toBe(false);
      expect(looseEqual([[1], [2]], [[1], [2]])).toBe(true);
      expect(looseEqual([1], "1")).toBe(false);
      expect(looseEqual("1", [1])).toBe(false);
    });

    it("compares objects by their own enumerable keys", () => {
      expect(looseEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(looseEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(looseEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(looseEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
      expect(looseEqual({ a: 1 }, "a")).toBe(false);
    });

    it("ignores inherited keys only when both sides agree", () => {
      const withProto = Object.create({ inherited: 1 });
      withProto.own = 2;
      expect(looseEqual(withProto, { own: 2 })).toBe(false);
    });

    it("falls back to string comparison for loose primitives", () => {
      expect(looseEqual(1, "1")).toBe(true);
      expect(looseEqual(null, undefined)).toBe(false);
      expect(looseEqual(true, "true")).toBe(true);
    });
  });

  describe("looseIndexOf", () => {
    it("finds a loosely equal item", () => {
      expect(looseIndexOf([{ a: 1 }, { a: 2 }], { a: 2 })).toBe(1);
      expect(looseIndexOf(["1", "2"], 2)).toBe(1);
    });

    it("returns -1 when nothing matches", () => {
      expect(looseIndexOf([{ a: 1 }], { a: 3 })).toBe(-1);
    });
  });

  describe("toDisplayString", () => {
    it("renders nullish values as an empty string", () => {
      expect(toDisplayString(null)).toBe("");
      expect(toDisplayString(undefined)).toBe("");
    });

    it("pretty prints objects and arrays", () => {
      expect(toDisplayString({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2));
      expect(toDisplayString([1, 2])).toBe(JSON.stringify([1, 2], null, 2));
    });

    it("falls back to [Object] for values that cannot be serialized", () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(toDisplayString(circular)).toBe("[Object]");
    });

    it("stringifies primitives", () => {
      expect(toDisplayString(0)).toBe("0");
      expect(toDisplayString(false)).toBe("false");
      expect(toDisplayString("text")).toBe("text");
    });
  });
});
