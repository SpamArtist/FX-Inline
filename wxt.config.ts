import path from "path";
import type {
  GetManualChunk,
  OutputBundle,
  OutputOptions,
  PreRenderedChunk,
} from "rollup";
import vitePluginSvgr from "vite-plugin-svgr";
import { defineConfig, type Entrypoint, type WxtViteConfig } from "wxt";
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

const extensionManualChunks: GetManualChunk = (moduleId) => {
  const normalizedModuleId = moduleId.split(path.sep).join("/");

  if (
    normalizedModuleId.includes("/node_modules/react/") ||
    normalizedModuleId.includes("/node_modules/react-dom/")
  ) {
    return "react-vendor";
  }

  if (
    normalizedModuleId.includes("/node_modules/webextension-polyfill/") ||
    normalizedModuleId.includes("/node_modules/wxt/browser")
  ) {
    return "browser-runtime";
  }

  if (
    normalizedModuleId.includes("/node_modules/@wxt-dev/storage/") ||
    normalizedModuleId.endsWith("/apps/extension/utils/appStorage.ts") ||
    normalizedModuleId.endsWith("/apps/extension/utils/inlineRuntimeSettings.ts")
  ) {
    return "extension-storage";
  }

  if (
    normalizedModuleId.endsWith("/apps/extension/assets/currency.json") ||
    normalizedModuleId.endsWith("/apps/extension/utils/enums.ts")
  ) {
    return "currency-catalog";
  }

  return undefined;
};

function extensionChunkFileNames(chunkInfo: PreRenderedChunk) {
  const chunkName =
    chunkInfo.name === "browser" ? "browser-runtime" : chunkInfo.name;

  return `chunks/${chunkName}-[hash].js`;
}

function isExtensionPageEntrypoint(entrypoint: Entrypoint) {
  return [
    "bookmarks",
    "devtools",
    "history",
    "newtab",
    "options",
    "popup",
    "sandbox",
    "sidepanel",
    "unlisted-page",
  ].includes(entrypoint.type);
}

function applyExtensionPageBuildConfig(
  entrypoints: readonly Entrypoint[],
  viteConfig: WxtViteConfig,
) {
  if (!entrypoints.some(isExtensionPageEntrypoint)) return;

  viteConfig.build ??= {};
  viteConfig.build.modulePreload = {
    polyfill: false,
  };
  viteConfig.build.rollupOptions ??= {};

  const existingOutput = viteConfig.build.rollupOptions.output;

  if (Array.isArray(existingOutput)) {
    for (const output of existingOutput) {
      output.manualChunks = extensionManualChunks;
      output.chunkFileNames = extensionChunkFileNames;
    }

    return;
  }

  viteConfig.build.rollupOptions.output = {
    ...(existingOutput ?? {}),
    chunkFileNames: extensionChunkFileNames,
    manualChunks: extensionManualChunks,
  };
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "apps/extension",
  publicDir: "apps/extension/public",
  modules: ["@wxt-dev/module-react"],
  hooks: {
    "vite:build:extendConfig": applyExtensionPageBuildConfig,
  },
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
        default_title: "FX Inline",
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
      web_accessible_resources: [
        {
          resources: ["content-worker.js", "chunks/*.js"],
          matches: ["<all_urls>"],
          use_dynamic_url: true,
        },
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
