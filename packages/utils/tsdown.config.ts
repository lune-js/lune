import { defineConfig } from "tsdown";

export default defineConfig({
  deps: {
    alwaysBundle: [/^es-toolkit\//],
    onlyBundle: ["es-toolkit"],
    neverBundle: []
  },
  dts: { generator: "oxc" },
  format: ["cjs", "esm"],
  target: "esnext"
});
