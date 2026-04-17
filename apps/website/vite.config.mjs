import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: currentDirectory,
  server: {
    fs: {
      allow: [path.resolve(currentDirectory, "../../")],
    },
  },
  build: {
    outDir: path.resolve(currentDirectory, "../../dist/website"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(currentDirectory, "index.html"),
        playground: path.resolve(currentDirectory, "playground.html"),
      },
    },
  },
});
