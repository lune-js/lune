// oxlint-disable
import { describe, it, expect, beforeEach, vi } from "bun:test";
import { createContext, nextTick } from "@lune-js/context";
import { walk } from "../src/directives";
import { _if } from "../src/directives/if";

const isDev = import.meta.env.DEV;

describe("walk", () => {
  let container: HTMLElement;
  let ctx: any;

  beforeEach(() => {
    container = document.createElement("div");
    ctx = createContext();
    ctx.scope.$refs = Object.create(null);
    ctx.scope.$s = (value: any) => (value == null ? "" : String(value));
  });

  it("should walk through DOM elements", () => {
    container.innerHTML = '<div lu-scope><span>{{ message }}</span><button @click="handleClick">Click</button></div>';

    ctx.scope.message = "Hello";
    ctx.scope.handleClick = vi.fn();
    walk(container, ctx);

    expect(container.innerHTML).toContain("Hello");
  });

  it("should skip elements with lu-pre", () => {
    container.innerHTML = "<div lu-pre><span>{{ message }}</span></div><div lu-scope><span>{{ message }}</span></div>";

    ctx.scope.message = "Hello";
    walk(container, ctx);

    const divs = container.querySelectorAll("div");
    // First div should not be processed (still has {{ message }})
    expect(divs[0].innerHTML).toContain("{{ message }}");
    // Second div should be processed
    expect(divs[1].innerHTML).toContain("Hello");
  });

  it("should handle lu-scope directive", () => {
    container.innerHTML = '<div lu-scope="{ localCount: 0 }"><span>{{ localCount }}</span></div>';

    walk(container, ctx);

    expect(container.innerHTML).toContain("0");
  });

  it("should handle lu-if directive", () => {
    // Test with show = true
    const container1 = document.createElement("div");
    container1.innerHTML = '<div lu-if="show">Visible</div>';
    ctx.scope.show = true;
    walk(container1, ctx);
    expect(container1.innerHTML).toContain("Visible");

    // Test with show = false
    const container2 = document.createElement("div");
    container2.innerHTML = '<div lu-if="show">Visible</div>';
    ctx.scope.show = false;
    walk(container2, ctx);
    expect(container2.innerHTML).not.toContain("Visible");
  });

  it("should handle lu-if with lu-else", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div lu-if="show">True</div><div lu-else>False</div>';
    ctx.scope.show = false;
    walk(container, ctx);
    expect(container.innerHTML).toContain("False");
    expect(container.innerHTML).not.toContain("True");
  });

  it("should handle lu-if with lu-else-if", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div lu-if="a">A</div><div lu-else-if="b">B</div><div lu-else>C</div>';
    ctx.scope.a = false;
    ctx.scope.b = true;
    walk(container, ctx);
    expect(container.innerHTML).toContain("B");
    expect(container.innerHTML).not.toContain("A");
    expect(container.innerHTML).not.toContain("C");
  });

  it.skipIf(!isDev)("should warn for empty lu-if in DEV", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const originalDEV = (globalThis as any).import?.meta?.env?.DEV;
    (globalThis as any).import = { meta: { env: { DEV: true } } };

    const container = document.createElement("div");
    container.innerHTML = '<div lu-if=" ">Empty</div>';
    walk(container, ctx);

    expect(warnSpy).toHaveBeenCalledWith("[Lune] WARN - lu-if expression cannot be empty");

    warnSpy.mockRestore();
    if (originalDEV !== undefined) {
      (globalThis as any).import.meta.env.DEV = originalDEV;
    } else {
      delete (globalThis as any).import;
    }
  });

  it("should handle lu-if on element with no parent", () => {
    const el = document.createElement("div");
    el.setAttribute("lu-if", "true");

    // _if should return early if no parent
    const result = _if(el, "true", ctx);
    expect(result).toBeUndefined();
  });

  it("should handle lu-for directive", () => {
    container.innerHTML = '<ul><li lu-for="item in items">{{ item }}</li></ul>';

    ctx.scope.items = ["Item 1", "Item 2"];
    walk(container, ctx);

    const items = container.querySelectorAll("li");
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toBe("Item 1");
    expect(items[1]?.textContent).toBe("Item 2");
  });

  it("should handle lu-for with number", () => {
    container.innerHTML = '<ul><li lu-for="i in count">{{ i }}</li></ul>';

    ctx.scope.count = 3;
    walk(container, ctx);

    const items = container.querySelectorAll("li");
    expect(items.length).toBe(3);
    expect(items[0]?.textContent).toBe("1");
    expect(items[1]?.textContent).toBe("2");
    expect(items[2]?.textContent).toBe("3");
  });

  it("should handle lu-for with object", () => {
    container.innerHTML = '<ul><li lu-for="value, key in obj">{{ key }}: {{ value }}</li></ul>';

    ctx.scope.obj = { a: 1, b: 2 };
    walk(container, ctx);

    const items = container.querySelectorAll("li");
    expect(items.length).toBe(2);
    // Order may vary, but check content
    const texts = Array.from(items).map((li) => li.textContent);
    expect(texts).toContain("a: 1");
    expect(texts).toContain("b: 2");
  });

  it("should handle lu-for with index", () => {
    container.innerHTML = '<ul><li lu-for="item, index in items">{{ index }}: {{ item }}</li></ul>';

    ctx.scope.items = ["A", "B"];
    walk(container, ctx);

    const items = container.querySelectorAll("li");
    expect(items[0]?.textContent).toBe("0: A");
    expect(items[1]?.textContent).toBe("1: B");
  });

  it("should handle lu-for with key", () => {
    container.innerHTML = '<ul><li lu-for="item in items" :key="item.id">{{ item.name }}</li></ul>';

    ctx.scope.items = [
      { id: 1, name: "First" },
      { id: 2, name: "Second" }
    ];
    walk(container, ctx);

    const items = container.querySelectorAll("li");
    expect(items[0]?.textContent).toBe("First");
    expect(items[1]?.textContent).toBe("Second");
  });

  it("should handle lu-for with destructure", () => {
    container.innerHTML = '<ul><li lu-for="{name, age} in people">{{ name }} ({{ age }})</li></ul>';

    ctx.scope.people = [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 }
    ];
    walk(container, ctx);

    const items = container.querySelectorAll("li");
    expect(items[0]?.textContent).toBe("John (30)");
    expect(items[1]?.textContent).toBe("Jane (25)");
  });

  it.skipIf(!isDev)("should warn for invalid lu-for in DEV", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const originalDEV = (globalThis as any).import?.meta?.env?.DEV;
    (globalThis as any).import = { meta: { env: { DEV: true } } };

    container.innerHTML = '<ul><li lu-for="invalid">item</li></ul>';
    walk(container, ctx);

    expect(warnSpy).toHaveBeenCalledWith('[Lune] WARN - invalid lu-for expression: "invalid"');

    warnSpy.mockRestore();
    if (originalDEV !== undefined) {
      (globalThis as any).import.meta.env.DEV = originalDEV;
    } else {
      delete (globalThis as any).import;
    }
  });

  it("should handle lu-for updates and moves", async () => {
    container.innerHTML = '<ul><li lu-for="item in items" :key="item">{{ item }}</li></ul>';

    ctx.scope.items = ["A", "B", "C"];
    walk(container, ctx);

    let items = container.querySelectorAll("li");
    expect(items.length).toBe(3);
    expect(Array.from(items).map((li) => li.textContent)).toEqual(["A", "B", "C"]);

    // Update to trigger move and reordering
    ctx.scope.items = ["C", "A", "B"];
    await nextTick();

    items = container.querySelectorAll("li");
    expect(items.length).toBe(3);
    expect(Array.from(items).map((li) => li.textContent)).toEqual(["C", "A", "B"]);
  });

  it("should handle attribute interpolation", () => {
    container.innerHTML = '<div :id="dynamicId" :class="dynamicClass">Content</div>';

    ctx.scope.dynamicId = "test-id";
    ctx.scope.dynamicClass = "test-class";
    walk(container, ctx);

    const div = container.querySelector("div");
    expect(div?.getAttribute("id")).toBe("test-id");
    expect(div?.getAttribute("class")).toBe("test-class");
  });

  it("should handle text interpolation", () => {
    container.innerHTML = "<div>{{ message }}</div>";

    ctx.scope.message = "Hello World";
    walk(container, ctx);

    const div = container.querySelector("div");
    expect(div?.textContent).toBe("Hello World");
  });

  it("should handle event handlers", () => {
    container.innerHTML = '<button @click="handleClick">Click</button>';

    const handleClick = vi.fn();
    ctx.scope.handleClick = handleClick;
    walk(container, ctx);

    const button = container.querySelector("button");
    button?.click();

    expect(handleClick).toHaveBeenCalled();
  });

  it("should handle nested directives", () => {
    container.innerHTML =
      '<div lu-scope="{ localData: { count: 0 } }"><div lu-if="show"><span>{{ localData.count }}</span></div></div>';

    ctx.scope.show = true;
    walk(container, ctx);

    expect(container.innerHTML).toContain("0");
  });

  it("should handle multiple directives on same element", () => {
    container.innerHTML = '<div lu-show="isVisible" :class="dynamicClass">Content</div>';

    ctx.scope.isVisible = true;
    ctx.scope.dynamicClass = "active";
    walk(container, ctx);

    const div = container.querySelector("div");
    expect(div?.style.display).not.toBe("none");
    expect(div?.getAttribute("class")).toBe("active");
  });

  it("should handle custom delimiters", () => {
    container.innerHTML = "<div>${ message }</div>";

    ctx.scope.message = "Hello";
    ctx.delimiters = ["${", "}"];
    ctx.delimitersRE = /\$\{([^]+?)\}/g;

    walk(container, ctx);

    const div = container.querySelector("div");
    expect(div?.textContent).toBe("Hello");
  });

  it.skipIf(!isDev)("should handle unknown custom directive in DEV", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalDEV = (globalThis as any).import?.meta?.env?.DEV;
    (globalThis as any).import = { meta: { env: { DEV: true } } };

    container.innerHTML = '<div lu-unknown="value"></div>';
    walk(container, ctx);

    expect(errorSpy).toHaveBeenCalledWith('[Lune] ERROR - unknown custom directive: "lu-unknown"');

    errorSpy.mockRestore();
    if (originalDEV !== undefined) {
      (globalThis as any).import.meta.env.DEV = originalDEV;
    } else {
      delete (globalThis as any).import;
    }
  });

  it("should handle lu-scope with $template selector", () => {
    // Create a template element
    const template = document.createElement("template");
    template.id = "my-template";
    template.innerHTML = "<span>Template content</span>";
    document.body.appendChild(template);

    container.innerHTML = "<div lu-scope=\"{ $template: '#my-template' }\"></div>";
    walk(container, ctx);

    const div = container.querySelector("div");
    expect(div?.innerHTML).toContain("Template content");

    document.body.removeChild(template);
  });

  it("should handle lu-scope with $template string", () => {
    container.innerHTML = "<div lu-scope=\"{ $template: '<span>String template</span>' }\"></div>";
    walk(container, ctx);

    const div = container.querySelector("div");
    expect(div?.innerHTML).toContain("String template");
  });

  it("should handle lu-once directive", async () => {
    container.innerHTML = "<div lu-once><span>{{ message }}</span></div>";

    ctx.scope.message = "Initial value";
    walk(container, ctx);

    // Wait for the initial effect to run
    await nextTick();

    // lu-once should interpolate once with current data
    const span = container.querySelector("span");
    expect(span?.textContent).toBe("Initial value");

    // The lu-once attribute should be removed after processing
    const div = container.querySelector("div");
    expect(div?.hasAttribute("lu-once")).toBe(false);

    // Even after changing the scope data and triggering reactivity, lu-once content should not update
    ctx.scope.message = "Updated value";
    await nextTick();
    // Since the lu-once element has been processed and is not reactive,
    // the span should still contain the initial value
    expect(span?.textContent).toBe("Initial value");
  });

  it("should register ref in both parent and scoped context when used with lu-scope", () => {
    container.innerHTML =
      '<div lu-scope="{ data: 42 }" ref="scopedRef"><span id="inner">{{ $refs.scopedRef.tagName }}</span></div>';

    ctx.scope.$refs = {};
    walk(container, ctx);

    // The ref should be registered in parent scope
    const div = container.querySelector("div");
    expect(ctx.scope.$refs.scopedRef).toBe(div);

    // The ref should also be available in the scoped context (verified via interpolation)
    const span = container.querySelector("#inner");
    expect(span?.textContent).toBe("DIV");
  });

  it("should keep walking when a lu-scope expression fails", () => {
    container.innerHTML = '<div lu-scope="Missing()"><span>{{ message }}</span></div>';

    ctx.scope.message = "Hello";

    expect(() => walk(container, ctx)).not.toThrow();
    expect(container.innerHTML).toContain("Hello");
  });

  it("should handle lu-scope with empty expression", () => {
    container.innerHTML = '<div lu-scope=""><span>{{ $root.tagName }}</span></div>';

    walk(container, ctx);

    const span = container.querySelector("span");
    expect(span?.textContent).toBe("DIV");
  });

  it("should handle directive cleanup functions", () => {
    // Create a mock directive that returns a cleanup function
    const mockDirective = vi.fn(() => {
      return () => {}; // cleanup function
    });

    ctx.dirs = { "test-dir": mockDirective };

    container.innerHTML = '<div lu-test-dir="value"></div>';

    walk(container, ctx);

    expect(mockDirective).toHaveBeenCalled();
  });

  it.skipIf(!isDev)("should handle :ref shorthand", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    container.innerHTML = '<div :ref="myRef"></div>';

    ctx.scope.$refs = {};
    walk(container, ctx);

    // :ref should be handled as ref directive and correctly register in the scope
    const div = container.querySelector("div");
    expect(div).toBeDefined();
    expect(ctx.scope.$refs.myRef).toBe(div);
    expect(consoleSpy).toHaveBeenCalledWith(
      `[Lune] ERROR - Failed to execute expression "return(myRef)":`,
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("should process DocumentFragment nodes", () => {
    const fragment = document.createDocumentFragment();
    const div = document.createElement("div");
    div.textContent = "{{ message }}";
    fragment.appendChild(div);

    ctx.scope.message = "Fragment content";
    walk(fragment, ctx);

    expect(div.textContent).toBe("Fragment content");
  });

  it.skipIf(!isDev)("should warn for invalid template selector in DEV", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalDEV = (globalThis as any).import?.meta?.env?.DEV;
    (globalThis as any).import = { meta: { env: { DEV: true } } };

    container.innerHTML = "<div lu-scope=\"{ $template: '#nonexistent' }\"></div>";
    walk(container, ctx);

    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    if (originalDEV !== undefined) {
      (globalThis as any).import.meta.env.DEV = originalDEV;
    } else {
      delete (globalThis as any).import;
    }
  });
});
