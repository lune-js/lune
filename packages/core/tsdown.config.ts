import { defineConfig, type UserConfig } from "tsdown";

const deps: UserConfig["deps"] = {
  alwaysBundle: [],
  onlyBundle: [],
  // Adds `@lune-js/utils` as an unbundled dependency to prevent duplicate bundle in `@lune-js/context`.
  neverBundle: [/^@lune-js\//]
};

export default defineConfig([
  {
    deps,
    dts: { generator: "oxc" },
    format: ["esm"],
    target: "esnext"
  },
  {
    /**
     * Quick fix for tsdown not convert "import.meta" for non-esm output.
     * Only the CJS output needs it; the ESM output keeps the real `import.meta.env.DEV`
     * so development warnings survive in the published module.
     * When tsdown resolves the issue, this can be removed.
     *
     * @see https://github.com/rolldown/tsdown/issues/370
     */
    define: {
      "import.meta.env.DEV": "undefined"
    },
    deps,
    dts: { generator: "oxc" },
    format: ["cjs"],
    target: "esnext"
  }
]);
