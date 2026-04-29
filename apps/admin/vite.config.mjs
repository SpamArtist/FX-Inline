import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import path from "path";
import { fileURLToPath } from "url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: currentDirectory,
  plugins: [preact()],
  server: {
    port: 3306,
    strictPort: false,
    fs: {
      allow: [path.resolve(currentDirectory, "../../")],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3307",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(currentDirectory, "../../dist/admin"),
    emptyOutDir: true,
  },
});
