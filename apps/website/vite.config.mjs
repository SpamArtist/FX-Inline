import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: currentDirectory,
  build: {
    outDir: path.resolve(currentDirectory, "../../dist/website"),
    emptyOutDir: true,
  },
});
