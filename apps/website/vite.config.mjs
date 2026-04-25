import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: currentDirectory,
  server: {
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
      interval: 150,
    },
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
        b2bDemo: path.resolve(currentDirectory, "b2b-demo.html"),
        "b2b/index": path.resolve(currentDirectory, "b2b/index.html"),
        "b2b-runtime/index": path.resolve(currentDirectory, "b2b-runtime/index.html"),
        "public-b2b/index": path.resolve(currentDirectory, "public-b2b/index.html"),
        b2bLoaderV1: path.resolve(currentDirectory, "b2b/loader.v1.js"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "b2bLoaderV1") {
            return "b2b/loader.v1.js";
          }
          return "assets/[name].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
