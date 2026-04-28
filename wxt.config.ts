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

function getAssetSource(source: string | Uint8Array) {
  return typeof source === "string" ? source : new TextDecoder().decode(source);
}

function assertWelcomeBundleHasNoRedundantPreloads() {
  return {
    name: "assert-welcome-bundle-has-no-redundant-preloads",
    apply: "build" as const,
    enforce: "post" as const,
    generateBundle(_options: OutputOptions, bundle: OutputBundle) {
      const welcomeHtml = bundle["welcome.html"];

      if (!welcomeHtml || welcomeHtml.type !== "asset") {
        return;
      }

      const welcomeHtmlSource = getAssetSource(welcomeHtml.source);
      const modulePreloadReferences =
        welcomeHtmlSource.match(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/g) ?? [];
      const browserChunkReferences =
        welcomeHtmlSource.match(/\/chunks\/browser-[^"']+\.js/g) ?? [];
      const browserChunks = Object.values(bundle)
        .filter((output) => output.type === "chunk")
        .filter((output) => /^chunks\/browser-[\w-]+\.js$/.test(output.fileName));

      if (modulePreloadReferences.length > 0) {
        throw new Error(
          `welcome.html must not emit modulepreload references: ${modulePreloadReferences.join(", ")}`,
        );
      }

      if (browserChunkReferences.length > 0) {
        throw new Error(
          `welcome.html must not reference browser shim chunks: ${browserChunkReferences.join(", ")}`,
        );
      }

      if (browserChunks.length > 0) {
        throw new Error(
          `Unexpected browser shim chunks were emitted: ${browserChunks
            .map((output) => output.fileName)
            .join(", ")}`,
        );
      }
    },
  };
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "apps/extension",
  publicDir: "apps/extension/public",
  modules: ["@wxt-dev/module-react"],
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
      assertWelcomeBundleHasNoRedundantPreloads(),
    ],
    build: {
      modulePreload: false,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./apps/extension"),
      },
    },
  }),
});
