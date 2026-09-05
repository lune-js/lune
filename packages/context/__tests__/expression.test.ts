import { beforeEach, describe, expect, it, vi } from "bun:test";
import { allowGlobals, evaluate, execute } from "../src/eval";

const isDev = import.meta.env.DEV;

/** Silences the expected development warning while a rejected expression is exercised. */
function silenceWarnings() {
  return vi.spyOn(console, "warn").mockImplementation(() => {});
}

function silenceErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("literals", () => {
  const scope = {};

  it("evaluates numbers in every supported notation", () => {
    expect(evaluate(scope, "42")).toBe(42);
    expect(evaluate(scope, "3.5")).toBe(3.5);
    expect(evaluate(scope, ".25")).toBe(0.25);
    expect(evaluate(scope, "1e3")).toBe(1000);
    expect(evaluate(scope, "1.5e-2")).toBe(0.015);
    expect(evaluate(scope, "0xff")).toBe(255);
    expect(evaluate(scope, "0b101")).toBe(5);
  });

  it("decodes string escapes", () => {
    expect(evaluate(scope, '"a\\nb"')).toBe("a\nb");
    expect(evaluate(scope, "'it\\'s'")).toBe("it's");
    expect(evaluate(scope, '"\\u0041\\u{1F600}\\x41"')).toBe("A\u{1F600}A");
    expect(evaluate(scope, '"tab\\there"')).toBe("tab\there");
  });

  it("evaluates keyword literals", () => {
    expect(evaluate(scope, "true")).toBe(true);
    expect(evaluate(scope, "false")).toBe(false);
    expect(evaluate(scope, "null")).toBeNull();
    expect(evaluate(scope, "undefined")).toBeUndefined();
  });

  it("ignores comments", () => {
    expect(evaluate(scope, "1 /* two */ + 2")).toBe(3);
    expect(execute(scope, "return 1 + 2 // three")).toBe(3);
  });
});

describe("template literals", () => {
  let scope: any;

  beforeEach(() => {
    scope = { name: "Lune", count: 2, user: { first: "Ada" } };
  });

  it("interpolates expressions", () => {
    expect(evaluate(scope, "`hi ${name}`")).toBe("hi Lune");
    expect(evaluate(scope, "`${count + 1} items`")).toBe("3 items");
    expect(evaluate(scope, "`${user.first} is ${count > 1 ? 'plural' : 'single'}`")).toBe("Ada is plural");
  });

  it("supports nested templates and braces", () => {
    expect(evaluate(scope, "`a${`b${count}`}c`")).toBe("ab2c");
    expect(evaluate(scope, "`${ { a: name }.a }`")).toBe("Lune");
  });
});

describe("arrays and objects", () => {
  let scope: any;

  beforeEach(() => {
    scope = { items: [1, 2], key: "id", extra: { b: 2 }, count: 3 };
  });

  it("builds arrays, including spreads and holes", () => {
    expect(evaluate(scope, "[1, 2, 3]")).toEqual([1, 2, 3]);
    expect(evaluate(scope, "[...items, 3]")).toEqual([1, 2, 3]);
    expect(evaluate(scope, "[1, , 3]")).toHaveLength(3);
    expect(evaluate(scope, "[]")).toEqual([]);
  });

  it("builds objects from every property form", () => {
    expect(evaluate(scope, "{ a: 1 }")).toEqual({ a: 1 });
    expect(evaluate(scope, "{ count }")).toEqual({ count: 3 });
    expect(evaluate(scope, "{ [key]: 1 }")).toEqual({ id: 1 });
    expect(evaluate(scope, "{ 'quoted': 1, 2: 'two' }")).toEqual({ quoted: 1, "2": "two" });
    expect(evaluate(scope, "{ a: 1, ...extra }")).toEqual({ a: 1, b: 2 });
  });
});

describe("operators", () => {
  let scope: any;

  beforeEach(() => {
    scope = { count: 8, name: "lune", list: [1, 2], date: new Date(0), nothing: null };
  });

  it("applies arithmetic and bitwise operators with the right precedence", () => {
    expect(evaluate(scope, "1 + 2 * 3")).toBe(7);
    expect(evaluate(scope, "(1 + 2) * 3")).toBe(9);
    expect(evaluate(scope, "2 ** 3 ** 2")).toBe(512);
    expect(evaluate(scope, "count % 3")).toBe(2);
    expect(evaluate(scope, "count / 2 - 1")).toBe(3);
    expect(evaluate(scope, "count & 3")).toBe(0);
    expect(evaluate(scope, "count | 1")).toBe(9);
    expect(evaluate(scope, "count ^ 1")).toBe(9);
    expect(evaluate(scope, "count << 1")).toBe(16);
    expect(evaluate(scope, "count >> 2")).toBe(2);
    expect(evaluate(scope, "-1 >>> 28")).toBe(15);
  });

  it("applies comparison and membership operators", () => {
    expect(evaluate(scope, "count >= 8 && count <= 8")).toBe(true);
    expect(evaluate(scope, "'1' == 1")).toBe(true);
    expect(evaluate(scope, "'1' === 1")).toBe(false);
    expect(evaluate(scope, "'1' != 1")).toBe(false);
    expect(evaluate(scope, "'1' !== 1")).toBe(true);
    expect(evaluate(scope, "'count' in { count: 1 }")).toBe(true);
    expect(evaluate(scope, "date instanceof Date")).toBe(true);
  });

  it("short circuits logical operators", () => {
    expect(evaluate(scope, "nothing ?? 'fallback'")).toBe("fallback");
    expect(evaluate(scope, "0 ?? 'fallback'")).toBe(0);
    expect(evaluate(scope, "nothing && nothing.missing")).toBeNull();
    expect(evaluate(scope, "count || nothing.missing")).toBe(8);
  });

  it("applies unary operators", () => {
    expect(evaluate(scope, "-count")).toBe(-8);
    expect(evaluate(scope, "+'2'")).toBe(2);
    expect(evaluate(scope, "~count")).toBe(-9);
    expect(evaluate(scope, "!name")).toBe(false);
    expect(evaluate(scope, "void count")).toBeUndefined();
  });

  it("reports typeof for undeclared names without throwing", () => {
    expect(evaluate(scope, "typeof neverDeclared")).toBe("undefined");
    expect(evaluate(scope, "typeof count")).toBe("number");
  });

  it("increments and decrements identifiers and members", () => {
    expect(evaluate(scope, "count++")).toBe(8);
    expect(scope.count).toBe(9);
    expect(evaluate(scope, "++count")).toBe(10);
    expect(evaluate(scope, "list[0]--")).toBe(1);
    expect(scope.list[0]).toBe(0);
  });

  it("assigns with plain, compound and logical operators", () => {
    expect(evaluate(scope, "count = 1")).toBe(1);
    expect(evaluate(scope, "count += 4")).toBe(5);
    expect(evaluate(scope, "count *= 2")).toBe(10);
    expect(evaluate(scope, "count -= 1")).toBe(9);
    expect(evaluate(scope, "count /= 3")).toBe(3);
    expect(evaluate(scope, "count %= 2")).toBe(1);
    expect(evaluate(scope, "nothing ??= 'set'")).toBe("set");
    expect(evaluate(scope, "name ||= 'other'")).toBe("lune");
    expect(evaluate(scope, "name &&= 'other'")).toBe("other");
    expect(evaluate(scope, "list[1] = 9")).toBe(9);
    expect(scope.list[1]).toBe(9);
  });
});

describe("optional chaining", () => {
  let scope: any;

  beforeEach(() => {
    scope = { user: { profile: { name: "Ada" }, greet: () => "hi" }, missing: null };
  });

  it("reads through present links", () => {
    expect(evaluate(scope, "user?.profile?.name")).toBe("Ada");
    expect(evaluate(scope, "user?.['profile'].name")).toBe("Ada");
    expect(evaluate(scope, "user.greet?.()")).toBe("hi");
  });

  it("short circuits the rest of the chain", () => {
    expect(evaluate(scope, "missing?.profile.name")).toBeUndefined();
    expect(evaluate(scope, "missing?.[0].name")).toBeUndefined();
    expect(evaluate(scope, "missing?.greet().length")).toBeUndefined();
    expect(evaluate(scope, "user.absent?.()")).toBeUndefined();
  });

  it("still throws when a nullish link is not marked optional", () => {
    const errorSpy = silenceErrors();
    expect(evaluate(scope, "missing.profile")).toBeUndefined();
    if (isDev) expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("calls", () => {
  let scope: any;

  beforeEach(() => {
    scope = {
      label: "scope",
      who() {
        return this.label;
      },
      nested: {
        label: "nested",
        who() {
          return this.label;
        }
      },
      sum: (...values: number[]) => values.reduce((total, value) => total + value, 0),
      numbers: [1, 2, 3]
    };
  });

  it("calls scope methods with the scope as receiver", () => {
    expect(evaluate(scope, "who()")).toBe("scope");
  });

  it("calls member methods with their object as receiver", () => {
    expect(evaluate(scope, "nested.who()")).toBe("nested");
    expect(evaluate(scope, "nested['who']()")).toBe("nested");
  });

  it("spreads call arguments", () => {
    expect(evaluate(scope, "sum(...numbers, 4)")).toBe(10);
  });

  it("constructs with new", () => {
    expect(evaluate(scope, "new Date(0).getTime()")).toBe(0);
    expect(evaluate(scope, "new Error('boom').message")).toBe("boom");
  });

  it("reports a helpful message when the callee is not callable", () => {
    const errorSpy = silenceErrors();
    expect(evaluate(scope, "label()")).toBeUndefined();
    if (isDev) {
      expect(errorSpy).toHaveBeenCalledWith(
        `[Lune] ERROR - Failed to execute expression "return(label())":`,
        expect.objectContaining({ message: "label is not a function" })
      );
    }
    errorSpy.mockRestore();
  });
});

describe("arrow functions", () => {
  let scope: any;

  beforeEach(() => {
    scope = { count: 1, val: "from scope", multiplier: 3 };
  });

  it("compiles expression bodies", () => {
    const double = evaluate(scope, "(n) => n * multiplier") as (n: number) => number;
    expect(double(2)).toBe(6);
    expect(evaluate(scope, "(n => n + 1)(1)")).toBe(2);
    expect(evaluate(scope, "(() => 7)()")).toBe(7);
  });

  it("compiles block bodies with an explicit return", () => {
    const fn = evaluate(scope, "(a, b) => { const total = a + b; return total * 2 }") as (
      a: number,
      b: number
    ) => number;
    expect(fn(1, 2)).toBe(6);
    expect(evaluate(scope, "(() => { })()")).toBeUndefined();
  });

  it("writes to the scope from a handler body", () => {
    const assign = evaluate(scope, "(value) => { count = value }") as (value: number) => void;
    assign(42);
    expect(scope.count).toBe(42);
  });

  it("shadows scope properties with parameters", () => {
    expect(evaluate(scope, "((val) => val)('from param')")).toBe("from param");
    expect(evaluate(scope, "val")).toBe("from scope");
  });

  it("closes over the defining scope", () => {
    const add = evaluate(scope, "(a) => (b) => a + b") as (a: number) => (b: number) => number;
    expect(add(2)(3)).toBe(5);
  });
});

describe("statements", () => {
  let scope: any;
  let el: Element;

  beforeEach(() => {
    el = document.createElement("div");
    scope = { count: 2, done: false };
  });

  it("runs several statements and returns the returned value", () => {
    expect(execute(scope, "count = 5; return count * 2")).toBe(10);
    expect(execute(scope, "count = 1;;")).toBeUndefined();
  });

  it("treats a line break as a statement terminator", () => {
    expect(execute(scope, "count = 3\nreturn count")).toBe(3);
  });

  it("branches with if and else", () => {
    expect(execute(scope, "if (count > 1) { return 'many' } else { return 'few' }")).toBe("many");
    expect(execute(scope, "if (done) return 'yes'")).toBeUndefined();
    expect(execute(scope, "if (done) { return 'yes' } else if (count) { return 'no' }")).toBe("no");
  });

  it("declares locals that shadow the scope", () => {
    expect(execute(scope, "let count = 10; return count")).toBe(10);
    expect(scope.count).toBe(2);
    expect(execute(scope, "const a = 1, b = 2; return a + b")).toBe(3);
    expect(execute(scope, "var later; return later")).toBeUndefined();
  });

  it("exposes the bound element and the scope itself", () => {
    expect(evaluate(scope, "$el.tagName", el)).toBe("DIV");
    expect(evaluate(scope, "$data.count", el)).toBe(2);
    expect(evaluate(scope, "this.count", el)).toBe(2);
    expect(execute(scope, "$el.id = 'set'; return $el.id", el)).toBe("set");
  });

  it("returns undefined from a bare return", () => {
    expect(execute(scope, "return")).toBeUndefined();
  });
});

describe("globals", () => {
  const scope = { list: [3, 1, 2] };

  it("resolves allowed built-ins", () => {
    expect(evaluate(scope, "Math.max(...list)")).toBe(3);
    expect(evaluate(scope, "JSON.stringify(list)")).toBe("[3,1,2]");
    expect(evaluate(scope, "Number('2') + parseInt('3')")).toBe(5);
    expect(evaluate(scope, "Object.keys({ a: 1 })")).toEqual(["a"]);
  });

  it("resolves bindings registered through allowGlobals", () => {
    allowGlobals({ formatMoney: (value: number) => `$${value.toFixed(2)}` });
    expect(evaluate(scope, "formatMoney(2)")).toBe("$2.00");
  });

  it("refuses to register a blocked name", () => {
    expect(() => allowGlobals({ fetch: () => undefined })).toThrow('"fetch" cannot be exposed to expressions.');
  });

  it("throws a reference error for anything else", () => {
    const errorSpy = silenceErrors();
    expect(evaluate(scope, "somethingUnregistered")).toBeUndefined();
    if (isDev) {
      expect(errorSpy).toHaveBeenCalledWith(
        `[Lune] ERROR - Failed to execute expression "return(somethingUnregistered)":`,
        expect.objectContaining({ message: "somethingUnregistered is not defined" })
      );
    }
    errorSpy.mockRestore();
  });
});

describe("safety", () => {
  let scope: any;

  beforeEach(() => {
    scope = { user: { name: "Ada" }, key: "constructor" };
  });

  it("rejects identifiers that lead back to dynamic code or the host", () => {
    const warnSpy = silenceWarnings();
    expect(execute(scope, "Function('return 1')()")).toBeUndefined();
    expect(execute(scope, "eval('1 + 1')")).toBeUndefined();
    expect(execute(scope, "window.location.href")).toBeUndefined();
    expect(execute(scope, "document.body")).toBeUndefined();
    expect(execute(scope, "fetch('/secrets')")).toBeUndefined();
    expect(execute(scope, "globalThis.process")).toBeUndefined();
    expect(execute(scope, "setTimeout(handler, 0)")).toBeUndefined();
    if (isDev) expect(warnSpy).toHaveBeenCalledTimes(7);
    warnSpy.mockRestore();
  });

  it("rejects the prototype escape hatches", () => {
    const warnSpy = silenceWarnings();
    expect(execute(scope, "user.constructor")).toBeUndefined();
    expect(execute(scope, "user.__proto__")).toBeUndefined();
    expect(execute(scope, "user.toString.constructor('return 1')")).toBeUndefined();
    expect(execute(scope, "({ __proto__: user })")).toBeUndefined();
    if (isDev) expect(warnSpy).toHaveBeenCalledTimes(4);
    warnSpy.mockRestore();
  });

  it("rejects prototype access resolved at runtime", () => {
    const errorSpy = silenceErrors();
    expect(execute(scope, "user[key]")).toBeUndefined();
    expect(execute(scope, "user[key] = 1")).toBeUndefined();
    if (isDev) expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });

  it("rejects the delete operator", () => {
    const warnSpy = silenceWarnings();
    expect(execute(scope, "delete user.name")).toBeUndefined();
    expect(scope.user.name).toBe("Ada");
    if (isDev) expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("rejects unsupported syntax as an invalid expression", () => {
    const errorSpy = silenceErrors();
    expect(execute(scope, "while (true) { user.name }")).toBeUndefined();
    expect(execute(scope, "function make() { return 1 }")).toBeUndefined();
    expect(execute(scope, "class Thing {}")).toBeUndefined();
    expect(execute(scope, "await user")).toBeUndefined();
    expect(execute(scope, "`unterminated")).toBeUndefined();
    expect(execute(scope, "'unterminated")).toBeUndefined();
    expect(execute(scope, "user #name")).toBeUndefined();
    expect(execute(scope, "1 = 2")).toBeUndefined();
    expect(execute(scope, "user.name++ ++")).toBeUndefined();
    if (isDev) expect(errorSpy).toHaveBeenCalledTimes(9);
    errorSpy.mockRestore();
  });
});
