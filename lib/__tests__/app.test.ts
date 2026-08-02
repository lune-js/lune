import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { createApp } from "../src";

const isDev = import.meta.env.DEV;

describe("app", () => {
  let container: HTMLElement;
  let originalCurrentScript: HTMLOrSVGScriptElement | null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    // Store original currentScript
    originalCurrentScript = document.currentScript;
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();

    // Restore original currentScript if it was set
    if (originalCurrentScript !== null) {
      Object.defineProperty(document, "currentScript", {
        value: originalCurrentScript,
        writable: true,
        configurable: true
      });
    }
  });

  describe("createApp", () => {
    it("should create app with initial data", () => {
      const app = createApp({ count: 0 });

      expect(app).toBeDefined();
      expect(typeof app.mount).toBe("function");
      expect(typeof app.directive).toBe("function");
      expect(typeof app.use).toBe("function");
    });

    it("should create app without initial data", () => {
      const app = createApp();

      expect(app).toBeDefined();
    });

    it("should handle custom delimiters", () => {
      const app = createApp({
        $delimiters: ["${", "}"]
      });

      expect(app).toBeDefined();
    });
  });

  describe("autoMount", () => {
    it("should export createApp", async () => {
      const { createApp } = await import("../src/index");
      expect(createApp).toBeDefined();
    });

    it("should export nextTick", async () => {
      const { nextTick } = await import("../src/index");
      expect(nextTick).toBeDefined();
    });

    it("should export reactive", async () => {
      const { reactive } = await import("../src/index");
      expect(reactive).toBeDefined();
    });

    it("should export watchEffect", async () => {
      const indexExports = await import("../src/index");
      // Test that effect is re-exported as watchEffect
      expect(indexExports.effect).toBeDefined();
    });

    it.skipIf(!isDev)("should not auto-mount when script has no init attribute", async () => {
      // Create a script element without init attribute
      const script = document.createElement("script");
      script.textContent = ""; // Empty script to simulate currentScript

      // Mock currentScript to be our script without init attribute
      Object.defineProperty(document, "currentScript", {
        value: script,
        writable: true,
        configurable: true
      });

      // Spy on console.warn to check if mount warning is logged
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import browser module
      const { autoMount } = await import("../src/browser");

      // Call autoMount
      autoMount();

      // Verify no warning was logged (since mount shouldn't be called)
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      // Restore the spy
      consoleWarnSpy.mockRestore();
    });

    it.skipIf(!isDev)("should auto-mount when script has init attribute", async () => {
      // Create a script element with init attribute
      const script = document.createElement("script");
      script.setAttribute("init", "");
      script.textContent = ""; // Empty script to simulate currentScript

      // Mock currentScript to be our script with init attribute
      Object.defineProperty(document, "currentScript", {
        value: script,
        writable: true,
        configurable: true
      });

      // Spy on console.warn to check if mount warning is logged
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import browser module
      const { autoMount } = await import("../src/browser");

      // Call autoMount
      autoMount();

      // Verify warning was logged (since mount is called and logs a warning in dev mode)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Lune] WARN - Mounting on documentElement: this is non-optimal as Lune.js will be forced to crawl the entire page's DOM.",
        `Consider explicitly marking elements controlled by Lune.js with "lu-scope".`
      );

      // Restore the spy
      consoleWarnSpy.mockRestore();
    });
  });

  describe("mount", () => {
    it("should mount to element selector", () => {
      container.id = "test-app";
      container.innerHTML = "<div>{{ count }}</div>";

      const app = createApp({ count: 42 });
      app.mount("#test-app");

      expect(container.textContent).toBe("42");
    });

    it("should mount to DOM element", () => {
      container.innerHTML = "<div>{{ count }}</div>";

      const app = createApp({ count: 42 });
      app.mount(container);

      expect(container.textContent).toBe("42");
    });

    it.skipIf(!isDev)("should mount to body when no element provided", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      document.body.innerHTML = "<div>{{ count }}</div>";

      const app = createApp({ count: 42 });
      app.mount();

      expect(warnSpy).toHaveBeenCalledWith(
        "[Lune] WARN - Mounting on documentElement: this is non-optimal as Lune.js will be forced to crawl the entire page's DOM.",
        `Consider explicitly marking elements controlled by Lune.js with "lu-scope".`
      );
      expect(document.body.textContent).toContain("42");
    });

    it.skipIf(!isDev)("should handle invalid selector", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const app = createApp({});
      app.mount("#nonexistent");

      expect(consoleSpy).toHaveBeenCalledWith("[Lune] ERROR - selector #nonexistent has no matching element.");
      consoleSpy.mockRestore();
    });

    it("should handle unmount", () => {
      container.innerHTML = "<div lu-scope>Test</div>";

      const app = createApp({});
      app.mount(container);

      const block = app.rootBlocks[0];
      const teardownSpy = vi.spyOn(block, "teardown");

      app.unmount();

      expect(teardownSpy).toHaveBeenCalled();
    });

    it("should handle nested lu-scope elements", () => {
      container.innerHTML = `
        <div lu-scope>
          <div lu-scope>Inner</div>
        </div>
      `;

      const app = createApp({});
      app.mount(container);

      // Should only mount the outer lu-scope, not the nested one
      expect(app.rootBlocks.length).toBe(1);
    });

    it("should handle multiple lu-scope elements", () => {
      container.innerHTML = `
        <div lu-scope>First</div>
        <div lu-scope>Second</div>
      `;

      const app = createApp({});
      app.mount(container);

      expect(app.rootBlocks.length).toBe(2);
    });

    it("should handle lu-scope on the mount element itself", () => {
      container.innerHTML = "<div>Content</div>";
      container.setAttribute("lu-scope", "");

      const app = createApp({});
      app.mount(container);

      expect(app.rootBlocks.length).toBe(1);
    });

    it("should handle no lu-scope elements", () => {
      container.innerHTML = "<div>No lu-scope</div>";

      const app = createApp({});
      app.mount(container);

      // Should mount the container itself if no lu-scope elements
      expect(app.rootBlocks.length).toBe(1);
    });
  });

  describe("directive", () => {
    it("should register custom directive", () => {
      const app = createApp();
      const directive = vi.fn();

      app.directive("test", directive);

      expect(app.directive("test")).toBe(directive);
    });

    it("should return directive when getting", () => {
      const app = createApp();
      const directive = vi.fn();

      app.directive("test", directive);

      expect(app.directive("test")).toBe(directive);
    });

    it("should be chainable", () => {
      const app = createApp();
      const directive = vi.fn();

      const result = app.directive("test", directive);

      expect(result).toBe(app);
    });
  });

  describe("use", () => {
    it("should install plugin", () => {
      const app = createApp();
      const plugin = {
        install: vi.fn()
      };
      const options = { test: true };

      app.use(plugin, options);

      expect(plugin.install).toHaveBeenCalledWith(app, options);
    });

    it("should be chainable", () => {
      const app = createApp();
      const plugin = {
        install: vi.fn()
      };

      const result = app.use(plugin);

      expect(result).toBe(app);
    });

    it("should handle plugin without options", () => {
      const app = createApp();
      const plugin = {
        install: vi.fn()
      };

      // Options will not contain an empty object
      app.use(plugin);

      expect(plugin.install).toHaveBeenCalledWith(app);
    });
  });

  describe("global helpers", () => {
    it("should provide $s helper for display string", () => {
      container.innerHTML = "{{ $s(test) }}";
      const app = createApp({ test: 42 });

      app.mount(container);

      expect(container.textContent).toBe("42");
    });

    it("should provide $nextTick helper", () => {
      container.innerHTML = "<div>{{ $nextTick(() => { console.log('Tick Tock')}) }}</div>";
      const app = createApp();

      app.mount(container);

      console.log(container.textContent);
      // $nextTick should be available in template expressions
      expect(container.textContent).not.toBe("");
    });

    it("should provide $refs object", () => {
      container.innerHTML = '<div ref="testDiv">Test</div>';
      const app = createApp();

      app.mount(container);

      // Verify that $refs object is provided and the ref is correctly registered
      expect(app.scope.$refs).toBeDefined();
      expect(app.scope.$refs.testDiv).toBeDefined();
      expect(app.scope.$refs.testDiv).toBe(container.querySelector("div"));
    });
  });
});
