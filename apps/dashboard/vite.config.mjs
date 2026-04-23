import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
