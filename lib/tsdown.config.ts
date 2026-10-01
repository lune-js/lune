import { defineConfig, type UserConfig } from "tsdown";

const sharedConfig: Pick<UserConfig, "define" | "deps"> = {
  /**
   * Quick fix for tsdown not convert "import.meta" for non-esm output.
   * When tsdown resolves the issue, this can be removed.
   *
   * @see https://github.com/rolldown/tsdown/issues/370
   */
  define: {
    "import.meta.env.DEV": "undefined"
  },
  deps: {
    alwaysBundle: [/^@lune-js\//],
    onlyBundle: [],
    neverBundle: []
  }
};

export default defineConfig([
  {
    ...sharedConfig,
    dts: { oxc: true },
    format: ["cjs", "esm"],
    target: "esnext"
  },
  {
    ...sharedConfig,
    entry: "src/browser.ts",
    format: ["iife", "umd"],
    minify: true,
    outputOptions: {
      name: "Lune"
    },
    platform: "browser",
    sourcemap: true,
    target: "es2022"
  }
]);
