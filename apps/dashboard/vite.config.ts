import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: currentDirectory,
  server: {
    port: 5174,
    fs: {
      allow: [path.resolve(currentDirectory, "../../")],
    },
  },
  build: {
    outDir: path.resolve(currentDirectory, "../../dist/dashboard"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(currentDirectory, "index.html"),
      },
    },
  },
});
