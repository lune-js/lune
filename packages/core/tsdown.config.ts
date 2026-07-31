import { defineConfig } from "tsdown";

export default defineConfig({
  dts: { oxc: true },
  format: ["cjs", "esm"],
  target: "esnext"
});
