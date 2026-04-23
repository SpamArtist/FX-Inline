import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/global.js"),
      name: "FXInlineRuntime",
      formats: ["iife"],
      fileName: () => "fx-inline-runtime.global.js",
    },
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
