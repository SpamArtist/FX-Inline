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

const CHUNKABLE_PAGE_ENTRYPOINT_TYPES = new Set([
  "bookmarks",
  "devtools",
  "history",
  "newtab",
  "options",
  "popup",
  "sandbox",
  "sidepanel",
  "unlisted-page",
]);

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
      moduleId.includes("/node_modules/react/") ||
      moduleId.includes("/node_modules/react-dom/") ||
      moduleId.includes("/node_modules/scheduler/") ||
      moduleId.includes("/node_modules/lucide-react/") ||
      moduleId.includes("/node_modules/@radix-ui/react-")
    ) {
      return "vendor-react";
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

function withFxInlineManualChunks(
  output: OutputOptions | OutputOptions[] | undefined,
): OutputOptions {
  const outputOptions = Array.isArray(output) ? output[0] : output;

  return {
    ...(outputOptions ?? {}),
    manualChunks: getFxInlineManualChunk,
  };
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "apps/extension",
  publicDir: "apps/extension/public",
  modules: ["@wxt-dev/module-react"],
  hooks: {
    "vite:build:extendConfig": (entrypoints, viteConfig) => {
      const buildsChunkablePage = entrypoints.some((entrypoint) =>
        CHUNKABLE_PAGE_ENTRYPOINT_TYPES.has(entrypoint.type),
      );
      if (!buildsChunkablePage) return;

      viteConfig.build ??= {};
      viteConfig.build.rollupOptions ??= {};
      viteConfig.build.rollupOptions.output = withFxInlineManualChunks(
        viteConfig.build.rollupOptions.output,
      );
    },
  },
  manifest: ({ mode }) => {
    const productionConnectSrc =
      "'self' https://open.er-api.com https://api.exchangerate-api.com";
    const devOnlyConnectSrc =
      " http://127.0.0.1:3000 http://localhost:3000 ws://127.0.0.1:3000 ws://localhost:3000";
    const connectSrc =
      mode === "development"
        ? productionConnectSrc + devOnlyConnectSrc
        : productionConnectSrc;

    return {
      ...(releaseManifestOverrides ?? {}),
      icons: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "96": "icon/96.png",
        "128": "icon/128.png",
      },
      action: {
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
      browser_specific_settings: {
        gecko: {
          id: "fx-inline@xbotpc",
          // @ts-ignore - WXT doesn't support this field yet
          data_collection_permissions: {
            required: ["none"],
          },
        },
      },
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
