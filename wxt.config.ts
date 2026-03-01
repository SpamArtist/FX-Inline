import tailwindcss from "@tailwindcss/vite";
import path from "path";
import vitePluginSvgr from "vite-plugin-svgr";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["activeTab", "storage", "alarms"],
    host_permissions: ["https://open.er-api.com/*"],
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
        "@": path.resolve(__dirname, "./"), // or "./src" if using src directory
      },
    },
  }),
});
