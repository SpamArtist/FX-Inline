import path from "path";
import type {
  GetManualChunk,
  OutputBundle,
  OutputOptions,
  PreRenderedChunk,
} from "rollup";
import preact from "@preact/preset-vite";
import vitePluginSvgr from "vite-plugin-svgr";
import { defineConfig, type Entrypoint, type WxtViteConfig } from "wxt";
import type { Plugin } from "vite";

export const EXTENSION_DEV_OPTIMIZE_DEPS_EXCLUDE = [
  "@prefresh/core",
  "@prefresh/utils",
  "preact",
  "preact/compat",
  "preact/debug",
  "preact/devtools",
  "preact/hooks",
  "preact/jsx-dev-runtime",
  "preact/jsx-runtime",
];

type OptimizeDepsListConfig = {
  exclude?: string[];
  include?: string[];
};

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

function normalizeBundleModuleId(id: string): string {
  return id.split(path.win32.sep).join(path.posix.sep);
}

export function getFxInlineManualChunk(id: string): string | undefined {
  const moduleId = normalizeBundleModuleId(id);

  if (moduleId.includes("/node_modules/")) {
    if (
      moduleId.includes("/node_modules/preact/") ||
      moduleId.includes("/node_modules/@preact/")
    ) {
      return "vendor-preact";
    }

    if (
      moduleId.includes("/node_modules/@wxt-dev/storage/") ||
      moduleId.includes("/node_modules/async-mutex/") ||
      moduleId.includes("/node_modules/dequal/") ||
      moduleId.includes("/node_modules/wxt/dist/utils/storage.")
    ) {
      return "vendor-storage";
    }

    return undefined;
  }

  if (
    moduleId.includes("/apps/extension/assets/currency.json") ||
    moduleId.includes("/apps/extension/utils/enums.ts") ||
    moduleId.includes("/apps/extension/utils/constants.ts")
  ) {
    return "app-data";
  }

  if (
    moduleId.includes("/apps/extension/generated/inlineRuntimeSettingsManifest.ts") ||
    moduleId.includes("/apps/extension/utils/appStorage.ts") ||
    moduleId.includes("/apps/extension/utils/inlineRuntimeSettings.ts")
  ) {
    return "app-state";
  }

  return undefined;
}

const extensionManualChunks: GetManualChunk = (moduleId) => {
  const normalizedModuleId = moduleId.split(path.sep).join("/");

  if (
    normalizedModuleId.includes("/node_modules/preact/") ||
    normalizedModuleId.includes("/node_modules/@preact/")
  ) {
    return "vendor-preact";
  }

  if (
    normalizedModuleId.includes("/node_modules/@wxt-dev/browser/") ||
    normalizedModuleId.includes("/node_modules/webextension-polyfill/") ||
    normalizedModuleId.includes("/node_modules/wxt/browser") ||
    normalizedModuleId.includes("/node_modules/wxt/dist/browser")
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

export function removeExtensionDevOptimizedDeps(
  optimizeDeps: OptimizeDepsListConfig,
) {
  const excludedDeps = new Set(EXTENSION_DEV_OPTIMIZE_DEPS_EXCLUDE);

  optimizeDeps.exclude = Array.from(
    new Set([...(optimizeDeps.exclude ?? []), ...excludedDeps]),
  );
  optimizeDeps.include = (optimizeDeps.include ?? []).filter(
    (dep) => !excludedDeps.has(dep),
  );
}

export function extensionDevDependencyOptimizerGuard(): Plugin {
  return {
    name: "fx-inline:extension-dev-dependency-optimizer-guard",
    apply: "serve",
    enforce: "post",
    configResolved(config) {
      removeExtensionDevOptimizedDeps(config.optimizeDeps);
    },
  };
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
          resources: ["content-worker.js", "chunks/*.js", "theme.css"],
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
      preact(),
      extensionDevDependencyOptimizerGuard(),
      vitePluginSvgr({
        svgrOptions: {
          exportType: "default",
          jsxRuntime: "classic-preact",
          ref: false,
          svgo: false,
          titleProp: true,
        },
        esbuildOptions: {
          jsxFactory: "h",
          jsxFragment: "Fragment",
        },
        include: "**/*.svg?component",
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
