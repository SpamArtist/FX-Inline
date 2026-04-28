import path from "path";
import type { OutputBundle, OutputOptions } from "rollup";
import vitePluginSvgr from "vite-plugin-svgr";
import { defineConfig } from "wxt";
import { resolveReleaseTag } from "./scripts/release/versioning.mjs";

const releaseTag = process.env.RELEASE_TAG?.trim();
const releaseManifestOverrides = releaseTag
  ? (() => {
    const release = resolveReleaseTag(releaseTag);
    return {
      version: release.manifestVersion,
      version_name: release.displayVersion,
    };
  })()
  : null;

const EXTENSION_NAME = "FX Inline";

function hardenFirefoxInnerHtmlAssignments() {
  return {
    name: "harden-firefox-innerhtml-assignments",
    apply: "build" as const,
    enforce: "post" as const,
    generateBundle(_options: OutputOptions, bundle: OutputBundle) {
      const scriptTemplatePattern =
        /\b([\w$]+)=([\w$]+)\.createElement\("div"\),\1\.innerHTML="<script><\\\/script>",\1=\1\.removeChild\(\1\.firstChild\)/g;
      const dynamicInnerHtmlPattern =
        /\.innerHTML=([\w$]+)\}\}break;case"(multiple|children)"/g;

      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;

        const patchedCode = output.code
          .replace(scriptTemplatePattern, '$1=$2.createElement("script")')
          .replace(
            dynamicInnerHtmlPattern,
            '.textContent=$1}}break;case"$2"',
          );

        if (patchedCode !== output.code) {
          output.code = patchedCode;
        }
      }
    },
  };
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "apps/extension",
  publicDir: "apps/extension/public",
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser, mode }) => {
    const productionConnectSrc =
      "'self' https://open.er-api.com https://api.exchangerate-api.com";
    const devOnlyConnectSrc =
      " http://127.0.0.1:3000 http://localhost:3000 ws://127.0.0.1:3000 ws://localhost:3000";
    const connectSrc =
      mode === "development"
        ? productionConnectSrc + devOnlyConnectSrc
        : productionConnectSrc;
    const firefoxManifestFields =
      browser === "firefox"
        ? {
          browser_specific_settings: {
            gecko: {
              id: "fx-inline@xbotpc",
              // @ts-ignore - WXT doesn't support this field yet
              data_collection_permissions: {
                required: ["none"],
              },
            },
          },
        }
        : {};

    return {
      ...(releaseManifestOverrides ?? {}),
      icons: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "128": "icon/128.png",
      },
      action: {
        default_title: EXTENSION_NAME,
        default_icon: {
          "16": "icon/16.png",
          "32": "icon/32.png",
          "48": "icon/48.png",
        },
      },
      permissions: ["storage", "alarms", "activeTab"],
      host_permissions: [
        "https://open.er-api.com/*",
        "https://api.exchangerate-api.com/*",
      ],
      content_security_policy: {
        extension_pages: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; connect-src ${connectSrc}`,
      },
      ...firefoxManifestFields,
    };
  },
  vite: () => ({
    plugins: [
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
      hardenFirefoxInnerHtmlAssignments(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./apps/extension"),
      },
    },
  }),
});
