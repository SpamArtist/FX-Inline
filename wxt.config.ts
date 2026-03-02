import tailwindcss from "@tailwindcss/vite";
import path from "path";
import vitePluginSvgr from "vite-plugin-svgr";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "apps/extension",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["activeTab", "storage", "alarms", "tabs"],
    host_permissions: [
      "http://127.0.0.1:8787/*",
      "http://localhost:8787/*",
      "https://open.er-api.com/*",
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src 'self' http://127.0.0.1:8787 http://localhost:8787 https://open.er-api.com http://127.0.0.1:3000 http://localhost:3000 ws://127.0.0.1:3000 ws://localhost:3000",
    },
    // content_scripts: [
    //   {
    //     css: ['./assets/tailwind.css'],
    //     matches: ['<all_urls>']
    //   },
    // ],
  },
  vite: () => ({
    plugins: [
      tailwindcss({
        optimize: {
          minify: true,
        },
      }),
      vitePluginSvgr({
        svgrOptions: {
          // svgr options
          exportType: "default",
          ref: true,
          svgo: false,
          titleProp: true,
        },
        include: "**/*.svg",
      }),
    ],
    resolve: {
      alias: {
        "@/packages": path.resolve(__dirname, "./packages"),
        "@": path.resolve(__dirname, "./apps/extension"),
      },
    },
  }),
});
