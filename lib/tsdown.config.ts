import { defineConfig } from "tsdown";

export default defineConfig([
  {
    deps: {
      alwaysBundle: [/^@lune-js\//],
      onlyBundle: [],
      neverBundle: []
    },
    dts: { oxc: true },
    format: ["cjs", "esm"],
    target: "esnext"
  },
  {
    entry: "src/browser.ts",
    deps: {
      alwaysBundle: [/^@lune-js\//],
      onlyBundle: [],
      neverBundle: []
    },
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
